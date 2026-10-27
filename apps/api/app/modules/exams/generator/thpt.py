"""Dạng bài lớp 10–12 cho đề thi tốt nghiệp THPT (cấu trúc từ 2025), chuyển từ apps/web/src/mocks/thpt-templates.ts.

Phần I nhiều lựa chọn, Phần II Đúng/Sai, Phần III trả lời ngắn. Mỗi lần gọi make() sinh số liệu mới kèm đáp án.
"""

from decimal import ROUND_HALF_UP, Decimal
from math import comb

from app.modules.exams.generator.base import Rng, Template, frac, lin, make_choices, number, p3, poly, registry, tf

THPT: list[Template] = []
template = registry(THPT)


def cubic(b2: int, b1: int, c: int) -> str:
    return poly([(1, "x^3"), (b2, "x^2"), (b1, "x"), (c, "")])


def mono(c: int, e: int) -> str:
    coef = "" if c == 1 else "-" if c == -1 else f"{c}"
    return f"{c}" if e == 0 else f"{coef}x" if e == 1 else f"{coef}x^{{{e}}}"


def iv(a: object, b: object) -> str:
    return rf"({a};\ {b})"


# Bộ ba nguyên (a, b, c) có a² + b² + c² là số chính phương
TRIPLES = [(1, 2, 2, 3), (2, 3, 6, 7), (1, 4, 8, 9), (4, 4, 7, 9), (2, 6, 9, 11), (6, 6, 7, 11), (2, 5, 14, 15), (2, 10, 11, 15)]


def vector3(g: Rng) -> tuple[list[int], int]:
    a, b, c, length = g.pick(TRIPLES)
    return [x if g.coin() else -x for x in g.shuffled([a, b, c])], length


def point3(g: Rng) -> list[int]:
    return [g.rand(-5, 5) for _ in range(3)]


def sq(name: str, a: int) -> str:
    """(x - a)^2 hoặc x^2 khi a = 0."""
    return f"{name}^2" if a == 0 else f"({poly([(1, name), (-a, '')])})^2"


# ================================================================ PHẦN I: nhiều phương án lựa chọn

@template("thpt_monotonic", "Tính đơn điệu của hàm số", "calculus", 12, 0.3, "choice", "choice", "I")
def _(g: Rng):
    p, c = g.rand(1, 3), g.rand(-5, 5)
    m = make_choices(g, iv(0, 2 * p), [r"(-\infty;\ 0)", iv(2 * p, r"+\infty"), iv(-2 * p, 0)])
    return {
        "statement": rf"Hàm số $y = {cubic(-3 * p, 0, c)}$ nghịch biến trên khoảng nào dưới đây?", **m,
        "solution": [rf"$y' = 3x^2 - {6 * p}x = 3x(x - {2 * p})$", rf"$y' < 0 \Leftrightarrow 0 < x < {2 * p}$"],
    }


@template("thpt_extremum", "Cực trị của hàm số", "calculus", 12, 0.35, "choice", "choice", "I")
def _(g: Rng):
    k, c = g.rand(1, 4), g.rand(-5, 5)
    m = make_choices(g, f"x = {k}", [f"x = {-k}", "x = 0", f"x = {k * k}", f"x = {2 * k}"])
    return {
        "statement": rf"Điểm cực tiểu của hàm số $y = {cubic(0, -3 * k * k, c)}$ là", **m,
        "solution": [rf"$y' = 3x^2 - {3 * k * k} = 0 \Leftrightarrow x = \pm {k}$", rf"$y'$ đổi dấu từ âm sang dương khi qua $x = {k}$"],
    }


@template("thpt_asymptote", "Tiệm cận của đồ thị", "calculus", 12, 0.25, "choice", "choice", "I")
def _(g: Rng):
    a, c = g.nonzero(-5, 5), g.nonzero(-5, 5)
    b = g.rand(-6, 6)
    while a * c + b == 0:
        b = g.rand(-6, 6)
    m = make_choices(g, f"y = {a}", [f"x = {c}", f"y = {-a}", f"y = {c}", f"x = {a}", f"y = {a + 1}", f"x = {-c}"])
    return {
        "statement": rf"Tiệm cận ngang của đồ thị hàm số $y = \dfrac{{{lin(a, b)}}}{{{lin(1, -c)}}}$ là đường thẳng", **m,
        "solution": [rf"$\lim\limits_{{x \to \pm\infty}} y = {a}$ nên tiệm cận ngang là $y = {a}$"],
    }


