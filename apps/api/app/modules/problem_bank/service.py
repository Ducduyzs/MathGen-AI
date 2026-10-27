"""Giao diện công khai của module ngân hàng bài. Module khác chỉ gọi các hàm ở đây, không đọc bảng trực tiếp."""

import random
import time
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

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
    rows = [SkillOut(code=s.code, name=s.name, grade_min=s.grade_min, grade_max=s.grade_max)
            for s in await db.scalars(select(Skill).order_by(Skill.sort))]
    _skills_cache = (time.monotonic(), rows)
    return rows


PRIMARY_MAX_GRADE = 5


def for_grade(skill: SkillOut, grade: int | None) -> bool:
    """Kỹ năng cùng cấp học với học sinh: tiểu học (lớp 1–5) hoặc từ lớp 6. Chưa có lớp: coi như từ lớp 6."""
    primary = grade is not None and grade <= PRIMARY_MAX_GRADE
    return ((skill.grade_max or 12) <= PRIMARY_MAX_GRADE) == primary


def suits(skill: SkillOut, grade: int | None) -> bool:
    """Kỹ năng hợp để tự chọn khi luyện tập: cùng cấp học, và với tiểu học thì đã học tới (bắt đầu không quá lớp trên kế tiếp)."""
    if not for_grade(skill, grade):
        return False
    return grade is None or grade > PRIMARY_MAX_GRADE or (skill.grade_min or 1) <= grade + 1


async def skill_names(db: AsyncSession) -> dict[str, str]:
    return {s.code: s.name for s in await skills(db)}


def to_public(p: Problem, names: dict[str, str]) -> PublicProblem:
    return PublicProblem(
        id=p.id, statement=p.statement, grade=p.grade, skill=SkillOut(code=p.skill_code, name=names.get(p.skill_code, p.skill_code)),
        difficulty=p.difficulty, answer_type=p.answer_type, answer_prefix=p.answer_prefix, choices=p.choices, hints=p.hints,
    )


async def list_problems(db: AsyncSession, grade: int | None, skill: str | None, level: int | None, q: str | None,
                        province: str | None = None) -> ProblemPage:
    stmt = select(Problem).where(Problem.status == "approved")
    if province:
        stmt = stmt.where(Problem.province_code == province)
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
    if decision == "approve" and item.answer:
        # Bài có đáp án chấm được → vào ngân hàng, học sinh luyện được ngay
        if item.canonical_hash and await db.scalar(select(Problem.id).where(Problem.canonical_hash == item.canonical_hash)):
            raise ApiError(409, "duplicate_problem")
        db.add(Problem(
            statement=item.statement, grade=item.grade, skill_code=item.skill_code, difficulty=item.difficulty,
            answer_type=item.answer["type"], answer_prefix=item.answer_prefix, choices=item.choices, answer=item.answer,
            answer_display=item.answer_display, solution=item.solution, canonical_hash=item.canonical_hash,
            status="approved", origin=item.origin,
            # Bài thu thập từ đề thật mang theo khu vực của đề gốc
            province_code=(item.source or {}).get("province_code"), school_id=(item.source or {}).get("school_id"),
            exam_kind=(item.source or {}).get("exam_kind"), exam_year=(item.source or {}).get("exam_year"),
        ))
    await db.commit()


async def add_review_items(db: AsyncSession, rows: list[dict]) -> int:
    """Đưa bài do pipeline trích xuất / sinh vào hàng chờ duyệt. Không commit: người gọi commit cùng giao dịch."""
    db.add_all(ReviewItem(status="pending", **r) for r in rows)
    return len(rows)


def add_review_items_sync(db: Session, rows: list[dict]) -> int:
    """Như add_review_items, cho worker (bộ gom)."""
    db.add_all(ReviewItem(status="pending", **r) for r in rows)
    return len(rows)


def pending_hashes_sync(db: Session, hashes: list[str]) -> set[str]:
    """Mã băm đã có trong hàng chờ duyệt (đang chờ) để bộ gom không gửi trùng."""
    if not hashes:
        return set()
    return set(db.scalars(select(ReviewItem.canonical_hash).where(ReviewItem.status == "pending", ReviewItem.canonical_hash.in_(hashes))))


async def count_by_province(db: AsyncSession) -> dict[str, int]:
    rows = await db.execute(select(Problem.province_code, func.count()).where(Problem.status == "approved", Problem.province_code.is_not(None))
                            .group_by(Problem.province_code))
    return dict(rows.all())


