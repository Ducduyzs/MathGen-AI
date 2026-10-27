"""Dạng bài Đại số lớp 8–10 cho đề ôn tập (chuyển từ apps/web/src/mocks/exam-generator.ts)."""

from app.modules.exams.generator.base import (
    Rng, Template, factor, frac, lin, make_choices, num_sum, number, poly, quad, registry, tf,
)

ALGEBRA: list[Template] = []
template = registry(ALGEBRA)


# ---------------------------------------------------------------- trắc nghiệm A/B/C/D

@template("lin_eq_choice", "Phương trình bậc nhất", "linear_equation", 8, 0.2, "choice", "choice")
def _(g: Rng):
    a, x0, b = g.rand(2, 9), g.rand(-9, 9), g.nonzero(-15, 15)
    c = a * x0 + b
    m = make_choices(g, f"x = {x0}", [f"x = {v}" for v in (x0 + 1, x0 - 1, -x0, x0 + 2, x0 - 2)])
    return {
        "statement": rf"Nghiệm của phương trình ${lin(a, b)} = {c}$ là", **m,
        "solution": [rf"${a}x = {c} {'+' if b < 0 else '-'} {abs(b)} = {c - b}$", rf"$x = {x0}$"],
    }


@template("factor_diff_squares", "Hằng đẳng thức hiệu hai bình phương", "factorization", 8, 0.3, "choice", "choice")
def _(g: Rng):
    k = g.rand(2, 12)
    m = make_choices(g, f"(x - {k})(x + {k})", [f"(x - {k})^2", f"(x + {k})^2", f"(x - {k * k})(x + 1)", f"x(x - {k * k})"])
    return {
        "statement": rf"Phân tích đa thức $x^2 - {k * k}$ thành nhân tử.", **m,
        "solution": [rf"$x^2 - {k * k} = x^2 - {k}^2 = (x - {k})(x + {k})$"],
    }


@template("factor_trinomial", "Phân tích tam thức bậc hai", "factorization", 8, 0.5, "choice", "choice")
def _(g: Rng):
    p, q = g.distinct_pair(1, 9)
    m = make_choices(g, f"{factor(p)}{factor(q)}", [
        f"{factor(-p)}{factor(-q)}", f"{factor(p)}{factor(-q)}", f"{factor(-p)}{factor(q)}", f"{factor(p + q)}{factor(1)}",
    ])
    return {
        "statement": rf"Phân tích đa thức ${quad(-(p + q), p * q)}$ thành nhân tử.", **m,
        "solution": [rf"Hai số có tổng ${p + q}$ và tích ${p * q}$ là ${p}$ và ${q}$",
                     rf"${quad(-(p + q), p * q)} = {factor(p)}{factor(q)}$"],
    }


SIGNS = [">", "<", r"\ge", r"\le"]
FLIP = {">": "<", "<": ">", r"\ge": r"\le", r"\le": r"\ge"}


@template("ineq_linear_choice", "Bất phương trình bậc nhất", "inequality", 8, 0.45, "choice", "choice")
def _(g: Rng):
    a, x0, b = g.pick([-5, -4, -3, -2, 2, 3, 4, 5]), g.rand(-6, 6), g.nonzero(-10, 10)
    c = a * x0 + b
    s = g.pick(SIGNS)
    res = FLIP[s] if a < 0 else s
    m = make_choices(g, f"x {res} {x0}", [f"x {sg} {x0}" for sg in SIGNS])
    return {
        "statement": rf"Giải bất phương trình ${lin(a, b)} {s} {c}$.", **m,
        "solution": [
            rf"${poly([(a, 'x')])} {s} {c - b}$",
            rf"Chia hai vế cho ${a} < 0$ và đổi chiều: $x {res} {x0}$" if a < 0 else rf"Chia hai vế cho ${a}$: $x {res} {x0}$",
        ],
    }


@template("quad_param_choice", "Điều kiện có hai nghiệm phân biệt", "quadratic_equation", 9, 0.7, "choice", "choice")
def _(g: Rng):
    b = g.rand(2, 9)
    F = frac(b * b, 4)
    m = make_choices(g, f"m < {F}", [f"m > {F}", rf"m \le {F}", rf"m \ge {F}", f"m < {b * b}"])
    return {
        "statement": rf"Tìm $m$ để phương trình $x^2 - {b}x + m = 0$ có hai nghiệm phân biệt.", **m,
        "solution": [rf"$\Delta = {b * b} - 4m$", rf"$\Delta > 0 \Leftrightarrow m < {F}$"],
    }


@template("func_value_choice", "Giá trị hàm số bậc nhất", "function", 9, 0.25, "choice", "choice")
def _(g: Rng):
    a, b, t = g.nonzero(-5, 5), g.nonzero(-9, 9), g.nonzero(-4, 4)
    v = a * t + b
    m = make_choices(g, f"{v}", [str(x) for x in (v + a, v - a, -v, a * t - b, v + 1, v - 1)])
    return {
        "statement": rf"Cho hàm số $y = {lin(a, b)}$. Giá trị của $y$ khi $x = {t}$ là", **m,
        "solution": [rf"$y = {a} \cdot ({t}) {'-' if b < 0 else '+'} {abs(b)} = {v}$"],
    }


