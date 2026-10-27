"""Sinh biến thể theo luật biến đổi trên cấu trúc (không phải sửa chữ):
ax² + bx + c = 0 → đổi hệ số giữ nghiệm nguyên, cho c = 0, cho b = 0, thay c bằng tham số m, …

Mỗi biến thể phải qua: kiểm chứng ngược (đọc lại đề → nhận dạng → giải lại), tự kiểm của bộ giải, và chống trùng
với đề gốc, ngân hàng và các biến thể cùng lô. Chuyển từ apps/web/src/mocks/pipeline/generate.ts.
"""

from collections.abc import Callable
from dataclasses import dataclass, replace
from fractions import Fraction
from typing import Literal

from app.modules.exams.generator.base import Rng, lin  # hàm thuần (số ngẫu nhiên, định dạng LaTeX), không đọc bảng
from app.modules.ingestion.pipeline.canonical import canonical_key, estimate_difficulty, hash_key
from app.modules.ingestion.pipeline.parse import ParseError, parse_relation
from app.modules.ingestion.pipeline.poly import add_p, coeffs_x, deg_x, from_coeffs, mul_p, plain, scale_p, var_p
from app.modules.ingestion.pipeline.solve import Solved, SolveError, near_misses, solve
from app.modules.ingestion.pipeline.structure import COND_TEXT, Presentation, Structure, recognize, render

Target = Literal["easier", "same", "harder"]
Format = Literal["original", "choice", "short"]


@dataclass(frozen=True)
class Ranges:
    leads: list[int]
    root: int
    coef: int


@dataclass(frozen=True)
class Draft:
    structure: Structure
    transform: str
    pres: Presentation | None = None


@dataclass(frozen=True)
class Rule:
    code: str
    label: str
    description: str
    kinds: tuple[str, ...]
    make: Callable[[Structure, Ranges, Rng], Draft | None]

    def info(self) -> dict:
        return {"code": self.code, "label": self.label, "description": self.description}


RELS = ["<", ">", "<=", ">="]
COMPLEMENT = {"=": "=", "<": ">=", ">": "<=", "<=": ">", ">=": "<"}
CONDS = ["distinct", "double", "none", "some"]


def from_roots(a: int, p: int, r: int):
    return from_coeffs([Fraction(a), Fraction(-a * (p + r)), Fraction(a * p * r)])


def linear_from(lhs: str, rhs: str, kind: str, rel: str = "=") -> Structure:
    sym = r"\le" if rel == "<=" else r"\ge" if rel == ">=" else rel
    return Structure(kind, parse_relation(f"{lhs} {sym} {rhs}")[0], rel=rel)  # type: ignore[arg-type]


def ranges(src: Structure, target: Target) -> Ranges:
    if target == "easier":
        return Ranges([1], 5, 9)
    if target == "harder":
        return Ranges([2, 3, -2, -1], 12, 20)
    cs = coeffs_x(src.P)
    lead = cs[0] if cs else Fraction(1)
    return Ranges([int(lead)] if lead.denominator == 1 and lead != 0 and abs(lead) <= 5 else [1], 8, 12)


RULES: list[Rule] = []


def rule(code: str, label: str, description: str, *kinds: str):
    def wrap(make):
        RULES.append(Rule(code, label, description, kinds, make))
        return make

    return wrap


# ---------------------------------------------------------------- phương trình bậc nhất

@rule("doi_he_so", "Đổi hệ số", "Giữ dạng ax + b = c, chọn hệ số và nghiệm nguyên mới.", "linear_equation")
def _(s, r, g):
    a = g.rand(2, 5) if r.leads[0] == 1 else g.rand(2, 9)
    x0, b = g.rand(-r.root, r.root), g.nonzero(-r.coef, r.coef)
    lhs, rhs = lin(a, b), f"{a * x0 + b}"
    return Draft(linear_from(lhs, rhs, "linear_equation"), f"Đổi hệ số: $a = {a}$, $b = {b}$, nghiệm mới $x = {x0}$", Presentation(lhs, rhs))


@rule("hai_ve", "Ẩn ở hai vế", "Dạng a₁x + b₁ = a₂x + b₂, phải chuyển vế.", "linear_equation")
def _(s, r, g):
    a2, a1 = g.distinct_pair(1, 9)
    x0, b2 = g.rand(-r.root, r.root), g.nonzero(-r.coef, r.coef)
    b1 = (a2 - a1) * x0 + b2
    lhs, rhs = lin(a1, b1), lin(a2, b2)
    return Draft(linear_from(lhs, rhs, "linear_equation"), f"Đưa ẩn về hai vế, nghiệm $x = {x0}$", Presentation(lhs, rhs))


