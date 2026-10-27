"""Dạng bài Toán tiểu học lớp 1–5 (chuyển từ apps/web/src/mocks/primary-templates.ts).

Số thập phân hiển thị kiểu Việt Nam (dấu phẩy, viết `{,}` trong LaTeX); đáp số lưu dạng có dấu chấm.
"""

from app.modules.exams.generator.base import Rng, Template, frac, make_choices, number, registry

PRIMARY: list[Template] = []
template = registry(PRIMARY)


def dec(x: float) -> str:
    """3.75 → "3{,}75" (LaTeX, dấu phẩy thập phân); số nguyên giữ nguyên."""
    s = f"{x:.2f}".rstrip("0").rstrip(".")
    return s.replace(".", "{,}")


def plain(x: float) -> str:
    return f"{x:.2f}".rstrip("0").rstrip(".")


# ---------------------------------------------------------------- lớp 1

@template("p1_add_20", "Cộng trong phạm vi 20", "p_add_sub", 1, 0.1, "written", "number")
def _(g: Rng):
    a = g.rand(1, 12)
    b = g.rand(1, 20 - a)
    return {"statement": rf"Tính: ${a} + {b} = ?$", "answer": number(a + b), "answer_display": f"{a + b}",
            "solution": [rf"${a} + {b} = {a + b}$"]}


@template("p1_sub_20", "Trừ trong phạm vi 20", "p_add_sub", 1, 0.12, "written", "number")
def _(g: Rng):
    a = g.rand(5, 20)
    b = g.rand(1, a)
    return {"statement": rf"Tính: ${a} - {b} = ?$", "answer": number(a - b), "answer_display": f"{a - b}",
            "solution": [rf"${a} - {b} = {a - b}$"]}


@template("p1_compare_100", "So sánh các số trong phạm vi 100", "p_number", 1, 0.1, "choice", "choice")
def _(g: Rng):
    xs = g.shuffled(list(range(10, 100)))[:4]
    big = g.coin()
    pick = max(xs) if big else min(xs)
    m = make_choices(g, f"{pick}", [f"{x}" for x in xs if x != pick])
    return {"statement": f"Số nào {'lớn' if big else 'bé'} nhất trong các số: {', '.join(f'${x}$' for x in xs)}?", **m,
            "solution": [rf"Xếp theo thứ tự tăng dần: ${'<'.join(str(x) for x in sorted(xs))}$",
                         f"Số {'lớn' if big else 'bé'} nhất là ${pick}$"]}


# ---------------------------------------------------------------- lớp 2

@template("p2_add_sub_100", "Cộng, trừ có nhớ trong phạm vi 100", "p_add_sub", 2, 0.2, "written", "number")
def _(g: Rng):
    if g.coin():
        a, b = g.rand(15, 69), g.rand(15, 30)
        return {"statement": rf"Đặt tính rồi tính: ${a} + {b}$", "answer": number(a + b), "answer_display": f"{a + b}",
                "solution": [rf"${a} + {b} = {a + b}$"]}
    a = g.rand(40, 99)
    b = g.rand(12, a - 10)
    return {"statement": rf"Đặt tính rồi tính: ${a} - {b}$", "answer": number(a - b), "answer_display": f"{a - b}",
            "solution": [rf"${a} - {b} = {a - b}$"]}


@template("p2_mul_table", "Bảng nhân 2 và 5", "p_mul_div", 2, 0.2, "choice", "choice")
def _(g: Rng):
    a, b = g.pick([2, 5]), g.rand(1, 10)
    p = a * b
    m = make_choices(g, f"{p}", [f"{x}" for x in (p + a, p - a, a + b, p + 1, p - 1, p + 2 * a)])
    return {"statement": rf"${a} \times {b} = ?$", **m, "solution": [rf"${a} \times {b} = {p}$"]}


