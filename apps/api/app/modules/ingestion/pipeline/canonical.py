"""Dạng chuẩn để chống trùng: hai đề khác chữ nhưng tương đương toán học (x² + 2x − 3 = 0 và 2x + x² = 3,
hay 2x² − 10x + 12 = 0 và x² − 5x + 6 = 0) cho cùng một khóa → cùng một mã băm SHA-256 (cột problems.canonical_hash).

Chuyển từ apps/web/src/mocks/pipeline/canonical.ts (khóa giống hệt bản TypeScript).
"""

import hashlib
import math
from fractions import Fraction

from app.modules.ingestion.pipeline.poly import Poly, coeffs_x, deg_m, deg_x, plain, poly_latex
from app.modules.ingestion.pipeline.structure import FLIP, REL_LATEX, Structure


def _integer_form(P: Poly) -> tuple[list[tuple[tuple[int, int], int]], bool]:
    """Quy đồng → chia ước chung → hệ số đầu dương. Trả về các hạng tử nguyên và việc có đổi dấu hay không."""
    items = sorted(P.items(), key=lambda kv: (-kv[0][0], -kv[0][1]))
    L = 1
    for _, c in items:
        L = math.lcm(L, c.denominator)
    ints = [(k, int(c * L)) for k, c in items]
    G = 0
    for _, v in ints:
        G = math.gcd(G, v)
    G = G or 1
    ints = [(k, v // G) for k, v in ints]
    flipped = bool(ints) and ints[0][1] < 0
    if flipped:
        ints = [(k, -v) for k, v in ints]
    return ints, flipped


def _enc(ints: list[tuple[tuple[int, int], int]]) -> str:
    return "|".join(f"{ex},{em}:{v}" for (ex, em), v in ints)


def _raw(P: Poly) -> str:
    return "|".join(f"{k}:{plain(c)}" for k, c in sorted((f"{ex},{em}", c) for (ex, em), c in P.items()))


def canonical_key(s: Structure) -> str:
    match s.kind:
        case "linear_equation" | "quadratic_equation":
            return f"eq:{_enc(_integer_form(s.P)[0])}"
        case "quadratic_param":
            return f"par:{s.cond}:{_enc(_integer_form(s.P)[0])}"
        case "linear_inequality" | "quadratic_inequality":
            ints, flipped = _integer_form(s.P)
            return f"ineq:{FLIP[s.rel] if flipped else s.rel}:{_enc(ints)}"
        case "factorization":
            return f"fac:{_enc(_integer_form(s.P)[0])}"
        case "function_value":
            return f"fv:{_raw(s.P)}@{plain(s.t)}"
        case "vertex":
            return f"vx:{_raw(s.P)}"
        case _:
            return f"ext:{s.extreme}:{_raw(s.P)}"


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def canonical_latex(s: Structure) -> str:
    """Dạng chuẩn hiển thị, ví dụ x^2 - 5x + 6 = 0."""
    if s.kind in ("function_value", "vertex", "min_value"):
        return f"y = {poly_latex(s.P)}"
    ints, flipped = _integer_form(s.P)
    P = {k: Fraction(v) for k, v in ints}
    if s.kind == "factorization":
        return poly_latex(P)
    rel = s.rel or "="
    return f"{poly_latex(P)} {REL_LATEX[FLIP[rel] if flipped else rel]} 0"


BASE = {
    "linear_equation": 0.2, "quadratic_equation": 0.4, "quadratic_param": 0.62, "linear_inequality": 0.3,
    "quadratic_inequality": 0.55, "factorization": 0.3, "function_value": 0.18, "vertex": 0.45, "min_value": 0.5,
}


def estimate_difficulty(s: Structure) -> float:
    """Độ khó 0–1 từ đặc trưng cấu trúc: dạng bài, hệ số phân số, hệ số lớn, hệ số đầu khác 1, có tham số, câu hỏi phụ."""
    d = BASE[s.kind]
    cs = list(s.P.values()) if deg_m(s.P) else coeffs_x(s.P)
    if any(c.denominator != 1 for c in cs):
        d += 0.12
    if any(abs(c) > 12 for c in cs):
        d += 0.06
    lead = cs[0] if cs else None
    if deg_x(s.P) >= 2 and lead is not None and abs(lead) != 1:
        d += 0.08
    if s.kind.endswith("inequality") and lead is not None and lead < 0:
        d += 0.06
    if s.ask != "solve":
        d += 0.05
    if deg_x(s.P) == 3:
        d += 0.08
    return math.floor(min(0.95, max(0.05, d)) * 100 + 0.5) / 100