@rule("dat_ngoac", "Có dấu ngoặc", "Dạng k(x − p) = ax + b, phải phá ngoặc.", "linear_equation")
def _(s, r, g):
    k, p = g.rand(2, 6), g.nonzero(-6, 6)
    a, x0 = g.rand(1, k - 1), g.rand(-r.root, r.root)
    b = (k - a) * x0 - k * p
    lhs, rhs = f"{k}({lin(1, -p)})", lin(a, b)
    return Draft(linear_from(lhs, rhs, "linear_equation"), f"Thêm ngoặc ${k}(x - p)$, nghiệm $x = {x0}$", Presentation(lhs, rhs))


@rule("phan_so", "Chứa phân số", "Dạng (x + p)/m = (x + q)/n, phải quy đồng (khó hơn).", "linear_equation")
def _(s, r, g):
    m, n = g.shuffled([2, 3, 4, 5, 6])[:2]
    k, x0 = g.nonzero(-5, 5), g.rand(-r.root, r.root)
    lhs = rf"\dfrac{{{lin(1, m * k - x0)}}}{{{m}}}"
    rhs = rf"\dfrac{{{lin(1, n * k - x0)}}}{{{n}}}"
    return Draft(linear_from(lhs, rhs, "linear_equation"), f"Chuyển sang dạng phân số với mẫu ${m}$ và ${n}$, nghiệm $x = {x0}$", Presentation(lhs, rhs))


# ---------------------------------------------------------------- phương trình bậc hai

@rule("doi_he_so", "Đổi hệ số, giữ nghiệm nguyên", "Chọn hai nghiệm nguyên mới rồi khai triển a(x − x₁)(x − x₂).", "quadratic_equation")
def _(s, r, g):
    a = g.pick(r.leads)
    p, t = g.distinct_pair(-r.root, r.root)
    return Draft(Structure("quadratic_equation", from_roots(a, p, t), rel="="),
                 f"Chọn nghiệm ${p}$ và ${t}$, hệ số $a = {a}$, khai triển $a(x - x_1)(x - x_2)$")


@rule("c_bang_0", "Cho c = 0", "ax² + bx = 0: một nghiệm bằng 0, đặt nhân tử chung.", "quadratic_equation")
def _(s, r, g):
    a, x1 = g.pick(r.leads), g.nonzero(-r.root, r.root)
    return Draft(Structure("quadratic_equation", from_roots(a, 0, x1), rel="="),
                 f"Cho $c = 0$: phương trình $ax^2 + bx = 0$ có nghiệm $0$ và ${x1}$")


@rule("b_bang_0", "Cho b = 0", "ax² + c = 0: hai nghiệm đối nhau.", "quadratic_equation")
def _(s, r, g):
    a, k = g.pick(r.leads), g.rand(1, r.root)
    return Draft(Structure("quadratic_equation", from_roots(a, -k, k), rel="="),
                 rf"Cho $b = 0$: phương trình $ax^2 + c = 0$ có hai nghiệm $\pm {k}$")


@rule("them_tham_so", "Thêm tham số m", "Thay hệ số tự do bằng m, hỏi điều kiện về nghiệm.", "quadratic_equation", "quadratic_param")
def _(s, r, g):
    a, b, cond = g.pick(r.leads), g.nonzero(-r.coef, r.coef), g.pick(CONDS)
    P = add_p(from_coeffs([Fraction(a), Fraction(b), Fraction(0)]), var_p("m"))
    return Draft(Structure("quadratic_param", P, rel="=", cond=cond), f"Thay $c$ bằng tham số $m$, hỏi điều kiện để phương trình {COND_TEXT[cond]}")


@rule("nhan_he_so", "Nhân hai vế với một số", "Bài tương đương với bài gốc, dùng để kiểm tra bộ chống trùng (sẽ bị loại).",
      "quadratic_equation", "linear_equation")
def _(s, r, g):
    k = g.pick([2, 3, -2])
    return Draft(replace(s, P=scale_p(s.P, Fraction(k)), ask="solve"), f"Nhân hai vế với ${k}$ (bài tương đương)")


# ---------------------------------------------------------------- phương trình chứa tham số

@rule("doi_dieu_kien", "Đổi yêu cầu về nghiệm", "Giữ phương trình, đổi giữa hai nghiệm phân biệt / nghiệm kép / vô nghiệm / có nghiệm.",
      "quadratic_param")