@template("vertex_choice", "Tọa độ đỉnh parabol", "function", 10, 0.55, "choice", "choice")
def _(g: Rng):
    b, c = g.pick([-8, -6, -4, -2, 2, 4, 6, 8]), g.rand(-5, 6)
    h, k = -b // 2, c - b * b // 4  # b chẵn nên chia hết

    def pt(x: int, y: int) -> str:
        return rf"({x};\ {y})"

    m = make_choices(g, pt(h, k), [pt(-h, k), pt(h, -k), pt(-h, -k), pt(h, c), pt(k, h)])
    return {
        "statement": rf"Tọa độ đỉnh của parabol $y = {quad(b, c)}$ là", **m,
        "solution": [rf"$x_0 = -\dfrac{{b}}{{2a}} = {h}$", rf"$y_0 = {num_sum([h * h, b * h, c])} = {k}$"],
    }


# ---------------------------------------------------------------- Đúng/Sai

@template("tf_quadratic", "Đúng/Sai: phương trình bậc hai", "quadratic_equation", 9, 0.6, "choice", "true_false")
def _(g: Rng):
    p, q = g.distinct_pair(-6, 6, True)
    S, P = p + q, p * q
    t = [g.coin() for _ in range(4)]
    wrong_root = next(v for v in (p + 1, p - 1, q + 1, -p, p + 2) if v not in (p, q))
    q_ = tf([
        "Phương trình có hai nghiệm phân biệt." if t[0] else "Phương trình vô nghiệm.",
        f"Tổng hai nghiệm bằng ${S if t[1] else (1 if S == 0 else -S)}$.",
        f"Tích hai nghiệm bằng ${P if t[2] else P + g.pick([-2, -1, 1, 2])}$.",
        f"$x = {p if t[3] else wrong_root}$ là một nghiệm của phương trình.",
    ], t)
    return {
        "statement": rf"Cho phương trình ${quad(-S, P)} = 0$. Mỗi ý sau đúng hay sai?", **q_,
        "solution": [
            rf"${quad(-S, P)} = {factor(p)}{factor(q)}$ nên phương trình có hai nghiệm phân biệt $x = {p}$, $x = {q}$",
            rf"Tổng hai nghiệm bằng ${S}$, tích hai nghiệm bằng ${P}$",
        ],
    }


@template("tf_linear_function", "Đúng/Sai: hàm số bậc nhất", "function", 9, 0.45, "choice", "true_false")
def _(g: Rng):
    a, b, t0 = g.nonzero(-5, 5), g.nonzero(-6, 6), g.nonzero(-3, 3)
    v = a * t0 + b
    t = [a > 0, g.coin(), g.coin(), g.coin()]
    q_ = tf([
        r"Hàm số đồng biến trên $\mathbb{R}$.",
        rf"Đồ thị hàm số đi qua điểm $(0;\ {b if t[1] else -b})$.",
        f"Khi $x = {t0}$ thì $y = {v if t[2] else v + g.pick([-2, -1, 1, 2])}$.",
        f"Đồ thị cắt trục hoành tại điểm có hoành độ ${frac(-b, a) if t[3] else frac(b, a)}$.",
    ], t)
    return {
        "statement": rf"Cho hàm số $y = {lin(a, b)}$. Mỗi ý sau đúng hay sai?", **q_,
        "solution": [
            rf"$a = {a} {'>' if a > 0 else '<'} 0$ nên hàm số {'đồng biến' if a > 0 else 'nghịch biến'} trên $\mathbb{{R}}$",
            rf"$x = 0 \Rightarrow y = {b}$; $x = {t0} \Rightarrow y = {v}$",
            rf"$y = 0 \Leftrightarrow x = {frac(-b, a)}$",
        ],
    }


# ---------------------------------------------------------------- tự luận: điền đáp số

@template("lin_eq_number", "Phương trình bậc nhất", "linear_equation", 8, 0.25, "written", "number")
def _(g: Rng):
    a, x0, b = g.rand(2, 9), g.rand(-9, 9), g.nonzero(-15, 15)
    c = a * x0 + b
    return {
        "statement": rf"Giải phương trình ${lin(a, b)} = {c}$.", "answer_prefix": "x =",
        "answer": number(x0), "answer_display": f"$x = {x0}$",
        "solution": [rf"${a}x = {c - b}$", rf"$x = {x0}$"],
    }


