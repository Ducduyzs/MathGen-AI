"""Đưa 499 đề thật tiếng Việt đã gắn nhãn (labels/vi_reality_llm.jsonl) vào dữ liệu phân loại.

Chia theo chủ đề (cố định theo mã câu): 40% real_test (chỉ để chấm), 15% real_val (chọn mô hình), 45% real_train
→ data/splits/classify/real_{train,val,test}.jsonl.
- Nhãn tin cậy (`exact`): câu người đã duyệt, hoặc cả 3 mô hình cùng gán. Chỉ nhãn này được chấm ở real_test.
- Còn lại (`weak`): chỉ dùng để train.

    python -X utf8 scripts/merge_real_labels.py
"""

import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "labels" / "vi_reality_llm.jsonl"
OUT = ROOT / "data" / "splits" / "classify"
# Mức độ 1–3 của nhãn → độ khó 0–1 (cùng thang với MATH: Level 1 = 0,1 … Level 5 = 0,9)
LEVEL_DIFFICULTY = {1: 0.2, 2: 0.45, 3: 0.7}


def band(grade: int | None) -> str | None:
    if grade is None:
        return None
    return "primary" if grade <= 5 else "lower_secondary" if grade <= 9 else "upper_secondary"


def to_row(r: dict, for_test: bool) -> dict:
    lab = r["label"]
    reliable = r["label_src"] == "human" or r["unanimous"]
    src = "exact" if reliable else "weak"
    grade = lab.get("grade")
    level = lab.get("difficulty_level")
    return {
        "id": r["id"], "source": "vi_reality", "license": "Apache-2.0", "tier": "open", "lang": "vi", "text": r["text"],
        # Ở tập test, lớp cụ thể chỉ giữ khi nhãn tin cậy (script train luôn chấm trường grade)
        "labels": {"topic": lab.get("topic"), "grade": grade if reliable or not for_test else None, "grade_band": band(grade),
                   "difficulty": LEVEL_DIFFICULTY.get(level)},
        "label_src": {"topic": src, "grade_band": src, "difficulty": src},
        "key": r["id"].split(":")[-1], "group": r["id"].split(":")[-1],
    }


def main() -> None:
    rows = [json.loads(line) for line in SRC.open(encoding="utf-8")]
    by_topic: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        by_topic[r["label"]["topic"]].append(r)
    train, val, test = [], [], []
    for group in by_topic.values():
        group.sort(key=lambda r: hashlib.sha256(r["id"].encode()).hexdigest())
        for i, r in enumerate(group):  # xen kẽ trong từng chủ đề: chủ đề ít câu vẫn có ở cả test và train
            k = (i * 7) % 20
            (test if k < 8 else val if k < 11 else train).append(r)
    for name, part, for_test in (("real_train", train, False), ("real_val", val, True), ("real_test", test, True)):
        with (OUT / f"{name}.jsonl").open("w", encoding="utf-8") as fh:
            for r in part:
                fh.write(json.dumps(to_row(r, for_test), ensure_ascii=False) + "\n")
        reliable = sum(r["label_src"] == "human" or r["unanimous"] for r in part)
        print(f"{name}: {len(part)} câu ({reliable} nhãn tin cậy) · {dict(Counter(r['label']['topic'] for r in part).most_common(5))}")


if __name__ == "__main__":
    main()