def _(s, r, g):
    cond = g.pick([c for c in CONDS if c != s.cond])
    return Draft(replace(s, cond=cond, ask="solve"), f"Đổi yêu cầu thành: phương trình {COND_TEXT[cond]}")


# ---------------------------------------------------------------- bất phương trình bậc nhất

@rule("doi_he_so", "Đổi hệ số", "Hệ số dương, nghiệm biên nguyên mới, chiều bất đẳng thức ngẫu nhiên.", "linear_inequality")
def _(s, r, g):
    a = g.rand(2, 5 if r.leads[0] == 1 else 9)
    x0, b, rel = g.rand(-r.root, r.root), g.nonzero(-r.coef, r.coef), g.pick(RELS)
    lhs, rhs = lin(a, b), f"{a * x0 + b}"
    return Draft(linear_from(lhs, rhs, "linear_inequality", rel), f"Đổi hệ số $a = {a}$, biên $x = {x0}$", Presentation(lhs, rhs))


@rule("he_so_am", "Hệ số âm (đổi chiều)", "Hệ số của x âm: học sinh phải nhớ đổi chiều khi chia.", "linear_inequality")
def _(s, r, g):
    a = -g.rand(2, 9)
    x0, b, rel = g.rand(-r.root, r.root), g.nonzero(-r.coef, r.coef), g.pick(RELS)
    lhs, rhs = lin(a, b), f"{a * x0 + b}"
    return Draft(linear_from(lhs, rhs, "linear_inequality", rel), f"Hệ số $a = {a} < 0$, biên $x = {x0}$", Presentation(lhs, rhs))


# ---------------------------------------------------------------- bất phương trình bậc hai

@rule("doi_he_so", "Đổi hệ số, giữ nghiệm nguyên", "Tam thức mới có hai nghiệm nguyên, chiều ngẫu nhiên.", "quadratic_inequality")
def _(s, r, g):
    same_sign = -1 if coeffs_x(s.P)[0] < 0 else 1
    a = abs(g.pick(r.leads)) * same_sign
    p, t = g.distinct_pair(-r.root, r.root)
    return Draft(Structure("quadratic_inequality", from_roots(a, p, t), rel=g.pick(RELS)), f"Tam thức có nghiệm ${p}$ và ${t}$, hệ số $a = {a}$")


@rule("doi_chieu", "Đổi chiều (lấy phần bù)", "Giữ tam thức, đổi dấu so sánh: tập nghiệm thành phần bù.", "quadratic_inequality", "linear_inequality")
def _(s, r, g):
    return Draft(replace(s, rel=COMPLEMENT[s.rel], ask="solve"), "Đổi chiều bất phương trình: tập nghiệm mới là phần bù của tập cũ")


# ---------------------------------------------------------------- phân tích nhân tử

@rule("doi_he_so", "Đổi hệ số", "Tam thức mới có nghiệm hữu tỉ; độ khó cao thì hệ số đầu khác 1.", "factorization")
def _(s, r, g):
    a, p = abs(g.pick(r.leads)), g.nonzero(-r.root, r.root)
    # (a·x − n)(x − p): nghiệm n/a hữu tỉ khi a ≠ 1
    n = g.nonzero(-r.root, r.root)
    if a == 1 and n == p:
        n = p + 1
    P = mul_p(from_coeffs([Fraction(a), Fraction(-n)]), from_coeffs([Fraction(1), Fraction(-p)]))
    return Draft(Structure("factorization", P), f"Tam thức có nghiệm ${n}$ và ${p}$" if a == 1 else rf"Tam thức có nghiệm $\dfrac{{{n}}}{{{a}}}$ và ${p}$")


@rule("hang_dang_thuc", "Hằng đẳng thức", "Dạng a² − b² hoặc (a − b)².", "factorization")
def _(s, r, g):
    k = g.rand(2, max(3, r.root))
    square = g.coin()
    P = from_roots(1, k, k) if square else from_roots(1, -k, k)
    return Draft(Structure("factorization", P), f"Bình phương của hiệu $(x - {k})^2$" if square else f"Hiệu hai bình phương $x^2 - {k}^2$")


@rule("nhan_tu_chung", "Đặt nhân tử chung", "Đa thức bậc ba có nhân tử chung x.", "factorization")
def _(s, r, g):
    p, t = g.distinct_pair(-r.root, r.root, True)
    return Draft(Structure("factorization", mul_p(var_p("x"), from_roots(1, p, t))), f"Bậc ba $x(x - {p})(x - {t})$ khai triển")