@template("lin_eq_fraction", "Phương trình chứa phân số", "linear_equation", 8, 0.55, "written", "number")
def _(g: Rng):
    m, n = g.shuffled([2, 3, 4, 5, 6])[:2]
    k, x0 = g.nonzero(-5, 5), g.rand(-6, 9)
    p, q = m * k - x0, n * k - x0
    return {
        "statement": rf"Giải phương trình $\dfrac{{{lin(1, p)}}}{{{m}}} = \dfrac{{{lin(1, q)}}}{{{n}}}$.", "answer_prefix": "x =",
        "answer": number(x0), "answer_display": f"$x = {x0}$",
        "solution": [rf"${n}({lin(1, p)}) = {m}({lin(1, q)})$", rf"${poly([(n - m, 'x')])} = {m * q - n * p}$", rf"$x = {x0}$"],
    }


@template("factor_root_written", "Phân tích nhân tử, tìm hệ số", "factorization", 8, 0.45, "written", "number")
def _(g: Rng):
    p, q = g.distinct_pair(-9, 9, True)
    return {
        "statement": rf"Biết ${quad(-(p + q), p * q)} = (x - a)(x - b)$ với $a < b$. Tìm $b$.", "answer_prefix": "b =",
        "answer": number(q), "answer_display": f"$b = {q}$",
        "solution": [rf"Hai số có tổng ${p + q}$ và tích ${p * q}$ là ${p}$ và ${q}$",
                     rf"${quad(-(p + q), p * q)} = {factor(p)}{factor(q)}$ nên $b = {q}$"],
    }


@template("ineq_smallest_int", "Nghiệm nguyên nhỏ nhất của bất phương trình", "inequality", 8, 0.55, "written", "number")
def _(g: Rng):
    a, b, c = g.rand(2, 5), g.nonzero(-10, 10), g.rand(-15, 15)
    ans = (c - b) // a + 1  # floor((c - b) / a) + 1
    return {
        "statement": rf"Tìm số nguyên $x$ nhỏ nhất thỏa mãn ${lin(a, b)} > {c}$.", "answer_prefix": "x =",
        "answer": number(ans), "answer_display": f"$x = {ans}$",
        "solution": [rf"${a}x > {c - b} \Leftrightarrow x > {frac(c - b, a)}$", rf"Số nguyên nhỏ nhất thỏa mãn là ${ans}$"],
    }


@template("quad_max_root", "Nghiệm của phương trình bậc hai", "quadratic_equation", 9, 0.5, "written", "number")
def _(g: Rng):
    p, q = g.distinct_pair(-9, 9, True)
    return {
        "statement": rf"Tìm nghiệm lớn nhất của phương trình ${quad(-(p + q), p * q)} = 0$.", "answer_prefix": "x =",
        "answer": number(q), "answer_display": f"$x = {q}$",
        "solution": [rf"${quad(-(p + q), p * q)} = {factor(p)}{factor(q)} = 0$",
                     rf"Hai nghiệm $x = {p}$, $x = {q}$; nghiệm lớn nhất là ${q}$"],
    }


@template("quad_double_root", "Điều kiện có nghiệm kép", "quadratic_equation", 9, 0.65, "written", "number")
def _(g: Rng):
    b = g.pick([2, 4, 6, 8, 10, 12])
    m = b * b // 4
    return {
        "statement": rf"Tìm $m$ để phương trình $x^2 - {b}x + m = 0$ có nghiệm kép.", "answer_prefix": "m =",
        "answer": number(m), "answer_display": f"$m = {m}$",
        "solution": [rf"Phương trình có nghiệm kép khi $\Delta = {b * b} - 4m = 0$", rf"$m = {m}$"],
    }


@template("func_quad_value", "Giá trị hàm số bậc hai", "function", 10, 0.45, "written", "number")
def _(g: Rng):
    b, c, t = g.nonzero(-6, 6), g.rand(-8, 8), g.nonzero(-4, 4)
    v = t * t + b * t + c
    return {
        "statement": rf"Cho $f(x) = {quad(b, c)}$. Tính $f({t})$.", "answer_prefix": f"f({t}) =",
        "answer": number(v), "answer_display": f"$f({t}) = {v}$",
        "solution": [rf"$f({t}) = {num_sum([t * t, b * t, c])} = {v}$"],
    }


@template("func_min_value", "Giá trị nhỏ nhất của hàm bậc hai", "function", 10, 0.6, "written", "number")
def _(g: Rng):
    b, c = g.pick([-8, -6, -4, -2, 2, 4, 6, 8]), g.rand(-5, 8)
    h, k = -b // 2, c - b * b // 4
    return {
        "statement": rf"Tìm giá trị nhỏ nhất của hàm số $y = {quad(b, c)}$.", "answer_prefix": r"y_{\min} =",
        "answer": number(k), "answer_display": rf"$y_{{\min}} = {k}$",
        "solution": [rf"$a = 1 > 0$, đỉnh tại $x_0 = -\dfrac{{b}}{{2a}} = {h}$", rf"$y_{{\min}} = y({h}) = {k}$"],
    }
