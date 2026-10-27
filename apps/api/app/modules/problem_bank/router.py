from fastapi import APIRouter, Response

from app.core.deps import Db, Teacher
from app.modules.problem_bank import service
from app.modules.problem_bank.schemas import ProblemPage, PublicProblem, ReviewDecisionIn, ReviewItemOut, SkillOut

router = APIRouter(tags=["problem_bank"])


@router.get("/skills", response_model=list[SkillOut])
async def skills(db: Db):
    return await service.skills(db)


@router.get("/problems", response_model=ProblemPage, response_model_exclude_none=True)
async def problems(db: Db, grade: int | None = None, skill: str | None = None, level: int | None = None, q: str | None = None):
    return await service.list_problems(db, grade, skill, level, q)


@router.get("/problems/{problem_id}", response_model=PublicProblem, response_model_exclude_none=True)
async def problem(problem_id: str, db: Db):
    p = await service.get_problem(db, problem_id)
    return service.to_public(p, await service.skill_names(db))


@router.get("/review/queue", response_model=list[ReviewItemOut], response_model_exclude_none=True)
async def review_queue(db: Db, _: Teacher):
    return await service.review_queue(db)


@router.post("/review/{item_id}", status_code=204)
async def review_decide(item_id: str, body: ReviewDecisionIn, db: Db, user: Teacher):
    await service.decide(db, item_id, body.decision, body.reason, user.id)
    return Response(status_code=204)
