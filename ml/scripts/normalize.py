"""Chuẩn hóa mọi nguồn thô về 2 file JSONL dùng chung:

  data/unified/problems.jsonl — một đề / dòng, cho mô hình PHÂN LOẠI
  data/unified/pairs.jsonl    — cặp đề gốc → biến thể, cho mô hình SINH

Mỗi nhãn đi kèm `label_src` cho biết độ tin cậy:
  exact  — đúng theo cách dựng (dữ liệu tổng hợp của dự án)
  source — nhãn gốc của bộ dữ liệu (ví dụ MATH: chủ đề + Level 1–5)
  weak   — đoán bằng từ khóa: chỉ dùng để train, KHÔNG dùng để đánh giá
  heur   — ước lượng theo quy tắc (ví dụ độ khó GSM8K theo số bước tính)

    python scripts/normalize.py                   # mọi nguồn đã tải trong data/raw
"""

import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Iterator


ROOT = Path(__file__).resolve().parents[1]
RAW, OUT = ROOT / "data" / "raw", ROOT / "data" / "unified"

# Hệ chủ đề thống nhất (đa quốc gia). Cấp lớp: primary 1–5, lower_secondary 6–9, upper_secondary 10–12.
TOPICS = [
    "arithmetic", "algebra", "functions", "trigonometry", "calculus", "exp_log", "sequences", "geometry",
    "coordinates", "probability_counting", "statistics", "number_theory", "precalculus", "other",
]

# ---------------------------------------------------------------- nhãn yếu theo từ khóa (ưu tiên từ trên xuống)
WEAK_EN = [
    ("statistics", r"\bmedian\b|\bvariance\b|standard deviation|\bquartile|\bfrequency (table|distribution)|\bhistogram"),
    ("probability_counting", r"probabilit|how many ways|\bpermutations?\b|\bcombinations?\b|\bdice\b|\bcoins?\b.*\bflip|randomly (choose|select|draw)"),
    ("calculus", r"derivative|\\int|\bintegral|\\lim|\blimit\b|\bf'\(|tangent line|monoton|extrem(um|a)\b|antiderivative"),
    ("exp_log", r"\\log|\blog_|logarithm|\bexponential"),
    ("sequences", r"\bsequence\b|arithmetic progression|geometric progression|common difference|common ratio|\ba_\{?n\}?\b"),
    ("trigonometry", r"\\sin|\\cos|\\tan|\bsin\s*x|\bcos\s*x|trigonometr"),
    ("coordinates", r"coordinate (plane|system)|\bxoy\b|\boxyz\b|\bvectors?\b|\\overrightarrow"),
    ("geometry", r"triangle|circle|\bradius\b|polygon|rectangle|perimeter|\barea of|\bvolume\b|pyramid|prism|sphere|\bcone\b|cylinder|\bangle\b"),
    ("number_theory", r"\bprimes?\b|divisib|\bremainder\b|\bgcd\b|\blcm\b|\\pmod|\bdigits?\b"),
    ("functions", r"\bfunction\b|\bf\(x\)|graph of"),
    ("algebra", r"\bsolve\b|equation|inequalit|polynomial|\broots?\b|x\^2|\bfactor"),
]
WEAK_VI = [
    ("statistics", r"trung vị|phương sai|độ lệch chuẩn|tứ phân vị|bảng tần số|mẫu số liệu"),
    ("probability_counting", r"xác suất|bao nhiêu cách|hoán vị|chỉnh hợp|tổ hợp|gieo .*(xúc xắc|đồng xu)"),
    ("calculus", r"đạo hàm|tích phân|nguyên hàm|giới hạn|cực trị|cực đại|cực tiểu|đồng biến|nghịch biến|tiệm cận"),
    ("exp_log", r"logarit|\\log|\blog_|hàm số mũ|phương trình mũ"),
    ("sequences", r"cấp số cộng|cấp số nhân|dãy số|công sai|công bội"),
    ("trigonometry", r"\\sin|\\cos|\\tan|lượng giác|\bsin\b|\bcos\b"),
    ("coordinates", r"oxyz|oxy|tọa độ|vectơ|vecto|mặt phẳng \(|mặt cầu"),
    ("geometry", r"tam giác|hình vuông|hình chữ nhật|đường tròn|hình tròn|bán kính|chu vi|diện tích|thể tích|hình chóp|lăng trụ|hình nón|hình trụ|góc"),
    ("number_theory", r"số nguyên tố|chia hết|số dư|ước chung|bội chung"),
    ("functions", r"hàm số|đồ thị|parabol"),
    ("algebra", r"phương trình|bất phương trình|đa thức|nhân tử|nghiệm|rút gọn biểu thức"),
    ("arithmetic", r"phép (cộng|trừ|nhân|chia)|tính nhẩm|đặt tính|\bsố\?"),
]
MATH_TYPE = {
    "Algebra": "algebra", "Intermediate Algebra": "algebra", "Prealgebra": "arithmetic", "Number Theory": "number_theory",
    "Counting & Probability": "probability_counting", "Geometry": "geometry", "Precalculus": "precalculus",
}


