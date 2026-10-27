"""Phụ huynh: học sinh tạo mã liên kết (dùng một lần, 24 giờ), phụ huynh nhập mã để theo dõi tiến độ, bài lớp giao,
kết quả làm đề và Đấu trường của con. Chỉ đọc qua service của các module khác."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import ApiError
from app.modules.arena import service as arena
from app.modules.classroom import service as classroom
from app.modules.exams import service as exams
from app.modules.family.models import LinkCode, ParentLink
from app.modules.family.schemas import ChildReport, ChildSummary, DayCount, LinkCodeOut, ParentOut
from app.modules.learning import service as learning
from app.modules.users.models import User

CODE_TTL = timedelta(hours=24)
MAX_PARENTS = 4
MAX_CHILDREN = 10
STREAK_WINDOW_DAYS = 120
REPORT_DAYS = 14


# ---------------------------------------------------------------- phía học sinh

async def create_code(db: AsyncSession, student: User) -> LinkCodeOut:
    """Tạo mã mới (mã cũ hết hiệu lực)."""
    expires = datetime.now(UTC) + CODE_TTL
    for _ in range(5):
        code = classroom.new_code()
        try:
            await db.execute(insert(LinkCode).values(student_id=student.id, code=code, expires_at=expires)
                             .on_conflict_do_update(index_elements=["student_id"], set_={"code": code, "expires_at": expires}))
            await db.commit()
            return LinkCodeOut(code=code, expires_at=expires)
        except IntegrityError:  # trùng mã của học sinh khác
            await db.rollback()
    raise ApiError(503, "error")


async def my_parents(db: AsyncSession, student: User) -> list[ParentOut]:
    rows = (await db.execute(
        select(User, ParentLink.created_at).join(ParentLink, ParentLink.parent_id == User.id)
        .where(ParentLink.student_id == student.id).order_by(ParentLink.created_at)
    )).all()
    return [ParentOut(id=u.id, full_name=u.full_name, email=u.email, linked_at=at) for u, at in rows]


async def remove_parent(db: AsyncSession, student: User, parent_id: str) -> None:
    await db.execute(delete(ParentLink).where(ParentLink.student_id == student.id, ParentLink.parent_id == parent_id))
    await db.commit()


# ---------------------------------------------------------------- phía phụ huynh

async def link(db: AsyncSession, parent: User, code: str) -> ChildSummary:
    row = await db.scalar(select(LinkCode).where(LinkCode.code == classroom.normalize_code(code)).with_for_update())
    if not row or row.expires_at <= datetime.now(UTC):
        raise ApiError(404, "link_code_invalid")
    student_id = row.student_id
    if not await db.get(ParentLink, (parent.id, student_id)):
        children = await db.scalar(select(func.count()).select_from(ParentLink).where(ParentLink.parent_id == parent.id))
        parents = await db.scalar(select(func.count()).select_from(ParentLink).where(ParentLink.student_id == student_id))
        if children >= MAX_CHILDREN or parents >= MAX_PARENTS:
            raise ApiError(422, "too_many_links")
        db.add(ParentLink(parent_id=parent.id, student_id=student_id))
    await db.delete(row)  # mã dùng một lần
    await db.commit()
    return (await _summaries(db, parent, [student_id]))[0]


async def _child(db: AsyncSession, parent: User, child_id: str) -> tuple[User, datetime]:
    link_row = await db.get(ParentLink, (parent.id, child_id))
    child = await db.get(User, child_id) if link_row else None
    if not child:
        raise ApiError(404, "not_found")
    return child, link_row.created_at


async def _summaries(db: AsyncSession, parent: User, only: list[str] | None = None) -> list[ChildSummary]:
    stmt = (select(User, ParentLink.created_at).join(ParentLink, ParentLink.student_id == User.id)
            .where(ParentLink.parent_id == parent.id).order_by(ParentLink.created_at))
    if only is not None:
        stmt = stmt.where(User.id.in_(only))
    rows = (await db.execute(stmt)).all()
    days = await learning.activity_by_user(db, [u.id for u, _ in rows], STREAK_WINDOW_DAYS)
    today, goal = learning.today_vn(), get_settings().daily_goal
    streaks = await learning.streaks_by_user(db, days)
    out = []
    for u, linked_at in rows:
        d = days[u.id]
        statuses = [a.status for a in await classroom.my_assignments(db, u) if a.status]
        out.append(ChildSummary(
            id=u.id, full_name=u.full_name, grade=u.grade, linked_at=linked_at, daily_goal=goal, today_problems=d.get(today, 0),
            week_problems=sum(n for day, n in d.items() if day > today - timedelta(days=7)), streak_days=streaks[u.id],
            pending_assignments=sum(1 for a in statuses if a in ("todo", "in_progress")), missed_assignments=sum(1 for a in statuses if a == "missed"),
            last_active=max((day for day, n in d.items() if n > 0), default=None),
        ))
    return out


async def children(db: AsyncSession, parent: User) -> list[ChildSummary]:
    return await _summaries(db, parent)


async def child_report(db: AsyncSession, parent: User, child_id: str) -> ChildReport:
    child, _ = await _child(db, parent, child_id)
    summary = (await _summaries(db, parent, [child.id]))[0]
    days = (await learning.activity_by_user(db, [child.id], REPORT_DAYS))[child.id]
    today = learning.today_vn()
    activity = [DayCount(day=d, count=days.get(d, 0)) for d in (today - timedelta(days=i) for i in range(REPORT_DAYS - 1, -1, -1))]
    return ChildReport(
        child=summary, progress=await learning.progress(db, child), activity=activity, exams=await exams.recent(db, child),
        assignments=await classroom.my_assignments(db, child), arena=(await arena.me(db, child)).best,
    )


async def remove_child(db: AsyncSession, parent: User, child_id: str) -> None:
    await db.execute(delete(ParentLink).where(ParentLink.parent_id == parent.id, ParentLink.student_id == child_id))
    await db.commit()
