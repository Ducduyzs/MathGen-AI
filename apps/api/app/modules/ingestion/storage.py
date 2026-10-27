"""Kho file tải lên với link ký sẵn (giống presigned URL của R2/S3).

Trình duyệt PUT file thẳng vào link, không cần token đăng nhập: chữ ký HMAC trên (khóa file, hạn dùng) là quyền ghi.
Dev lưu vào thư mục cục bộ (UPLOAD_DIR); production thay bằng R2 với cùng giao diện (signed_url, read).
"""

import hashlib
import hmac
import time
from pathlib import Path

from app.core.config import get_settings

URL_TTL = 15 * 60


def _sig(key: str, exp: int) -> str:
    return hmac.new(get_settings().jwt_secret.encode(), f"upload:{key}:{exp}".encode(), hashlib.sha256).hexdigest()


def signed_url(key: str) -> str:
    exp = int(time.time()) + URL_TTL
    return f"/api/ingestion/files/{key}?exp={exp}&sig={_sig(key, exp)}"


def valid_signature(key: str, exp: int, sig: str) -> bool:
    return exp >= time.time() and hmac.compare_digest(sig, _sig(key, exp))


def _path(key: str) -> Path:
    if not key.isalnum():  # khóa là ULID; chặn ../ và ký tự lạ
        raise ValueError("khóa file không hợp lệ")
    return Path(get_settings().upload_dir) / key


def write(key: str, data: bytes) -> None:
    path = _path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def read(key: str) -> bytes:
    return _path(key).read_bytes()