@template("thpt_antiderivative", "Nguyên hàm", "calculus", 12, 0.25, "choice", "choice", "I")
def _(g: Rng):
    n, k = g.rand(1, 3), g.rand(1, 4)
    f = mono((n + 1) * k, n)
    m = make_choices(g, f"{mono(k, n + 1)} + C", [
        f"{mono(n * (n + 1) * k, n - 1)} + C", f"{mono((n + 1) * k, n + 1)} + C", f"{mono(k, n)} + C",
    ])
    return {
        "statement": rf"Họ nguyên hàm của hàm số $f(x) = {f}$ là", **m,
        "solution": [rf"$\displaystyle\int {f}\,dx = {(n + 1) * k} \cdot \dfrac{{x^{{{n + 1}}}}}{{{n + 1}}} + C = {mono(k, n + 1)} + C$"],
    }


@template("thpt_integral_value", "Tích phân", "calculus", 12, 0.4, "choice", "choice", "I")
def _(g: Rng):
    k, a = g.rand(1, 4), g.rand(-4, 5)
    v = k * k + a * k
    m = make_choices(g, f"{v}", [f"{2 * k + a}", f"{k * k}", f"{k * k + 2 * a * k}", f"{v + 1}", f"{v - 1}", f"{v + 2}"])
    return {
        "statement": rf"Giá trị của $\displaystyle\int_0^{{{k}}} ({lin(2, a)})\,dx$ bằng", **m,
        "solution": [rf"$\displaystyle\int_0^{{{k}}} ({lin(2, a)})\,dx = \Big({poly([(1, 'x^2'), (a, 'x')])}\Big)\Big|_0^{{{k}}} = {v}$"],
    }


@template("thpt_log_equation", "Phương trình logarit", "exp_log", 11, 0.35, "choice", "choice", "I")
def _(g: Rng):
    a, k = g.rand(-5, 5), g.rand(1, 4)
    x = a + 2**k
    m = make_choices(g, f"x = {x}", [f"x = {a + 2 * k}", f"x = {2**k - a}", f"x = {x + 1}", f"x = {x - 1}", f"x = {x + 2}"])
    return {
        "statement": rf"Nghiệm của phương trình $\log_2 ({lin(1, -a)}) = {k}$ là", **m,
        "solution": [rf"Điều kiện: $x > {a}$", rf"${lin(1, -a)} = 2^{{{k}}} = {2**k} \Leftrightarrow x = {x}$ (thỏa mãn)"],
    }


@template("thpt_exp_equation", "Phương trình mũ", "exp_log", 11, 0.3, "choice", "choice", "I")
def _(g: Rng):
    b, e, a = g.pick([2, 3, 5]), g.rand(1, 3), g.rand(-4, 4)
    if (e + a) % 2 != 0:
        a += 1
    x = (e + a) // 2
    m = make_choices(g, f"x = {x}", [f"x = {e + a}", f"x = {frac(e - a, 2)}", f"x = {x + 1}", f"x = {x - 1}", f"x = {x + 2}"])
    return {
        "statement": rf"Nghiệm của phương trình ${b}^{{{lin(2, -a)}}} = {b**e}$ là", **m,
        "solution": [rf"${b}^{{{lin(2, -a)}}} = {b}^{{{e}}} \Leftrightarrow {lin(2, -a)} = {e} \Leftrightarrow x = {x}$"],
    }


