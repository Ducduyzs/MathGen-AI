"""Mô hình phân loại đề (XLM-R đa nhiệm, train ở ml/train/train_classifier.py): chủ đề, cấp lớp, lớp, độ khó.

Thư mục mô hình (ml/scripts/export_classifier.py): model_fp16.pt, tokenizer/, config.json, labels.json — không cần mạng.
torch + transformers là phụ thuộc tùy chọn (nhóm `ml`); thiếu thư viện hoặc thiếu mô hình thì `predict` trả None
và app chạy như trước. Mô hình nạp một lần khi cần (lần đầu ~vài giây), dùng chung trong tiến trình.
"""

import json
import logging
import threading
from pathlib import Path

from app.core.config import get_settings

log = logging.getLogger(__name__)

TOPIC_LABELS = {
    "arithmetic": "Số học", "algebra": "Đại số", "functions": "Hàm số", "trigonometry": "Lượng giác", "calculus": "Đạo hàm – Tích phân",
    "exp_log": "Mũ – Logarit", "sequences": "Dãy số – Cấp số", "geometry": "Hình học", "coordinates": "Tọa độ",
    "probability_counting": "Xác suất – Tổ hợp", "statistics": "Thống kê", "number_theory": "Số học nâng cao", "precalculus": "Tiền giải tích",
    "other": "Khác",
}
BAND_LABELS = {"primary": "Tiểu học", "lower_secondary": "THCS", "upper_secondary": "THPT", "school": "Phổ thông", "competition": "Thi học sinh giỏi"}
LEVELS = [(0.25, "Nhận biết"), (0.5, "Thông hiểu"), (0.75, "Vận dụng"), (1.01, "Vận dụng cao")]
BATCH = 16
# Lớp hợp lệ theo cấp: đầu "lớp" chỉ chọn trong khoảng của cấp đã đoán để hai đầu ra không mâu thuẫn
BAND_GRADES = {"lower_secondary": range(6, 10), "upper_secondary": range(10, 13)}

_lock = threading.Lock()
_state: dict = {"model": None, "tok": None, "meta": None, "error": None}


def model_dir() -> Path | None:
    d = get_settings().classifier_dir
    return Path(d) if d else None


def _meta() -> dict | None:
    d = model_dir()
    try:
        return json.loads((d / "labels.json").read_text(encoding="utf-8")) if d else None
    except OSError:
        return None


def status() -> dict:
    """Trạng thái cho trang Chất lượng: có dùng được không, vì sao không, mô hình nào, độ chính xác trên đề thật."""
    meta = _meta()
    if not model_dir():
        reason = "Chưa cấu hình CLASSIFIER_DIR"
    elif not meta or not (model_dir() / "model_fp16.pt").exists():
        reason = "Chưa có mô hình (chạy ml/scripts/export_classifier.py)"
    else:
        try:
            import torch  # noqa: F401
            import transformers  # noqa: F401

            reason = _state["error"]
        except ImportError:
            reason = "Chưa cài torch + transformers (uv sync --group ml)"
    return {"available": reason is None, "loaded": _state["model"] is not None, "reason": reason,
            "base_model": (meta or {}).get("base_model"), "real_test": (meta or {}).get("real_test") or {}}


