"""Biểu diễn có cấu trúc của bài toán + nhận dạng từ văn bản + dựng lại đề từ cấu trúc.

Ý tưởng cốt lõi: x² + 2x + c = 0 không chỉ là chuỗi ký tự mà là {dạng: phương trình bậc hai, a = 1, b = 2, c}.
Chuyển từ apps/web/src/mocks/pipeline/structure.ts.
"""

import re
from dataclasses import dataclass, replace
from fractions import Fraction
from typing import Literal

from app.modules.ingestion.pipeline.parse import ParseError, Rel, normalize_math, parse_expr, parse_relation
from app.modules.ingestion.pipeline.poly import (
    Poly, coef, coeffs_x, const_of, deg_m, deg_x, is_const, latex, plain, poly_from_json, poly_latex, poly_to_json,
)

Kind = Literal["linear_equation", "quadratic_equation", "quadratic_param", "linear_inequality", "quadratic_inequality",
               "factorization", "function_value", "vertex", "min_value"]
Cond = Literal["distinct", "double", "none", "some"]
Ask = Literal["solve", "max_root", "sum_roots", "max_int_m", "min_int_m", "min_int", "max_int", "count_int", "b_factor", "vertex_x"]


@dataclass(frozen=True)
class Structure:
    kind: Kind
    #: Phương trình/bất phương trình: P(x) rel 0. Hàm số: y = P(x).
    P: Poly
    ask: Ask = "solve"
    rel: Rel | None = None
    cond: Cond | None = None
    #: Điểm cần tính giá trị (function_value)
    t: Fraction | None = None
    extreme: Literal["min", "max"] | None = None

    def with_(self, **kw) -> "Structure":
        return replace(self, **kw)

    def to_json(self) -> dict:
        return {"kind": self.kind, "P": poly_to_json(self.P), "ask": self.ask, "rel": self.rel, "cond": self.cond,
                "t": plain(self.t) if self.t is not None else None, "extreme": self.extreme}

    @staticmethod
    def from_json(d: dict) -> "Structure":
        return Structure(kind=d["kind"], P=poly_from_json(d["P"]), ask=d["ask"], rel=d.get("rel"), cond=d.get("cond"),
                         t=Fraction(d["t"]) if d.get("t") is not None else None, extreme=d.get("extreme"))


@dataclass(frozen=True)
class Presentation:
    """Cách trình bày hai vế (để đề sinh ra tự nhiên, không phải lúc nào cũng "= 0")."""

    lhs: str
    rhs: str


KIND_LABEL: dict[str, str] = {
    "linear_equation": "Phương trình bậc nhất",
    "quadratic_equation": "Phương trình bậc hai",
    "quadratic_param": "Phương trình bậc hai chứa tham số",
    "linear_inequality": "Bất phương trình bậc nhất",
    "quadratic_inequality": "Bất phương trình bậc hai",
    "factorization": "Phân tích đa thức thành nhân tử",
    "function_value": "Giá trị của hàm số",
    "vertex": "Đỉnh của parabol",
    "min_value": "Giá trị lớn nhất/nhỏ nhất của hàm bậc hai",
}

KIND_SKILL: dict[str, tuple[str, int]] = {
    "linear_equation": ("linear_equation", 8),
    "quadratic_equation": ("quadratic_equation", 9),
    "quadratic_param": ("quadratic_equation", 9),
    "linear_inequality": ("inequality", 8),
    "quadratic_inequality": ("inequality", 10),
    "factorization": ("factorization", 8),
    "function_value": ("function", 9),
    "vertex": ("function", 10),
    "min_value": ("function", 10),
}

REL_LATEX: dict[str, str] = {"=": "=", "<": "<", ">": ">", "<=": r"\le", ">=": r"\ge"}
FLIP: dict[str, str] = {"=": "=", "<": ">", ">": "<", "<=": ">=", ">=": "<="}
COND_TEXT: dict[str, str] = {"distinct": "có hai nghiệm phân biệt", "double": "có nghiệm kép", "none": "vô nghiệm", "some": "có nghiệm"}


# ---------------------------------------------------------------- tách công thức khỏi lời văn

