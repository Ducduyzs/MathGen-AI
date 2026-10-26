"""Chia train/val/test cho hai hướng và viết báo cáo dữ liệu.

PHÂN LOẠI → data/splits/classify/
  train.jsonl            nhãn exact/source/weak (nhãn yếu chỉ dùng để train)
  val.jsonl, test.jsonl  CHỈ nhãn exact/source — không chấm điểm trên nhãn đoán
  test_unseen_templates  các dạng bài tổng hợp bị giữ lại hoàn toàn khỏi train → đo khả năng tổng quát hóa
  to_label_vi.jsonl      đề thật tiếng Việt chưa có nhãn chuẩn → giáo viên gắn nhãn làm bộ test thật
SINH → data/splits/generate/
  train/val/test.jsonl   cặp đã kiểm chứng (hoặc từ nguồn tin cậy), có sẵn trường `messages` để SFT
  negatives.jsonl        biến thể bị bộ kiểm chứng loại → dùng cho DPO / huấn luyện bộ chấm sau này

Không rò rỉ: chia theo nhóm (khóa chuẩn của đề; với cặp là khóa của đề gốc), không chia theo dòng.

    python scripts/build_splits.py [--include-flagged] [--cap-per-source 40000] [--cap-pairs-metamath 60000]
"""

import argparse
import hashlib
import json
import random
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UNI = ROOT / "data" / "unified"
RELIABLE = {"exact", "source"}

SYSTEM_VI = "Bạn là trợ lý soạn đề Toán. Chỉ trả về JSON hợp lệ, không giải thích thêm."
SYSTEM_EN = "You are a math problem author. Reply with valid JSON only."
FORMAT_VI = {"original": "tự luận", "choice": "trắc nghiệm 4 phương án", "short": "trả lời ngắn (một đáp số)"}
TARGET_VI = {"easier": "dễ hơn", "same": "tương đương", "harder": "khó hơn"}
REL_EN = {
    "rephrase": "Rewrite the problem with different wording; keep the same mathematics and answer.",
    "backward_sv": "Create a backward version: hide one given quantity as an unknown and give the original answer instead.",
    "backward_fobar": "Create a backward version: replace one given number with an unknown X and state the original answer.",
}


def bucket(key: str, salt: str = "") -> int:
    return int(hashlib.md5((salt + key).encode()).hexdigest()[:8], 16) % 1000


def read(path: Path):
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            yield json.loads(line)


