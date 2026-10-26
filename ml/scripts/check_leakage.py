"""Kiểm tra rò rỉ giữa các tập: không được có đề (key) hay nhóm (group) nào xuất hiện ở hai tập khác nhau.

    python scripts/check_leakage.py [data/splits | data/splits_with_flagged]
"""

import json
import sys
from itertools import combinations
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def ids(path: Path, fields: tuple[str, ...]) -> dict[str, set[str]]:
    out = {f: set() for f in fields}
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            r = json.loads(line)
            for f in fields:
                if r.get(f):
                    out[f].add(r[f])
    return out


def main() -> int:
    base = ROOT / (sys.argv[1] if len(sys.argv) > 1 else "data/splits")
    bad = 0
    for task, fields, splits in [
        ("classify", ("key", "group"), ["train", "val", "test", "test_unseen_templates"]),
        ("generate", ("group",), ["train", "val", "test"]),
    ]:
        sets = {s: ids(base / task / f"{s}.jsonl", fields) for s in splits if (base / task / f"{s}.jsonl").exists()}
        for a, b in combinations(sets, 2):
            for f in fields:
                n = len(sets[a][f] & sets[b][f])
                status = "OK " if n == 0 else "RÒ"
                bad += n
                print(f"{status} {task:<9} {f:<6} {a} ∩ {b}: {n}")
    # Dạng bài giữ lại không được xuất hiện trong train
    tpl_train, tpl_unseen = set(), set()
    for split, bucket in (("train", tpl_train), ("test_unseen_templates", tpl_unseen)):
        with (base / "classify" / f"{split}.jsonl").open(encoding="utf-8") as fh:
            for line in fh:
                t = json.loads(line)["labels"].get("template")
                if t:
                    bucket.add(t)
    overlap = tpl_train & tpl_unseen
    print(f"{'OK ' if not overlap else 'RÒ'} dạng bài giữ lại có mặt trong train: {sorted(overlap) or 0}")
    return 1 if bad or overlap else 0


if __name__ == "__main__":
    sys.exit(main())