def weak_topic(text: str, lang: str, default: str | None = None) -> str | None:
    low = text.lower()
    for topic, pat in WEAK_VI if lang == "vi" else WEAK_EN:
        if re.search(pat, low):
            return topic
    return default


def norm_key(text: str) -> str:
    """Khóa chống trùng: bỏ $, khoảng trắng, chữ hoa → sha1."""
    t = re.sub(r"[\s$]+", "", text.lower())
    return hashlib.sha1(t.encode("utf-8")).hexdigest()[:16]


def boxed(s: str | None) -> str | None:
    """Lấy nội dung \\boxed{...} cuối cùng (đếm ngoặc lồng nhau)."""
    if not s:
        return None
    i = s.rfind("\\boxed{")
    if i < 0:
        return None
    depth, j = 0, i + len("\\boxed{")
    for k in range(j, len(s)):
        if s[k] == "{":
            depth += 1
        elif s[k] == "}":
            if depth == 0:
                return s[j:k].strip()
            depth -= 1
    return None


def clean(t: str) -> str:
    t = re.sub(r"^\s*(Câu|Bài)\s*\d+\s*[.:)]\s*", "", t.strip())
    return re.sub(r"[ \t]+", " ", re.sub(r"\n\s*\n+", "\n", t)).strip()


def rows(name: str, pattern: str = "*.parquet", columns: list[str] | None = None) -> Iterator[tuple[str, dict]]:
    import pyarrow.parquet as pq  # chỉ cần khi đọc parquet; script train import file này mà không cần pyarrow

    for f in sorted((RAW / name).glob(pattern)):
        split = f.name.split("__")[1] if "__" in f.name else "train"
        for batch in pq.ParquetFile(f).iter_batches(batch_size=20000, columns=columns):
            for r in batch.to_pylist():
                yield split, r


def manifest(name: str) -> dict:
    return json.loads((RAW / name / "manifest.json").read_text(encoding="utf-8"))


def problem(src: dict, pid: str, text: str, *, lang: str, split_hint: str | None = None, answer=None, solution=None,
            choices=None, topic=None, topic_src=None, grade=None, grade_band=None, band_src=None, difficulty=None,
            diff_src=None, qtype="free", style="symbolic", extra=None, group=None) -> dict:
    key = norm_key(text)
    return {
        "id": f"{src['name']}:{pid}", "source": src["name"], "license": src["license"], "tier": src["tier"],
        "lang": lang, "country": src["country"], "text": text, "answer": answer, "solution": solution, "choices": choices,
        "labels": {"topic": topic, "grade": grade, "grade_band": grade_band, "difficulty": difficulty, "qtype": qtype, "style": style, **(extra or {})},
        "label_src": {"topic": topic_src if topic else None, "grade_band": band_src if grade_band else None, "difficulty": diff_src if difficulty is not None else None},
        # key: chống trùng nguyên văn · group: đơn vị chia train/test (các bản trình bày khác nhau của cùng một đề)
        "split_hint": split_hint, "key": key, "group": f"{src['name']}:{group}" if group else key,
    }


# ---------------------------------------------------------------- từng nguồn

def p_gsm8k(m):
    for split, r in rows("gsm8k"):
        steps = r["answer"].count("<<")
        ans = r["answer"].split("####")[-1].strip()
        yield problem(m, f"{split}:{norm_key(r['question'])}", clean(r["question"]), lang="en", split_hint=split, answer=ans,
                      solution=r["answer"], topic=weak_topic(r["question"], "en", "arithmetic"), topic_src="weak",
                      difficulty=round(min(0.5, 0.1 + 0.05 * steps), 2), diff_src="heur", style="word_problem")


def p_numina(m):
    band = {"cn_k12": "school", "olympiads": "competition", "amc_aime": "competition", "aops_forum": "competition",
            "synthetic_amc": "competition", "math": "competition", "gsm8k": "school", "orca_math": "school", "synthetic_math": None}
    for split, r in rows("numina_cot", columns=["source", "problem", "solution"]):
        text = clean(r["problem"])
        yield problem(m, f"{r['source']}:{norm_key(text)}", text, lang="en", answer=boxed(r["solution"]), solution=r["solution"],
                      topic=weak_topic(text, "en"), topic_src="weak", grade_band=band.get(r["source"]), band_src="source",
                      extra={"origin": r["source"]})