def write(path: Path, rows) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with path.open("w", encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
            n += 1
    return n


def reliable(r: dict) -> bool:
    return any(v in RELIABLE for v in r["label_src"].values() if v)


# ---------------------------------------------------------------- phân loại

def build_classify(args, out_dir: Path, report: list[str]) -> None:
    by_source: dict[str, list[dict]] = defaultdict(list)
    real_vi: list[dict] = []
    dropped_test = Counter()
    for r in read(UNI / "problems.jsonl"):
        if r["tier"] == "flagged" and not args.include_flagged:
            continue
        if r["source"] in ("vi_reality", "vnhsge"):
            real_vi.append(r)  # đề thật tiếng Việt: luôn đưa vào file cần gắn nhãn, dù chưa có nhãn
        lab = r["labels"]
        if not (lab["topic"] or lab["grade_band"] or lab["difficulty"] is not None):
            continue  # không có nhãn nào dùng được
        if r.get("split_hint") in ("test", "validation") and not reliable(r):
            # Đề test chính thức của benchmark mà chỉ có nhãn đoán: không chấm được, cũng không đưa vào train
            # (tránh làm bẩn benchmark khi ai đó đánh giá trên GSM8K/AQuA/SVAMP).
            dropped_test[r["source"]] += 1
            continue
        by_source[r["source"]].append(r)

    # Giữ lại ~15% dạng bài tổng hợp hoàn toàn khỏi train
    templates = sorted({r["labels"].get("template") for r in by_source.get("synthetic_vi", []) if r["labels"].get("template")})
    unseen = {t for t in templates if bucket(t, "tpl") < 150}

    rng = random.Random(2026)
    out = defaultdict(list)
    for src, rows in by_source.items():
        rng.shuffle(rows)
        rows = rows[: args.cap_per_source] if src != "synthetic_vi" else rows
        for r in rows:
            if r["labels"].get("template") in unseen:
                out["test_unseen_templates"].append(r)
                continue
            b = bucket(r.get("group") or r["key"])
            hint = r.get("split_hint")
            split = "test" if hint == "test" else "val" if hint == "validation" else "train" if b < 880 else "val" if b < 940 else "test"
            if split != "train" and not reliable(r):
                split = "train"  # nhãn yếu không dùng để chấm
            out[split].append(r)

    # Cân bằng chủ đề trong train: mỗi chủ đề tối đa cap dòng, ưu tiên dòng có nhãn tin cậy.
    per_topic = defaultdict(list)
    rest = []
    for r in out["train"]:
        (per_topic[r["labels"]["topic"]] if r["labels"]["topic"] else rest).append(r)
    balanced = rest
    for topic, rows in per_topic.items():
        rows.sort(key=lambda r: (r["label_src"]["topic"] not in RELIABLE, bucket(r["key"], "cap")))
        balanced += rows[: args.cap_per_topic]
    capped = len(out["train"]) - len(balanced)
    out["train"] = balanced

    # Đề thật tiếng Việt cần giáo viên gắn nhãn (chưa có nhãn chuẩn)
    to_label = [
        {"id": r["id"], "source": r["source"], "tier": r["tier"], "text": r["text"], "choices": r["choices"],
         "suggested": {"topic": r["labels"]["topic"], "grade": r["labels"]["grade"]},
         "label": {"topic": None, "grade": None, "difficulty_level": None, "kind": None}}
        for r in real_vi
    ]

    for name, rows in out.items():
        rng.shuffle(rows)
        write(out_dir / "classify" / f"{name}.jsonl", rows)
    write(out_dir / "classify" / "to_label_vi.jsonl", to_label)

    report.append("## Phân loại (dạng bài / chủ đề, lớp, độ khó)\n")
    report.append(f"Dạng bài tổng hợp giữ lại khỏi train ({len(unseen)}/{len(templates)}): {', '.join(sorted(unseen))}\n")
    report.append(f"Bỏ đề test/validation chính thức chỉ có nhãn đoán (tránh làm bẩn benchmark): "
                  f"{', '.join(f'{k} {v}' for k, v in dropped_test.items()) or 'không'}. "
                  f"Cắt bớt do giới hạn {args.cap_per_topic} dòng/chủ đề: {capped} dòng.\n")
    splits = ["train", "val", "test", "test_unseen_templates"]
    report.append("| Nguồn | " + " | ".join(splits) + " |\n|---|" + "---:|" * len(splits))
    per = {s: Counter(r["source"] for r in out[s]) for s in splits}
    for src in sorted(by_source):
        report.append(f"| {src} | " + " | ".join(str(per[s][src]) for s in splits) + " |")
    report.append("| **Tổng** | " + " | ".join(f"**{len(out[s])}**" for s in splits) + " |\n")

    train = out["train"]
    report.append("Độ phủ nhãn trong train (tỉ lệ dòng có nhãn · nguồn nhãn):\n")
    for field in ("topic", "grade_band", "difficulty"):
        have = [r for r in train if r["labels"][field] is not None]
        srcs = Counter(r["label_src"][field] for r in have)
        report.append(f"- `{field}`: {len(have) / max(1, len(train)):.0%} · " + ", ".join(f"{k} {v}" for k, v in srcs.most_common()))
    report.append("- `grade` (lớp cụ thể): " + f"{sum(r['labels']['grade'] is not None for r in train)} dòng\n")
    topics = Counter(r["labels"]["topic"] for r in train if r["labels"]["topic"])
    report.append("Phân bố chủ đề (train): " + ", ".join(f"{t} {n}" for t, n in topics.most_common()) + "\n")
    report.append(f"Đề thật tiếng Việt cần gắn nhãn: **{len(to_label)}** câu (`to_label_vi.jsonl`).\n")


# ---------------------------------------------------------------- sinh

def to_messages(p: dict) -> list[dict]:
    t = p["target"]
    if p["lang"] == "vi":
        meta = p.get("meta", {})
        if p["relation"].startswith("rule:"):
            ask = (f"Tạo một biến thể của bài toán sau bằng luật biến đổi `{p['relation'][5:]}`, độ khó "
                   f"{TARGET_VI.get(meta.get('target'), 'tương đương')}, hình thức {FORMAT_VI.get(meta.get('format'), 'tự luận')}.")
        else:
            ask = "Tạo một bài toán cùng dạng với bài sau nhưng khác số liệu."
        user = f"{ask}\n\nBài gốc: {p['seed']['text']}\nĐáp án bài gốc: {p['seed'].get('answer')}"
        answer = {"statement": t["text"], "answer": t.get("answer"), "choices": t.get("choices") or None, "solution": t.get("solution")}
        return [{"role": "system", "content": SYSTEM_VI}, {"role": "user", "content": user},
                {"role": "assistant", "content": json.dumps(answer, ensure_ascii=False)}]
    user = f"{REL_EN[p['relation']]}\n\nOriginal problem: {p['seed']['text']}\nOriginal answer: {p['seed'].get('answer')}"
    answer = {"statement": t["text"], "answer": t.get("answer")}
    return [{"role": "system", "content": SYSTEM_EN}, {"role": "user", "content": user},
            {"role": "assistant", "content": json.dumps(answer, ensure_ascii=False)}]


def build_generate(args, out_dir: Path, report: list[str]) -> None:
    rng = random.Random(2026)
    keep, negatives, meta_rows = defaultdict(list), [], []
    for p in read(UNI / "pairs.jsonl"):
        if p["verified"] is False:
            negatives.append(p)
            continue
        if p["source"] == "metamathqa":
            if not p["seed"].get("answer"):
                continue
            meta_rows.append(p)
            continue
        keep[p["source"]].append(p)
    rng.shuffle(meta_rows)
    keep["metamathqa"] = meta_rows[: args.cap_pairs_metamath]

    out = defaultdict(list)
    for src, rows in keep.items():
        for p in rows:
            b = bucket(p["group"], "pair")
            split = "train" if b < 900 else "val" if b < 950 else "test"
            out[split].append({**p, "messages": to_messages(p)})
    for name, rows in out.items():
        rng.shuffle(rows)
        write(out_dir / "generate" / f"{name}.jsonl", rows)
    write(out_dir / "generate" / "negatives.jsonl", negatives)

    report.append("## Sinh biến thể (cặp đề gốc → biến thể)\n")
    report.append("| Nguồn | Quan hệ | train | val | test |\n|---|---|---:|---:|---:|")
    rel = {s: Counter((p["source"], p["relation"].split(":")[0] + (":" if ":" in p["relation"] else "")) for p in out[s]) for s in ("train", "val", "test")}
    for key in sorted(set().union(*[set(c) for c in rel.values()])):
        report.append(f"| {key[0]} | {key[1]} | " + " | ".join(str(rel[s][key]) for s in ("train", "val", "test")) + " |")
    report.append(f"\nVí dụ âm (bị bộ kiểm chứng loại): **{len(negatives)}** cặp (`negatives.jsonl`).\n")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--include-flagged", action="store_true", help="thêm nguồn flagged (chỉ thí nghiệm nội bộ)")
    ap.add_argument("--cap-per-source", type=int, default=40000)
    ap.add_argument("--cap-per-topic", type=int, default=15000)
    ap.add_argument("--cap-pairs-metamath", type=int, default=60000)
    args = ap.parse_args()

    suffix = "_with_flagged" if args.include_flagged else ""
    out_dir = ROOT / "data" / f"splits{suffix}"  # tách thư mục để bản có nguồn flagged không lẫn vào bản sạch
    report = [
        "# Báo cáo dữ liệu huấn luyện\n",
        f"Tạo bởi `scripts/build_splits.py` → `data/splits{suffix}/` · nguồn flagged: **{'có' if args.include_flagged else 'không'}** · "
        f"giới hạn mỗi nguồn: {args.cap_per_source} · mỗi chủ đề (train): {args.cap_per_topic} · cặp MetaMathQA: {args.cap_pairs_metamath}\n",
    ]
    build_classify(args, out_dir, report)
    build_generate(args, out_dir, report)
    (ROOT / f"DATA_REPORT{suffix}.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    print("\n".join(report))


if __name__ == "__main__":
    main()
