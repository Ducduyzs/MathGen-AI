"""Gắn nhãn đề thật tiếng Việt (to_label_vi.jsonl) bằng 3 LLM độc lập, rồi lấy theo đa số.

Mỗi mô hình gắn nhãn riêng như 3 người gắn nhãn: GPT, DeepSeek, Gemini (cùng một hướng dẫn, không thấy nhãn của nhau).
- Kết quả thô của từng mô hình lưu ở labels/raw/<mô hình>.jsonl. Chạy lại chỉ gọi API cho câu còn thiếu.
- labels/vi_reality_llm.jsonl: nhãn gộp + phiếu của từng mô hình + cờ `needs_review` cho câu bất đồng.
- labels/REPORT.md: mức đồng thuận giữa các mô hình (đồng ý từng cặp, Fleiss' kappa).

Nhãn này có `label_src = "llm"`: dùng để train được, nhưng **chỉ chấm điểm** trên câu cả 3 mô hình đồng ý
hoặc đã được giáo viên duyệt (xem README, mục "Gắn nhãn bằng LLM").

    python scripts/llm_label.py                 # gắn nhãn + gộp
    python scripts/llm_label.py --only gpt      # chỉ chạy một mô hình
    python scripts/llm_label.py --aggregate     # chỉ gộp lại từ kết quả đã có

Khóa API đọc từ ml/.env (OPENAI_API_KEY, DEEPSEEK_API_KEY, GEMINI_API_KEY). Không commit file đó.
"""

import argparse
import json
import os
import re
import statistics
import sys
import threading
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "splits" / "classify" / "to_label_vi.jsonl"
OUT_DIR = ROOT / "labels"
RAW_DIR = OUT_DIR / "raw"

TOPICS = [
    "arithmetic", "algebra", "functions", "trigonometry", "calculus", "exp_log", "sequences", "geometry",
    "coordinates", "probability_counting", "statistics", "number_theory", "precalculus", "other",
]
KINDS = [
    "linear_equation", "quadratic_equation", "linear_inequality", "quadratic_inequality", "factorization",
    "vertex", "min_value", "function_value", "quadratic_param",
]

PROVIDERS = {
    "gpt": {"url": "https://api.openai.com/v1/chat/completions", "key": "OPENAI_API_KEY", "model": "gpt-5.2",
            "extra": {"reasoning_effort": "low"}},
    "deepseek": {"url": "https://api.deepseek.com/chat/completions", "key": "DEEPSEEK_API_KEY", "model": "deepseek-v4-pro",
                 "extra": {}},
    "gemini": {"url": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", "key": "GEMINI_API_KEY",
               "model": "gemini-3-flash-preview", "extra": {}},  # gói miễn phí: 2.5-flash, 3.5-flash hết hạn mức trong ngày; flash-latest hay báo 503
}
BATCH = 10
WORKERS = 4

SYSTEM = f"""Bạn là giáo viên Toán THCS/THPT ở Việt Nam, gắn nhãn đề theo Chương trình GDPT 2018.
Với MỖI đề, xác định 4 nhãn:

1. topic: kiến thức CHÍNH cần dùng để giải, chọn đúng một giá trị:
   - arithmetic: số học, tỉ số, phần trăm, đơn vị đo; giải được bằng phép tính, không cần đặt ẩn
   - algebra: biểu thức đại số, đa thức, phương trình, hệ phương trình, bất phương trình; bài lời văn phải đặt ẩn, lập phương trình/hệ
   - functions: hàm số và đồ thị (bậc nhất, bậc hai, y = ax²), đọc/lập công thức hàm số
   - trigonometry: tỉ số lượng giác, hệ thức lượng trong tam giác vuông dùng sin/cos/tan, hàm lượng giác
   - calculus: giới hạn, đạo hàm, ứng dụng đạo hàm, nguyên hàm, tích phân
   - exp_log: lũy thừa với số mũ thực, mũ, logarit
   - sequences: dãy số, cấp số cộng, cấp số nhân
   - geometry: hình học phẳng và không gian không dùng tọa độ (tam giác, đường tròn, diện tích, thể tích, Pythagore, đồng dạng)
   - coordinates: tọa độ trong mặt phẳng Oxy hoặc không gian Oxyz, vectơ
   - probability_counting: đếm, hoán vị, tổ hợp, xác suất
   - statistics: thu thập, biểu diễn, phân tích số liệu (bảng, biểu đồ, số trung bình, trung vị, phương sai)
   - number_theory: chia hết, số nguyên tố, ƯCLN, BCNN, số dư, chữ số
   - precalculus: số phức, ma trận, đa thức nâng cao, vượt chương trình phổ thông
   - other: không thuộc các loại trên
2. grade: lớp 6–12 mà bài này thường được dạy (số nguyên). Bài kiến thức tiểu học thì ghi 6.
3. difficulty_level: mức độ theo Bộ GD&ĐT: 1 = Nhận biết, 2 = Thông hiểu, 3 = Vận dụng, 4 = Vận dụng cao.
4. kind: CHỈ điền khi đề cho sẵn biểu thức và đúng là một trong 9 dạng sau, ngược lại ghi null
   (bài lời văn cần tự lập phương trình thì kind = null):
   {", ".join(KINDS)}
   (linear_equation: giải phương trình bậc nhất; quadratic_equation: giải phương trình bậc hai;
    linear_inequality / quadratic_inequality: giải bất phương trình bậc nhất / bậc hai;
    factorization: phân tích đa thức thành nhân tử; vertex: tọa độ đỉnh parabol;
    min_value: giá trị nhỏ nhất/lớn nhất của hàm bậc hai; function_value: tính giá trị hàm số tại một điểm;
    quadratic_param: tìm tham số m để phương trình bậc hai thỏa điều kiện)

Nếu đề có nhiều ý, gắn nhãn theo ý khó nhất (difficulty) và kiến thức chủ đạo (topic).
Chỉ trả về JSON, không giải thích:
{{"items": [{{"id": "...", "topic": "...", "grade": 8, "difficulty_level": 2, "kind": null}}, ...]}}
Đủ số đề, giữ nguyên id."""