@template("thpt_pyramid_volume", "Thể tích khối chóp", "geometry_space", 12, 0.35, "choice", "choice", "I")
def _(g: Rng):
    s, h = g.rand(2, 6), 3 * g.rand(1, 4)
    V = s * s * h // 3
    m = make_choices(g, f"{V}", [f"{s * s * h}", frac(s * s * h, 2), f"{s * h}", frac(s * s * h, 6)])
    return {
        "statement": f"Cho khối chóp có đáy là hình vuông cạnh ${s}$ và chiều cao bằng ${h}$. Thể tích của khối chóp đã cho bằng", **m,
        "solution": [rf"$V = \dfrac{{1}}{{3}}Bh$ với $B = {s}^2 = {s * s}$", rf"$V = \dfrac{{1}}{{3}} \cdot {s * s} \cdot {h} = {V}$"],
    }


@template("thpt_oxyz_midpoint", "Tọa độ trung điểm trong không gian", "coordinates_3d", 12, 0.25, "choice", "choice", "I")
def _(g: Rng):
    A = point3(g)
    B = [x + 2 * g.rand(-3, 3) for x in A]
    I = [(x + y) // 2 for x, y in zip(A, B)]  # noqa: E741 — B - A chẵn nên chia hết
    m = make_choices(g, p3(*I), [
        p3(*(x + y for x, y in zip(A, B))), p3(*(y - x for x, y in zip(A, B))), p3(*(-x for x in I)),
        p3(*((y - x) // 2 for x, y in zip(A, B))), p3(*(x + 1 for x in I)), p3(*(x - 1 for x in I)),
    ])
    return {
        "statement": rf"Trong không gian $Oxyz$, cho hai điểm $A{p3(*A)}$ và $B{p3(*B)}$. Tọa độ trung điểm $I$ của đoạn thẳng $AB$ là", **m,
        "solution": [rf"$I\left(\dfrac{{x_A + x_B}}{{2}};\ \dfrac{{y_A + y_B}}{{2}};\ \dfrac{{z_A + z_B}}{{2}}\right) = {p3(*I)}$"],
    }


@template("thpt_sphere", "Tâm và bán kính mặt cầu", "coordinates_3d", 12, 0.3, "choice", "choice", "I")
def _(g: Rng):
    P = point3(g)
    while all(x == 0 for x in P):
        P = point3(g)
    R = g.rand(2, 6)
    neg = [-x for x in P]

    def opt(Q: list[int], rr: int) -> str:
        return rf"I{p3(*Q)},\ R = {rr}"

    m = make_choices(g, opt(P, R), [opt(neg, R), opt(P, R * R), opt(neg, R * R)])
    return {
        "statement": rf"Trong không gian $Oxyz$, mặt cầu $(S): {sq('x', P[0])} + {sq('y', P[1])} + {sq('z', P[2])} = {R * R}$ có tâm $I$ và bán kính $R$ là", **m,
        "solution": [r"Mặt cầu $(x - a)^2 + (y - b)^2 + (z - c)^2 = R^2$ có tâm $I(a;\ b;\ c)$, bán kính $R$",
                     rf"Tâm $I{p3(*P)}$, $R = \sqrt{{{R * R}}} = {R}$"],
    }


@template("thpt_probability_classic", "Xác suất cổ điển", "probability_statistics", 10, 0.3, "choice", "choice", "I")
def _(g: Rng):
    red, blue = g.rand(2, 8), g.rand(2, 8)
    n = red + blue
    m = make_choices(g, frac(red, n), [frac(blue, n), frac(red, blue), frac(1, n), frac(red, n + 1)])
    return {
        "statement": f"Một hộp có ${red}$ viên bi đỏ và ${blue}$ viên bi xanh. Lấy ngẫu nhiên 1 viên bi. Xác suất để lấy được viên bi đỏ là", **m,
        "solution": [rf"$n(\Omega) = {n}$, $n(A) = {red}$", rf"$P(A) = \dfrac{{{red}}}{{{n}}} = {frac(red, n)}$"],
    }


@template("thpt_grouped_range", "Khoảng biến thiên của mẫu số liệu ghép nhóm", "probability_statistics", 11, 0.25, "choice", "choice", "I")
def _(g: Rng):
    a0, w, k = 5 * g.rand(1, 10), g.pick([2, 5, 10]), g.rand(4, 6)
    groups = "; ".join(rf"$[{a0 + i * w};\ {a0 + (i + 1) * w})$: {g.rand(2, 12)}" for i in range(k))
    R = k * w
    m = make_choices(g, f"{R}", [f"{R - w}", f"{a0 + R}", f"{w}", f"{R + w}"])
    return {
        "statement": f"Cho mẫu số liệu ghép nhóm (nhóm: tần số) — {groups}. Khoảng biến thiên của mẫu số liệu ghép nhóm trên là", **m,
        "solution": [rf"$R = a_{{{k + 1}}} - a_1 = {a0 + R} - {a0} = {R}$"],
    }


@template("thpt_arithmetic_seq", "Cấp số cộng", "sequences", 11, 0.25, "choice", "choice", "I")
def _(g: Rng):
    u1, d, n = g.rand(-5, 8), g.nonzero(-4, 5), g.rand(5, 15)
    un = u1 + (n - 1) * d
    m = make_choices(g, f"{un}", [str(x) for x in (u1 + n * d, u1 + (n - 2) * d, (n - 1) * d, un + 1, un - 1, un + 2)])
    return {
        "statement": rf"Cho cấp số cộng $(u_n)$ có $u_1 = {u1}$ và công sai $d = {d}$. Giá trị của $u_{{{n}}}$ bằng", **m,
        "solution": [r"$u_n = u_1 + (n - 1)d$", rf"$u_{{{n}}} = {u1} + {n - 1} \cdot ({d}) = {un}$"],
    }


@template("thpt_geometric_seq", "Cấp số nhân", "sequences", 11, 0.3, "choice", "choice", "I")
def _(g: Rng):
    u1, q, n = g.rand(1, 5), g.pick([2, 3, -2]), g.rand(3, 6)
    un = u1 * q ** (n - 1)
    m = make_choices(g, f"{un}", [str(x) for x in (u1 * q**n, u1 * q ** (n - 2), u1 + (n - 1) * q, -un)])
    return {
        "statement": rf"Cho cấp số nhân $(u_n)$ có $u_1 = {u1}$ và công bội $q = {q}$. Giá trị của $u_{{{n}}}$ bằng", **m,
        "solution": [r"$u_n = u_1 \cdot q^{n - 1}$", rf"$u_{{{n}}} = {u1} \cdot ({q})^{{{n - 1}}} = {un}$"],
    }


# ================================================================ PHẦN II: Đúng/Sai

@template("thpt_tf_function", "Đúng/Sai: khảo sát hàm số bậc ba", "calculus", 12, 0.55, "choice", "true_false", "II")
def _(g: Rng):
    k, c = g.pick([1, 2]), g.rand(-4, 4)
    K, top, bottom = 3 * k * k, 2 * k**3 + c, -2 * k**3 + c
    t = [g.coin() for _ in range(4)]
    q = tf([
        rf"$y' = 3x^2 - {K}$." if t[0] else rf"$y' = 3x^2 - {K}x$.",
        f"Hàm số {'nghịch biến' if t[1] else 'đồng biến'} trên khoảng ${iv(-k, k)}$.",
        f"Giá trị cực đại của hàm số bằng ${top if t[2] else bottom}$.",
        rf"Giá trị lớn nhất của hàm số trên đoạn $[0;\ {2 * k}]$ bằng ${top if t[3] else c}$.",
    ], t)
    return {
        "statement": rf"Cho hàm số $y = {cubic(0, -K, c)}$. Mỗi ý sau đúng hay sai?", **q,
        "solution": [
            rf"$y' = 3x^2 - {K} = 0 \Leftrightarrow x = \pm {k}$; $y' < 0$ trên ${iv(-k, k)}$",
            rf"Cực đại tại $x = {-k}$: $y_{{\text{{CĐ}}}} = {top}$; cực tiểu tại $x = {k}$: $y_{{\text{{CT}}}} ={bottom}$",
            rf"Trên $[0;\ {2 * k}]$: $y(0) = {c}$, $y({k}) = {bottom}$, $y({2 * k}) = {top}$ nên giá trị lớn nhất là ${top}$",
        ],
    }


@template("thpt_tf_integral", "Đúng/Sai: nguyên hàm, tích phân, diện tích", "calculus", 12, 0.55, "choice", "true_false", "II")
def _(g: Rng):
    a, k = g.rand(1, 5), g.rand(1, 4)
    area, d = k * k + a * k, k * k + 2 * k + a * k
    F = poly([(1, "x^2"), (a, "x")])
    t = [g.coin() for _ in range(4)]
    q = tf([
        f"$F(x) = {F if t[0] else poly([(2, 'x^2'), (a, 'x')])}$ là một nguyên hàm của $f(x)$.",
        rf"$\displaystyle\int_0^1 f(x)\,dx = {1 + a if t[1] else 2 + a}$.",
        f"Diện tích hình phẳng giới hạn bởi đồ thị $y = f(x)$, trục hoành và các đường thẳng $x = 0$, $x = {k}$ bằng ${area if t[2] else area + k}$.",
        rf"$\displaystyle\int_1^{{{k + 1}}} f(x)\,dx = {d if t[3] else d + 1}$.",
    ], t)
    return {
        "statement": f"Cho hàm số $f(x) = {lin(2, a)}$. Mỗi ý sau đúng hay sai?", **q,
        "solution": [
            rf"$F(x) = {F}$ là một nguyên hàm của $f(x)$",
            rf"$\displaystyle\int_0^1 f(x)\,dx = F(1) - F(0) = {1 + a}$",
            rf"$f(x) > 0$ trên $[0;\ {k}]$ nên $S = \displaystyle\int_0^{{{k}}} f(x)\,dx = {area}$",
            rf"$\displaystyle\int_1^{{{k + 1}}} f(x)\,dx = F({k + 1}) - F(1) = {d}$",
        ],
    }


@template("thpt_tf_oxyz", "Đúng/Sai: vectơ, khoảng cách trong Oxyz", "coordinates_3d", 12, 0.6, "choice", "true_false", "II")
def _(g: Rng):
    A = point3(g)
    v, length = vector3(g)
    B = [x + y for x, y in zip(A, v)]
    t = [g.coin() for _ in range(4)]
    on_plane = -(2 * A[0] + A[1] - 2 * A[2])
    d = on_plane
    if not t[2]:
        while d == on_plane:
            d = g.nonzero(-9, 9)
    dist = frac(abs(d), 3)
    squares = " + ".join(f"({x})^2" if x < 0 else f"{x}^2" for x in v)
    q = tf([
        rf"$\overrightarrow{{AB}} = {p3(*(v if t[0] else [-x for x in v]))}$.",
        f"$AB = {length if t[1] else length * length}$.",
        "Điểm $A$ thuộc mặt phẳng $(P)$.",
        rf"Khoảng cách từ gốc tọa độ $O$ đến $(P)$ bằng ${dist if t[3] else (1 if d == 0 else abs(d))}$.",
    ], t)
    return {
        "statement": rf"Trong không gian $Oxyz$, cho $A{p3(*A)}$, $B{p3(*B)}$ và mặt phẳng $(P): {poly([(2, 'x'), (1, 'y'), (-2, 'z'), (d, '')])} = 0$. Mỗi ý sau đúng hay sai?", **q,
        "solution": [
            rf"$\overrightarrow{{AB}} = {p3(*v)}$, $AB = \sqrt{{{squares}}} = {length}$",
            rf"Thay $A$ vào $(P)$: ${2 * A[0] + A[1] - 2 * A[2] + d} {'=' if t[2] else r'\ne'} 0$",
            rf"$d(O, (P)) = \dfrac{{|{d}|}}{{\sqrt{{2^2 + 1^2 + 2^2}}}} = {dist}$",
        ],
    }


@template("thpt_tf_probability", "Đúng/Sai: xác suất lấy hai viên bi", "probability_statistics", 10, 0.6, "choice", "true_false", "II")
def _(g: Rng):
    red, blue = g.rand(3, 6), g.rand(2, 5)
    n = red + blue
    total = comb(n, 2)
    t = [g.coin() for _ in range(4)]
    two_red = frac(comb(red, 2), total)
    at_least_blue = frac(total - comb(red, 2), total)
    wrong_c = frac(comb(blue, 2), total)
    if wrong_c == at_least_blue:
        wrong_c = frac(comb(blue, 2) + 1, total)
    q = tf([
        f"Số cách lấy 2 viên bi từ hộp là ${total if t[0] else n * (n - 1)}$.",
        f"Xác suất để lấy được 2 viên bi đỏ là ${two_red if t[1] else frac(red * red, n * n)}$.",
        f"Xác suất để có ít nhất 1 viên bi xanh là ${at_least_blue if t[2] else wrong_c}$.",
        f"Xác suất để lấy được 1 viên bi đỏ và 1 viên bi xanh là ${frac(red * blue, total) if t[3] else frac(red * blue, n * n)}$.",
    ], t)
    return {
        "statement": f"Một hộp có ${red}$ viên bi đỏ và ${blue}$ viên bi xanh. Lấy ngẫu nhiên đồng thời 2 viên bi. Mỗi ý sau đúng hay sai?", **q,
        "solution": [
            rf"$n(\Omega) = C_{{{n}}}^2 = {total}$",
            rf"$P(\text{{2 đỏ}}) = \dfrac{{C_{{{red}}}^2}}{{{total}}} = {two_red}$, nên $P(\text{{ít nhất 1 xanh}}) = 1 - {two_red} = {at_least_blue}$",
            rf"$P(\text{{1 đỏ, 1 xanh}}) = \dfrac{{{red} \cdot {blue}}}{{{total}}} = {frac(red * blue, total)}$",
        ],
    }


# ================================================================ PHẦN III: trả lời ngắn

@template("thpt_prism_volume", "Thể tích khối lăng trụ", "geometry_space", 12, 0.45, "written", "number", "III")
def _(g: Rng):
    a, b, h = 2 * g.rand(1, 4), g.rand(2, 7), g.rand(2, 9)
    base = a * b // 2
    V = base * h
    return {
        "statement": f"Cho khối lăng trụ đứng có đáy là tam giác vuông với hai cạnh góc vuông bằng ${a}$ và ${b}$, chiều cao bằng ${h}$. Tính thể tích khối lăng trụ.",
        "answer_prefix": "V =", "answer": number(V), "answer_display": f"$V = {V}$",
        "solution": [rf"$B = \dfrac{{1}}{{2}} \cdot {a} \cdot {b} = {base}$", rf"$V = Bh = {base} \cdot {h} = {V}$"],
    }


@template("thpt_optimization", "Bài toán tối ưu (ứng dụng đạo hàm)", "calculus", 12, 0.6, "written", "number", "III")
def _(g: Rng):
    P = 4 * g.rand(5, 30)
    half, side = P // 2, P // 4
    return {
        "statement": f"Bác An dùng ${P}$ mét lưới để rào một mảnh vườn hình chữ nhật. Diện tích lớn nhất của mảnh vườn là bao nhiêu mét vuông?",
        "answer_prefix": r"S_{\max} =", "answer": number(side * side), "answer_display": rf"$S_{{\max}} = {side * side}$ m²",
        "solution": [
            rf"Gọi một cạnh là $x$ $(0 < x < {half})$, cạnh còn lại là ${half} - x$",
            rf"$S(x) = x({half} - x)$, $S'(x) = {half} - 2x = 0 \Leftrightarrow x = {side}$",
            rf"$S_{{\max}} = S({side}) = {side * side}$",
        ],
    }


@template("thpt_conditional_prob", "Xác suất có điều kiện", "probability_statistics", 12, 0.65, "written", "number", "III")
def _(g: Rng):
    boys, girls, bm, gm = g.rand(15, 22), g.rand(15, 22), g.rand(3, 9), g.rand(3, 9)
    # Làm tròn nửa lên như toFixed(2) của frontend
    value = str((Decimal(gm) / Decimal(bm + gm)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    shown = value.replace(".", "{,}")
    return {
        "statement": f"Một lớp có ${boys}$ nam và ${girls}$ nữ, trong đó có ${bm}$ nam và ${gm}$ nữ đạt học sinh giỏi. Chọn ngẫu nhiên một học sinh của lớp, biết học sinh đó đạt học sinh giỏi. Tính xác suất để học sinh đó là nữ (làm tròn kết quả đến hàng phần trăm).",
        "answer_prefix": "P =", "answer": number(value), "tolerance": 0.005,
        "answer_display": rf"$P = {frac(gm, bm + gm)} \approx {shown}$",
        "solution": [r'Gọi $A$: "học sinh là nữ", $B$: "học sinh giỏi"',
                     rf"$P(A \mid B) = \dfrac{{n(A \cap B)}}{{n(B)}} = \dfrac{{{gm}}}{{{bm + gm}}} \approx {shown}$"],
    }


@template("thpt_oxyz_distance", "Độ dài đoạn thẳng trong không gian", "coordinates_3d", 12, 0.4, "written", "number", "III")
def _(g: Rng):
    A = point3(g)
    v, length = vector3(g)
    B = [x + y for x, y in zip(A, v)]
    return {
        "statement": rf"Trong không gian $Oxyz$, cho hai điểm $A{p3(*A)}$ và $B{p3(*B)}$. Tính độ dài đoạn thẳng $AB$.",
        "answer_prefix": "AB =", "answer": number(length), "answer_display": f"$AB = {length}$",
        "solution": [rf"$\overrightarrow{{AB}} = {p3(*v)}$", rf"$AB = \sqrt{{{' + '.join(str(x * x) for x in v)}}} = {length}$"],
    }


@template("thpt_integral_cubic", "Tính tích phân", "calculus", 12, 0.5, "written", "number", "III")
def _(g: Rng):
    k, a = g.rand(1, 3), g.rand(-3, 4)
    v = k**3 + a * k * k
    return {
        "statement": rf"Tính $I = \displaystyle\int_0^{{{k}}} ({poly([(3, 'x^2'), (2 * a, 'x')])})\,dx$.",
        "answer_prefix": "I =", "answer": number(v), "answer_display": f"$I = {v}$",
        "solution": [rf"$I = \Big({poly([(1, 'x^3'), (a, 'x^2')])}\Big)\Big|_0^{{{k}}} = {v}$"],
    }


@template("thpt_arith_sum", "Tổng cấp số cộng", "sequences", 11, 0.5, "written", "number", "III")
def _(g: Rng):
    u1, d, n = g.rand(-5, 10), g.nonzero(-3, 5), g.rand(8, 20)
    S = n * (2 * u1 + (n - 1) * d) // 2  # luôn chia hết
    return {
        "statement": f"Cho cấp số cộng có $u_1 = {u1}$ và công sai $d = {d}$. Tính tổng ${n}$ số hạng đầu tiên.",
        "answer_prefix": rf"S_{{{n}}} =", "answer": number(S), "answer_display": rf"$S_{{{n}}} = {S}$",
        "solution": [r"$S_n = \dfrac{n[2u_1 + (n - 1)d]}{2}$",
                     rf"$S_{{{n}}} = \dfrac{{{n} \cdot [{2 * u1} + {n - 1} \cdot ({d})]}}{{2}} = {S}$"],
    }


@template("thpt_log_short", "Phương trình logarit (trả lời ngắn)", "exp_log", 11, 0.45, "written", "number", "III")
def _(g: Rng):
    a, k = g.rand(-6, 6), g.rand(1, 3)
    x = 3**k - a
    return {
        "statement": rf"Tìm nghiệm của phương trình $\log_3 ({lin(1, a)}) = {k}$.",
        "answer_prefix": "x =", "answer": number(x), "answer_display": f"$x = {x}$",
        "solution": [rf"Điều kiện: $x > {-a}$", rf"${lin(1, a)} = 3^{{{k}}} = {3**k} \Leftrightarrow x = {x}$"],
    }
