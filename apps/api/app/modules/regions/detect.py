"""Nhận diện tỉnh, trường, kỳ thi, năm học từ phần đầu đề (tiêu đề trang, vài chục dòng đầu).

Đề Việt Nam thường mở đầu bằng "SỞ GIÁO DỤC VÀ ĐÀO TẠO <TỈNH>" / "UBND TỈNH <TỈNH>" / "TRƯỜNG THPT <TÊN>" và
"ĐỀ KIỂM TRA CUỐI HỌC KÌ I – NĂM HỌC 2024 – 2025". Chỉ đọc phần đầu để không nhầm tên địa danh trong đề bài.
"""

import re
import unicodedata
from dataclasses import asdict, dataclass

from app.modules.regions.data import ALIASES, LEGACY, NAMES, PROVINCES

HEADER_LINES = 25


def fold(s: str) -> str:
    """Bỏ dấu, chữ thường, gộp khoảng trắng: "SỞ GD&ĐT Nghệ An" → "so gd&dt nghe an"."""
    s = unicodedata.normalize("NFD", s.replace("Đ", "D").replace("đ", "d"))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return " ".join(s.lower().split())


# Mọi cách gọi tỉnh (tên mới + tên cũ), dài trước để "ba ria - vung tau" khớp trước "vung tau"
_PLACE_KEYS: list[tuple[str, str]] = sorted(
    [(fold(name), code) for code, name in PROVINCES] + [(fold(name.replace("TP. ", "")), code) for code, name in PROVINCES]
    + list(ALIASES.items()),
    key=lambda kv: -len(kv[0]),
)
_PROVINCE_LINE = re.compile(
    r"((?:so|phong) giao duc(?: va dao tao| - dao tao)?|(?:so|phong) gd ?(?:&|va|-) ?dt|(?:so|phong) gddt"
    r"|ubnd (?:tinh|thanh pho|tp\.?)|uy ban nhan dan (?:tinh|thanh pho))\s*(.*)"
)
_SCHOOL = re.compile(
    r"\btruong\s+(tieu hoc|th\b|thcs|trung hoc co so|thpt chuyen|thpt|trung hoc pho thong|ptdtnt|pt dtnt|th&thcs|th - thcs|thcs&thpt|thcs - thpt|lien cap)\s*(.*)",
)
_LEVEL = {"tieu hoc": "primary", "th": "primary", "thcs": "lower", "trung hoc co so": "lower", "thpt": "upper", "thpt chuyen": "upper",
          "trung hoc pho thong": "upper", "ptdtnt": "multi", "pt dtnt": "multi", "th&thcs": "multi", "th - thcs": "multi",
          "thcs&thpt": "multi", "thcs - thpt": "multi", "lien cap": "multi"}
_LEVEL_LABEL = {"primary": "Tiểu học", "lower": "THCS", "upper": "THPT", "multi": "Liên cấp"}
_KINDS = [
    ("graduation", r"tot nghiep (thpt|trung hoc pho thong)|thi thpt quoc gia"),
    ("grade10", r"tuyen sinh (vao )?lop 10|vao lop 10"),
    ("gifted", r"hoc sinh gioi|chon (hoc sinh|hsg)|\bhsg\b"),
    ("mid_term", r"giua (hoc )?ki|giua (hoc )?ky"),
    ("end_term", r"cuoi (hoc )?ki|cuoi (hoc )?ky|hoc ki (i|ii|1|2)\b|hoc ky (i|ii|1|2)\b"),
    ("survey", r"khao sat|thi thu"),
]
_YEAR = re.compile(r"nam hoc\s*(20\d\d)\s*[-–—/]\s*(20\d\d)|nam\s*(20\d\d)")


@dataclass
class Region:
    province_code: str | None = None
    province_raw: str | None = None  # tên tỉnh như ghi trên đề (có thể là tỉnh cũ)
    school_name: str | None = None
    school_level: str | None = None
    exam_kind: str | None = None
    exam_year: int | None = None  # năm kết thúc năm học (2024-2025 → 2025)

    def as_dict(self) -> dict:
        return asdict(self)


def _place(original: str, offset: int = 0) -> tuple[str, str] | None:
    """Tỉnh nhắc tới đầu tiên trong dòng gốc (từ vị trí `offset` của bản bỏ dấu) → (mã, tên như ghi trên đề)."""
    f = fold(original)
    best = None
    for key, code in _PLACE_KEYS:
        m = re.compile(rf"(?<![a-z]){re.escape(key)}(?![a-z])").search(f, offset)
        if m and (best is None or m.start() < best[1]):
            best = (code, m.start(), m.end())
    if not best:
        return None
    code, a, b = best
    # Bản bỏ dấu giữ nguyên số ký tự khi dòng không có khoảng trắng kép, nên cắt được tên gốc (có dấu)
    raw = " ".join(original.split())[a:b]
    return code, (_title(raw) if fold(raw) in LEGACY else NAMES[code])  # tỉnh cũ: giữ tên ghi trên đề


ACRONYMS = {"THPT", "THCS", "TH", "PTDTNT", "DTNT", "PT", "GD&ĐT", "TP.", "TP", "THCS&THPT", "TH&THCS"}


def _title(words: str) -> str:
    """"TRƯỜNG THPT CHUYÊN PHAN BỘI CHÂU" → "Trường THPT Chuyên Phan Bội Châu" (giữ chữ viết tắt)."""
    return " ".join(w.upper() if w.upper() in ACRONYMS else w.capitalize() for w in words.split())


def detect(title: str, text: str) -> Region:
    lines = [ln.strip() for ln in [title, *text.splitlines()[:HEADER_LINES]] if ln and ln.strip()]
    out = Region()
    for raw in lines:
        f = fold(raw)
        if out.province_code is None and (m := _PROVINCE_LINE.search(f)):
            hit = _place(raw, m.start(2))
            if hit:
                out.province_code, out.province_raw = hit
        if out.school_name is None and (m := _SCHOOL.search(f)):
            level = _LEVEL[m.group(1)]
            # Lấy tên trường từ dòng gốc (giữ dấu), bỏ phần sau dấu – hoặc "năm học"
            name = " ".join(raw.split())[m.start():m.end()]
            name = re.split(r"\s[-–—|]\s|\s{2,}|năm học|NĂM HỌC|Năm học", name)[0].strip(" .:,")
            if len(name) > 10:
                out.school_name, out.school_level = _title(name), level
        if out.exam_kind is None:
            out.exam_kind = next((k for k, pat in _KINDS if re.search(pat, f)), None)
        if out.exam_year is None and (m := _YEAR.search(f)):
            out.exam_year = int(m.group(2) or m.group(3))
    # Không có dòng "Sở GD&ĐT …": thử tên tỉnh trong tiêu đề trang (vd. "Đề thi vào lớp 10 Nghệ An 2025")
    if out.province_code is None and title and (hit := _place(title)):
        out.province_code, out.province_raw = hit
    return out


def level_label(level: str | None) -> str | None:
    return _LEVEL_LABEL.get(level or "")