def load_env() -> None:
    path = ROOT / ".env"
    if not path.exists():
        return
    for line in path.read_text(encoding="utf8").splitlines():
        if line.strip() and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"'))


def read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf8").splitlines() if line.strip()]


def valid(item: dict) -> dict | None:
    """Chuẩn hóa một nhãn trả về; sai định dạng thì bỏ (câu đó sẽ được gọi lại)."""
    try:
        topic = str(item["topic"]).strip()
        grade = int(item["grade"])
        level = int(item["difficulty_level"])
        kind = item.get("kind")
        kind = None if kind in (None, "", "null", "none") else str(kind).strip()
    except (KeyError, TypeError, ValueError):
        return None
    if topic not in TOPICS or not 6 <= grade <= 12 or not 1 <= level <= 4 or (kind is not None and kind not in KINDS):
        return None
    return {"topic": topic, "grade": grade, "difficulty_level": level, "kind": kind}


def parse_json(text: str) -> dict:
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    return json.loads(text)


def call(provider: str, batch: list[dict]) -> dict[str, dict]:
    p = PROVIDERS[provider]
    user = "\n\n".join(f"[id: {r['id']}]\n{r['text']}" for r in batch)
    body = {"model": p["model"], "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}],
            "response_format": {"type": "json_object"}, **p["extra"]}
    headers = {"Authorization": f"Bearer {os.environ[p['key']]}", "Content-Type": "application/json"}
    for attempt in range(5):
        try:
            r = requests.post(p["url"], json=body, headers=headers, timeout=180)
            if r.status_code == 429 and "quota" in r.text.lower():
                raise SystemExit(f"{provider}: hết hạn mức API ({p['model']}). Đổi model trong PROVIDERS hoặc chạy lại sau.")
            if r.status_code in (429, 500, 502, 503, 504):
                raise RuntimeError(f"HTTP {r.status_code}")
            if r.status_code != 200:
                raise SystemExit(f"{provider}: HTTP {r.status_code} {r.text[:300]}")
            items = parse_json(r.json()["choices"][0]["message"]["content"])["items"]
            ids = {x["id"] for x in batch}
            return {it["id"]: v for it in items if it.get("id") in ids and (v := valid(it))}
        except SystemExit:
            raise
        except Exception as e:  # mạng, giới hạn tốc độ, JSON hỏng: chờ rồi thử lại
            wait = 2 ** attempt * 3
            print(f"  {provider}: {type(e).__name__}: {str(e)[:120]} → thử lại sau {wait}s", file=sys.stderr)
            time.sleep(wait)
    return {}


def label_with(provider: str, rows: list[dict]) -> None:
    raw = RAW_DIR / f"{provider}.jsonl"
    done = {x["id"] for x in read_jsonl(raw)}
    todo = [r for r in rows if r["id"] not in done]
    if not todo:
        print(f"{provider}: đã đủ {len(done)} câu")
        return
    model = PROVIDERS[provider]["model"]
    print(f"{provider} ({model}): còn {len(todo)} câu")
    lock = threading.Lock()
    batches = [todo[i:i + BATCH] for i in range(0, len(todo), BATCH)]
    n = 0
    with ThreadPoolExecutor(WORKERS) as pool, raw.open("a", encoding="utf8") as f:
        for fut in as_completed(pool.submit(call, provider, b) for b in batches):
            got = fut.result()
            with lock:
                for rid, lab in got.items():
                    f.write(json.dumps({"id": rid, "model": model, **lab}, ensure_ascii=False) + "\n")
                f.flush()
                n += len(got)
    print(f"{provider}: xong {n}/{len(todo)} câu (câu thiếu sẽ được gọi lại ở lần chạy sau)")


