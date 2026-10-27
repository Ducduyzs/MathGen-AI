"""Đấu trường: trả lời nhanh trong 5 / 15 / 30 phút. Câu khó dần theo số câu đã làm, đúng liên tiếp được thưởng thêm;
bảng xếp hạng theo tuần (giờ Việt Nam) cho từng kho câu và thời lượng.

Câu hỏi sinh từ bộ sinh đề của module exams, mỗi lần một câu: chỉ câu đang hỏi được lưu kèm đáp án, server giữ giờ
kết thúc nên client không thể làm thêm sau khi hết giờ.
"""

import random
import secrets
from datetime import UTC, datetime, time, timedelta

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import distinct_on, insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ApiError
from app.core.ids import new_id
from app.modules.arena import ranks
from app.modules.arena.models import ArenaRating, ArenaRun
from app.modules.arena.schemas import (
    AnswerIn, AnswerOut, ArenaItem, ArenaMeOut, BestOut, BoardOut, BoardRow, RankBoardOut, RankChange, RankRow, RunOut, RunSummary,
    StartRunIn,
)
from app.modules.exams import service as exams
from app.modules.exams.schemas import ExamQuestionOut, TemplateRef
from app.modules.learning import service as learning
from app.modules.problem_bank import service as bank
from app.modules.problem_bank.schemas import SkillOut
from app.modules.users.models import User

# Câu trả lời gửi đúng lúc hết giờ có thể đến muộn vài giây qua mạng
GRACE = timedelta(seconds=5)
BOARD_SIZE = 20
RECENT = 8
MAX_COMBO_BONUS = 5


def points_for(difficulty: float, combo: int) -> int:
    """Điểm một câu đúng: 10 + độ khó (0–10) + 2 điểm cho mỗi câu đúng liên tiếp trước đó (tối đa 5 câu)."""
    return 10 + round(10 * difficulty) + 2 * min(combo, MAX_COMBO_BONUS)


def _target_difficulty(answered: int) -> float:
    return min(0.2 + 0.03 * answered, 0.85)


def _next_question(pool: str, answered: int, last_template: str | None) -> dict:
    """Chọn ngẫu nhiên trong vài dạng có độ khó gần mức mục tiêu, không lặp dạng vừa hỏi."""
    ts = [t for t in exams.arena_templates(pool) if t.code != last_template] or exams.arena_templates(pool)
    target = _target_difficulty(answered)
    near = sorted(ts, key=lambda t: abs(t.difficulty - target))[:4]
    row = exams.generate_from_templates([random.choice(near).code])[0]
    return {"key": secrets.token_hex(4), **row}


def week_start() -> datetime:
    """0 giờ thứ Hai tuần này, giờ Việt Nam."""
    today = learning.today_vn()
    return datetime.combine(today - timedelta(days=today.weekday()), time(0), tzinfo=learning.VN)


async def _owned(db: AsyncSession, user: User, run_id: str, *, lock: bool = False) -> ArenaRun:
    stmt = select(ArenaRun).where(ArenaRun.id == run_id, ArenaRun.user_id == user.id)
    run = await db.scalar(stmt.with_for_update() if lock else stmt)
    if not run:
        raise ApiError(404, "not_found")
    return run


async def _finalize(db: AsyncSession, run: ArenaRun, now: datetime) -> list[tuple[str, bool]]:
    """Kết thúc lượt (chưa commit). Trả về kết quả từng kỹ năng để cập nhật điểm sau khi commit."""
    if run.finished_at is not None:
        return []
    run.finished_at, run.current = min(now, run.ends_at), None
    done = [h for h in run.history if h["given"] is not None]
    await _apply_rank(db, run)
    await learning.record_activity(db, run.user_id, [h["is_correct"] for h in done], "arena")
    return [(h["skill_code"], h["is_correct"]) for h in done]