# ---------------------------------------------------------------- hàm số

@rule("doi_he_so", "Đổi hệ số", "Hàm số cùng bậc với hệ số mới, điểm tính mới.", "function_value")
def _(s, r, g):
    t = g.nonzero(-4, 4)
    if deg_x(s.P) == 1:
        P = from_coeffs([Fraction(g.nonzero(-r.coef, r.coef)), Fraction(g.rand(-r.coef, r.coef))])
    else:
        P = from_coeffs([Fraction(g.pick(r.leads)), Fraction(g.rand(-9, 9)), Fraction(g.rand(-9, 9))])
    return Draft(Structure("function_value", P, t=Fraction(t)), f"Đổi hệ số hàm số, tính tại $x = {t}$")


@rule("doi_diem", "Đổi điểm cần tính", "Giữ hàm số, tính giá trị tại điểm khác.", "function_value")
def _(s, r, g):
    t = g.nonzero(-5, 5)
    if s.t is not None and t == s.t:
        t += 1
    return Draft(replace(s, t=Fraction(t), ask="solve"), f"Giữ hàm số, tính tại $x = {t}$")


@rule("doi_he_so", "Đổi hệ số, đỉnh nguyên", "Parabol mới có hoành độ đỉnh nguyên.", "vertex", "min_value")
def _(s, r, g):
    want = (-1 if s.extreme == "max" else 1) if s.kind == "min_value" else g.pick([1, -1])
    a, h, c = abs(g.pick(r.leads)) * want, g.nonzero(-5, 5), g.rand(-9, 9)
    return Draft(replace(s, P=from_coeffs([Fraction(a), Fraction(-2 * a * h), Fraction(c)]), ask="solve"),
                 f"Parabol mới có đỉnh tại $x = {h}$, hệ số $a = {a}$")


@rule("doi_cau_hoi", "Đổi câu hỏi", "Cùng parabol: hỏi tọa độ đỉnh ↔ giá trị lớn nhất/nhỏ nhất.", "vertex", "min_value")
def _(s, r, g):
    if s.kind == "vertex":
        extreme = "min" if coeffs_x(s.P)[0] > 0 else "max"
        return Draft(Structure("min_value", s.P, extreme=extreme), f"Hỏi giá trị {'nhỏ nhất' if extreme == 'min' else 'lớn nhất'} thay vì tọa độ đỉnh")
    return Draft(Structure("vertex", s.P), "Hỏi tọa độ đỉnh thay vì giá trị lớn nhất/nhỏ nhất")


def rules_for(kind: str) -> list[dict]:
    return [r.info() for r in RULES if kind in r.kinds]


# ---------------------------------------------------------------- dựng biến thể

def _apply_format(s: Structure, fmt: Format) -> Structure | None:
    """Chọn câu hỏi phù hợp hình thức: "trả lời ngắn" cần đúng một đáp số."""
    base = replace(s, ask="solve")
    if fmt != "short":
        return base

    def try_ask(*asks: str) -> Structure | None:
        for ask in asks:
            try:
                if solve(replace(s, ask=ask)).short is not None:
                    return replace(s, ask=ask)
            except SolveError:
                pass  # thử câu hỏi tiếp theo
        return None

    return {
        "quadratic_equation": lambda: try_ask("max_root", "sum_roots", "solve"),
        "quadratic_param": lambda: try_ask("solve", "max_int_m", "min_int_m"),
        "linear_inequality": lambda: try_ask("min_int", "max_int"),
        "quadratic_inequality": lambda: try_ask("count_int"),
        "factorization": lambda: try_ask("b_factor"),
        "vertex": lambda: try_ask("vertex_x"),
    }.get(s.kind, lambda: try_ask("solve"))()


def build_choices(s: Structure, solved: Solved, g: Rng) -> tuple[list[dict], str, str] | None:
    def text(x: Solved) -> str:
        return x.choice_text or x.display

    correct = text(solved)
    options = [correct]
    for m in near_misses(s):
        if len(options) >= 4:
            break
        try:
            t = text(solve(m))
        except (SolveError, ZeroDivisionError):
            continue  # phương án nhiễu không giải được thì bỏ
        if t not in options:
            options.append(t)
    if len(options) < 4:
        return None
    options = g.shuffled(options)
    keys = ["A", "B", "C", "D"]
    return [{"key": keys[i], "content": c} for i, c in enumerate(options)], keys[options.index(correct)], correct


