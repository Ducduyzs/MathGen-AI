"""Bộ phân tích biểu thức (recursive descent) đọc được cả LaTeX ($x^2 - 5x + 6 = 0$, \\dfrac{x}{4}) lẫn chữ thường
trích từ PDF/Word (x² – 5x + 6 = 0, 3(x – 2), 2·x). Kết quả là đa thức chính xác.

Không dùng eval hay sympy.sympify trên chuỗi người dùng: chỉ nhận đúng các ký hiệu được phép.
Chuyển từ apps/web/src/mocks/pipeline/parse.ts.
"""

import re
from dataclasses import dataclass
from typing import Literal

from app.modules.ingestion.pipeline.poly import (
    ONE, Poly, add_p, const_of, const_p, from_decimal, is_const, mul_p, neg_p, pow_p, scale_p, sub_p, var_p,
)

Rel = Literal["=", "<", ">", "<=", ">="]


class ParseError(Exception):
    pass


@dataclass(frozen=True)
class Tok:
    t: str  # num | var | op | ^ | ( | ) | { | } | frac | rel
    v: str = ""


def normalize_math(s: str) -> str:
    """Chuẩn hóa ký hiệu: dấu trừ Unicode, chỉ số trên, \\cdot, \\left( …"""
    s = re.sub(r"\\left|\\right|\\displaystyle|\\limits", "", s)
    s = re.sub(r"\\[dt]?frac", r" \\frac ", s)
    s = re.sub(r"\\cdot|\\times|×|·|∙", "*", s)
    s = re.sub(r"[−–—‒]", "-", s)
    s = s.replace("²", "^2").replace("³", "^3")
    s = re.sub(r"\\leq?(?![a-z])|≤|<=|⩽", r" \\le ", s)
    s = re.sub(r"\\geq?(?![a-z])|≥|>=|⩾", r" \\ge ", s)
    s = re.sub(r"\\[,;!: ]|\\quad|\\qquad", " ", s)
    return s.replace("[", "(").replace("]", ")")


_NUM = re.compile(r"[0-9]+(?:[.,][0-9]+)?")  # chỉ chữ số ASCII (\d của Python nhận cả chữ số Unicode)
_CMD = re.compile(r"\\[a-zA-Z]+")


def tokenize(src: str) -> list[Tok]:
    s = normalize_math(src)
    out: list[Tok] = []
    i = 0
    while i < len(s):
        ch = s[i]
        if ch.isspace():
            i += 1
            continue
        if m := _NUM.match(s, i):
            out.append(Tok("num", m.group()))
            i = m.end()
            continue
        if ch == "\\":
            m = _CMD.match(s, i)
            cmd = m.group() if m else "\\"
            i += len(cmd)
            if cmd == r"\frac":
                out.append(Tok("frac"))
            elif cmd == r"\le":
                out.append(Tok("rel", "<="))
            elif cmd == r"\ge":
                out.append(Tok("rel", ">="))
            else:
                raise ParseError(f"Ký hiệu chưa hỗ trợ: {cmd}")
            continue
        if ch.isascii() and ch.isalpha():
            if ch not in "xm":
                raise ParseError(f"Biến chưa hỗ trợ: {ch}")
            out.append(Tok("var", ch))
            i += 1
            continue
        i += 1
        if ch in "+-*/":
            out.append(Tok("op", ch))
        elif ch == ":":
            out.append(Tok("op", "/"))
        elif ch in "^(){}":
            out.append(Tok(ch))
        elif ch in "=<>":
            out.append(Tok("rel", ch))
        else:
            raise ParseError(f"Ký tự lạ: {ch}")
    return out


def _div_const(a: Poly, b: Poly) -> Poly:
    if not is_const(b) or const_of(b) == 0:
        raise ParseError("Chỉ hỗ trợ chia cho hằng số khác 0")
    return scale_p(a, ONE / const_of(b))


class _Parser:
    def __init__(self, toks: list[Tok]):
        self.toks = toks
        self.pos = 0

    def peek(self) -> Tok | None:
        return self.toks[self.pos] if self.pos < len(self.toks) else None

    def next(self) -> Tok | None:
        t = self.peek()
        self.pos += 1
        return t

    def expect(self, t: str) -> None:
        tok = self.next()
        if tok is None or tok.t != t:
            raise ParseError("Biểu thức không hợp lệ")

    def done(self) -> bool:
        return self.pos >= len(self.toks)

    def expr(self) -> Poly:
        left = self.term()
        while (t := self.peek()) and t.t == "op" and t.v in "+-":
            self.pos += 1
            right = self.term()
            left = add_p(left, right) if t.v == "+" else sub_p(left, right)
        return left

    def term(self) -> Poly:
        left = self.unary()
        while True:
            t = self.peek()
            if t and t.t == "op" and t.v in "*/":
                self.pos += 1
                right = self.unary()
                left = mul_p(left, right) if t.v == "*" else _div_const(left, right)
            elif t and t.t in ("var", "(", "frac", "{"):
                left = mul_p(left, self.power())  # nhân ngầm: 2x, 3(x - 2), (x - 1)(x + 2)
            else:
                return left

    def unary(self) -> Poly:
        t = self.peek()
        if t and t.t == "op" and t.v in "+-":
            self.pos += 1
            v = self.unary()
            return neg_p(v) if t.v == "-" else v
        return self.power()

    def power(self) -> Poly:
        base = self.atom()
        if (t := self.peek()) is None or t.t != "^":
            return base
        self.pos += 1
        exp = self.atom()
        c = const_of(exp)
        if not is_const(exp) or c.denominator != 1 or not 0 <= c <= 6:
            raise ParseError("Số mũ chưa hỗ trợ")
        return pow_p(base, int(c))

    def atom(self) -> Poly:
        t = self.next()
        if t is None:
            raise ParseError("Biểu thức không hợp lệ")
        if t.t == "num":
            return const_p(from_decimal(t.v))
        if t.t == "var":
            return var_p(t.v)
        if t.t in ("(", "{"):
            v = self.expr()
            self.expect(")" if t.t == "(" else "}")
            return v
        if t.t == "frac":
            self.expect("{")
            a = self.expr()
            self.expect("}")
            self.expect("{")
            b = self.expr()
            self.expect("}")
            return _div_const(a, b)
        raise ParseError("Biểu thức không hợp lệ")


def _parse_tokens(toks: list[Tok]) -> Poly:
    if not toks:
        raise ParseError("Biểu thức rỗng")
    p = _Parser(toks)
    v = p.expr()
    if not p.done():
        raise ParseError("Biểu thức không hợp lệ")
    return v


def _trim_punct(s: str) -> str:
    return re.sub(r"^[.,;:]+|[.,;:]+$", "", s.strip()).strip()


def parse_expr(src: str) -> Poly:
    return _parse_tokens(tokenize(_trim_punct(src)))


def parse_relation(src: str) -> tuple[Poly, Rel | None]:
    """"L rel R" → (P = L − R, quan hệ); không có quan hệ thì trả về (biểu thức, None)."""
    toks = tokenize(_trim_punct(src))
    at = [i for i, t in enumerate(toks) if t.t == "rel"]
    if not at:
        return _parse_tokens(toks), None
    if len(at) > 1:
        raise ParseError("Chưa hỗ trợ chuỗi nhiều dấu so sánh")
    i = at[0]
    return sub_p(_parse_tokens(toks[:i]), _parse_tokens(toks[i + 1:])), toks[i].v  # type: ignore[return-value]
