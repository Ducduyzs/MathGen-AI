"""Kiểm chứng độc lập bằng SymPy (chỉ chạy trong worker, không trong request).

Bộ giải chính (solve.py) và SymPy là hai cách giải khác nhau; chỉ khi hai bên khớp nhau thì lời giải mới được coi là
đã kiểm chứng. So trên `facts` của bộ giải: tập nghiệm, nghiệm vô tỉ, tập nghiệm bất phương trình, đỉnh, giá trị.
"""

from fractions import Fraction

import sympy as sp

from app.modules.ingestion.pipeline.poly import Poly
from app.modules.ingestion.pipeline.solve import Solved
from app.modules.ingestion.pipeline.structure import Structure

x, m = sp.symbols("x m", real=True)
_REL = {"=": sp.Eq, "<": sp.Lt, ">": sp.Gt, "<=": sp.Le, ">=": sp.Ge}


def to_sympy(P: Poly) -> sp.Expr:
    return sp.Add(*(sp.Rational(c.numerator, c.denominator) * x**ex * m**em for (ex, em), c in P.items()))


def _q(v: str) -> sp.Rational:
    f = Fraction(v)
    return sp.Rational(f.numerator, f.denominator)


def _region_set(region: list[list]) -> sp.Set:
    parts = []
    for lo, lo_closed, hi, hi_closed in region:
        a = _q(lo) if lo is not None else -sp.oo
        b = _q(hi) if hi is not None else sp.oo
        parts.append(sp.Interval(a, b, left_open=not lo_closed, right_open=not hi_closed))
    return sp.Union(*parts) if parts else sp.S.EmptySet


def verify(s: Structure, solved: Solved) -> bool:
    """True nếu SymPy cho cùng kết quả với bộ giải."""
    f, P = solved.facts, to_sympy(s.P)
    match s.kind:
        case "linear_equation" | "quadratic_equation":
            roots = sp.solveset(sp.Eq(P, 0), x, sp.S.Reals)
            if "irr" in f:
                u, v, r = f["irr"]
                return roots == sp.FiniteSet(_q(u) - _q(v) * sp.sqrt(r), _q(u) + _q(v) * sp.sqrt(r))
            return roots == sp.FiniteSet(*(_q(v) for v in f["roots"]))
        case "quadratic_param":
            delta = sp.discriminant(sp.Poly(P, x), x).as_expr()
            need = {"distinct": ">", "double": "=", "none": "<", "some": ">="}[s.cond or "distinct"]
            got = sp.solveset(_REL[need](delta, 0), m, sp.S.Reals)
            want = sp.solveset(_REL[f["m_rel"]](m, _q(f["m_bound"])), m, sp.S.Reals)
            return got == want
        case "linear_inequality" | "quadratic_inequality":
            got = sp.solveset(_REL[s.rel](P, 0), x, sp.S.Reals)
            return got == _region_set(f["region"])
        case "factorization":
            # Nghiệm (kể cả bội) của đa thức khớp các nhân tử của bộ giải
            want = sorted(_q(v) for v in f["roots"])
            got = sorted(sp.roots(sp.Poly(P, x), multiple=True))
            return len(got) == sp.degree(P, x) and got == want
        case "function_value":
            return P.subs(x, sp.Rational(s.t.numerator, s.t.denominator)) == _q(f["value"])
        case "vertex" | "min_value":
            h, k = (_q(v) for v in f["vertex"])
            crit = sp.solveset(sp.Eq(sp.diff(P, x), 0), x, sp.S.Reals)
            return crit == sp.FiniteSet(h) and P.subs(x, h) == k
    return False
