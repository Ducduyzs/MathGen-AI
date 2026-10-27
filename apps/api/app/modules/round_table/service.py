"""Bàn tròn vũ trụ: 4 người quanh một bàn, cùng trả lời một câu; sai thì quay vòng hố đen (6 ô, 1 ô hố đen).

Trạng thái phòng là một JSON trong Redis (sống vài giờ), mọi thay đổi chạy dưới khóa Redis của phòng.
Không có tiến trình nền: mỗi request tự đẩy ván chơi tới đúng thời điểm hiện tại (`_advance`), client hỏi lại mỗi giây.
Ghế trống được máy chơi thay khi bắt đầu. Hết ván: ghi kết quả của người thật vào hoạt động học (XP, chuỗi ngày).
"""

import json
import random
import secrets
import time
from datetime import UTC, datetime

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ApiError
from app.modules.exams import service as exams
from app.modules.exams.schemas import ExamQuestionOut, TemplateRef
from app.modules.learning import service as learning
from app.modules.problem_bank import service as bank
from app.modules.problem_bank.schemas import SkillOut
from app.modules.round_table.schemas import CreateRoomIn, LastResult, PlayerOut, RevealOut, RoomOut
from app.modules.users.models import User

SEATS = 4
CHAMBERS = 6
ANSWER_SECONDS = {"basic": 30, "thpt": 45}
REVEAL_SECONDS = 9  # đủ để xem đáp án và vòng quay của những người trả lời sai
CALM_REVEAL_SECONDS = 5  # không ai phải quay
ROOM_TTL = 3 * 3600
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
BOT_NAMES = ["Sao Mai (máy)", "Thiên Hà (máy)", "Tinh Vân (máy)"]


def _key(code: str) -> str:
    return f"rt:room:{code}"


async def _load(redis: Redis, code: str) -> dict:
    raw = await redis.get(_key(code))
    if not raw:
        raise ApiError(404, "not_found")
    return json.loads(raw)


async def _save(redis: Redis, room: dict) -> None:
    await redis.set(_key(room["code"]), json.dumps(room, ensure_ascii=False), ex=ROOM_TTL)


def _lock(redis: Redis, code: str):
    return redis.lock(f"rt:lock:{code}", timeout=10, blocking_timeout=8)


def _seat_of(room: dict, user: User) -> dict | None:
    return next((p for p in room["players"] if p["user_id"] == user.id), None)


def _player(seat: int, user_id: str | None, name: str, bot: bool, accuracy: float = 0.0) -> dict:
    return {"seat": seat, "user_id": user_id, "name": name, "bot": bot, "accuracy": accuracy, "score": 0, "correct": 0, "alive": True,
            "spins": 0, "trap": random.randrange(CHAMBERS), "answer": None, "answered_at": None, "plan_at": None, "plan_ok": False,
            "results": [], "last": None, "out_round": None}


def points_for(ok: bool, answered_at: float, deadline: float, limit: int) -> int:
    """Đúng: 100 điểm, cộng tối đa 50 điểm nếu trả lời nhanh."""
    if not ok:
        return 0
    return 100 + round(50 * max(0.0, min(1.0, (deadline - answered_at) / limit)))


def _new_question(room: dict, now: float) -> None:
    pool = room["pool"]
    templates = [t for t in exams.arena_templates(pool) if t.code != room.get("last_template")] or exams.arena_templates(pool)
    target = min(0.25 + 0.04 * room["round"], 0.85)
    chosen = random.choice(sorted(templates, key=lambda t: abs(t.difficulty - target))[:4])
    q = exams.generate_from_templates([chosen.code])[0]
    limit = ANSWER_SECONDS[pool]
    room.update(phase="question", question={"key": secrets.token_hex(4), **q}, last_template=chosen.code, reveal=None,
                started=now, deadline=now + limit)
    for p in room["players"]:
        p.update(answer=None, answered_at=None, last=None)
        if p["bot"] and p["alive"]:
            # Máy trả lời đúng ít hơn khi câu khó, và trả lời vào một lúc ngẫu nhiên trong thời gian cho phép
            p["plan_ok"] = random.random() < p["accuracy"] - 0.3 * (q["difficulty"] - 0.5)
            p["plan_at"] = now + random.uniform(0.25, 0.9) * limit


