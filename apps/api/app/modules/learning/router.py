from typing import Annotated

from fastapi import APIRouter, Header, Query

from app.core.deps import CurrentUser, Db
from app.core.redis import get_redis
from app.modules.learning import service
from app.modules.learning.schemas import AttemptIn, AttemptResult, AttemptSummary, ProgressOut
from app.modules.problem_bank.schemas import PublicProblem

router = APIRouter(tags=["learning"])


@router.get("/practice/next", response_model=PublicProblem, response_model_exclude_none=True)
async def practice_next(db: Db, user: CurrentUser, skill: str | None = None, similar_to: str | None = None):
    return await service.next_problem(db, get_redis(), user, skill, similar_to)


@router.post("/attempts", response_model=AttemptResult)
async def submit_attempt(body: AttemptIn, db: Db, user: CurrentUser,
                         idempotency_key: Annotated[str | None, Header(max_length=64)] = None):
    return await service.submit(db, user, body, idempotency_key)


@router.get("/me/progress", response_model=ProgressOut)
async def my_progress(db: Db, user: CurrentUser):
    return await service.progress(db, user)


@router.get("/me/attempts", response_model=list[AttemptSummary])
async def my_attempts(db: Db, user: CurrentUser, limit: Annotated[int, Query(ge=1, le=50)] = 10):
    return await service.recent_attempts(db, user, limit)