def _load():
    import torch
    import torch.nn as nn
    from transformers import AutoConfig, AutoModel, AutoTokenizer

    d, meta = model_dir(), _meta()
    labels = meta["labels"]

    class MultiHead(nn.Module):  # cùng tên tham số với lúc train để nạp state dict
        def __init__(self):
            super().__init__()
            self.enc = AutoModel.from_config(AutoConfig.from_pretrained(d))
            h = self.enc.config.hidden_size
            self.drop = nn.Dropout(0.1)
            self.topic, self.band = nn.Linear(h, len(labels["topic"])), nn.Linear(h, len(labels["grade_band"]))
            self.grade, self.diff = nn.Linear(h, len(labels["grade"])), nn.Linear(h, 1)

        def forward(self, input_ids, attention_mask):
            x = self.enc(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state[:, 0]
            return self.topic(x), self.band(x), self.grade(x), torch.sigmoid(self.diff(x)).squeeze(-1)

    model = MultiHead()
    state = {k: v.float() for k, v in torch.load(d / "model_fp16.pt", map_location="cpu").items()}
    missing, unexpected = model.load_state_dict(state, strict=False)
    missing = [k for k in missing if not k.endswith("position_ids")]
    if missing or [k for k in unexpected if not k.endswith("position_ids")]:
        raise RuntimeError(f"Mô hình không khớp kiến trúc: thiếu {missing[:3]}, thừa {unexpected[:3]}")
    model.eval()
    torch.set_num_threads(max(1, min(4, torch.get_num_threads())))
    return model, AutoTokenizer.from_pretrained(d / "tokenizer"), meta


def _ensure() -> bool:
    if _state["model"] is not None:
        return True
    if not status()["available"]:
        return False
    with _lock:
        if _state["model"] is None and _state["error"] is None:
            try:
                _state["model"], _state["tok"], _state["meta"] = _load()
                log.info("classifier loaded from %s", model_dir())
            except Exception as e:  # mô hình hỏng / sai phiên bản: tắt tính năng, không làm hỏng pipeline
                log.exception("classifier load failed")
                _state["error"] = f"Không nạp được mô hình: {e.__class__.__name__}"
    return _state["model"] is not None


def _level(d: float) -> str:
    return next(label for bound, label in LEVELS if d < bound)


def _predict_impl(texts: list[str]) -> list[dict]:
    import torch

    model, tok, meta = _state["model"], _state["tok"], _state["meta"]
    labels = meta["labels"]
    out: list[dict] = []
    for i in range(0, len(texts), BATCH):
        enc = tok(texts[i:i + BATCH], truncation=True, max_length=meta.get("max_len", 256), padding=True, return_tensors="pt")
        with torch.inference_mode():
            lt, lb, lg, ld = model(enc["input_ids"], enc["attention_mask"])
        pt, pb, pg = lt.softmax(-1), lb.softmax(-1), lg.softmax(-1)
        for j in range(pt.shape[0]):
            topic, band = labels["topic"][int(pt[j].argmax())], labels["grade_band"][int(pb[j].argmax())]
            allowed = BAND_GRADES.get(band)
            gp = pg[j] if not allowed else pg[j] * torch.tensor([float(g in allowed) for g in labels["grade"]])
            grade = labels["grade"][int(gp.argmax())]
            gconf = float(gp.max() / gp.sum()) if allowed else float(gp.max())
            diff = round(float(ld[j]), 2)
            out.append({
                "topic": topic, "topic_label": TOPIC_LABELS.get(topic, topic), "topic_confidence": round(float(pt[j].max()), 3),
                "grade_band": band, "grade_band_label": BAND_LABELS.get(band, band), "grade_band_confidence": round(float(pb[j].max()), 3),
                # Đầu "lớp" chỉ được train trên lớp 6–12: đề tiểu học thì không đoán lớp cụ thể
                "grade": None if band == "primary" else grade, "grade_confidence": round(gconf, 3),
                "difficulty": diff, "level": _level(diff),
            })
    return out


def warm_up() -> None:
    """Nạp mô hình ở luồng nền khi tiến trình khởi động (lần nạp đầu ~1 phút) để người dùng đầu tiên không phải chờ."""
    if status()["available"]:
        threading.Thread(target=_ensure, name="classifier-warmup", daemon=True).start()


def predict(texts: list[str]) -> list[dict] | None:
    """Nhận định cho từng đề; None nếu mô hình không dùng được (app vẫn chạy như trước)."""
    if not texts or not _ensure():
        return None
    return PREDICT(texts)


# Test thay bằng hàm giả (không nạp mô hình thật)
PREDICT = _predict_impl
