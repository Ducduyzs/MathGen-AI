"""OCR đề Toán từ ảnh / PDF scan bằng mô hình đọc ảnh (chạy trong worker).

Gemini nhận cả ảnh lẫn PDF; GPT dùng dự phòng cho ảnh. Kết quả là văn bản thường theo đúng quy ước của pipeline
(đánh số "Câu 1.", phương án "A.", lũy thừa x^2) để các bước tách câu → nhận dạng → giải → SymPy chạy như với file chữ.
Nội dung ảnh được gửi tới nhà cung cấp mô hình: chỉ dùng cho đề thi, không gửi thông tin cá nhân.
"""

import base64

import httpx

from app.core.config import get_settings

PROMPT = (
    "Chép lại NGUYÊN VĂN đề Toán trong tài liệu này thành văn bản thuần, không giải, không bình luận.\n"
    "- Giữ đánh số câu như trên đề (Câu 1., Bài 2:, 1.) và mỗi câu bắt đầu ở dòng mới.\n"
    "- Phương án trắc nghiệm viết trên dòng riêng: A. ... B. ... C. ... D. ...\n"
    "- Công thức viết dạng văn bản: x^2, sqrt(x), 3/4, <=, >=, pi; không dùng LaTeX.\n"
    "- Bỏ qua phần đầu trang không phải câu hỏi chỉ khi không đọc được; nếu đọc được (tên Sở, trường, kỳ thi) thì giữ lại ở đầu."
)
TIMEOUT = 90.0


class OcrError(Exception):
    pass


def _gemini(key: str, data: bytes, mime: str) -> str:
    model = get_settings().ocr_gemini_model
    body = {"contents": [{"parts": [{"inline_data": {"mime_type": mime, "data": base64.b64encode(data).decode()}}, {"text": PROMPT}]}],
            "generationConfig": {"temperature": 0}}
    r = httpx.post(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent", params={"key": key},
                   json=body, timeout=TIMEOUT)
    if r.status_code != 200:
        raise OcrError(f"Gemini HTTP {r.status_code}")
    parts = (r.json().get("candidates") or [{}])[0].get("content", {}).get("parts", [])
    return "\n".join(p.get("text", "") for p in parts)


def _openai(key: str, data: bytes, mime: str) -> str:
    url = f"data:{mime};base64,{base64.b64encode(data).decode()}"
    body = {"model": get_settings().ocr_openai_model, "temperature": 0, "messages": [{"role": "user", "content": [
        {"type": "text", "text": PROMPT}, {"type": "image_url", "image_url": {"url": url}}]}]}
    r = httpx.post("https://api.openai.com/v1/chat/completions", headers={"Authorization": f"Bearer {key}"}, json=body, timeout=TIMEOUT)
    if r.status_code != 200:
        raise OcrError(f"OpenAI HTTP {r.status_code}")
    return r.json()["choices"][0]["message"]["content"] or ""


def available() -> bool:
    s = get_settings()
    return bool(s.gemini_api_key or s.openai_api_key)


def recognize(data: bytes, mime: str) -> str:
    """Ảnh (image/*) hoặc PDF (application/pdf) → văn bản đề. Lỗi mọi nhà cung cấp thì báo OcrError."""
    s = get_settings()
    errors = []
    if s.gemini_api_key:
        try:
            text = _gemini(s.gemini_api_key, data, mime)
            if text.strip():
                return text
        except (httpx.HTTPError, OcrError, KeyError, ValueError) as e:
            errors.append(str(e))
    if s.openai_api_key and mime.startswith("image/"):
        try:
            text = _openai(s.openai_api_key, data, mime)
            if text.strip():
                return text
        except (httpx.HTTPError, OcrError, KeyError, ValueError) as e:
            errors.append(str(e))
    raise OcrError("; ".join(errors) or "Chưa cấu hình khóa mô hình đọc ảnh")