async def _rating(db: AsyncSession, user_id: str, lock: bool = False) -> ArenaRating | None:
    if not lock:
        return await db.get(ArenaRating, user_id)
    # Tạo nếu chưa có và khóa dòng trong một lượt gọi DB
    stmt = insert(ArenaRating).values(user_id=user_id, points=0, peak=0, ranked_runs=0)
    stmt = stmt.on_conflict_do_update(index_elements=["user_id"], set_={"user_id": stmt.excluded.user_id}).returning(ArenaRating)
    return await db.scalar(select(ArenaRating).from_statement(stmt).execution_options(populate_existing=True))


async def _apply_rank(db: AsyncSession, run: ArenaRun) -> None:
    """Cộng/trừ điểm rank một lần khi lượt kết thúc."""
    rating = await _rating(db, run.user_id, lock=True)
    delta = ranks.rank_delta(rating.points, run.score, run.answered, run.duration_minutes)
    if delta is None:
        return
    after = max(0, rating.points + delta)
    run.rank_delta = after - rating.points
    rating.points, rating.peak, rating.ranked_runs = after, max(rating.peak, after), rating.ranked_runs + 1


async def _commit(db: AsyncSession, user_id: str, outcomes: list[tuple[str, bool]]) -> None:
    await db.commit()
    learning.schedule_exam_scores(user_id, outcomes)


def _best_per_user(pool: str, duration: int, since: datetime | None):
    """Lượt điểm cao nhất của mỗi người (một dòng / người)."""
    stmt = select(ArenaRun).where(ArenaRun.pool == pool, ArenaRun.duration_minutes == duration, ArenaRun.finished_at.is_not(None),
                                  ArenaRun.score > 0)
    if since is not None:
        stmt = stmt.where(ArenaRun.finished_at >= since)
    return stmt.ext(distinct_on(ArenaRun.user_id)).order_by(ArenaRun.user_id, ArenaRun.score.desc(), ArenaRun.finished_at).subquery()


async def _rank(db: AsyncSession, pool: str, duration: int, since: datetime | None, score: int) -> int:
    """Hạng kiểu thi đấu: 1 + số người có điểm cao hơn (bằng điểm thì cùng hạng)."""
    best = _best_per_user(pool, duration, since)
    return 1 + await db.scalar(select(func.count()).select_from(best).where(best.c.score > score))


async def _out(db: AsyncSession, run: ArenaRun) -> RunOut:
    out = RunOut(id=run.id, pool=run.pool, duration_minutes=run.duration_minutes, started_at=run.created_at, ends_at=run.ends_at,
                 finished=run.finished_at is not None, score=run.score, correct=run.correct, answered=run.answered, combo=run.combo,
                 best_combo=run.best_combo)
    if run.current:
        q, names = run.current, await bank.skill_names(db)
        out.question = ExamQuestionOut(
            id=q["key"], index=run.answered + 1, type=q["type"], template=TemplateRef(code=q["template_code"], name=q["template_name"]),
            skill=SkillOut(code=q["skill_code"], name=names.get(q["skill_code"], q["skill_code"])), grade=q["grade"],
            difficulty=q["difficulty"], statement=q["statement"], choices=q.get("choices"), statements=q.get("statements"),
            answer_prefix=q.get("answer_prefix"),
        )
    if out.finished:
        out.history = [ArenaItem(statement=h["statement"], template=TemplateRef(code=h["template_code"], name=h["template_name"]),
                                 given=h["given"], is_correct=h["is_correct"], points=h["points"], answer_display=h["answer_display"])
                       for h in run.history]
        since = week_start()
        if run.score > 0 and run.finished_at >= since:
            out.week_rank = await _rank(db, run.pool, run.duration_minutes, since, run.score)
        previous = await db.scalar(select(func.max(ArenaRun.score)).where(
            ArenaRun.user_id == run.user_id, ArenaRun.pool == run.pool, ArenaRun.duration_minutes == run.duration_minutes,
            ArenaRun.finished_at.is_not(None), ArenaRun.id != run.id))
        out.personal_best = run.score > (previous or 0)
        if run.rank_delta is not None:
            # Lượt cũ: tính lại "trước" từ điểm hiện tại chỉ đúng với lượt gần nhất, nên chỉ trả cho lượt vừa xong
            rating = await _rating(db, run.user_id)
            latest = await db.scalar(select(ArenaRun.id).where(ArenaRun.user_id == run.user_id, ArenaRun.rank_delta.is_not(None))
                                     .order_by(ArenaRun.finished_at.desc()).limit(1))
            if rating and latest == run.id:
                out.rank_change = RankChange(delta=run.rank_delta, before=ranks.describe(rating.points - run.rank_delta),
                                             after=ranks.describe(rating.points, rating.ranked_runs))
    return out


