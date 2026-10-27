import logging
import random
from datetime import UTC, date, datetime, timedelta, timezone

from redis.asyncio import Redis
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import ApiError
from app.modules.learning import tasks
from app.modules.learning.grading import grade
from app.modules.learning.models import Attempt, DailyActivity, SkillScore
from app.modules.learning.schemas import AttemptIn, AttemptResult, AttemptSummary, ProgressOut, SkillScoreOut
from app.modules.problem_bank import service as bank
from app.modules.problem_bank.models import Problem
from app.modules.problem_bank.schemas import PublicProblem, SkillOut
from app.modules.users.models import User

log = logging.getLogger(__name__)
VN = timezone(timedelta(hours=7))  # Việt Nam không có giờ mùa hè
RECENT = 6


def today_vn() -> date:
    return datetime.now(VN).date()


async def _scores(db: AsyncSession, user_id: str) -> dict[str, SkillScore]:
    return {s.skill_code: s for s in await db.scalars(select(SkillScore).where(SkillScore.user_id == user_id))}


async def _recent(redis: Redis, user_id: str) -> list[str]:
    try:
        return await redis.lrange(f"recent:{user_id}", 0, RECENT - 1)
    except Exception:  # Redis lỗi thì vẫn phục vụ bài, chỉ mất tính năng tránh lặp
        log.warning("redis unavailable: recent list skipped")
        return []


async def _remember(redis: Redis, user_id: str, problem_id: str) -> None:
    key = f"recent:{user_id}"
    try:
        async with redis.pipeline(transaction=True) as pipe:
            await pipe.lrem(key, 0, problem_id).lpush(key, problem_id).ltrim(key, 0, RECENT - 1).expire(key, 7 * 86400).execute()
    except Exception:
        log.warning("redis unavailable: recent list not updated")


async def next_problem(db: AsyncSession, redis: Redis, user: User, skill: str | None, similar_to: str | None) -> PublicProblem:
    """Chọn kỹ năng yếu với xác suất cao hơn, rồi chọn bài có độ khó gần năng lực, tránh bài vừa làm."""
    if similar_to:
        skill = (await bank.get_problem(db, similar_to)).skill_code
    scores = await _scores(db, user.id)
    if not skill:
        available = await bank.skills_with_problems(db)
        if not available:
            raise ApiError(404, "no_problem")
        weights = [1.05 - (scores[c].score if c in scores else 0.5) for c in available]
        skill = random.choices(available, weights=weights)[0]
    pool = await bank.approved_pool(db, skill)
    if not pool:
        raise ApiError(404, "no_problem")
    recent = await _recent(redis, user.id)
    fresh = [p for p in pool if p.id not in recent] or [p for p in pool if not recent or p.id != recent[0]] or pool
    ability = scores[skill].score if skill in scores else 0.5
    top = sorted(fresh, key=lambda p: abs(p.difficulty - ability))[:3]
    chosen = random.choice(top)
    await _remember(redis, user.id, chosen.id)
    return bank.to_public(chosen, await bank.skill_names(db))


def _result(attempt: Attempt, p: Problem) -> AttemptResult:
    return AttemptResult(attempt_id=attempt.id, is_correct=attempt.is_correct, correct_answer=p.answer, correct_answer_display=p.answer_display, solution=p.solution)


async def submit(db: AsyncSession, user: User, body: AttemptIn, idempotency_key: str | None) -> AttemptResult:
    key = idempotency_key or body.client_attempt_id
    existing = await db.scalar(select(Attempt).where(Attempt.user_id == user.id, Attempt.client_attempt_id == key))
    p = await bank.get_problem(db, body.problem_id)
    if existing:  # nộp lại (mạng lỗi, bấm hai lần): trả kết quả cũ, không tạo bản ghi mới
        return _result(existing, p)

    answer = body.answer.model_dump()
    attempt = Attempt(user_id=user.id, problem_id=p.id, client_attempt_id=key, answer=answer,
                      is_correct=grade(p.answer, answer), time_ms=body.time_ms, hints_used=body.hints_used)
    db.add(attempt)
    await record_activity(db, user.id, 1)
    try:
        await db.commit()
    except IntegrityError:  # hai request cùng khóa chạy song song: bản kia đã ghi trước
        await db.rollback()
        existing = await db.scalar(select(Attempt).where(Attempt.user_id == user.id, Attempt.client_attempt_id == key))
        return _result(existing, p)

    # Sau khi commit mới đẩy task: worker cập nhật điểm kỹ năng (dev/test: chạy ngay trong tiến trình).
    tasks.update_skill_score.delay(user.id, p.skill_code, attempt.is_correct, body.hints_used)
    return _result(attempt, p)