# ---------------------------------------------------------------- gộp nhãn

def majority(values: list) -> tuple[object, int]:
    (v, c), = Counter(values).most_common(1)
    return v, c


def fleiss_kappa(table: list[list]) -> float | None:
    """table: mỗi câu là danh sách nhãn của các người gắn nhãn (cùng số người)."""
    cats = sorted({v for row in table for v in row}, key=str)
    if len(table) < 2 or len(cats) < 2:
        return None
    m = len(table[0])
    if m < 2:  # cần ít nhất 2 người gắn nhãn
        return None
    p_items = []
    totals = Counter()
    for row in table:
        c = Counter(row)
        totals.update(c)
        p_items.append((sum(x * x for x in c.values()) - m) / (m * (m - 1)))
    p_bar = sum(p_items) / len(table)
    p_e = sum((totals[k] / (len(table) * m)) ** 2 for k in cats)
    return (p_bar - p_e) / (1 - p_e) if p_e < 1 else None


def aggregate(rows: list[dict], providers: list[str]) -> None:
    votes = {p: {x["id"]: x for x in read_jsonl(RAW_DIR / f"{p}.jsonl")} for p in providers}
    complete = [r for r in rows if all(r["id"] in votes[p] for p in providers)]
    out, table = [], {"topic": [], "grade": [], "difficulty_level": [], "kind": []}
    for r in complete:
        vs = [votes[p][r["id"]] for p in providers]
        topic, nt = majority([v["topic"] for v in vs])
        kind, nk = majority([v["kind"] for v in vs])
        grades = [v["grade"] for v in vs]
        levels = [v["difficulty_level"] for v in vs]
        for field in table:
            table[field].append([v[field] for v in vs])
        need = nt < 2 or nk < 2 or max(grades) - min(grades) > 1 or max(levels) - min(levels) > 1
        out.append({
            "id": r["id"],
            "text": r["text"],
            "label": {"topic": topic if nt >= 2 else None, "grade": int(statistics.median(grades)),
                      "difficulty_level": int(statistics.median(levels)), "kind": kind if nk >= 2 else None},
            "label_src": "llm",
            # unanimous: cả 3 mô hình trùng nhãn chủ đề và lệch không quá 1 lớp, 1 mức độ → đủ tin để chấm điểm
            "agreement": {"topic": nt, "kind": nk, "grade_spread": max(grades) - min(grades),
                          "level_spread": max(levels) - min(levels)},
            "unanimous": nt == len(providers) and max(grades) - min(grades) <= 1 and max(levels) - min(levels) <= 1,
            "needs_review": need,
            "votes": {p: {k: votes[p][r["id"]][k] for k in ("topic", "grade", "difficulty_level", "kind")} for p in providers},
        })
    path = OUT_DIR / "vi_reality_llm.jsonl"
    path.write_text("".join(json.dumps(x, ensure_ascii=False) + "\n" for x in out), encoding="utf8")
    write_report(out, table, providers, len(rows))
    print(f"Đã gộp {len(out)}/{len(rows)} câu → {path.relative_to(ROOT)}; cần giáo viên duyệt: {sum(x['needs_review'] for x in out)}")


