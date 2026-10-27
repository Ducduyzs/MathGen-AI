"""Chấm đáp án trong request: chỉ so sánh với đáp án đã chuẩn hóa sẵn, dùng phân số chính xác.
Không gọi SymPy ở đây (SymPy chạy trong worker) — giữ độ trễ thấp cho học sinh."""

import re
from fractions import Fraction

_NUMBER = re.compile(r"^-?\d+(?:\.\d+)?(?:/-?\d+(?:\.\d+)?)?$")


def parse_number(raw: str) -> Fraction | None:
    """3/2, 1,5, 1.5, -0.75 → Fraction. Khớp đúng quy tắc của frontend (apps/web/src/lib/math-input.ts)."""
    s = re.sub(r"\s+", "", raw).replace(",", ".")
    if not _NUMBER.match(s):
        return None
    num, _, den = s.partition("/")
    n = Fraction(num)
    if not den:
        return n
    d = Fraction(den)
    return None if d == 0 else n / d


def same_number(a: str, b: str, tolerance: Fraction | None = None) -> bool:
    x, y = parse_number(a), parse_number(b)
    if x is None or y is None:
        return False
    return abs(x - y) <= tolerance if tolerance is not None else x == y


def grade(expected: dict, given: dict) -> bool:
    if expected.get("type") != given.get("type"):
        return False
    t = expected["type"]
    if t == "choice":
        return str(given.get("value", "")).strip().upper() == str(expected["value"]).upper()
    if t == "number":
        return same_number(str(given.get("value", "")), str(expected["value"]))
    if t == "set":
        got = [parse_number(str(v)) for v in given.get("value") or []]
        want = sorted(parse_number(str(v)) for v in expected["value"])
        return None not in got and len(got) == len(want) and sorted(got) == want
    return False