def gradable_answer(solved: Solved, fmt: Format, choice_key: str | None) -> dict | None:
    """Đáp án có cấu trúc để chấm tự động khi bài vào ngân hàng; None nếu chỉ chấm được bằng mắt (tập nghiệm, nhân tử)."""
    if fmt == "choice" and choice_key:
        return {"type": "choice", "value": choice_key}
    if solved.short is not None:
        return {"type": "number", "value": plain(solved.short)}
    roots = solved.facts.get("roots")
    if solved.key.startswith("roots:") and roots and len(roots) == 2:
        return {"type": "set", "value": roots}
    return None


@dataclass
class Variant:
    statement: str
    format: Format
    choices: list[dict]
    answer_display: str
    answer_short: str | None
    answer_prefix: str | None
    answer: dict | None
    #: Nhãn ô nhập khi bài vào ngân hàng với đáp án số ("x =", "m =")
    answer_label: str | None
    solution: list[str]
    rule: dict
    transform: str
    structure: Structure
    key: str
    difficulty: float
    checks: list[dict]
    accepted: bool


def _build_variant(draft: Draft, r: Rule, fmt: Format, bank: dict[str, str], source: dict[str, str], g: Rng) -> Variant | None:
    s = _apply_format(draft.structure, fmt)
    if not s:
        return None
    statement = render(s, draft.pres)
    try:
        solved = solve(s)
    except (SolveError, ZeroDivisionError):
        return None
    if fmt == "short" and solved.short is None:
        return None

    # Kiểm chứng ngược: coi đề vừa sinh như một đề mới, nhận dạng và giải lại.
    back = recognize(statement)
    round_trip = False
    if back.ok and canonical_key(back.structure) == canonical_key(s) and back.structure.ask == s.ask:
        try:
            round_trip = solve(back.structure).key == solved.key
        except SolveError:
            round_trip = False

    key = canonical_key(s)
    src_dup, bank_dup = source.get(key), bank.get(hash_key(key))  # bank: mã băm → mã bài
    checks = [
        {"label": "Kiểm chứng ngược: đọc lại đề vừa sinh, nhận dạng và giải lại cho cùng đáp án", "passed": round_trip},
        *solved.checks,
        {"label": f"Trùng với {src_dup} của đề tải lên (cùng dạng chuẩn)" if src_dup else "Không trùng với đề tải lên", "passed": not src_dup},
        {"label": f"Trùng bài {bank_dup} trong ngân hàng" if bank_dup else "Không trùng ngân hàng bài", "passed": not bank_dup},
    ]

    choices: list[dict] = []
    display = solved.display
    choice_key = None
    if fmt == "choice":
        built = build_choices(s, solved, g)
        if not built:
            return None
        choices, choice_key, correct = built
        display = f"{choice_key}. {correct}"

    return Variant(
        statement=statement, format=fmt, choices=choices, answer_display=display,
        answer_short=plain(solved.short) if fmt == "short" and solved.short is not None else None,
        answer_prefix=solved.short_label if fmt == "short" else None,
        answer=(answer := gradable_answer(solved, fmt, choice_key)),
        answer_label=solved.short_label if answer and answer["type"] == "number" else None, solution=solved.steps, rule=r.info(), transform=draft.transform,
        structure=s, key=key, difficulty=estimate_difficulty(s), checks=checks, accepted=all(c["passed"] for c in checks),
    )


def generate_variants(src: Structure, count: int, rule_codes: list[str], target: Target, fmt: Format,
                      bank: dict[str, str], source: dict[str, str], g: Rng | None = None) -> list[Variant]:
    """Sinh tới `count` biến thể đạt chuẩn; kèm tối đa 2 biến thể bị loại để giáo viên thấy bộ lọc hoạt động."""
    g = g or Rng()
    rules = [r for r in RULES if src.kind in r.kinds and r.code in rule_codes]
    if not rules:
        return []
    rg = ranges(src, target)
    accepted: list[Variant] = []
    rejected: list[Variant] = []
    seen: set[str] = set()
    for attempt in range(count * 10):
        if len(accepted) >= count:
            break
        r = rules[attempt % len(rules)]
        try:
            draft = r.make(src, rg, g)
        except (ValueError, ZeroDivisionError, ParseError):
            continue
        if not draft:
            continue
        v = _build_variant(draft, r, fmt, bank, source, g)
        if not v or v.key in seen:  # trùng trong cùng lô: bỏ, không cần báo
            continue
        seen.add(v.key)
        if v.accepted:
            accepted.append(v)
        elif len(rejected) < 2:
            rejected.append(v)
    return [*accepted, *rejected]
