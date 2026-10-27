"""Bộ sinh đề theo dạng bài: mỗi dạng (template) sinh số liệu mới ở mỗi lần gọi, kèm đáp án và lời giải.

42 dạng = 17 dạng Đại số lớp 8–10 (đề ôn tập) + 25 dạng lớp 10–12 (đề thi tốt nghiệp THPT).
"""

from app.modules.exams.generator.algebra import ALGEBRA
from app.modules.exams.generator.base import ExamMode, Generated, Rng, Template
from app.modules.exams.generator.thpt import THPT

TEMPLATES: list[Template] = [*ALGEBRA, *THPT]
BY_CODE: dict[str, Template] = {t.code: t for t in TEMPLATES}

TYPE_ORDER = ["choice", "true_false", "number"]
# Thứ tự chủ đề trong mỗi phần, giống cách đề chính thức xếp: giải tích → mũ-log → hình → xác suất → dãy số
TOPIC_ORDER = ["calculus", "exp_log", "geometry_space", "coordinates_3d", "probability_statistics", "sequences"]

THPT_BLUEPRINT = {
    "duration_minutes": 90,
    "parts": [
        {"part": "I", "type": "choice", "count": 12, "points": 0.25},
        {"part": "II", "type": "true_false", "count": 4, "points": 1.0},
        {"part": "III", "type": "number", "count": 6, "points": 0.5},
    ],
}

Built = tuple[Template, Generated]


def generate(templates: list[Template], g: Rng) -> list[Built]:
    """Sinh câu cho từng dạng; thử lại vài lần nếu trùng đề bài với câu trước."""
    seen: set[str] = set()
    out: list[Built] = []
    for t in templates:
        q = t.make(g)
        for _ in range(8):
            if q["statement"] not in seen:
                break
            q = t.make(g)
        seen.add(q["statement"])
        out.append((t, q))
    return out


def draw(ts: list[Template], n: int, g: Rng) -> list[Template]:
    """Rút xoay vòng để các dạng xuất hiện đều nhau, xếp dễ → khó."""
    out: list[Template] = []
    bag: list[Template] = []
    for _ in range(n):
        if not bag:
            bag = g.shuffled(ts)
        out.append(bag.pop())
    return sorted(out, key=lambda t: t.difficulty)


def build_questions(mode: ExamMode, size: int, g: Rng, skills: list[str] | None = None,
                    templates: list[str] | None = None) -> list[Built] | None:
    """Đề ôn tập. Trắc nghiệm: ~20% câu Đúng/Sai, còn lại A/B/C/D. Tự luận: điền đáp số.

    Khi truyền `templates` (đề từ dạng đã sai) thì lấy đúng các dạng đó, bất kể hình thức.
    """
    if templates:
        pool = [t for t in TEMPLATES if t.code in templates]
        if not pool:
            return None
        chosen = sorted(draw(pool, size, g), key=lambda t: TYPE_ORDER.index(t.type))
        return generate(chosen, g)

    pool = [t for t in TEMPLATES if t.mode == mode and (not skills or t.skill in skills)]
    if not pool:
        return None
    tf_pool = [t for t in pool if t.type == "true_false"]
    main_pool = [t for t in pool if t.type != "true_false"]
    n_tf = round(size * 0.2) if mode == "choice" and tf_pool else 0
    if not main_pool:
        n_tf = size
    return generate([*draw(main_pool, size - n_tf, g), *draw(tf_pool, n_tf, g)], g)


def build_thpt(g: Rng) -> list[Built]:
    """Đề tốt nghiệp THPT: 12 câu Phần I + 4 câu Phần II + 6 câu Phần III.

    Mỗi phần lấy trước một dạng cho mỗi chủ đề (để đề luôn phủ đủ chủ đề), sau đó rút thêm cho đủ số câu.
    """
    chosen: list[Template] = []
    for part in THPT_BLUEPRINT["parts"]:
        pool = g.shuffled([t for t in THPT if t.part == part["part"]])
        first = [t for skill in TOPIC_ORDER for t in [next((x for x in pool if x.skill == skill), None)] if t]
        rest = [t for t in pool if t not in first]
        picked = [*first, *rest][: part["count"]]
        chosen += sorted(picked, key=lambda t: (TOPIC_ORDER.index(t.skill), t.difficulty))
    return generate(chosen, g)


__all__ = ["BY_CODE", "TEMPLATES", "THPT_BLUEPRINT", "Rng", "build_questions", "build_thpt"]