def p_aqua(m):
    for split, r in rows("aqua_rat", "raw__*.parquet"):
        text = clean(r["question"])
        yield problem(m, f"{split}:{norm_key(text)}", text, lang="en", split_hint=split, answer=r["correct"], solution=r["rationale"],
                      choices=list(r["options"]), topic=weak_topic(text, "en", "arithmetic"), topic_src="weak", qtype="mcq", style="word_problem")


def p_svamp(m):
    for split, r in rows("svamp"):
        text = clean(r["question_concat"])
        yield problem(m, f"{r['ID']}", text, lang="en", split_hint=split, answer=str(r["Answer"]), solution=r["Equation"],
                      topic="arithmetic", topic_src="source", difficulty=0.15, diff_src="heur", style="word_problem",
                      extra={"svamp_type": r["Type"]})


def p_orca(m):
    for split, r in rows("orca_math"):
        text = clean(r["question"])
        yield problem(m, norm_key(text), text, lang="en", solution=r["answer"], topic=weak_topic(text, "en", "arithmetic"),
                      topic_src="weak", style="word_problem")


def p_vi_reality(m):
    for split, r in rows("vi_reality"):
        text = clean(r["problem"])
        yield problem(m, norm_key(text), text, lang="vi", solution=r["solution"], topic=weak_topic(text, "vi"), topic_src="weak",
                      style="word_problem")


def p_hendrycks(m):
    for split, r in rows("hendrycks_math"):
        level = re.search(r"\d", r["level"] or "")
        lv = int(level.group()) if level else None
        text = clean(r["problem"])
        yield problem(m, f"{split}:{norm_key(text)}", text, lang="en", split_hint=split, answer=boxed(r["solution"]), solution=r["solution"],
                      topic=MATH_TYPE.get(r["type"]), topic_src="source", grade_band="competition", band_src="source",
                      difficulty=round(0.1 + 0.2 * (lv - 1), 2) if lv else None, diff_src="source", extra={"math_level": lv})


def p_vnhsge(m):
    for split, r in rows("vnhsge"):
        if r["category_en"] != "Mathematics":
            continue
        text = clean(r["question"])
        letters = "ABCDEFGH"
        opts = [f"{letters[i]}. {o}" for i, o in enumerate((r["options"] or [])[: len(letters)])]
        ans = letters[int(r["answer"]) - 1] if str(r["answer"]).isdigit() and 1 <= int(r["answer"]) <= len(opts) else r["answer"]
        yield problem(m, f"{r['file_name']}:{norm_key(text)}", text, lang="vi", answer=ans, choices=opts, topic=weak_topic(text, "vi"),
                      topic_src="weak", grade=12, grade_band="upper_secondary", band_src="source", qtype="mcq",
                      extra={"exam": r["file_name"]})


def p_vi_mcq(m):
    for split, r in rows("vi_mcq_grade1_5"):
        g = int(r["grade"]) if str(r["grade"]).isdigit() else None
        for i, p in enumerate(r["problems"] or []):
            text = clean(p.get("question") or "")
            if not text:
                continue
            ans = re.search(r"Đáp án đúng là:\s*([A-D])", p.get("explanation") or "")
            yield problem(m, f"{r['id']}:{i}", text, lang="vi", answer=ans.group(1) if ans else None, solution=p.get("explanation"),
                          choices=p.get("choices"), topic=weak_topic(text, "vi", "arithmetic"), topic_src="weak", grade=g,
                          grade_band="primary", band_src="source", qtype="mcq")


def p_vi_crawl(m):
    for split, r in rows("vi_crawl"):
        g = re.search(r"[Tt]oán\s*(\d{1,2})", r["title"] or "")
        grade = int(g.group(1)) if g else None
        bandv = None if grade is None else "primary" if grade <= 5 else "lower_secondary" if grade <= 9 else "upper_secondary"
        for ci, content in enumerate(r["contents"] or []):
            # Tách từng bài: "1. … Hướng dẫn: …"
            for bi, part in enumerate(re.split(r"\n(?=\d{1,2}\.\s)", content or "")):
                q = re.split(r"\n\s*(Hướng dẫn|Lời giải|Giải|Trả lời)\s*:?", part)[0]
                text = clean(re.sub(r"^\d{1,2}\.\s*", "", q))
                if len(text) < 15:
                    continue
                yield problem(m, f"{r['id']}:{ci}:{bi}", text, lang="vi", topic=weak_topic(text, "vi"), topic_src="weak",
                              grade=grade, grade_band=bandv, band_src="source")


