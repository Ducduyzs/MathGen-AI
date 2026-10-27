"""Phần thưởng kiểu Duolingo: XP, nhiệm vụ hằng ngày, đóng băng chuỗi, huy hiệu.

Mọi hoạt động (luyện tập, đề, Đấu trường) đi qua `record`, chạy trong giao dịch của người gọi (không commit).
Ngày nghỉ được đóng băng lúc ghi hoạt động kế tiếp; trước đó các hàm đọc tự tính như đã đóng băng (`pending_freezes`)
nên không cần ghi gì khi chỉ xem.
"""

import hashlib
from collections import defaultdict
from collections.abc import Callable, Collection, Sequence
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.learning.models import DailyActivity, RewardProfile, SkillScore, UserBadge
from app.modules.learning.schemas import BadgeOut, CalendarDay, QuestOut, RewardsOut

Kind = Literal["practice", "exam", "arena"]

XP_CORRECT, XP_HINTED, XP_TRIED = 10, 5, 2  # làm sai vẫn có chút XP: khuyến khích thử, không phạt
XP_GOAL = 20
INITIAL_FREEZES, MAX_FREEZES, FREEZE_EVERY = 1, 2, 7  # mỗi 7 ngày liên tiếp được thêm một lượt, giữ tối đa 2
HISTORY_DAYS = 400
CALENDAR_DAYS = 35
MASTERY = 0.85


@dataclass(frozen=True)
class Quest:
    code: str
    title: str
    metric: str  # cột của DailyActivity
    target: int
    reward: int


# Mỗi ngày một nhiệm vụ dễ, một vừa, một khó
QUEST_TIERS: tuple[tuple[Quest, ...], ...] = (
    (Quest("answered_10", "Làm 10 câu", "count", 10, 10), Quest("correct_5", "Làm đúng 5 câu", "correct", 5, 10),
     Quest("xp_50", "Kiếm 50 XP", "xp", 50, 10)),
    (Quest("correct_10", "Làm đúng 10 câu", "correct", 10, 20), Quest("combo_5", "Đúng 5 câu liên tiếp", "best_combo", 5, 20),
     Quest("arena_1", "Chơi một lượt Đấu trường", "arena_runs", 1, 20)),
    (Quest("correct_20", "Làm đúng 20 câu", "correct", 20, 30), Quest("combo_8", "Đúng 8 câu liên tiếp", "best_combo", 8, 30),
     Quest("exam_1", "Nộp một đề", "exams", 1, 30), Quest("xp_150", "Kiếm 150 XP", "xp", 150, 30)),
)


def daily_quests(user_id: str, day: date) -> list[Quest]:
    """Ba nhiệm vụ cố định trong ngày, khác nhau giữa các học sinh."""
    seed = hashlib.sha256(f"{user_id}:{day.isoformat()}".encode()).digest()
    return [tier[seed[i] % len(tier)] for i, tier in enumerate(QUEST_TIERS)]


@dataclass(frozen=True)
class Stats:
    xp: int
    correct: int
    streak: int
    best_combo: int
    quests_done: int
    exams: int
    arena_runs: int
    best_skill: float


@dataclass(frozen=True)
class Badge:
    code: str
    title: str
    description: str
    earned: Callable[[Stats], bool]


BADGES: tuple[Badge, ...] = (
    Badge("first_correct", "Khởi đầu", "Làm đúng câu đầu tiên", lambda s: s.correct >= 1),
    Badge("streak_7", "Một tuần bền bỉ", "Giữ chuỗi 7 ngày học", lambda s: s.streak >= 7),
    Badge("streak_30", "Một tháng kiên trì", "Giữ chuỗi 30 ngày học", lambda s: s.streak >= 30),
    Badge("streak_100", "Trăm ngày", "Giữ chuỗi 100 ngày học", lambda s: s.streak >= 100),
    Badge("correct_100", "Trăm câu đúng", "Làm đúng 100 câu", lambda s: s.correct >= 100),
    Badge("correct_1000", "Nghìn câu đúng", "Làm đúng 1.000 câu", lambda s: s.correct >= 1000),
    Badge("combo_10", "Mười liên tiếp", "Đúng 10 câu liên tiếp", lambda s: s.best_combo >= 10),
    Badge("quests_all", "Trọn nhiệm vụ", "Xong cả 3 nhiệm vụ trong một ngày", lambda s: s.quests_done >= 3),
    Badge("first_exam", "Sĩ tử", "Nộp đề đầu tiên", lambda s: s.exams >= 1),
    Badge("first_arena", "Đấu sĩ", "Hoàn thành lượt Đấu trường đầu tiên", lambda s: s.arena_runs >= 1),
    Badge("xp_1000", "Chăm chỉ", "Đạt 1.000 XP", lambda s: s.xp >= 1000),
    Badge("mastery", "Thành thạo", "Đạt 85% ở một kỹ năng", lambda s: s.best_skill >= MASTERY),
)