PLAIN_RUN = re.compile(r"[-+−–—0-9xmyf()\[\]\s.,/*^²³=<>≤≥·]+")
_MATHY = re.compile(r"[-+=<>≤≥^²*/()·0-9−–]")


def _is_math_run(r: str) -> bool:
    return bool(re.search("[xm]", r)) and bool(_MATHY.search(r)) and len(r) >= 3


def _trim_run(r: str) -> str:
    return re.sub(r"^[.,]+|[.,]+$", "", r.strip()).strip()


def math_segments(text: str) -> list[str]:
    """Công thức trong đề: lấy trong $...$ nếu có; không thì tìm đoạn ký tự toán trong chữ thường (PDF/Word)."""
    if "$" in text:
        return [m.group(1).strip() for m in re.finditer(r"\$\$?([^$]+?)\$\$?", text)]
    return [r for r in (_trim_run(x) for x in PLAIN_RUN.findall(text)) if _is_math_run(r)]


def to_display(text: str) -> str:
    """Bọc các đoạn công thức của chữ thường vào $...$ để hiển thị bằng KaTeX."""
    if "$" in text:
        return text

    def wrap(m: re.Match) -> str:
        run = m.group()
        core = _trim_run(run)
        if not _is_math_run(core):
            return run
        start = run.index(core)
        tex = re.sub(r"\s+", " ", normalize_math(core).replace("*", r" \cdot ")).strip()
        return f"{run[:start]}${tex}${run[start + len(core):]}"

    return PLAIN_RUN.sub(wrap, text)


# ---------------------------------------------------------------- nhận dạng

@dataclass(frozen=True)
class Recognition:
    structure: Structure | None
    confidence: float = 0.0
    reason: str | None = None

    @property
    def ok(self) -> bool:
        return self.structure is not None


def _fail(reason: str) -> Recognition:
    return Recognition(None, reason=reason)


RELATION = re.compile(r"[=<>≤≥]|\\le|\\ge")