async def start(db: AsyncSession, user: User, body: StartRunIn) -> RunOut:
    now = datetime.now(UTC)
    # Mỗi người một lượt đang chạy: bắt đầu lượt mới thì kết thúc lượt cũ
    outcomes: list[tuple[str, bool]] = []
    for old in await db.scalars(select(ArenaRun).where(ArenaRun.user_id == user.id, ArenaRun.finished_at.is_(None)).with_for_update()):
        outcomes += await _finalize(db, old, now)
    run = ArenaRun(id=new_id(), user_id=user.id, pool=body.pool, duration_minutes=body.duration_minutes, created_at=now,
                   ends_at=now + timedelta(minutes=body.duration_minutes), score=0, correct=0, answered=0, combo=0, best_combo=0,
                   history=[], current=_next_question(body.pool, 0, None))
    db.add(run)
    await _commit(db, user.id, outcomes)
    return await _out(db, run)


async def get(db: AsyncSession, user: User, run_id: str) -> RunOut:
    run = await _owned(db, user, run_id)
    now = datetime.now(UTC)
    if run.finished_at is None and now > run.ends_at + GRACE:  # hết giờ khi đã rời trang: chốt lượt
        run = await _owned(db, user, run_id, lock=True)
        await _commit(db, user.id, await _finalize(db, run, now))
    return await _out(db, run)


async def answer(db: AsyncSession, user: User, run_id: str, body: AnswerIn) -> AnswerOut:
    run = await _owned(db, user, run_id, lock=True)
    now = datetime.now(UTC)
    if run.finished_at is not None or now > run.ends_at + GRACE:
        await _commit(db, user.id, await _finalize(db, run, now))
        raise ApiError(409, "run_over")
    q = run.current
    if body.key != q["key"]:  # gửi lại câu đã chấm (bấm hai lần, mạng chậm): client tải lại lượt
        raise ApiError(409, "stale_question")

    given = body.answer.model_dump() if body.answer else None
    ok = given is not None and exams.row_points(q, given) == 1
    pts = points_for(q["difficulty"], run.combo) if ok else 0
    run.history = [*run.history, {
        "statement": q["statement"], "template_code": q["template_code"], "template_name": q["template_name"], "skill_code": q["skill_code"],
        "given": given, "is_correct": ok, "points": pts, "answer_display": q["answer_display"],
    }]
    run.answered += 1
    run.correct += ok
    run.score += pts
    run.combo = run.combo + 1 if ok else 0
    run.best_combo = max(run.best_combo, run.combo)
    outcomes: list[tuple[str, bool]] = []
    if now >= run.ends_at:
        outcomes = await _finalize(db, run, now)
    else:
        run.current = _next_question(run.pool, run.answered, q["template_code"])
    await _commit(db, user.id, outcomes)
    return AnswerOut(is_correct=ok, points=pts, correct_answer=q["answer"], correct_answer_display=q["answer_display"], run=await _out(db, run))


async def finish(db: AsyncSession, user: User, run_id: str) -> RunOut:
    """Dừng sớm (hoặc client báo hết giờ). Gọi lại nhiều lần vẫn an toàn."""
    run = await _owned(db, user, run_id, lock=True)
    await _commit(db, user.id, await _finalize(db, run, datetime.now(UTC)))
    return await _out(db, run)