def p_synthetic(m):
    with (RAW / "synthetic_vi" / "problems.jsonl").open(encoding="utf-8") as fh:
        for line in fh:
            r = json.loads(line)
            lab = r["labels"]
            yield problem(m, r["id"].split(":", 1)[1], r["text"], lang="vi", answer=r["answer"], solution=r["solution"],
                          choices=r["choices"], topic=lab["topic"], topic_src="exact", grade=lab["grade"], grade_band=lab["grade_band"],
                          band_src="exact", difficulty=lab["difficulty"], diff_src="exact", qtype=lab["qtype"],
                          extra={"skill": lab["skill"], "kind": lab["kind"], "template": lab["template"], "part": lab["part"], "render": r["render"]},
                          group=r.get("group"))


PROBLEM_READERS = {
    "synthetic_vi": p_synthetic, "gsm8k": p_gsm8k, "numina_cot": p_numina, "aqua_rat": p_aqua, "svamp": p_svamp,
    "orca_math": p_orca, "vi_reality": p_vi_reality, "hendrycks_math": p_hendrycks, "vnhsge": p_vnhsge,
    "vi_mcq_grade1_5": p_vi_mcq, "vi_crawl": p_vi_crawl,
}

# ---------------------------------------------------------------- cặp cho mô hình sinh

ANSWER_RE = re.compile(r"The answer is:?\s*(.+?)\s*$", re.S)
META_REL = {"Rephrased": "rephrase", "SV": "backward_sv", "FOBAR": "backward_fobar"}


def pairs_metamath(m):
    # Đáp án của đề gốc lấy từ các dòng *_AnsAug (cùng original_question).
    answers: dict[str, str] = {}
    for _, r in rows("metamathqa", columns=["type", "original_question", "response"]):
        if r["type"].endswith("AnsAug"):
            a = ANSWER_RE.search(r["response"] or "")
            if a:
                answers.setdefault(r["original_question"], a.group(1).strip())
    for _, r in rows("metamathqa"):
        origin, kind = r["type"].split("_", 1)
        rel = META_REL.get(kind)
        if not rel:
            continue
        a = ANSWER_RE.search(r["response"] or "")
        yield {
            "id": f"metamathqa:{norm_key(r['query'])}", "source": "metamathqa", "license": m["license"], "tier": m["tier"], "lang": "en",
            "relation": rel, "seed": {"text": clean(r["original_question"]), "answer": answers.get(r["original_question"])},
            "target": {"text": clean(r["query"]), "answer": a.group(1).strip() if a else None, "solution": r["response"]},
            "verified": None, "meta": {"origin": origin}, "group": norm_key(r["original_question"]),
        }


def pairs_synthetic(m):
    with (RAW / "synthetic_vi" / "pairs.jsonl").open(encoding="utf-8") as fh:
        for line in fh:
            r = json.loads(line)
            yield {"id": r["id"], "source": "synthetic_vi", "license": m["license"], "tier": m["tier"], "lang": "vi",
                   "relation": r["relation"], "seed": r["seed"], "target": r["target"], "verified": r["verified"],
                   "failed_checks": r.get("failed_checks", []), "meta": r.get("meta", {}), "group": norm_key(r["seed"]["text"])}


PAIR_READERS = {"metamathqa": pairs_metamath, "synthetic_vi": pairs_synthetic}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    available = {p.name for p in RAW.iterdir() if (p / "manifest.json").exists()}
    stats = Counter()

    seen: set[str] = set()
    with (OUT / "problems.jsonl").open("w", encoding="utf-8") as fh:
        for name, reader in PROBLEM_READERS.items():
            if name not in available:
                continue
            m = manifest(name)
            n = dup = 0
            for rec in reader(m):
                if rec["key"] in seen:  # trùng nguyên văn giữa các nguồn: giữ bản đầu (nguồn ưu tiên đứng trước)
                    dup += 1
                    continue
                seen.add(rec["key"])
                fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
                n += 1
            stats[f"problems:{name}"] = n
            print(f"problems  {name:<16} {n:>8} dòng  (bỏ {dup} trùng)")

    with (OUT / "pairs.jsonl").open("w", encoding="utf-8") as fh:
        for name, reader in PAIR_READERS.items():
            if name not in available:
                continue
            n = 0
            for rec in reader(manifest(name)):
                fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
                n += 1
            print(f"pairs     {name:<16} {n:>8} cặp")


if __name__ == "__main__":
    sys.exit(main())