def _reveal(room: dict, now: float) -> None:
    q, limit, deadline = room["question"], ANSWER_SECONDS[room["pool"]], room["deadline"]
    anyone_spun = False
    for p in room["players"]:
        if not p["alive"]:
            continue
        if p["bot"]:
            at = min(p["plan_at"], now)
            ok = p["plan_ok"]
        else:
            at = p["answered_at"] or deadline
            ok = p["answer"] is not None and exams.row_points(q, p["answer"]) == 1
        pts = points_for(ok, at, deadline, limit)
        hit = False
        if not ok:  # sai hoặc bỏ trống: quay vòng, ô hố đen nằm ở vị trí `trap`
            hit = p["spins"] == p["trap"]
            p["spins"] += 1
            anyone_spun = True
            if hit:
                p["alive"], p["out_round"] = False, room["round"]
        p["score"] += pts
        p["correct"] += ok
        p["results"].append(ok)
        p["last"] = {"correct": ok, "points": pts, "spun": not ok, "hit": hit}
    room.update(phase="reveal", reveal={"answer_display": q["answer_display"], "solution": q["solution"]},
                deadline=now + (REVEAL_SECONDS if anyone_spun else CALM_REVEAL_SECONDS))


def _finish(room: dict) -> None:
    alive = [p for p in room["players"] if p["alive"]]
    # Còn người trụ lại: người trụ lại nhiều điểm nhất thắng. Không ai trụ: người bị loại muộn nhất (rồi nhiều điểm nhất) thắng.
    pool = alive or [p for p in room["players"] if p["out_round"] == max(x["out_round"] or 0 for x in room["players"])]
    best = max(p["score"] for p in pool)
    room.update(phase="finished", deadline=None, question=None, winners=[p["seat"] for p in pool if p["score"] == best])


def _advance(room: dict, now: float) -> None:
    """Đẩy ván chơi tới thời điểm `now`: hết giờ hoặc mọi người đã trả lời thì chấm, hết giờ xem đáp án thì sang câu mới."""
    while True:
        if room["phase"] == "question":
            waiting = [p for p in room["players"] if p["alive"] and not p["bot"] and p["answered_at"] is None]
            if now < room["deadline"] and waiting:
                return
            _reveal(room, now)
        elif room["phase"] == "reveal":
            if now < room["deadline"]:
                return
            alive = [p for p in room["players"] if p["alive"]]
            if len(alive) <= 1 or not any(not p["bot"] for p in alive) or room["round"] >= room["rounds"]:
                _finish(room)
                return
            room["round"] += 1
            _new_question(room, now)
        else:
            return


async def _record(db: AsyncSession, room: dict) -> None:
    """Ghi các câu người thật đã trả lời vào hoạt động học (một lần, khi ván kết thúc)."""
    if room["phase"] != "finished" or room.get("recorded"):
        return
    for p in room["players"]:
        if not p["bot"] and p["results"]:
            await learning.record_activity(db, p["user_id"], p["results"], "game")
    await db.commit()
    room["recorded"] = True


async def _out(db: AsyncSession, room: dict, user: User) -> RoomOut:
    me = _seat_of(room, user)
    phase = room["phase"]
    now = time.time()
    to_dt = lambda t: datetime.fromtimestamp(t, UTC) if t else None  # noqa: E731
    players = [
        PlayerOut(
            seat=p["seat"], name=p["name"], is_bot=p["bot"], is_me=p is me, is_host=p["user_id"] == room["host"], score=p["score"],
            correct=p["correct"], alive=p["alive"], spins=p["spins"], out_round=p["out_round"],
            answered=phase == "question" and p["alive"] and (p["answered_at"] is not None if not p["bot"] else p["plan_at"] <= now),
            last=LastResult(**p["last"]) if p["last"] and phase in ("reveal", "finished") else None,
        )
        for p in room["players"]
    ]
    out = RoomOut(code=room["code"], pool=room["pool"], rounds=room["rounds"], chambers=CHAMBERS, phase=phase, round=room["round"],
                  answer_seconds=ANSWER_SECONDS[room["pool"]], now=to_dt(now), deadline=to_dt(room.get("deadline")), players=players,
                  my_seat=me["seat"], winners=room.get("winners", []))
    q = room.get("question")
    if q and phase == "question":
        names = await bank.skill_names(db)
        out.question = ExamQuestionOut(
            id=q["key"], index=room["round"], type=q["type"], template=TemplateRef(code=q["template_code"], name=q["template_name"]),
            skill=SkillOut(code=q["skill_code"], name=names.get(q["skill_code"], q["skill_code"])), grade=q["grade"],
            difficulty=q["difficulty"], statement=q["statement"], choices=q.get("choices"), statements=q.get("statements"),
            answer_prefix=q.get("answer_prefix"),
        )
    if room.get("reveal") and phase == "reveal":
        out.reveal = RevealOut(**room["reveal"], my_answer=me["answer"])
    return out