def recognize(statement: str) -> Recognition:
    low = statement.lower()
    # Câu Đúng/Sai nhiều ý: các ý con ("Tổng hai nghiệm bằng…") dễ bị đọc nhầm thành câu hỏi chính.
    if re.search(r"đúng hay sai|đúng\s*/\s*sai", low):
        return _fail("Câu Đúng/Sai nhiều ý chưa được hỗ trợ nhận dạng tự động.")
    segs = math_segments(statement)
    if not segs:
        return _fail("Không tìm thấy biểu thức đại số một biến (có thể là bài hình học, chứng minh hoặc toán lời văn).")

    from_latex = "$" in statement

    def ok(s: Structure, keyword: bool) -> Recognition:
        return Recognition(s, confidence=min(0.98, max(0.5, 0.68 + (0.25 if keyword else 0) + (0.05 if from_latex else -0.05))))

    try:
        # Dạng "Biết P = (x - a)(x - b) với a < b. Tìm b."
        ab = next((s for s in segs if re.search(r"\(\s*x\s*-\s*a\s*\)\s*\(\s*x\s*-\s*b\s*\)", s)), None)
        if ab:
            P = parse_expr(ab.split("=")[0])
            if deg_x(P) != 2 or deg_m(P) > 0:
                return _fail("Đa thức không phải bậc hai.")
            return ok(Structure("factorization", P, ask="b_factor"), True)

        # Hàm số y = P(x) hoặc f(x) = P(x)
        fn = next((s for s in segs if re.match(r"^(y|f\s*\(\s*x\s*\))\s*=", s)), None)
        if fn:
            P = parse_expr(fn[fn.index("=") + 1:])
            if deg_m(P) > 0:
                return _fail("Hàm số chứa tham số chưa được hỗ trợ.")
            keyword = bool(re.search("hàm số|parabol|đồ thị", low))
            if "đỉnh" in low:
                if deg_x(P) != 2:
                    return _fail("Chỉ parabol (hàm bậc hai) mới có đỉnh.")
                return ok(Structure("vertex", P, ask="vertex_x" if "hoành độ" in low else "solve"), keyword)
            if ext := re.search("giá trị (nhỏ nhất|lớn nhất)", low):
                if deg_x(P) != 2:
                    return _fail("Chỉ hỗ trợ giá trị lớn nhất/nhỏ nhất của hàm bậc hai.")
                return ok(Structure("min_value", P, extreme="max" if ext.group(1) == "lớn nhất" else "min"), keyword)
            at = next((s for s in segs if re.match(r"^x\s*=", s) and not re.search("[xm]", s[s.index("=") + 1:])), None)
            f_at = re.search(r"f\s*\(\s*([^()x]+?)\s*\)", " ".join(segs) if from_latex else statement)
            t_src = at[at.index("=") + 1:] if at else (f_at.group(1) if f_at else None)
            if t_src:
                tp = parse_expr(t_src)
                if not is_const(tp):
                    return _fail("Không đọc được giá trị của x.")
                return ok(Structure("function_value", P, t=const_of(tp)), keyword)
            return _fail("Nhận ra hàm số nhưng chưa rõ đề yêu cầu tính gì.")

        # Phân tích đa thức thành nhân tử
        if "phân tích" in low:
            src = next((s for s in segs if not RELATION.search(s) and "x" in s), None)
            if not src:
                return _fail("Không tìm thấy đa thức cần phân tích.")
            P = parse_expr(src)
            if deg_m(P) > 0 or not 2 <= deg_x(P) <= 3:
                return _fail("Chỉ hỗ trợ đa thức bậc hai, hoặc bậc ba có nhân tử chung x.")
            return ok(Structure("factorization", P), True)

        # Phương trình / bất phương trình: bỏ qua các đoạn gán "x = 3", "m = 2"
        rel_seg = next((s for s in segs if RELATION.search(s) and not re.match(r"^[xm]\s*=\s*[^xm]*$", s)), None)
        if not rel_seg:
            return _fail("Không tìm thấy phương trình hoặc bất phương trình.")
        P, rel = parse_relation(rel_seg)
        if not rel:
            return _fail("Không tìm thấy dấu so sánh.")
        d = deg_x(P)

        if rel == "=":
            if deg_m(P) > 0:
                linear_in_m = deg_m(P) == 1 and coef(P, 1, 1) == 0 and coef(P, 2, 1) == 0
                if d != 2 or not linear_in_m:
                    return _fail("Chỉ hỗ trợ tham số m nằm ở hệ số tự do của phương trình bậc hai.")
                cond = ("distinct" if "phân biệt" in low else "double" if "nghiệm kép" in low else "none" if "vô nghiệm" in low
                        else "some" if "có nghiệm" in low else None)
                if not cond:
                    return _fail("Chưa rõ điều kiện về nghiệm của phương trình chứa m.")
                ask = "max_int_m" if "nguyên lớn nhất" in low else "min_int_m" if "nguyên nhỏ nhất" in low else "solve"
                return ok(Structure("quadratic_param", P, ask=ask, rel=rel, cond=cond), bool(re.search(r"tìm \$?m", low)))
            keyword = bool(re.search(r"phương trình|tìm \$?x|biết|nghiệm", low))
            if d == 1:
                return ok(Structure("linear_equation", P, rel=rel), keyword)
            if d == 2:
                ask = "max_root" if "nghiệm lớn nhất" in low else "sum_roots" if re.search("tổng (các|hai) nghiệm", low) else "solve"
                return ok(Structure("quadratic_equation", P, ask=ask, rel=rel), keyword)
            return _fail("Đẳng thức không chứa ẩn." if d == 0 else "Chưa hỗ trợ phương trình bậc ba trở lên.")

        if deg_m(P) > 0:
            return _fail("Bất phương trình chứa tham số chưa được hỗ trợ.")
        keyword = bool(re.search("bất phương trình|thỏa mãn|nghiệm nguyên", low))
        if d == 1:
            ask = "min_int" if re.search("số nguyên.*nhỏ nhất", low) else "max_int" if re.search("số nguyên.*lớn nhất", low) else "solve"
            return ok(Structure("linear_inequality", P, ask=ask, rel=rel), keyword)
        if d == 2:
            return ok(Structure("quadratic_inequality", P, ask="count_int" if "bao nhiêu nghiệm nguyên" in low else "solve", rel=rel), keyword)
        return _fail("Chưa hỗ trợ bất phương trình bậc này.")
    except ParseError as e:
        return _fail(f"Không đọc được biểu thức: {e}.")