@template("p2_word_more", "Bài toán nhiều hơn, ít hơn", "p_word", 2, 0.25, "written", "number")
def _(g: Rng):
    a, d = g.rand(20, 60), g.rand(5, 19)
    name, thing = g.pick([("Lan", "bông hoa"), ("Nam", "viên bi"), ("Mai", "quyển truyện"), ("Hùng", "con tem")])
    if g.coin():
        return {"statement": f"{name} có {a} {thing}, bạn của {name} có nhiều hơn {name} {d} {thing}. Hỏi bạn của {name} có bao nhiêu {thing}?",
                "answer": number(a + d), "answer_display": f"{a + d} {thing}", "solution": [rf"${a} + {d} = {a + d}$ ({thing})"]}
    return {"statement": f"{name} có {a} {thing}, bạn của {name} có ít hơn {name} {d} {thing}. Hỏi bạn của {name} có bao nhiêu {thing}?",
            "answer": number(a - d), "answer_display": f"{a - d} {thing}", "solution": [rf"${a} - {d} = {a - d}$ ({thing})"]}


@template("p2_length", "Đổi đơn vị độ dài", "p_measure", 2, 0.25, "choice", "choice")
def _(g: Rng):
    if g.coin():
        a = g.rand(2, 9)
        m = make_choices(g, rf"{a * 10}\text{{ cm}}", [rf"{a}\text{{ cm}}", rf"{a * 100}\text{{ cm}}", rf"{a + 10}\text{{ cm}}"])
        return {"statement": rf"${a}\text{{ dm}} = \;?$", **m, "solution": [r"$1\text{ dm} = 10\text{ cm}$",
                                                                               rf"${a}\text{{ dm}} = {a * 10}\text{{ cm}}$"]}
    a = g.rand(2, 9)
    m = make_choices(g, rf"{a * 100}\text{{ cm}}", [rf"{a * 10}\text{{ cm}}", rf"{a}\text{{ cm}}", rf"{a * 1000}\text{{ cm}}"])
    return {"statement": rf"${a}\text{{ m}} = \;?$", **m, "solution": [r"$1\text{ m} = 100\text{ cm}$",
                                                                          rf"${a}\text{{ m}} = {a * 100}\text{{ cm}}$"]}


# ---------------------------------------------------------------- lớp 3

@template("p3_mul_div_table", "Bảng nhân, bảng chia 2–9", "p_mul_div", 3, 0.3, "written", "number")
def _(g: Rng):
    a, b = g.rand(2, 9), g.rand(2, 9)
    if g.coin():
        return {"statement": rf"Tính: ${a} \times {b}$", "answer": number(a * b), "answer_display": f"{a * b}",
                "solution": [rf"${a} \times {b} = {a * b}$"]}
    return {"statement": rf"Tính: ${a * b} : {a}$", "answer": number(b), "answer_display": f"{b}",
            "solution": [rf"Vì ${a} \times {b} = {a * b}$ nên ${a * b} : {a} = {b}$"]}


@template("p3_find_x", "Tìm thành phần chưa biết", "p_add_sub", 3, 0.35, "written", "number")
def _(g: Rng):
    k = g.pick(["add", "sub", "mul"])
    if k == "add":
        x, a = g.rand(100, 600), g.rand(50, 300)
        return {"statement": rf"Tìm $x$, biết: $x + {a} = {x + a}$", "answer": number(x), "answer_display": f"x = {x}",
                "solution": [rf"$x = {x + a} - {a}$", rf"$x = {x}$"], "answer_prefix": "x ="}
    if k == "sub":
        x, a = g.rand(200, 900), g.rand(50, 180)
        return {"statement": rf"Tìm $x$, biết: $x - {a} = {x - a}$", "answer": number(x), "answer_display": f"x = {x}",
                "solution": [rf"$x = {x - a} + {a}$", rf"$x = {x}$"], "answer_prefix": "x ="}
    x, a = g.rand(2, 9), g.rand(3, 9)
    return {"statement": rf"Tìm $x$, biết: $x \times {a} = {x * a}$", "answer": number(x), "answer_display": f"x = {x}",
            "solution": [rf"$x = {x * a} : {a}$", rf"$x = {x}$"], "answer_prefix": "x ="}