def write_report(out: list[dict], table: dict, providers: list[str], n_total: int) -> None:
    n = len(out)
    pct = lambda k: f"{100 * k / n:.1f}%" if n else "–"  # noqa: E731
    # Mô hình thực tế của từng người gắn nhãn (có thể đổi giữa chừng, ví dụ khi hết hạn mức)
    used = {p: Counter(x["model"] for x in read_jsonl(RAW_DIR / f"{p}.jsonl")) for p in providers}
    models = "; ".join(f"{p} = " + ", ".join(f"`{m}` ({c} câu)" for m, c in used[p].most_common()) for p in providers)
    lines = [
        "# Gắn nhãn đề thật tiếng Việt bằng LLM",
        "",
        f"Nguồn: `data/splits/classify/to_label_vi.jsonl` ({n_total} câu, Vietnamese Reality Math, Apache-2.0). "
        f"Đã gộp: **{n}** câu. Mô hình: {models}.",
        "",
        "Ba mô hình gắn nhãn độc lập với cùng một hướng dẫn (`scripts/llm_label.py`). Nhãn gộp: chủ đề và dạng lấy theo "
        "đa số (≥ 2/3), lớp và mức độ lấy trung vị.",
        "",
        "## Mức đồng thuận",
        "",
        "| Nhãn | Cả 3 trùng | Ít nhất 2 trùng | Fleiss' κ |",
        "|---|---|---|---|",
    ]
    for field, rows in table.items():
        all3 = sum(len(set(r)) == 1 for r in rows)
        two = sum(Counter(r).most_common(1)[0][1] >= 2 for r in rows)
        k = fleiss_kappa(rows)
        lines.append(f"| {field} | {pct(all3)} | {pct(two)} | {k:.2f} |" if k is not None else f"| {field} | {pct(all3)} | {pct(two)} | – |")
    lines += ["", "**Từng cặp mô hình** (tỉ lệ trùng nhãn chủ đề / lớp / mức độ):", "", "| Cặp | topic | grade | difficulty_level |", "|---|---|---|---|"]
    for i in range(len(providers)):
        for j in range(i + 1, len(providers)):
            a, b = providers[i], providers[j]
            same = lambda f: pct(sum(x["votes"][a][f] == x["votes"][b][f] for x in out))  # noqa: E731
            lines.append(f"| {a} – {b} | {same('topic')} | {same('grade')} | {same('difficulty_level')} |")
    unanimous = sum(x["unanimous"] for x in out)
    lines += [
        "",
        "## Kết quả",
        "",
        f"- **Đồng thuận cao** (cả 3 trùng chủ đề, lệch ≤ 1 lớp và ≤ 1 mức độ): **{unanimous}** câu ({pct(unanimous)}). "
        "Dùng làm bộ test thật tạm thời.",
        f"- **Cần giáo viên duyệt** (`needs_review`): **{sum(x['needs_review'] for x in out)}** câu: chủ đề không có đa số, "
        "hoặc lớp / mức độ lệch quá 1.",
        "",
        "**Phân bố chủ đề (nhãn gộp):**",
        "",
        "| Chủ đề | Số câu |",
        "|---|---|",
    ]
    for t, c in Counter(x["label"]["topic"] or "(không có đa số)" for x in out).most_common():
        lines.append(f"| {t} | {c} |")
    lines += ["", "**Phân bố lớp:** " + ", ".join(f"lớp {g}: {c}" for g, c in sorted(Counter(x["label"]["grade"] for x in out).items())),
              "", "**Phân bố mức độ:** " + ", ".join(f"mức {g}: {c}" for g, c in sorted(Counter(x["label"]["difficulty_level"] for x in out).items())),
              "", "**Dạng của pipeline (kind):** " + (", ".join(f"{k}: {c}" for k, c in Counter(x["label"]["kind"] for x in out if x["label"]["kind"]).most_common()) or "không có"),
              "",
              "## Hạn chế",
              "",
              "- Nhãn LLM là **nhãn bạc**, chưa phải nhãn chuẩn. Các mô hình có thể sai giống nhau (ví dụ cùng xếp lớp theo "
              "độ khó con số thay vì theo chương trình), nên đồng thuận cao không bảo đảm đúng.",
              "- Mức độ (Nhận biết → Vận dụng cao) mang tính chủ quan; nên để giáo viên duyệt ngẫu nhiên khoảng 50 câu đồng "
              "thuận cao để ước lượng tỉ lệ sai.",
              ""]
    (OUT_DIR / "REPORT.md").write_text("\n".join(lines), encoding="utf8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=list(PROVIDERS), action="append")
    ap.add_argument("--aggregate", action="store_true", help="chỉ gộp từ kết quả đã có, không gọi API")
    ap.add_argument("--limit", type=int, help="chỉ lấy N câu đầu (thử nghiệm)")
    args = ap.parse_args()

    load_env()
    # Đổi mô hình không cần sửa code, ví dụ khi hết hạn mức: GEMINI_MODEL=gemini-3.1-flash-lite python scripts/llm_label.py --only gemini
    for name, p in PROVIDERS.items():
        p["model"] = os.environ.get(f"{name.upper()}_MODEL", p["model"])
    rows = read_jsonl(SRC)[: args.limit]
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    providers = args.only or list(PROVIDERS)
    if not args.aggregate:
        missing = [PROVIDERS[p]["key"] for p in providers if not os.environ.get(PROVIDERS[p]["key"])]
        if missing:
            raise SystemExit(f"Thiếu khóa API trong ml/.env: {', '.join(missing)}")
        with ThreadPoolExecutor(len(providers)) as pool:  # 3 mô hình chạy song song
            for fut in [pool.submit(label_with, p, rows) for p in providers]:
                fut.result()
    aggregate(rows, list(PROVIDERS) if not args.only else providers)


if __name__ == "__main__":
    main()
