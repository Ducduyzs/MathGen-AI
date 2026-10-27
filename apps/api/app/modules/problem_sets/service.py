"""Bộ đề của giáo viên: chọn câu theo dạng bài, đổi số liệu từng câu, sắp xếp, nhân bản, giao cho lớp (module classroom gọi
`assignment_rows`). Câu hỏi sinh bằng bộ sinh đề của module exams nên chấm bài giống hệt đề ôn tập."""

import secrets
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ApiError
from app.modules.exams import service as exams
from app.modules.exams.schemas import TemplateRef
from app.modules.problem_bank import service as bank
from app.modules.problem_bank.schemas import SkillOut
from app.modules.problem_sets.models import ProblemSet
from app.modules.problem_sets.schemas import (
    MAX_QUESTIONS, AddQuestionsIn, CreateSetIn, ProblemSetOut, ProblemSetSummary, SetQuestionOut, TemplateCount, TypeCounts, UpdateSetIn,
)
from app.modules.users.models import User


def _key() -> str:
    return secrets.token_hex(4)


def _generate(items: list[TemplateCount], have: int) -> list[dict]:
    codes = [i.template for i in items for _ in range(i.count)]
    if have + len(codes) > MAX_QUESTIONS:
        raise ApiError(422, "set_too_large")
    return [{"key": _key(), **row} for row in exams.generate_from_templates(codes)]


async def _owned(db: AsyncSession, user: User, set_id: str, *, lock: bool = False) -> ProblemSet:
    stmt = select(ProblemSet).where(ProblemSet.id == set_id)
    s = await db.scalar(stmt.with_for_update() if lock else stmt)
    if not s or (s.teacher_id != user.id and user.role != "admin"):
        raise ApiError(404, "not_found")
    return s


def _summary(s: ProblemSet, names: dict[str, str]) -> ProblemSetSummary:
    counts = TypeCounts()
    skills: dict[str, SkillOut] = {}
    for q in s.questions:
        setattr(counts, q["type"], getattr(counts, q["type"]) + 1)
        skills.setdefault(q["skill_code"], SkillOut(code=q["skill_code"], name=names.get(q["skill_code"], q["skill_code"])))
    return ProblemSetSummary(id=s.id, title=s.title, description=s.description, size=len(s.questions), counts=counts,
                             skills=list(skills.values()), created_at=s.created_at, updated_at=s.updated_at)


def _question(q: dict, names: dict[str, str]) -> SetQuestionOut:
    return SetQuestionOut(
        key=q["key"], type=q["type"], template=TemplateRef(code=q["template_code"], name=q["template_name"]),
        skill=SkillOut(code=q["skill_code"], name=names.get(q["skill_code"], q["skill_code"])), grade=q["grade"],
        difficulty=q["difficulty"], statement=q["statement"], choices=q.get("choices"), statements=q.get("statements"),
        answer_prefix=q.get("answer_prefix"), answer=q["answer"], answer_display=q["answer_display"], solution=q["solution"],
    )


async def _out(db: AsyncSession, s: ProblemSet) -> ProblemSetOut:
    names = await bank.skill_names(db)
    return ProblemSetOut(**_summary(s, names).model_dump(), questions=[_question(q, names) for q in s.questions])


async def _save(db: AsyncSession, s: ProblemSet, questions: list[dict] | None = None) -> ProblemSetOut:
    if questions is not None:
        s.questions = questions  # gán danh sách mới để SQLAlchemy nhận ra JSONB đã đổi
    s.updated_at = datetime.now(UTC)
    await db.commit()
    return await _out(db, s)


async def list_sets(db: AsyncSession, user: User) -> list[ProblemSetSummary]:
    rows = await db.scalars(select(ProblemSet).where(ProblemSet.teacher_id == user.id).order_by(ProblemSet.updated_at.desc()))
    names = await bank.skill_names(db)
    return [_summary(s, names) for s in rows]


async def create(db: AsyncSession, user: User, body: CreateSetIn) -> ProblemSetOut:
    now = datetime.now(UTC)
    s = ProblemSet(teacher_id=user.id, title=body.title.strip(), description=(body.description or "").strip() or None,
                   questions=_generate(body.items, 0), created_at=now, updated_at=now)
    db.add(s)
    await db.commit()
    return await _out(db, s)


async def get(db: AsyncSession, user: User, set_id: str) -> ProblemSetOut:
    return await _out(db, await _owned(db, user, set_id))


async def update(db: AsyncSession, user: User, set_id: str, body: UpdateSetIn) -> ProblemSetOut:
    s = await _owned(db, user, set_id, lock=True)
    if body.title is not None:
        s.title = body.title.strip()
    if "description" in body.model_fields_set:
        s.description = (body.description or "").strip() or None
    questions = None
    if body.order is not None:
        by_key = {q["key"]: q for q in s.questions}
        if len(set(body.order)) != len(body.order) or any(k not in by_key for k in body.order):
            raise ApiError(422, "validation_error")
        questions = [by_key[k] for k in body.order]
    return await _save(db, s, questions)


async def add_questions(db: AsyncSession, user: User, set_id: str, body: AddQuestionsIn) -> ProblemSetOut:
    s = await _owned(db, user, set_id, lock=True)
    return await _save(db, s, [*s.questions, *_generate(body.items, len(s.questions))])


async def regenerate(db: AsyncSession, user: User, set_id: str, key: str) -> ProblemSetOut:
    """Đổi số liệu một câu: sinh câu mới cùng dạng, giữ nguyên vị trí."""
    s = await _owned(db, user, set_id, lock=True)
    i = next((i for i, q in enumerate(s.questions) if q["key"] == key), None)
    if i is None:
        raise ApiError(404, "not_found")
    fresh = _generate([TemplateCount(template=s.questions[i]["template_code"])], 0)[0]
    return await _save(db, s, [*s.questions[:i], fresh, *s.questions[i + 1:]])


async def duplicate(db: AsyncSession, user: User, set_id: str) -> ProblemSetSummary:
    src = await _owned(db, user, set_id)
    now = datetime.now(UTC)
    s = ProblemSet(teacher_id=user.id, title=f"{src.title} (bản sao)"[:200], description=src.description,
                   questions=[{**q, "key": _key()} for q in src.questions], created_at=now, updated_at=now)
    db.add(s)
    await db.commit()
    return _summary(s, await bank.skill_names(db))


async def delete(db: AsyncSession, user: User, set_id: str) -> None:
    await db.delete(await _owned(db, user, set_id))
    await db.commit()


async def assignment_rows(db: AsyncSession, user: User, set_id: str) -> tuple[str, str, list[dict]]:
    """Bộ đề → (tên, hình thức, câu hỏi) để giao cho lớp. Bộ đề chỉ có câu điền đáp số thì là đề tự luận."""
    s = await _owned(db, user, set_id)
    if not s.questions:
        raise ApiError(422, "set_empty")
    mode = "written" if all(q["type"] == "number" for q in s.questions) else "choice"
    return s.title, mode, [{k: v for k, v in q.items() if k != "key"} for q in s.questions]
