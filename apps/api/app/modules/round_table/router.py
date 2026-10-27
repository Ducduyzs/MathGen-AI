from fastapi import APIRouter

from app.core.deps import Db, Student
from app.core.redis import get_redis
from app.modules.round_table import service
from app.modules.round_table.schemas import AnswerIn, CreateRoomIn, RoomOut

router = APIRouter(prefix="/round-table", tags=["round-table"])


@router.post("/rooms", response_model=RoomOut, response_model_exclude_none=True, status_code=201)
async def create_room(body: CreateRoomIn, db: Db, user: Student):
    return await service.create(db, get_redis(), user, body)


@router.get("/rooms/{code}", response_model=RoomOut, response_model_exclude_none=True)
async def get_room(code: str, db: Db, user: Student):
    return await service.get(db, get_redis(), user, code)


@router.post("/rooms/{code}/join", response_model=RoomOut, response_model_exclude_none=True)
async def join_room(code: str, db: Db, user: Student):
    return await service.join(db, get_redis(), user, code)


@router.post("/rooms/{code}/start", response_model=RoomOut, response_model_exclude_none=True)
async def start_room(code: str, db: Db, user: Student):
    return await service.start(db, get_redis(), user, code)


@router.post("/rooms/{code}/answer", response_model=RoomOut, response_model_exclude_none=True)
async def answer(code: str, body: AnswerIn, db: Db, user: Student):
    given = body.answer.model_dump() if body.answer else None
    return await service.answer(db, get_redis(), user, code, body.round, given)


@router.post("/rooms/{code}/leave", status_code=204)
async def leave_room(code: str, db: Db, user: Student):
    await service.leave(db, get_redis(), user, code)
