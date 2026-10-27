"""Giải chính xác từng dạng bài và tự kiểm chứng (thế ngược nghiệm, thử điểm, Vi-ét, nhân lại nhân tử).

Chạy được trong request (chỉ số học phân số, không SymPy). Worker kiểm chứng thêm một lần độc lập bằng SymPy
(xem sympy_check.py) dựa trên `facts`. Chuyển từ apps/web/src/mocks/pipeline/solve.ts.
"""

import math
from dataclasses import dataclass, field, replace
from fractions import Fraction

from app.modules.ingestion.pipeline.poly import (
    ONE, ZERO, Poly, add_p, coef, coeffs_x, const_p, deg_x, eval_x, from_coeffs, latex, mul_p, plain, poly_latex, scale_p,
    simplify_sqrt, sqrt_exact, var_p,
)
from app.modules.ingestion.pipeline.structure import FLIP, REL_LATEX, Structure


class SolveError(Exception):
    pass


@dataclass
class Solved:
    #: Khóa so sánh đáp án (kiểm chứng ngược)
    key: str
    #: Đáp án hiển thị, có $...$
    display: str
    steps: list[str]
    checks: list[dict]
    #: Đáp số một số (khi câu hỏi yêu cầu một số)
    short: Fraction | None = None
    short_label: str | None = None
    #: Nội dung khi làm phương án trắc nghiệm (mặc định = display)
    choice_text: str | None = None
    #: Dữ kiện có cấu trúc cho bộ kiểm chứng SymPy: roots, irr, region, value, vertex…
    facts: dict = field(default_factory=dict)


def holds(v: Fraction, rel: str) -> bool:
    return {"=": v == 0, "<": v < 0, ">": v > 0, "<=": v <= 0, ">=": v >= 0}[rel]


def _mono(c: Fraction, v: str = "x") -> str:
    return poly_latex(scale_p(var_p(v), c))


def _set(xs: list[Fraction]) -> str:
    return r"S = \left\{" + r";\ ".join(latex(x) for x in xs) + r"\right\}"


def check(label: str, passed: bool) -> dict:
    return {"label": label, "passed": bool(passed)}


@dataclass
class _Roots:
    delta: Fraction
    kind: str  # none | rational | irrational
    roots: list[Fraction]
    u: Fraction | None = None
    v: Fraction | None = None
    r: int | None = None


def quad_roots(a: Fraction, b: Fraction, c: Fraction) -> _Roots:
    """Nghiệm của ax² + bx + c (a ≠ 0)."""
    delta = b * b - 4 * a * c
    two_a = 2 * a
    if delta < 0:
        return _Roots(delta, "none", [])
    if (s := sqrt_exact(delta)) is not None:
        r = sorted([(-b - s) / two_a, (-b + s) / two_a])
        return _Roots(delta, "rational", [r[0]] if r[0] == r[1] else r)
    # Δ = n/d → √Δ = √(n·d)/d = k√r/d
    k, r = simplify_sqrt(delta.numerator * delta.denominator)
    return _Roots(delta, "irrational", [], u=-b / two_a, v=abs(Fraction(k, delta.denominator) / two_a), r=r)


def _count(lo: int, hi: int) -> int:
    return max(0, hi - lo + 1)


def _region(intervals: list[tuple]) -> list[list]:
    """Tập nghiệm dạng hợp các khoảng [lo, lo_kín, hi, hi_kín] (None = vô cực) để SymPy so lại."""
    return [[plain(lo) if lo is not None else None, lc, plain(hi) if hi is not None else None, hc] for lo, lc, hi, hc in intervals]