async def record_activity(db: AsyncSession, user_id: str, count: int) -> None:
    """Cộng số bài đã làm hôm nay (giờ Việt Nam). Không commit: người gọi commit cùng giao dịch của mình."""
    if count <= 0:
        return
    await db.execute(
        insert(DailyActivity).values(user_id=user_id, day=today_vn(), count=count)
        .on_conflict_do_update(index_elements=["user_id", "day"], set_={"count": DailyActivity.count + count})
    )


def schedule_exam_scores(user_id: str, outcomes: list[tuple[str, bool]]) -> None:
    """Đẩy task cập nhật điểm kỹ năng sau khi nộp đề. Gọi sau khi đã commit."""
    if outcomes:
        tasks.apply_exam_result.delay(user_id, outcomes)


def streak(days: dict[date, int], goal: int, today: date) -> int:
    """Số ngày liên tiếp đạt mục tiêu, tính cả hôm nay nếu đã đạt (chưa đạt hôm nay thì chuỗi vẫn giữ từ hôm qua)."""
    d = today if days.get(today, 0) >= goal else today - timedelta(days=1)
    n = 0
    while days.get(d, 0) >= goal:
        n += 1
        d -= timedelta(days=1)
    return n



async def activity_by_user(db: AsyncSession, user_ids: list[str], days: int) -> dict[str, dict[date, int]]:
    """Số bài mỗi ngày trong `days` ngày gần nhất của nhiều học sinh (bảng xếp hạng lớp)."""
    out: dict[str, dict[date, int]] = {u: {} for u in user_ids}
    if user_ids:
        rows = await db.scalars(select(DailyActivity).where(DailyActivity.user_id.in_(user_ids), DailyActivity.day > today_vn() - timedelta(days=days)))
        for r in rows:
            out[r.user_id][r.day] = r.count
    return out


async def progress(db: AsyncSession, user: User) -> ProgressOut:
    goal = get_settings().daily_goal
    scores = await _scores(db, user.id)
    skills = await bank.skills(db)
    # Một truy vấn cho cả tổng số và số đúng
    total, correct = (await db.execute(
        select(func.count(), func.count().filter(Attempt.is_correct.is_(True))).where(Attempt.user_id == user.id)
    )).one()
    since = today_vn() - timedelta(days=400)
    days = {r.day: r.count for r in await db.scalars(select(DailyActivity).where(DailyActivity.user_id == user.id, DailyActivity.day >= since))}
    return ProgressOut(
        skills=[SkillScoreOut(code=s.code, name=s.name, score=scores[s.code].score if s.code in scores else 0.5,
                              n_attempts=scores[s.code].n_attempts if s.code in scores else 0) for s in skills],
        total_attempts=total, correct_attempts=correct, daily_goal=goal, today_attempts=days.get(today_vn(), 0),
        streak_days=streak(days, goal, today_vn()),
    )


async def recent_attempts(db: AsyncSession, user: User, limit: int) -> list[AttemptSummary]:
    rows = await db.execute(
        select(Attempt, Problem).join(Problem, Problem.id == Attempt.problem_id)
        .where(Attempt.user_id == user.id).order_by(Attempt.created_at.desc()).limit(limit)
    )
    names = await bank.skill_names(db)
    return [
        AttemptSummary(id=a.id, problem_id=p.id, statement=p.statement, skill=SkillOut(code=p.skill_code, name=names.get(p.skill_code, p.skill_code)),
                       is_correct=a.is_correct, created_at=a.created_at.astimezone(UTC))
        for a, p in rows.all()
    ]
