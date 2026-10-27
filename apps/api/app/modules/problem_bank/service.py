"""Giao diện công khai của module ngân hàng bài. Module khác chỉ gọi các hàm ở đây, không đọc bảng trực tiếp."""

import time
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ApiError
from app.modules.problem_bank.models import Problem, ReviewItem, Skill
from app.modules.problem_bank.schemas import ProblemPage, PublicProblem, ReviewItemOut, SkillOut

# 4 mức độ của Bộ GD: Nhận biết, Thông hiểu, Vận dụng, Vận dụng cao (cùng ngưỡng với frontend)
LEVEL_BOUNDS = {1: (0.0, 0.25), 2: (0.25, 0.5), 3: (0.5, 0.75), 4: (0.75, 1.01)}


SKILLS_TTL = 300.0
_skills_cache: tuple[float, list[SkillOut]] | None = None


async def skills(db: AsyncSession) -> list[SkillOut]:
    """Danh sách kỹ năng gần như không đổi: cache trong tiến trình 5 phút, đỡ một lượt truy vấn mỗi request."""
    global _skills_cache
    if _skills_cache and time.monotonic() - _skills_cache[0] < SKILLS_TTL:
        return _skills_cache[1]
    rows = [SkillOut(code=s.code, name=s.name) for s in await db.scalars(select(Skill).order_by(Skill.sort))]
    _skills_cache = (time.monotonic(), rows)
    return rows


async def skill_names(db: AsyncSession) -> dict[str, str]:
    return {s.code: s.name for s in await skills(db)}


def to_public(p: Problem, names: dict[str, str]) -> PublicProblem:
    return PublicProblem(
        id=p.id, statement=p.statement, grade=p.grade, skill=SkillOut(code=p.skill_code, name=names.get(p.skill_code, p.skill_code)),
        difficulty=p.difficulty, answer_type=p.answer_type, answer_prefix=p.answer_prefix, choices=p.choices, hints=p.hints,
    )


async def list_problems(db: AsyncSession, grade: int | None, skill: str | None, level: int | None, q: str | None) -> ProblemPage:
    stmt = select(Problem).where(Problem.status == "approved")
    if grade:
        stmt = stmt.where(Problem.grade == grade)
    if skill:
        stmt = stmt.where(Problem.skill_code == skill)
    if level in LEVEL_BOUNDS:
        lo, hi = LEVEL_BOUNDS[level]
        stmt = stmt.where(Problem.difficulty >= lo, Problem.difficulty < hi)
    if q:
        stmt = stmt.where(Problem.statement.ilike(f"%{q}%"))
    rows = (await db.scalars(stmt.order_by(Problem.grade, Problem.difficulty).limit(200))).all()
    names = await skill_names(db)
    return ProblemPage(items=[to_public(p, names) for p in rows], total=len(rows))


async def get_problem(db: AsyncSession, problem_id: str) -> Problem:
    p = await db.get(Problem, problem_id)
    if not p or p.status != "approved":
        raise ApiError(404, "not_found")
    return p


async def approved_pool(db: AsyncSession, skill: str) -> list[Problem]:
    return list((await db.scalars(select(Problem).where(Problem.status == "approved", Problem.skill_code == skill))).all())


async def skills_with_problems(db: AsyncSession) -> list[str]:
    return list((await db.scalars(select(Problem.skill_code).where(Problem.status == "approved").distinct())).all())


async def review_queue(db: AsyncSession) -> list[ReviewItemOut]:
    rows = (await db.scalars(select(ReviewItem).where(ReviewItem.status == "pending").order_by(ReviewItem.created_at.desc(), ReviewItem.id))).all()
    names = await skill_names(db)
    return [
        ReviewItemOut(
            id=r.id, origin=r.origin, statement=r.statement, answer_display=r.answer_display, solution=r.solution, grade=r.grade,
            skill=SkillOut(code=r.skill_code, name=names.get(r.skill_code, r.skill_code)), difficulty=r.difficulty,
            classification_confidence=r.classification_confidence, parent=r.parent, transform=r.transform, source=r.source,
            choices=r.choices, checks=r.checks,
        )
        for r in rows
    ]


async def decide(db: AsyncSession, item_id: str, decision: str, reason: str | None, reviewer_id: str) -> None:
    item = await db.get(ReviewItem, item_id, with_for_update=True)
    if not item or item.status != "pending":
        raise ApiError(404, "not_found")
    item.status = "approved" if decision == "approve" else "rejected"
    item.decided_by, item.decided_at, item.reason = reviewer_id, datetime.now(UTC), reason
    # TODO(M3): khi duyệt, chuyển bài (kèm đáp án có cấu trúc từ pipeline SymPy) vào bảng problems.
    await db.commit()


async def count_pending(db: AsyncSession) -> int:
    return int(await db.scalar(select(func.count()).select_from(ReviewItem).where(ReviewItem.status == "pending")) or 0)
