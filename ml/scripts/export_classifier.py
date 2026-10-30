"""Gom mô hình phân loại đã train thành thư mục cho API (apps/api/var/models/classifier).

    python scripts/export_classifier.py --run runs/2026-10-27_real/out/base_real40 \
        --base-config <thư mục xlm-roberta-base có config.json> --dest ../apps/api/var/models/classifier

Thư mục đích gồm: model_fp16.pt (state dict MultiHead), tokenizer/, config.json (cấu hình bộ mã hóa),
labels.json (thứ tự nhãn các đầu ra + số liệu trên real_test để hiển thị). Không cần mạng khi API nạp mô hình.
"""

import argparse
import json
import shutil
from pathlib import Path


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", required=True, type=Path, help="thư mục out/<lần chạy> có model_fp16.pt, tokenizer/, metrics.json")
    ap.add_argument("--base-config", required=True, type=Path, help="thư mục mô hình gốc có config.json")
    ap.add_argument("--dest", required=True, type=Path)
    a = ap.parse_args()

    metrics = json.loads((a.run / "metrics.json").read_text(encoding="utf-8"))
    a.dest.mkdir(parents=True, exist_ok=True)
    shutil.copy2(a.run / "model_fp16.pt", a.dest / "model_fp16.pt")
    shutil.copytree(a.run / "tokenizer", a.dest / "tokenizer", dirs_exist_ok=True)
    shutil.copy2(a.base_config / "config.json", a.dest / "config.json")
    real = metrics.get("final", {}).get("real_test", {})
    labels = {
        "labels": metrics["labels"],
        "base_model": Path(metrics["model"]).name,
        "run": a.run.name,
        "max_len": metrics["args"].get("max_len", 256),
        "real_test": {"n": real.get("n"), "topic_acc": real.get("topic", {}).get("acc"), "grade_band_acc": real.get("grade_band", {}).get("acc"),
                      "grade_acc": real.get("grade", {}).get("acc"), "grade_within_1": real.get("grade", {}).get("within_1"),
                      "difficulty_spearman": real.get("difficulty", {}).get("spearman")},
    }
    (a.dest / "labels.json").write_text(json.dumps(labels, ensure_ascii=False, indent=2), encoding="utf-8")
    print("→", a.dest, "·", labels["base_model"], "·", json.dumps(labels["real_test"], ensure_ascii=False)[:300])


if __name__ == "__main__":
    main()