@template("p3_perimeter", "Chu vi hình chữ nhật, hình vuông", "p_geometry", 3, 0.35, "choice", "choice")
def _(g: Rng):
    if g.coin():
        a, b = g.rand(6, 20), g.rand(2, 5)
        p = 2 * (a + b)
        m = make_choices(g, rf"{p}\text{{ cm}}", [rf"{x}\text{{ cm}}" for x in (a + b, a * b, p + 2, p - 2, 2 * a + b)])
        return {"statement": f"Hình chữ nhật có chiều dài ${a}$ cm, chiều rộng ${b}$ cm. Chu vi hình chữ nhật là", **m,
                "solution": [rf"Chu vi $= ({a} + {b}) \times 2 = {p}$ (cm)"]}
    a = g.rand(3, 25)
    m = make_choices(g, rf"{4 * a}\text{{ cm}}", [rf"{x}\text{{ cm}}" for x in (a * a, 2 * a, 4 * a + 4, 4 * a - 4, 3 * a)])
    return {"statement": f"Hình vuông có cạnh ${a}$ cm. Chu vi hình vuông là", **m, "solution": [rf"Chu vi $= {a} \times 4 = {4 * a}$ (cm)"]}


@template("p3_time", "Đổi giờ, phút", "p_measure", 3, 0.3, "written", "number")
def _(g: Rng):
    h, mi = g.rand(1, 3), g.pick([5, 10, 15, 20, 30, 45])
    return {"statement": f"${h}$ giờ ${mi}$ phút bằng bao nhiêu phút?", "answer": number(h * 60 + mi), "answer_display": f"{h * 60 + mi} phút",
            "solution": [r"$1$ giờ $= 60$ phút", rf"${h} \times 60 + {mi} = {h * 60 + mi}$ (phút)"]}


# ---------------------------------------------------------------- lớp 4

@template("p4_average", "Tìm số trung bình cộng", "p_word", 4, 0.4, "written", "number")
def _(g: Rng):
    n = g.pick([3, 4])
    avg = g.rand(30, 80)
    xs = [avg + g.rand(-12, 12) for _ in range(n - 1)]
    xs.append(avg * n - sum(xs))
    shown = ", ".join(f"${x}$" for x in xs)
    return {"statement": f"Tìm số trung bình cộng của các số: {shown}.", "answer": number(avg), "answer_display": f"{avg}",
            "solution": [rf"$({' + '.join(map(str, xs))}) : {n} = {avg * n} : {n} = {avg}$"]}


@template("p4_area_rect", "Diện tích hình chữ nhật", "p_geometry", 4, 0.35, "written", "number")
def _(g: Rng):
    a, b = g.rand(8, 30), g.rand(3, 12)
    return {"statement": f"Một mảnh vườn hình chữ nhật có chiều dài ${a}$ m, chiều rộng ${b}$ m. Tính diện tích mảnh vườn (m²).",
            "answer": number(a * b), "answer_display": f"{a * b} m²", "solution": [rf"Diện tích $= {a} \times {b} = {a * b}$ (m²)"]}


@template("p4_fraction_compare", "So sánh phân số", "p_fraction", 4, 0.45, "choice", "choice")
def _(g: Rng):
    d = g.rand(5, 12)
    nums = g.shuffled(list(range(1, d)))[:4]
    best = max(nums)
    raw = lambda n: rf"\dfrac{{{n}}}{{{d}}}"  # noqa: E731 (giữ nguyên mẫu số để so sánh tử)
    m = make_choices(g, raw(best), [raw(n) for n in nums if n != best])
    return {"statement": "Phân số nào lớn nhất?", **m,
            "solution": [rf"Các phân số cùng mẫu ${d}$: phân số nào có tử lớn hơn thì lớn hơn", rf"Lớn nhất là ${raw(best)}$"]}


@template("p4_fraction_add", "Cộng phân số cùng mẫu", "p_fraction", 4, 0.4, "choice", "choice")
def _(g: Rng):
    d = g.rand(5, 15)
    a = g.rand(1, d - 2)
    b = g.rand(1, d - a - 1)
    s = frac(a + b, d)
    m = make_choices(g, s, [frac(a + b, 2 * d), frac(a * b, d), frac(a + b + 1, d), frac(a + b - 1, d), frac(a + b, d + 1), frac(a + b + 2, d)])
    return {"statement": rf"Tính: $\dfrac{{{a}}}{{{d}}} + \dfrac{{{b}}}{{{d}}}$", **m,
            "solution": [rf"$\dfrac{{{a}}}{{{d}}} + \dfrac{{{b}}}{{{d}}} = \dfrac{{{a} + {b}}}{{{d}}} = {s}$"]}


