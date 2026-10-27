"""Trích văn bản từ file tải lên (chạy trong worker).

- txt / md / tex: đọc UTF-8.
- docx: đọc word/document.xml bằng zipfile (không cần thư viện ngoài).
- pdf: pypdf; PDF scan (không có lớp chữ) cần OCR.
- Ảnh: cần OCR công thức (Mathpix / Pix2Text) — chưa cấu hình, báo lỗi rõ ràng thay vì đoán.
"""

import io
import re
import zipfile
from xml.etree import ElementTree

MAX_UPLOAD_BYTES = 20 * 1024 * 1024
ALLOWED_EXTENSIONS = {"pdf", "docx", "txt", "tex", "md", "png", "jpg", "jpeg"}

_W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


class ExtractError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def extension(name: str) -> str:
    return name.rsplit(".", 1)[-1].lower() if "." in name else ""


def _docx_text(data: bytes) -> str:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            info = z.getinfo("word/document.xml")
            if info.file_size > 50 * MAX_UPLOAD_BYTES:  # chặn file nén bất thường (zip bomb)
                raise ExtractError("unsupported_file", "File Word quá lớn sau khi giải nén.")
            root = ElementTree.fromstring(z.read(info))
    except (zipfile.BadZipFile, KeyError, ElementTree.ParseError) as e:
        raise ExtractError("unsupported_file", "File Word bị hỏng hoặc không đúng định dạng .docx.") from e
    lines = []
    for p in root.iter(f"{_W}p"):
        parts = []
        for node in p.iter():
            if node.tag == f"{_W}t" and node.text:
                parts.append(node.text)
            elif node.tag == f"{_W}tab":
                parts.append(" ")
            elif node.tag == f"{_W}br":
                parts.append("\n")
        lines.append("".join(parts))
    return "\n".join(lines)


def _pdf_text(data: bytes) -> str:
    from pypdf import PdfReader
    from pypdf.errors import PdfReadError

    try:
        reader = PdfReader(io.BytesIO(data))
        text = "\n".join(page.extract_text() or "" for page in reader.pages[:50])
    except PdfReadError as e:
        raise ExtractError("unsupported_file", "File PDF bị hỏng hoặc được mã hóa.") from e
    if not text.strip():
        raise ExtractError("ocr_required", "PDF không có lớp chữ (bản scan), cần OCR.")
    return text


def extract_text(name: str, data: bytes) -> str:
    ext = extension(name)
    if ext in ("txt", "tex", "md"):
        return data.decode("utf-8", errors="replace")
    if ext == "docx":
        return _docx_text(data)
    if ext == "pdf":
        return _pdf_text(data)
    if ext in ("png", "jpg", "jpeg"):
        raise ExtractError("ocr_required", "Ảnh đề thi cần OCR công thức (Mathpix/Pix2Text), chưa được cấu hình trên máy chủ.")
    raise ExtractError("unsupported_file", "Định dạng file chưa được hỗ trợ.")


def clean(text: str) -> str:
    return re.sub(r"\x00", "", text)