@dataclass
class RewardEvent:
    xp: int = 0
    goal_reached: bool = False
    freeze_earned: bool = False
    streak: int = 0
    quests: list[str] = field(default_factory=list)
    badges: list[str] = field(default_factory=list)


def _met(days: dict[date, int], goal: int, d: date) -> bool:
    return days.get(d, 0) >= goal


def pending_freezes(days: dict[date, int], goal: int, today: date, frozen: Collection[date], spare: int) -> list[date]:
    """Những ngày vừa nghỉ (tính đến hôm qua) sẽ được đóng băng: chỉ khi đủ lượt cho cả quãng nghỉ và trước đó còn chuỗi."""
    gap, d = [], today - timedelta(days=1)
    while not (_met(days, goal, d) or d in frozen):
        if len(gap) == spare:
            return []
        gap.append(d)
        d -= timedelta(days=1)
    return gap


def streak(days: dict[date, int], goal: int, today: date, frozen: Collection[date] = (), spare: int = 0) -> int:
    """Số ngày liên tiếp đạt mục tiêu, tính cả hôm nay nếu đã đạt (chưa đạt hôm nay thì chuỗi vẫn giữ từ hôm qua).

    Ngày đóng băng (`frozen`, hoặc dùng `spare` lượt còn lại cho quãng vừa nghỉ) nối chuỗi nhưng không cộng thêm ngày.
    """
    kept = {*frozen, *pending_freezes(days, goal, today, frozen, spare)}
    d = today if _met(days, goal, today) else today - timedelta(days=1)
    n = 0
    while _met(days, goal, d) or d in kept:
        n += _met(days, goal, d)
        d -= timedelta(days=1)
    return n


def longest_run(results: Sequence[bool]) -> int:
    best = run = 0
    for ok in results:
        run = run + 1 if ok else 0
        best = max(best, run)
    return best


async def _history(db: AsyncSession, user_id: str, today: date) -> tuple[dict[date, int], set[date]]:
    rows = await db.execute(select(DailyActivity.day, DailyActivity.count, DailyActivity.frozen)
                            .where(DailyActivity.user_id == user_id, DailyActivity.day > today - timedelta(days=HISTORY_DAYS)))
    days, frozen = {}, set()
    for d, n, is_frozen in rows:
        days[d] = n
        if is_frozen:
            frozen.add(d)
    return days, frozen


async def _locked(db: AsyncSession, model, values: dict, key: list[str]):
    """Tạo dòng nếu chưa có và khóa lại trong một lượt gọi DB: các lần nộp song song của cùng học sinh chạy lần lượt.

    ON CONFLICT DO UPDATE (cập nhật không đổi gì) khóa dòng như SELECT ... FOR UPDATE.
    """
    stmt = insert(model).values(**values)
    stmt = stmt.on_conflict_do_update(index_elements=key, set_={key[0]: stmt.excluded[key[0]]}).returning(model)
    return await db.scalar(select(model).from_statement(stmt).execution_options(populate_existing=True))