# ---------------------------------------------------------------- lớp 5

@template("p5_decimal_add", "Cộng, trừ số thập phân", "p_decimal", 5, 0.45, "written", "number")
def _(g: Rng):
    a, b = g.rand(105, 995) / 100, g.rand(15, 495) / 100
    if g.coin():
        r = round(a + b, 2)
        return {"statement": rf"Tính: ${dec(a)} + {dec(b)}$", "answer": number(plain(r)), "answer_display": dec(r).replace("{,}", ","),
                "solution": [rf"${dec(a)} + {dec(b)} = {dec(r)}$"]}
    a, b = max(a, b), min(a, b)
    r = round(a - b, 2)
    return {"statement": rf"Tính: ${dec(a)} - {dec(b)}$", "answer": number(plain(r)), "answer_display": dec(r).replace("{,}", ","),
            "solution": [rf"${dec(a)} - {dec(b)} = {dec(r)}$"]}


@template("p5_percent", "Tìm giá trị phần trăm của một số", "p_decimal", 5, 0.55, "choice", "choice")
def _(g: Rng):
    p, base = g.pick([10, 20, 25, 40, 50, 75]), g.pick([40, 60, 80, 120, 200, 240, 400])
    v = p * base // 100
    m = make_choices(g, f"{v}", [f"{x}" for x in (p + base, base - v, v * 10, v + p, v * 2, v + 5)])
    return {"statement": rf"Tìm ${p}\%$ của ${base}$.", **m, "solution": [rf"${base} \times {p} : 100 = {v}$"]}


@template("p5_speed", "Vận tốc, quãng đường, thời gian", "p_word", 5, 0.55, "written", "number")
def _(g: Rng):
    v, t = g.pick([30, 36, 40, 45, 48, 50, 60]), g.pick([2, 3, 4])
    who = g.pick(["Một ô tô", "Một xe máy", "Một đoàn tàu"])
    if g.coin():
        return {"statement": f"{who} đi với vận tốc ${v}$ km/giờ trong ${t}$ giờ. Tính quãng đường đi được (km).",
                "answer": number(v * t), "answer_display": f"{v * t} km", "solution": [rf"$s = v \times t = {v} \times {t} = {v * t}$ (km)"]}
    return {"statement": f"{who} đi quãng đường ${v * t}$ km hết ${t}$ giờ. Tính vận tốc (km/giờ).",
            "answer": number(v), "answer_display": f"{v} km/giờ", "solution": [rf"$v = s : t = {v * t} : {t} = {v}$ (km/giờ)"]}


@template("p5_triangle_area", "Diện tích hình tam giác", "p_geometry", 5, 0.5, "choice", "choice")
def _(g: Rng):
    a, h = g.rand(3, 20) * 2, g.rand(3, 15)
    s = a * h // 2
    m = make_choices(g, rf"{s}\text{{ cm}}^2", [rf"{x}\text{{ cm}}^2" for x in (a * h, a + h, s + h, s + a, s - 1)])
    return {"statement": f"Hình tam giác có đáy ${a}$ cm, chiều cao ${h}$ cm. Diện tích hình tam giác là", **m,
            "solution": [rf"$S = {a} \times {h} : 2 = {s}$ (cm²)"]}


@template("p5_box_volume", "Thể tích hình hộp chữ nhật", "p_geometry", 5, 0.5, "written", "number")
def _(g: Rng):
    a, b, c = g.rand(3, 12), g.rand(2, 8), g.rand(2, 6)
    return {"statement": f"Hình hộp chữ nhật có chiều dài ${a}$ cm, chiều rộng ${b}$ cm, chiều cao ${c}$ cm. Tính thể tích (cm³).",
            "answer": number(a * b * c), "answer_display": f"{a * b * c} cm³", "solution": [rf"$V = {a} \times {b} \times {c} = {a * b * c}$ (cm³)"]}