async def leaderboard(db: AsyncSession, user: User, pool: str, duration: int, scope: str) -> BoardOut:
    since = week_start() if scope == "week" else None
    best = _best_per_user(pool, duration, since)
    rows = (await db.execute(
        select(best.c.user_id, best.c.score, best.c.correct, best.c.answered, User.full_name, User.grade)
        .join(User, User.id == best.c.user_id).order_by(best.c.score.desc(), best.c.finished_at).limit(BOARD_SIZE)
    )).all()
    out, rank, prev = [], 0, None
    for i, r in enumerate(rows, start=1):
        if r.score != prev:
            rank, prev = i, r.score
        out.append(BoardRow(rank=rank, user_id=r.user_id, full_name=r.full_name, grade=r.grade, score=r.score, correct=r.correct,
                            answered=r.answered, is_me=r.user_id == user.id))
    me = None
    if not any(r.is_me for r in out):
        mine = (await db.execute(select(best.c.score, best.c.correct, best.c.answered).where(best.c.user_id == user.id))).first()
        if mine:
            me = BoardRow(rank=await _rank(db, pool, duration, since, mine.score), user_id=user.id, full_name=user.full_name,
                          grade=user.grade, score=mine.score, correct=mine.correct, answered=mine.answered, is_me=True)
    return BoardOut(rows=out, me=me)


async def me(db: AsyncSession, user: User) -> ArenaMeOut:
    finished = (ArenaRun.user_id == user.id, ArenaRun.finished_at.is_not(None))
    best = (await db.execute(
        select(ArenaRun.pool, ArenaRun.duration_minutes, func.max(ArenaRun.score)).where(*finished, ArenaRun.score > 0)
        .group_by(ArenaRun.pool, ArenaRun.duration_minutes)
    )).all()
    recent = await db.scalars(select(ArenaRun).where(*finished).order_by(ArenaRun.finished_at.desc()).limit(RECENT))
    active = await db.scalar(select(ArenaRun.id).where(ArenaRun.user_id == user.id, ArenaRun.finished_at.is_(None),
                                                       ArenaRun.ends_at > datetime.now(UTC)).order_by(ArenaRun.created_at.desc()))
    rating = await _rating(db, user.id)
    return ArenaMeOut(
        rank=ranks.describe(rating.points, rating.ranked_runs) if rating else ranks.describe(0),
        best=[BestOut(pool=p, duration_minutes=d, score=s) for p, d, s in best],
        recent=[RunSummary(id=r.id, pool=r.pool, duration_minutes=r.duration_minutes, score=r.score, correct=r.correct,
                           answered=r.answered, finished_at=r.finished_at) for r in recent],
        active_run_id=active,
    )


async def rank_board(db: AsyncSession, user: User) -> RankBoardOut:
    """Bảng rank: người có ít nhất một lượt tính rank, điểm cao trước (bằng điểm thì cùng hạng)."""
    rows = (await db.execute(
        select(ArenaRating, User.full_name, User.grade).join(User, User.id == ArenaRating.user_id)
        .where(ArenaRating.ranked_runs > 0).order_by(ArenaRating.points.desc(), ArenaRating.updated_at).limit(BOARD_SIZE)
    )).all()
    out, rank, prev = [], 0, None
    for i, (r, name, grade) in enumerate(rows, start=1):
        if r.points != prev:
            rank, prev = i, r.points
        out.append(RankRow(rank=rank, user_id=r.user_id, full_name=name, grade=grade, rating=ranks.describe(r.points, r.ranked_runs),
                           is_me=r.user_id == user.id))
    me = None
    mine = await _rating(db, user.id)
    if mine and mine.ranked_runs and not any(r.is_me for r in out):
        above = await db.scalar(select(func.count()).select_from(ArenaRating).where(ArenaRating.ranked_runs > 0, ArenaRating.points > mine.points))
        me = RankRow(rank=above + 1, user_id=user.id, full_name=user.full_name, grade=user.grade,
                     rating=ranks.describe(mine.points, mine.ranked_runs), is_me=True)
    return RankBoardOut(rows=out, me=me)
