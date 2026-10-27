"""Hàm dùng chung cho bộ sinh đề: số ngẫu nhiên, định dạng LaTeX, tạo phương án.

Chuyển từ apps/web/src/mocks/gen-utils.ts. Mỗi dạng bài nhận một `Rng` để test cố định được seed.
"""

import math
import random
from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal, NotRequired, TypedDict

ExamMode = Literal["choice", "written"]
QuestionType = Literal["choice", "true_false", "number"]
ThptPart = Literal["I", "II", "III"]


class Rng(random.Random):
    def rand(self, lo: int, hi: int) -> int:
        return self.randint(lo, hi)

    def pick[T](self, xs: list[T] | tuple[T, ...]) -> T:
        return self.choice(xs)

    def coin(self) -> bool:
        return self.random() < 0.5

    def nonzero(self, lo: int, hi: int) -> int:
        v = 0
        while v == 0:
            v = self.rand(lo, hi)
        return v

    def distinct_pair(self, lo: int, hi: int, skip_zero: bool = False) -> tuple[int, int]:
        draw = (lambda: self.nonzero(lo, hi)) if skip_zero else (lambda: self.rand(lo, hi))
        p = draw()
        q = draw()
        while q == p:
            q = draw()
        return (p, q) if p < q else (q, p)

    def shuffled[T](self, xs: list[T] | tuple[T, ...]) -> list[T]:
        out = list(xs)
        self.shuffle(out)
        return out


class Generated(TypedDict):
    statement: str
    answer: dict
    answer_display: str
    solution: list[str]
    choices: NotRequired[list[dict]]
    statements: NotRequired[list[dict]]
    answer_prefix: NotRequired[str]
    # Sai số chấp nhận cho câu trả lời ngắn có làm tròn (ví dụ 0,005 khi làm tròn đến hàng phần trăm)
    tolerance: NotRequired[float]


@dataclass(frozen=True)
class Template:
    code: str
    name: str
    skill: str
    grade: int
    difficulty: float
    mode: ExamMode
    type: QuestionType
    part: ThptPart | None
    make: Callable[[Rng], Generated]

    def info(self) -> dict:
        out = {"code": self.code, "name": self.name, "skill": self.skill, "grade": self.grade,
               "difficulty": self.difficulty, "mode": self.mode, "type": self.type}
        return out | ({"part": self.part} if self.part else {})


def registry(target: list[Template]):
    """Decorator đăng ký một hàm make() thành dạng bài."""

    def template(code: str, name: str, skill: str, grade: int, difficulty: float, mode: ExamMode, type: QuestionType,
                 part: ThptPart | None = None):
        def wrap(make: Callable[[Rng], Generated]):
            target.append(Template(code, name, skill, grade, difficulty, mode, type, part, make))
            return make

        return wrap

    return template


# ---------------------------------------------------------------- định dạng

def frac(n: int, d: int) -> str:
    """Phân số tối giản dạng LaTeX."""
    if d < 0:
        n, d = -n, -d
    g = math.gcd(n, d) or 1
    n, d = n // g, d // g
    if d == 1:
        return f"{n}"
    return rf"-\dfrac{{{-n}}}{{{d}}}" if n < 0 else rf"\dfrac{{{n}}}{{{d}}}"


def poly(terms: list[tuple[int, str]]) -> str:
    """poly([(1, "x^2"), (-5, "x"), (6, "")]) → "x^2 - 5x + 6"."""
    out = ""
    for c, v in terms:
        if c == 0:
            continue
        body = (v if abs(c) == 1 else f"{abs(c)}{v}") if v else f"{abs(c)}"
        out += (f" - {body}" if c < 0 else f" + {body}") if out else (f"-{body}" if c < 0 else body)
    return out or "0"


def lin(a: int, b: int) -> str:
    return poly([(a, "x"), (b, "")])


def quad(b: int, c: int) -> str:
    return poly([(1, "x^2"), (b, "x"), (c, "")])


def factor(root: int) -> str:
    """(x - root)"""
    return f"({poly([(1, 'x'), (-root, '')])})"


def num_sum(xs: list[int]) -> str:
    """Biểu thức số: num_sum([4, -6, 1]) → "4 - 6 + 1"."""
    return "".join(f"{x}" if i == 0 else f" - {-x}" if x < 0 else f" + {x}" for i, x in enumerate(xs))


def p3(*xs: int) -> str:
    """Điểm/vectơ: p3(1, -2, 3) → "(1;\\ -2;\\ 3)"."""
    return "(" + r";\ ".join(str(x) for x in xs) + ")"


# ---------------------------------------------------------------- phương án và đáp án

KEYS = ["A", "B", "C", "D"]


def make_choices(g: Rng, correct: str, candidates: list[str]) -> dict:
    """Đáp án đúng + các phương án nhiễu (bỏ trùng, giữ thứ tự), xáo vị trí."""
    wrong = list(dict.fromkeys(c for c in candidates if c != correct))[:3]
    options = g.shuffled([correct, *wrong])
    key = KEYS[options.index(correct)]
    return {
        "choices": [{"key": KEYS[i], "content": f"${c}$"} for i, c in enumerate(options)],
        "answer": {"type": "choice", "value": key},
        "answer_display": f"{key}. ${correct}$",
    }


def tf(statements: list[str], truth: list[bool]) -> dict:
    """Câu Đúng/Sai: truth[i] là đáp án của ý thứ i."""
    keys = ["a", "b", "c", "d"]
    return {
        "statements": [{"key": keys[i], "content": s} for i, s in enumerate(statements)],
        "answer": {"type": "true_false", "value": {keys[i]: t for i, t in enumerate(truth)}},
        "answer_display": " · ".join(f"{keys[i]}) {'Đúng' if t else 'Sai'}" for i, t in enumerate(truth)),
    }


def number(value: int | str) -> dict:
    return {"type": "number", "value": str(value)}