# ---------------------------------------------------------------- dựng đề từ cấu trúc

def render(s: Structure, pres: Presentation | None = None) -> str:
    P = poly_latex(s.P)
    rel = REL_LATEX[s.rel or "="]
    side = f"{pres.lhs} {rel} {pres.rhs}" if pres else f"{P} {rel} 0"
    match s.kind:
        case "linear_equation":
            return f"Giải phương trình ${side}$."
        case "quadratic_equation":
            if s.ask == "max_root":
                return f"Tìm nghiệm lớn nhất của phương trình ${side}$."
            if s.ask == "sum_roots":
                return f"Tính tổng các nghiệm của phương trình ${side}$."
            return f"Giải phương trình ${side}$."
        case "quadratic_param":
            cond = COND_TEXT[s.cond or "distinct"]
            if s.ask == "max_int_m":
                return f"Tìm giá trị nguyên lớn nhất của $m$ để phương trình ${side}$ {cond}."
            if s.ask == "min_int_m":
                return f"Tìm giá trị nguyên nhỏ nhất của $m$ để phương trình ${side}$ {cond}."
            return f"Tìm $m$ để phương trình ${side}$ {cond}."
        case "linear_inequality":
            if s.ask == "min_int":
                return f"Tìm số nguyên $x$ nhỏ nhất thỏa mãn ${side}$."
            if s.ask == "max_int":
                return f"Tìm số nguyên $x$ lớn nhất thỏa mãn ${side}$."
            return f"Giải bất phương trình ${side}$."
        case "quadratic_inequality":
            if s.ask == "count_int":
                return f"Bất phương trình ${side}$ có bao nhiêu nghiệm nguyên?"
            return f"Giải bất phương trình ${side}$."
        case "factorization":
            if s.ask == "b_factor":
                return f"Biết ${P} = (x - a)(x - b)$ với $a < b$. Tìm $b$."
            return f"Phân tích đa thức ${P}$ thành nhân tử."
        case "function_value":
            return f"Cho hàm số $y = {P}$. Tính giá trị của $y$ khi $x = {latex(s.t)}$."
        case "vertex":
            return f"Tìm hoành độ đỉnh của parabol $y = {P}$." if s.ask == "vertex_x" else f"Tìm tọa độ đỉnh của parabol $y = {P}$."
        case "min_value":
            return f"Tìm giá trị {'lớn nhất' if s.extreme == 'max' else 'nhỏ nhất'} của hàm số $y = {P}$."
    raise ValueError(s.kind)


def general_form(s: Structure) -> tuple[str, list[dict]]:
    """Dạng tổng quát + tham số, ví dụ ax^2 + bx + c = 0 với a = 1, b = -5, c = 6."""
    rel = REL_LATEX[s.rel or "="]
    names = ["a", "b", "c", "d"]
    cs = None if deg_m(s.P) > 0 else coeffs_x(s.P)
    params = [{"name": names[i], "value": latex(c)} for i, c in enumerate(cs or [])]
    match s.kind:
        case "linear_equation":
            return "ax + b = 0", params
        case "quadratic_equation":
            return "ax^2 + bx + c = 0", params
        case "quadratic_param":
            free = {k: v for k, v in s.P.items() if k[0] == 0}
            return "ax^2 + bx + c(m) = 0", [{"name": "a", "value": latex(coef(s.P, 2))}, {"name": "b", "value": latex(coef(s.P, 1))},
                                             {"name": "c(m)", "value": poly_latex(free)}]
        case "linear_inequality":
            return f"ax + b {rel} 0", params
        case "quadratic_inequality":
            return f"ax^2 + bx + c {rel} 0", params
        case "factorization":
            return ("ax^3 + bx^2 + cx + d" if deg_x(s.P) == 3 else "ax^2 + bx + c"), params
        case "function_value":
            return ("y = ax + b" if deg_x(s.P) == 1 else "y = ax^2 + bx + c"), [*params, {"name": "x_0", "value": latex(s.t)}]
        case _:
            return "y = ax^2 + bx + c", params