def solve(s: Structure) -> Solved:  # noqa: C901 — mỗi nhánh là một dạng bài
    P = s.P
    match s.kind:
        case "linear_equation":
            a, b = coef(P, 1), coef(P, 0)
            x0 = -b / a
            return Solved(
                key=f"x={plain(x0)}", display=f"$x = {latex(x0)}$",
                steps=[f"${_mono(a)} = {latex(-b)}$", f"$x = {latex(x0)}$"], short=x0, short_label="x =",
                checks=[check(f"Thế $x = {latex(x0)}$ vào phương trình: hai vế bằng nhau", eval_x(P, x0) == 0)],
                facts={"roots": [plain(x0)]},
            )

        case "quadratic_equation":
            a, b, c = coeffs_x(P)
            R = quad_roots(a, b, c)
            delta_step = rf"$\Delta = b^2 - 4ac = {latex(R.delta)}$"
            total, prod = -b / a, c / a
            if R.kind == "none":
                if s.ask != "solve":
                    raise SolveError("Phương trình vô nghiệm, không hỏi được đáp số")
                return Solved(key="none", display="Phương trình vô nghiệm", steps=[delta_step, r"$\Delta < 0$ nên phương trình vô nghiệm"],
                              checks=[check(r"$\Delta < 0$: phương trình vô nghiệm", R.delta < 0)], facts={"roots": []})
            if R.kind == "irrational":
                v_tex = "" if R.v == 1 else latex(R.v)
                u_tex = "" if R.u == 0 else f"{latex(R.u)} "
                display = rf"$x = {u_tex}\pm {v_tex}\sqrt{{{R.r}}}$"
                # Vi-ét: (u + v√r) + (u − v√r) = 2u, (u + v√r)(u − v√r) = u² − v²r
                vieta = 2 * R.u == total and R.u * R.u - R.v * R.v * R.r == prod
                if s.ask == "max_root":
                    raise SolveError("Nghiệm vô tỉ, không hỏi được nghiệm lớn nhất dạng số")
                sum_ask = s.ask == "sum_roots"
                return Solved(
                    key=f"sum={plain(total)}" if sum_ask else f"irr:{plain(R.u)}:{plain(R.v)}:{R.r}",
                    display=f"$x_1 + x_2 = {latex(total)}$" if sum_ask else display,
                    steps=[delta_step, rf"$x = \dfrac{{-b \pm \sqrt{{\Delta}}}}{{2a}}$ nên {display}"],
                    short=total if sum_ask else None, short_label="x_1 + x_2 =" if sum_ask else None,
                    checks=[check(r"Kiểm tra Vi-ét: tổng và tích hai nghiệm khớp $-\dfrac{b}{a}$ và $\dfrac{c}{a}$", vieta)],
                    facts={"irr": [plain(R.u), plain(R.v), R.r]},
                )
            roots = R.roots
            subst = all(eval_x(P, r) == 0 for r in roots)
            steps = [delta_step, f"Phương trình có nghiệm kép $x = {latex(roots[0])}$" if len(roots) == 1
                     else f"$x_1 = {latex(roots[0])}$, $x_2 = {latex(roots[1])}$"]
            checks = [check(f"Thế {'nghiệm' if len(roots) == 1 else 'từng nghiệm'} vào phương trình: đều bằng 0", subst)]
            facts = {"roots": [plain(r) for r in roots]}
            if s.ask == "max_root":
                m = roots[-1]
                return Solved(key=f"max={plain(m)}", display=f"$x = {latex(m)}$", steps=steps, checks=checks, short=m, short_label="x =", facts=facts)
            if s.ask == "sum_roots":
                return Solved(key=f"sum={plain(total)}", display=f"$x_1 + x_2 = {latex(total)}$", steps=steps, checks=checks,
                              short=total, short_label="x_1 + x_2 =", facts=facts)
            return Solved(
                key="roots:" + ",".join(plain(r) for r in roots),
                display=f"$x = {latex(roots[0])}$ (nghiệm kép)" if len(roots) == 1 else f"${_set(roots)}$",
                steps=steps, checks=checks, short=roots[0] if len(roots) == 1 else None,
                short_label="x =" if len(roots) == 1 else None, facts=facts,
            )

        case "quadratic_param":
            # P = ax² + bx + (c0 + c1·m) → Δ(m) = K − L·m
            a, b, c0, c1 = coef(P, 2), coef(P, 1), coef(P, 0), coef(P, 0, 1)
            K = b * b - 4 * a * c0
            L = 4 * a * c1
            B = K / L
            delta_m = add_p(const_p(K), scale_p(var_p("m"), -L))
            need = {"distinct": ">", "double": "=", "none": "<", "some": ">="}[s.cond or "distinct"]
            # K − L·m (need) 0 ⇔ L·m (FLIP need) K ⇔ m (… đổi chiều nếu L < 0) B
            rel_m = "=" if need == "=" else (FLIP[need] if L > 0 else need)
            display = f"$m {REL_LATEX[rel_m]} {latex(B)}$"
            inside = B if rel_m == "=" else (B - 1 if rel_m.startswith("<") else B + 1)
            outside = B + 1 if rel_m == "=" else (B + 1 if rel_m.startswith("<") else B - 1)
            ok = holds(K - L * inside, need) and not holds(K - L * outside, need)
            short = None
            if s.ask == "max_int_m":
                if rel_m == "<":
                    short = Fraction(math.ceil(B) - 1)
                elif rel_m == "<=":
                    short = Fraction(math.floor(B))
                else:
                    raise SolveError("Tập giá trị của m không bị chặn trên")
            elif s.ask == "min_int_m":
                if rel_m == ">":
                    short = Fraction(math.floor(B) + 1)
                elif rel_m == ">=":
                    short = Fraction(math.ceil(B))
                else:
                    raise SolveError("Tập giá trị của m không bị chặn dưới")
            elif rel_m == "=":
                short = B
            solve_ask = s.ask == "solve"
            return Solved(
                key=f"m{rel_m}{plain(B)}" if solve_ask else f"{s.ask}={plain(short)}",
                display=display if solve_ask else f"$m = {latex(short)}$",
                steps=[rf"$\Delta = {poly_latex(delta_m)}$", rf"Cần $\Delta {REL_LATEX[need]} 0 \Leftrightarrow {display[1:-1]}$",
                       *([f"Giá trị nguyên {'lớn nhất' if s.ask == 'max_int_m' else 'nhỏ nhất'} là $m = {latex(short)}$"] if not solve_ask else [])],
                short=short, short_label="m =",
                checks=[check(f"Thử $m = {latex(inside)}$ (thỏa) và $m = {latex(outside)}$ (không thỏa): đúng điều kiện của $\\Delta$", ok)],
                facts={"m_rel": rel_m, "m_bound": plain(B)},
            )

        case "linear_inequality":
            a, b = coef(P, 1), coef(P, 0)
            x0 = -b / a
            rel = FLIP[s.rel] if a < 0 else s.rel
            display = f"$x {REL_LATEX[rel]} {latex(x0)}$"
            inside = x0 - 1 if rel.startswith("<") else x0 + 1
            outside = x0 + 1 if rel.startswith("<") else x0 - 1
            ok = holds(eval_x(P, inside), s.rel) and not holds(eval_x(P, outside), s.rel)
            short = None
            if s.ask == "min_int":
                if rel == ">":
                    short = Fraction(math.floor(x0) + 1)
                elif rel == ">=":
                    short = Fraction(math.ceil(x0))
                else:
                    raise SolveError("Tập nghiệm không bị chặn dưới")
            elif s.ask == "max_int":
                if rel == "<":
                    short = Fraction(math.ceil(x0) - 1)
                elif rel == "<=":
                    short = Fraction(math.floor(x0))
                else:
                    raise SolveError("Tập nghiệm không bị chặn trên")
            closed = rel in ("<=", ">=")
            region = [(None, False, x0, closed)] if rel.startswith("<") else [(x0, closed, None, False)]
            return Solved(
                key=f"{s.ask}={plain(short)}" if short is not None else f"x{rel}{plain(x0)}",
                display=f"$x = {latex(short)}$" if short is not None else display,
                steps=[f"${_mono(a)} {REL_LATEX[s.rel]} {latex(-b)}$",
                       f"Chia hai vế cho ${latex(a)} < 0$ và đổi chiều: {display}" if a < 0 else f"Chia hai vế cho ${latex(a)}$: {display}",
                       *([f"Số nguyên {'nhỏ nhất' if s.ask == 'min_int' else 'lớn nhất'} thỏa mãn là ${latex(short)}$"] if short is not None else [])],
                short=short, short_label="x =" if short is not None else None,
                checks=[check(f"Thử $x = {latex(inside)}$ (thỏa) và $x = {latex(outside)}$ (không thỏa)", ok)],
                facts={"region": _region(region)},
            )

        case "quadratic_inequality":
            a, b, c = coeffs_x(P)
            rel = s.rel
            flipped = a < 0
            if flipped:
                a, b, c, rel = -a, -b, -c, FLIP[rel]
            R = quad_roots(a, b, c)
            if R.kind == "irrational":
                raise SolveError("Chưa hỗ trợ bất phương trình bậc hai có nghiệm vô tỉ")
            strict = rel in ("<", ">")
            above = rel.startswith(">")
            r1, r2 = (R.roots[0], R.roots[-1]) if R.roots else (None, None)
            ints: int | None = None
            region: list[tuple]
            if R.kind == "none":
                display = r"$S = \mathbb{R}$" if above else r"$S = \varnothing$"
                ints = None if above else 0
                region = [(None, False, None, False)] if above else []
            elif len(R.roots) == 1:
                if above:
                    display = rf"$S = \mathbb{{R}} \setminus \left\{{{latex(r1)}\right\}}$" if strict else r"$S = \mathbb{R}$"
                    region = [(None, False, r1, False), (r1, False, None, False)] if strict else [(None, False, None, False)]
                else:
                    display = r"$S = \varnothing$" if strict else rf"$S = \left\{{{latex(r1)}\right\}}$"
                    region = [] if strict else [(r1, True, r1, True)]
                ints = None if above else (0 if strict else (1 if r1.denominator == 1 else 0))
            elif above:
                display = (rf"$S = (-\infty;\ {latex(r1)}{')' if strict else ']'} \cup {'(' if strict else '['}{latex(r2)};\ +\infty)$")
                region = [(None, False, r1, not strict), (r2, not strict, None, False)]
            else:
                display = f"$S = {'(' if strict else '['}{latex(r1)};\\ {latex(r2)}{')' if strict else ']'}$"
                ints = _count(math.floor(r1) + 1, math.ceil(r2) - 1) if strict else _count(math.ceil(r1), math.floor(r2))
                region = [(r1, not strict, r2, not strict)]

            # Thử điểm ở từng khoảng: trái r1, giữa, phải r2
            probes = ([r1 - 1, *([(r1 + r2) / 2] if len(R.roots) == 2 else []), r2 + 1] if R.roots else [ZERO])

            def in_set(x: Fraction) -> bool:
                if R.kind == "none":
                    return above
                if len(R.roots) == 1:
                    return (not strict) if x == r1 else above
                between = r1 < x < r2
                return not between if above else between

            ok = all(holds(eval_x(P, x), s.rel) == in_set(x) for x in probes)
            if s.ask == "count_int" and ints is None:
                raise SolveError("Tập nghiệm có vô số số nguyên")
            count_ask = s.ask == "count_int"
            steps = [
                *([f"Nhân hai vế với $-1$ và đổi chiều: ${poly_latex(from_coeffs([a, b, c]))} {REL_LATEX[rel]} 0$"] if flipped else []),
                (f"Tam thức có nghiệm {' và '.join(f'${latex(r)}$' for r in R.roots)}, hệ số $a > 0$" if R.roots
                 else rf"$\Delta = {latex(R.delta)} < 0$, tam thức luôn dương"),
                f"Tập nghiệm: {display}",
            ]
            return Solved(
                key=f"count={ints}" if count_ask else f"qi:{display}",
                display=f"Có ${ints}$ nghiệm nguyên" if count_ask else display,
                steps=steps, short=Fraction(ints) if count_ask and ints is not None else None,
                short_label=r"\text{Số nghiệm nguyên} =" if count_ask else None,
                checks=[check("Thử một điểm trong mỗi khoảng chia bởi các nghiệm: đúng dấu", ok)],
                facts={"region": _region(region)},
            )

        case "factorization":
            cubic = deg_x(P) == 3
            if cubic and coef(P, 0) != 0:
                raise SolveError("Đa thức bậc ba không có nhân tử chung x")
            Q2 = from_coeffs(coeffs_x(P)[:3]) if cubic else P  # P = x·Q2
            a, b, c = coeffs_x(Q2)
            R = quad_roots(a, b, c)
            if R.kind != "rational":
                raise SolveError("Tam thức không phân tích được thành nhân tử hữu tỉ")
            roots = [R.roots[0], R.roots[0]] if len(R.roots) == 1 else R.roots
            # (d·x − n) với nghiệm n/d; hệ số còn lại k = a / (d1·d2)
            factors = [from_coeffs([Fraction(r.denominator), Fraction(-r.numerator)]) for r in roots]
            k = a / (roots[0].denominator * roots[1].denominator)

            def f_tex(f: Poly) -> str:
                return "x" if deg_x(f) == 1 and coef(f, 0) == 0 and coef(f, 1) == 1 else f"({poly_latex(f)})"

            body = f"{f_tex(factors[0])}^2" if len(R.roots) == 1 else "".join(f_tex(f) for f in factors)
            k_tex = "" if k == 1 else "-" if k == -1 else latex(k)
            form = f"{k_tex}{'x' if cubic else ''}{body}"
            expanded = scale_p(mul_p(mul_p(factors[0], factors[1]), var_p("x") if cubic else const_p(ONE)), k)
            same = poly_latex(expanded) == poly_latex(P)
            short = None
            if s.ask == "b_factor":
                if a != 1 or cubic or len(R.roots) != 2 or not all(r.denominator == 1 for r in roots):
                    raise SolveError("Không đưa được về dạng (x − a)(x − b) nguyên")
                short = roots[1]
            return Solved(
                key=f"b={plain(short)}" if short is not None else f"factor:{form}",
                display=f"$b = {latex(short)}$" if short is not None else f"${poly_latex(P)} = {form}$",
                choice_text=None if short is not None else f"${form}$",
                steps=[*([f"Đặt nhân tử chung: ${poly_latex(P)} = x({poly_latex(Q2)})$"] if cubic else []),
                       f"Tam thức ${poly_latex(Q2)}$ có nghiệm {' và '.join(f'${latex(r)}$' for r in R.roots)}",
                       f"${poly_latex(P)} = {form}$",
                       *([f"Vậy $a = {latex(roots[0])}$, $b = {latex(short)}$"] if short is not None else [])],
                short=short, short_label="b =" if short is not None else None,
                checks=[check("Nhân lại các nhân tử được đúng đa thức ban đầu", same)],
                facts={"roots": [plain(r) for r in ([ZERO] if cubic else []) + roots], "lead": plain(a)},
            )

        case "function_value":
            v = eval_x(P, s.t)
            return Solved(
                key=f"y={plain(v)}", display=f"$y = {latex(v)}$",
                steps=[f"Thay $x = {latex(s.t)}$ vào $y = {poly_latex(P)}$", f"$y = {latex(v)}$"], short=v, short_label="y =",
                checks=[check("Tính lại bằng cách thế trực tiếp: cùng kết quả", v == eval_x(P, s.t))], facts={"value": plain(v)},
            )

        case "vertex" | "min_value":
            a, b, _ = coeffs_x(P)
            h = -b / (2 * a)
            k = eval_x(P, h)
            deriv = 2 * a * h + b  # y'(h) = 2ah + b
            checks = [check(f"Đạo hàm $y' = 2ax + b$ bằng 0 tại $x = {latex(h)}$", deriv == 0)]
            facts = {"vertex": [plain(h), plain(k)]}
            if s.kind == "vertex":
                vx = s.ask == "vertex_x"
                return Solved(
                    key=f"vx={plain(h)}" if vx else f"v:{plain(h)},{plain(k)}",
                    display=f"$x_0 = {latex(h)}$" if vx else rf"$I\left({latex(h)};\ {latex(k)}\right)$",
                    steps=[rf"$x_0 = -\dfrac{{b}}{{2a}} = {latex(h)}$", f"$y_0 = y({latex(h)}) = {latex(k)}$"],
                    short=h if vx else None, short_label="x_0 =" if vx else None, checks=checks, facts=facts,
                )
            want_min = s.extreme != "max"
            if (a > 0) != want_min:
                raise SolveError("Hàm số không có giá trị nhỏ nhất (a < 0)" if want_min else "Hàm số không có giá trị lớn nhất (a > 0)")
            name = r"\min" if want_min else r"\max"
            return Solved(
                key=f"{name}={plain(k)}", display=f"$y_{{{name}}} = {latex(k)}$ khi $x = {latex(h)}$",
                steps=[rf"$a = {latex(a)} {'>' if want_min else '<'} 0$, đỉnh tại $x = -\dfrac{{b}}{{2a}} = {latex(h)}$",
                       f"$y_{{{name}}} = y({latex(h)}) = {latex(k)}$"],
                short=k, short_label=f"y_{{{name}}} =",
                checks=[*checks, check(f"Hệ số $a {'> 0' if want_min else '< 0'}$ nên đỉnh là điểm {'thấp' if want_min else 'cao'} nhất", True)],
                facts=facts,
            )
    raise SolveError(f"Chưa hỗ trợ dạng {s.kind}")