async def count_by_school(db: AsyncSession, school_ids: list[str]) -> dict[str, int]:
    if not school_ids:
        return {}
    rows = await db.execute(select(Problem.school_id, func.count()).where(Problem.status == "approved", Problem.school_id.in_(school_ids))
                            .group_by(Problem.school_id))
    return dict(rows.all())


async def region_pool(db: AsyncSession, province: str, school_id: str | None, answer_type: str, skills: list[str] | None,
                      grade: int | None) -> list[Problem]:
    """Câu thật của một khu vực cho đề theo khu vực: cùng trường xếp trước, rồi cùng tỉnh; ưu tiên lớp gần lớp học sinh."""
    stmt = select(Problem).where(Problem.status == "approved", Problem.province_code == province, Problem.answer_type == answer_type)
    if skills:
        stmt = stmt.where(Problem.skill_code.in_(skills))
    rows = list(await db.scalars(stmt))
    if grade:
        near = [p for p in rows if grade - 2 <= p.grade <= grade + 1]
        rows = near or rows
    random.shuffle(rows)  # mỗi lần ra đề một khác; sắp xếp sau giữ thứ tự ngẫu nhiên trong cùng nhóm
    return sorted(rows, key=lambda p: (p.school_id != school_id if school_id else False, p.grade if not grade else abs(p.grade - grade)))


async def bank_index(db: AsyncSession) -> dict[str, str]:
    """Chỉ mục chống trùng: mã băm dạng chuẩn → mã bài (bài đã duyệt)."""
    rows = await db.execute(select(Problem.canonical_hash, Problem.id).where(Problem.status == "approved", Problem.canonical_hash.is_not(None)))
    return {h: pid for h, pid in rows}


def bank_index_sync(db: Session) -> dict[str, str]:
    """Như bank_index, cho worker (phiên đồng bộ)."""
    rows = db.execute(select(Problem.canonical_hash, Problem.id).where(Problem.status == "approved", Problem.canonical_hash.is_not(None)))
    return {h: pid for h, pid in rows}


def skill_names_sync(db: Session) -> dict[str, str]:
    return {s.code: s.name for s in db.scalars(select(Skill))}


async def count_pending(db: AsyncSession) -> int:
    return int(await db.scalar(select(func.count()).select_from(ReviewItem).where(ReviewItem.status == "pending")) or 0)


async def quality_stats(db: AsyncSession, days: int = 30) -> dict:
    """Số liệu chất lượng ngân hàng: số bài theo nguồn gốc / kỹ năng / tỉnh và kết quả duyệt gần đây."""
    approved = Problem.status == "approved"
    by_origin = dict((await db.execute(select(Problem.origin, func.count()).where(approved).group_by(Problem.origin))).all())
    by_skill = dict((await db.execute(select(Problem.skill_code, func.count()).where(approved).group_by(Problem.skill_code))).all())
    by_province = dict((await db.execute(select(Problem.province_code, func.count()).where(approved, Problem.province_code.is_not(None))
                                         .group_by(Problem.province_code))).all())
    since = datetime.now(UTC) - timedelta(days=days)
    decided = dict((await db.execute(select(ReviewItem.status, func.count()).where(ReviewItem.decided_at >= since)
                                     .group_by(ReviewItem.status))).all())
    reasons = (await db.execute(select(ReviewItem.reason, func.count()).where(ReviewItem.status == "rejected", ReviewItem.decided_at >= since,
                                                                              ReviewItem.reason.is_not(None))
                                .group_by(ReviewItem.reason).order_by(func.count().desc()).limit(5))).all()
    pending_by_origin = dict((await db.execute(select(ReviewItem.origin, func.count()).where(ReviewItem.status == "pending")
                                               .group_by(ReviewItem.origin))).all())
    return {
        "total": sum(by_origin.values()), "by_origin": by_origin, "by_skill": by_skill, "by_province": by_province,
        "pending": sum(pending_by_origin.values()), "pending_by_origin": pending_by_origin,
        "approved_recent": decided.get("approved", 0), "rejected_recent": decided.get("rejected", 0),
        "reject_reasons": [{"reason": r, "count": n} for r, n in reasons],
    }


async def problems_by_ids(db: AsyncSession, ids: list[str]) -> dict[str, Problem]:
    if not ids:
        return {}
    return {p.id: p for p in await db.scalars(select(Problem).where(Problem.id.in_(ids)))}
