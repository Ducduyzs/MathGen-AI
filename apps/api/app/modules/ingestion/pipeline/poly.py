"""Số hữu tỉ chính xác (Fraction) và đa thức hai biến x (ẩn), m (tham số).

Đa thức là dict {(bậc x, bậc m): hệ số}, không lưu hệ số 0. Toàn bộ pipeline tính bằng kiểu này nên không có sai số
dấu phẩy động. Chuyển từ apps/web/src/mocks/pipeline/{rational,poly}.ts.
"""

import math
from fractions import Fraction

Poly = dict[tuple[int, int], Fraction]

ZERO = Fraction(0)
ONE = Fraction(1)


# ---------------------------------------------------------------- số hữu tỉ

def latex(a: Fraction) -> str:
    """5, -\\dfrac{3}{2}"""
    if a.denominator == 1:
        return f"{a.numerator}"
    return rf"-\dfrac{{{-a.numerator}}}{{{a.denominator}}}" if a < 0 else rf"\dfrac{{{a.numerator}}}{{{a.denominator}}}"


def plain(a: Fraction) -> str:
    """Dạng chấm điểm: 5, -3/2"""
    return f"{a.numerator}" if a.denominator == 1 else f"{a.numerator}/{a.denominator}"


def from_decimal(s: str) -> Fraction:
    """"1,5" hoặc "1.5" → 3/2"""
    return Fraction(s.replace(",", "."))


def sqrt_exact(a: Fraction) -> Fraction | None:
    """Căn bậc hai đúng của số hữu tỉ không âm; None nếu không phải số chính phương."""
    if a < 0:
        return None
    sn, sd = math.isqrt(a.numerator), math.isqrt(a.denominator)
    return Fraction(sn, sd) if sn * sn == a.numerator and sd * sd == a.denominator else None


def simplify_sqrt(n: int) -> tuple[int, int]:
    """√n = k√r với r không chứa thừa số chính phương."""
    k, r, f = 1, n, 2
    while f * f <= r:
        while r % (f * f) == 0:
            r //= f * f
            k *= f
        f += 1
    return k, r


# ---------------------------------------------------------------- đa thức

def const_p(c: Fraction) -> Poly:
    return {} if c == 0 else {(0, 0): Fraction(c)}


def var_p(v: str) -> Poly:
    return {(1, 0) if v == "x" else (0, 1): ONE}


def add_p(a: Poly, b: Poly) -> Poly:
    out = dict(a)
    for k, c in b.items():
        s = out.get(k, ZERO) + c
        if s == 0:
            out.pop(k, None)
        else:
            out[k] = s
    return out


def neg_p(a: Poly) -> Poly:
    return {k: -c for k, c in a.items()}


def sub_p(a: Poly, b: Poly) -> Poly:
    return add_p(a, neg_p(b))


def mul_p(a: Poly, b: Poly) -> Poly:
    out: Poly = {}
    for (xa, ma), ca in a.items():
        for (xb, mb), cb in b.items():
            out = add_p(out, {(xa + xb, ma + mb): ca * cb})
    return out


def scale_p(a: Poly, c: Fraction) -> Poly:
    return mul_p(a, const_p(c))


def pow_p(a: Poly, n: int) -> Poly:
    out = const_p(ONE)
    for _ in range(n):
        out = mul_p(out, a)
    return out


def is_const(a: Poly) -> bool:
    return all(k == (0, 0) for k in a)


def const_of(a: Poly) -> Fraction:
    return a.get((0, 0), ZERO)


def deg_x(a: Poly) -> int:
    return max((k[0] for k in a), default=0)


def deg_m(a: Poly) -> int:
    return max((k[1] for k in a), default=0)


def coef(a: Poly, ex: int, em: int = 0) -> Fraction:
    return a.get((ex, em), ZERO)


def coeffs_x(a: Poly) -> list[Fraction]:
    """Hệ số theo x, bậc giảm dần (đa thức không chứa m)."""
    d = deg_x(a)
    return [coef(a, d - i) for i in range(d + 1)]


def from_coeffs(cs: list[Fraction]) -> Poly:
    """Đa thức một biến từ danh sách hệ số bậc giảm dần."""
    n = len(cs)
    return {(n - 1 - i, 0): Fraction(c) for i, c in enumerate(cs) if c != 0}


def eval_x(a: Poly, x: Fraction) -> Fraction:
    return sum((c * x**ex for (ex, _), c in a.items()), ZERO)


def poly_latex(a: Poly) -> str:
    """LaTeX theo bậc x giảm dần: x^2 - 5x + 6, \\dfrac{1}{2}x - m"""
    terms = sorted(a.items(), key=lambda kv: (-kv[0][0], -kv[0][1]))
    if not terms:
        return "0"
    out = []
    for i, ((ex, em), c) in enumerate(terms):
        mono = ("" if not ex else "x" if ex == 1 else f"x^{ex}") + ("" if not em else "m" if em == 1 else f"m^{em}")
        coef_str = "" if mono and abs(c) == 1 else latex(abs(c))
        body = f"{coef_str}{mono}"
        out.append((f"-{body}" if c < 0 else body) if i == 0 else (f" - {body}" if c < 0 else f" + {body}"))
    return "".join(out)


# ---------------------------------------------------------------- lưu trữ (JSONB)

def poly_to_json(a: Poly) -> list[list]:
    return [[ex, em, plain(c)] for (ex, em), c in sorted(a.items())]


def poly_from_json(rows: list[list]) -> Poly:
    return {(int(ex), int(em)): Fraction(c) for ex, em, c in rows}
