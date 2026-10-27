from typing import Literal

from fastapi import APIRouter

from app.core.deps import CurrentUser, Db
from app.core.errors import ApiError
from app.modules.arena import service
from app.modules.arena.schemas import ARENA_DURATIONS, AnswerIn, AnswerOut, ArenaMeOut, ArenaPool, BoardOut, RankBoardOut, RunOut, StartRunIn

router = APIRouter(prefix="/arena", tags=["arena"])


@router.get("/me", response_model=ArenaMeOut)
async def arena_me(db: Db, user: CurrentUser):
    return await service.me(db, user)


@router.get("/leaderboard", response_model=BoardOut)
async def arena_leaderboard(db: Db, user: CurrentUser, pool: ArenaPool = "basic", duration: int = 5,
                            scope: Literal["week", "all"] = "week"):
    if duration not in ARENA_DURATIONS:  # Literal số nguyên không nhận chuỗi "30" của query string
        raise ApiError(422, "validation_error")
    return await service.leaderboard(db, user, pool, duration, scope)


@router.get("/ranking", response_model=RankBoardOut)
async def arena_ranking(db: Db, user: CurrentUser):
    return await service.rank_board(db, user)


@router.post("/runs", response_model=RunOut, status_code=201, response_model_exclude_none=True)
async def start_run(body: StartRunIn, db: Db, user: CurrentUser):
    return await service.start(db, user, body)


@router.get("/runs/{run_id}", response_model=RunOut, response_model_exclude_none=True)
async def get_run(run_id: str, db: Db, user: CurrentUser):
    return await service.get(db, user, run_id)


@router.post("/runs/{run_id}/answer", response_model=AnswerOut, response_model_exclude_none=True)
async def answer(run_id: str, body: AnswerIn, db: Db, user: CurrentUser):
    return await service.answer(db, user, run_id, body)


@router.post("/runs/{run_id}/finish", response_model=RunOut, response_model_exclude_none=True)
async def finish_run(run_id: str, db: Db, user: CurrentUser):
    return await service.finish(db, user, run_id)