async def record(db: AsyncSession, user_id: str, results: Sequence[bool], kind: Kind, goal: int, today: date,
                 hints: int = 0) -> RewardEvent:
    profile = await _locked(db, RewardProfile, {"user_id": user_id, "xp": 0, "correct": 0, "freezes": INITIAL_FREEZES, "longest_streak": 0},
                            ["user_id"])
    days, frozen = await _history(db, user_id, today)
    gap = pending_freezes(days, goal, today, frozen, profile.freezes)
    if gap:
        await db.execute(insert(DailyActivity).values([{"user_id": user_id, "day": d, "count": 0, "frozen": True} for d in gap])
                         .on_conflict_do_update(index_elements=["user_id", "day"], set_={"frozen": True}))
        profile.freezes -= len(gap)
        frozen.update(gap)
    row = await _locked(db, DailyActivity, {"user_id": user_id, "day": today, "count": 0}, ["user_id", "day"])

    event = RewardEvent()
    correct = sum(results)
    xp = sum((XP_HINTED if hints else XP_CORRECT) if ok else XP_TRIED for ok in results)
    before = row.count
    row.count += len(results)
    row.correct += correct
    if kind == "practice":  # chuỗi đúng nối qua từng lần nộp
        for ok in results:
            row.combo = row.combo + 1 if ok else 0
        row.best_combo = max(row.best_combo, row.combo)
    else:
        row.best_combo = max(row.best_combo, longest_run(results))
    row.exams += kind == "exam"
    row.arena_runs += kind == "arena"

    days[today] = row.count
    event.streak = streak(days, goal, today, frozen)
    if before < goal <= row.count:
        xp += XP_GOAL
        event.goal_reached = True
        if event.streak % FREEZE_EVERY == 0 and profile.freezes < MAX_FREEZES:
            profile.freezes += 1
            event.freeze_earned = True
    row.xp += xp

    # XP thưởng của nhiệm vụ cũng tính cho nhiệm vụ "Kiếm N XP": xét lại tới khi không còn nhiệm vụ mới
    done = list(row.quests)
    changed = True
    while changed:
        changed = False
        for q in daily_quests(user_id, today):
            if q.code not in done and getattr(row, q.metric) >= q.target:
                done.append(q.code)
                row.xp += q.reward
                xp += q.reward
                event.quests.append(q.title)
                changed = True
    row.quests = done  # gán list mới để SQLAlchemy ghi lại cột JSONB

    profile.xp += xp
    profile.correct += correct
    profile.longest_streak = max(profile.longest_streak, event.streak)
    event.xp = xp

    best_skill, have = (await db.execute(select(
        select(func.max(SkillScore.score)).where(SkillScore.user_id == user_id).scalar_subquery(),
        select(func.array_agg(UserBadge.code)).where(UserBadge.user_id == user_id).scalar_subquery(),
    ))).one()
    stats = Stats(xp=profile.xp, correct=profile.correct, streak=event.streak, best_combo=row.best_combo, quests_done=len(done),
                  exams=row.exams, arena_runs=row.arena_runs, best_skill=best_skill or 0.0)
    have = set(have or ())
    new = [b for b in BADGES if b.code not in have and b.earned(stats)]
    if new:
        await db.execute(insert(UserBadge).values([{"user_id": user_id, "code": b.code} for b in new]).on_conflict_do_nothing())
    event.badges = [b.title for b in new]
    return event


async def streaks(db: AsyncSession, days_by_user: dict[str, dict[date, int]], goal: int, today: date) -> dict[str, int]:
    """Chuỗi ngày của nhiều học sinh (tính cả ngày đã/sẽ đóng băng) từ bộ đếm ngày đã đọc sẵn."""
    ids = list(days_by_user)
    if not ids:
        return {}
    frozen: dict[str, set[date]] = defaultdict(set)
    for uid, d in await db.execute(select(DailyActivity.user_id, DailyActivity.day).where(
            DailyActivity.user_id.in_(ids), DailyActivity.frozen.is_(True), DailyActivity.day > today - timedelta(days=HISTORY_DAYS))):
        frozen[uid].add(d)
    spare = dict((await db.execute(select(RewardProfile.user_id, RewardProfile.freezes).where(RewardProfile.user_id.in_(ids)))).all())
    return {u: streak(d, goal, today, frozen[u], spare.get(u, INITIAL_FREEZES)) for u, d in days_by_user.items()}


async def summary(db: AsyncSession, user_id: str, goal: int, today: date) -> RewardsOut:
    profile = await db.get(RewardProfile, user_id)
    xp_total, freezes, longest = (profile.xp, profile.freezes, profile.longest_streak) if profile else (0, INITIAL_FREEZES, 0)
    days, frozen = await _history(db, user_id, today)
    gap = pending_freezes(days, goal, today, frozen, freezes)
    frozen.update(gap)
    freezes -= len(gap)
    current = streak(days, goal, today, frozen)
    row = await db.get(DailyActivity, (user_id, today))
    done = set(row.quests) if row else set()
    earned = {b.code: b.earned_at for b in await db.scalars(select(UserBadge).where(UserBadge.user_id == user_id))}

    def status(d: date) -> str:
        if _met(days, goal, d):
            return "met"
        if d in frozen:
            return "frozen"
        return "partial" if days.get(d, 0) > 0 else "none"

    return RewardsOut(
        today=today, xp_total=xp_total, xp_today=row.xp if row else 0, daily_goal=goal, today_attempts=days.get(today, 0),
        streak_days=current, longest_streak=max(longest, current), freezes=freezes, max_freezes=MAX_FREEZES, freeze_every=FREEZE_EVERY,
        quests=[QuestOut(code=q.code, title=q.title, target=q.target, reward=q.reward, done=q.code in done,
                         progress=min(getattr(row, q.metric) if row else 0, q.target)) for q in daily_quests(user_id, today)],
        badges=[BadgeOut(code=b.code, title=b.title, description=b.description, earned_at=earned.get(b.code)) for b in BADGES],
        calendar=[CalendarDay(day=d, count=days.get(d, 0), status=status(d))
                  for d in (today - timedelta(days=i) for i in range(CALENDAR_DAYS - 1, -1, -1))],
    )