def near_misses(s: Structure) -> list[Structure]:
    """Biến đổi nhỏ trên cấu trúc để tạo phương án nhiễu "giống lỗi học sinh hay mắc"."""
    out: list[Structure] = []
    # Có nghiệm hữu tỉ: nhiễu bằng đổi dấu hoặc lệch một nghiệm, để phương án sai vẫn "trông hợp lý".
    # Bậc ba có nhân tử chung x: nhiễu trên tam thức rồi nhân lại với x.
    cubic = s.kind == "factorization" and deg_x(s.P) == 3 and coef(s.P, 0) == 0
    if s.kind in ("quadratic_equation", "factorization") and (deg_x(s.P) == 2 or cubic):
        a, b, c = coeffs_x(s.P)[:3]
        R = quad_roots(a, b, c)
        if R.kind == "rational":
            p, t = R.roots[0], R.roots[-1]

            def from_roots_q(u: Fraction, v: Fraction) -> Poly:
                P = from_coeffs([a, -(a * (u + v)), a * u * v])
                return mul_p(P, var_p("x")) if cubic else P

            for u, v in [(-p, t), (p, -t), (-p, -t), (p + 1, t - 1), (p - 1, t + 1), (p + 1, t)]:
                P = from_roots_q(u, v)
                if poly_latex(P) != poly_latex(s.P):
                    out.append(replace(s, P=P))

    def flip_coef(ex: int) -> Poly | None:
        c = coef(s.P, ex)
        if c == 0:
            return None
        mono = const_p(ONE) if ex == 0 else var_p("x") if ex == 1 else mul_p(var_p("x"), var_p("x"))
        return add_p(s.P, scale_p(mono, -2 * c))

    def shift(d: int) -> Poly:
        return add_p(s.P, const_p(Fraction(d)))

    for P in [flip_coef(1), flip_coef(0), shift(1), shift(-1), shift(2), shift(-2), shift(3)]:
        if P:
            out.append(replace(s, P=P))
    if s.rel and s.rel != "=":
        out.insert(0, replace(s, rel=FLIP[s.rel]))
        toggle = {"=": "=", "<": "<=", "<=": "<", ">": ">=", ">=": ">"}
        out.insert(0, replace(s, rel=toggle[s.rel]))
    if s.kind == "quadratic_param":
        for cond in ("distinct", "none", "some", "double"):
            if cond != s.cond:
                out.insert(0, replace(s, cond=cond))
    if s.kind == "function_value" and s.t is not None:
        out[:0] = [replace(s, t=-s.t), replace(s, t=s.t + 1)]
    return out
