"""Quy tắc thu thập: chỉ nguồn được phép, đúng phạm vi đã khai báo, không chạm địa chỉ nội bộ.

Bộ gom không tự quyết nguồn nào được phép: quản trị viên khai báo giấy phép (kèm bằng chứng khi cần) và xác nhận
đã kiểm tra điều khoản sử dụng của nguồn. Ngoài ra luôn tôn trọng robots.txt (RFC 9309) và Crawl-delay.
"""

import ipaddress
import socket
from urllib.parse import urljoin, urlsplit, urlunsplit

LICENSES: dict[str, str] = {
    "government": "Đề thi / văn bản chính thức của cơ quan nhà nước",
    "public_domain": "Phạm vi công cộng",
    "cc0": "CC0",
    "cc_by": "CC BY",
    "cc_by_sa": "CC BY-SA",
    "permission": "Có văn bản cho phép của chủ sở hữu",
}
# Giấy phép cần ghi lại bằng chứng (số văn bản, email cho phép, đường dẫn điều khoản…)
NEEDS_NOTE = {"permission"}

USER_AGENT = "MathGenBot/0.1 (+https://mathgen.vn/bot; thu thap de Toan lop 1-12 tu nguon duoc phep)"
BOT_TOKEN = "MathGenBot"
MIN_DELAY = 1.0
MAX_BYTES = 20 * 1024 * 1024
MAX_REDIRECTS = 5
DOC_EXTENSIONS = {"pdf", "docx"}
# Đuôi file chắc chắn không phải tài liệu đề: không tải
SKIP_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp", "svg", "ico", "css", "js", "mp3", "mp4", "zip", "rar", "exe", "xls", "xlsx", "ppt", "pptx"}


def normalize(url: str, base: str | None = None) -> str | None:
    """URL tuyệt đối, bỏ #fragment, host chữ thường; None nếu không phải http(s)."""
    try:
        parts = urlsplit(urljoin(base, url) if base else url)
    except ValueError:
        return None
    if parts.scheme not in ("http", "https") or not parts.hostname:
        return None
    host = parts.hostname.lower()
    port = f":{parts.port}" if parts.port and parts.port not in (80, 443) else ""
    return urlunsplit((parts.scheme, host + port, parts.path or "/", parts.query, ""))


def host_of(url: str) -> str:
    return (urlsplit(url).hostname or "").lower()


def extension(url: str) -> str:
    path = urlsplit(url).path.lower()
    return path.rsplit(".", 1)[-1] if "." in path.rsplit("/", 1)[-1] else ""


def in_scope(url: str, domain: str, include_paths: list[str]) -> bool:
    """Cùng tên miền (hoặc tên miền con) và nằm trong các thư mục đã khai báo (nếu có)."""
    host = host_of(url)
    if host != domain and not host.endswith("." + domain):
        return False
    if extension(url) in SKIP_EXTENSIONS:
        return False
    path = urlsplit(url).path or "/"
    return not include_paths or any(path.startswith(p) for p in include_paths)


def is_public_host(host: str) -> bool:
    """Chống SSRF: mọi địa chỉ IP của host phải là địa chỉ công cộng (không localhost, mạng nội bộ, link-local…)."""
    if host in ("localhost",) or host.endswith((".local", ".internal", ".localhost")):
        return False
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError:
        return False
    return all(ipaddress.ip_address(info[4][0]).is_global for info in infos)