async def _tick(db: AsyncSession, redis: Redis, room: dict, changed: bool = False) -> None:
    """Đẩy ván tới hiện tại, ghi kết quả nếu vừa kết thúc, lưu lại nếu có gì đổi."""
    before = (room["phase"], room["round"], room.get("recorded"))
    _advance(room, time.time())
    await _record(db, room)
    if changed or (room["phase"], room["round"], room.get("recorded")) != before:
        await _save(redis, room)


async def create(db: AsyncSession, redis: Redis, user: User, body: CreateRoomIn) -> RoomOut:
    for _ in range(10):
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(5))
        room = {"code": code, "host": user.id, "pool": body.pool, "rounds": body.rounds, "phase": "lobby", "round": 0,
                "deadline": None, "question": None, "reveal": None, "players": [_player(0, user.id, user.full_name, False)]}
        if await redis.set(_key(code), json.dumps(room, ensure_ascii=False), ex=ROOM_TTL, nx=True):
            return await _out(db, room, user)
    raise ApiError(503, "busy")


async def join(db: AsyncSession, redis: Redis, user: User, code: str) -> RoomOut:
    code = code.strip().upper()
    async with _lock(redis, code):
        room = await _load(redis, code)
        if not _seat_of(room, user):
            if room["phase"] != "lobby":
                raise ApiError(409, "room_started")
            taken = {p["seat"] for p in room["players"]}
            free = [s for s in range(SEATS) if s not in taken]
            if not free:
                raise ApiError(409, "room_full")
            room["players"].append(_player(free[0], user.id, user.full_name, False))
            room["players"].sort(key=lambda p: p["seat"])
            await _save(redis, room)
        return await _out(db, room, user)


async def _member_room(redis: Redis, user: User, code: str) -> dict:
    room = await _load(redis, code.upper())
    if not _seat_of(room, user):  # phòng của người khác: như không tồn tại
        raise ApiError(404, "not_found")
    return room


async def get(db: AsyncSession, redis: Redis, user: User, code: str) -> RoomOut:
    room = await _member_room(redis, user, code)
    if room["phase"] in ("question", "reveal") or (room["phase"] == "finished" and not room.get("recorded")):
        async with _lock(redis, room["code"]):
            room = await _load(redis, room["code"])
            await _tick(db, redis, room)
    return await _out(db, room, user)


async def start(db: AsyncSession, redis: Redis, user: User, code: str) -> RoomOut:
    async with _lock(redis, code.upper()):
        room = await _member_room(redis, user, code)
        if room["host"] != user.id:
            raise ApiError(403, "forbidden")
        if room["phase"] == "lobby":
            taken = {p["seat"] for p in room["players"]}
            names = iter(BOT_NAMES)
            for s in range(SEATS):
                if s not in taken:
                    room["players"].append(_player(s, None, next(names), True, accuracy=random.uniform(0.55, 0.8)))
            room["players"].sort(key=lambda p: p["seat"])
            room["round"] = 1
            _new_question(room, time.time())
            await _save(redis, room)
        return await _out(db, room, user)


async def answer(db: AsyncSession, redis: Redis, user: User, code: str, round_no: int, given: dict | None) -> RoomOut:
    async with _lock(redis, code.upper()):
        room = await _member_room(redis, user, code)
        await _tick(db, redis, room)
        me = _seat_of(room, user)
        if room["phase"] != "question" or room["round"] != round_no:
            raise ApiError(409, "stale_question")
        if not me["alive"]:
            raise ApiError(409, "eliminated")
        if me["answered_at"] is None:  # gửi lại (bấm hai lần) không đổi đáp án
            me["answer"], me["answered_at"] = given, time.time()
            await _tick(db, redis, room, changed=True)
        return await _out(db, room, user)


async def leave(db: AsyncSession, redis: Redis, user: User, code: str) -> None:
    """Rời phòng chờ thì nhường ghế (chủ phòng rời thì người kế tiếp làm chủ); đang chơi thì coi như bị loại."""
    async with _lock(redis, code.upper()):
        room = await _member_room(redis, user, code)
        me = _seat_of(room, user)
        if room["phase"] == "lobby":
            room["players"].remove(me)
            humans = [p for p in room["players"] if not p["bot"]]
            if not humans:
                await redis.delete(_key(room["code"]))
                return
            if room["host"] == user.id:
                room["host"] = humans[0]["user_id"]
            await _save(redis, room)
        elif room["phase"] in ("question", "reveal") and me["alive"]:
            me["alive"], me["out_round"] = False, room["round"]
            await _tick(db, redis, room, changed=True)
