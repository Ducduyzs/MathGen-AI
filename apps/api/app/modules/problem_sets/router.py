from fastapi import APIRouter

from app.core.deps import Db, Teacher
from app.modules.problem_sets import service
from app.modules.problem_sets.schemas import AddQuestionsIn, CreateSetIn, ProblemSetOut, ProblemSetSummary, UpdateSetIn

router = APIRouter(prefix="/problem-sets", tags=["problem-sets"])


@router.get("", response_model=list[ProblemSetSummary])
async def list_sets(db: Db, user: Teacher):
    return await service.list_sets(db, user)


@router.post("", response_model=ProblemSetOut, status_code=201)
async def create_set(body: CreateSetIn, db: Db, user: Teacher):
    return await service.create(db, user, body)


@router.get("/{set_id}", response_model=ProblemSetOut)
async def get_set(set_id: str, db: Db, user: Teacher):
    return await service.get(db, user, set_id)


@router.patch("/{set_id}", response_model=ProblemSetOut)
async def update_set(set_id: str, body: UpdateSetIn, db: Db, user: Teacher):
    return await service.update(db, user, set_id, body)


@router.delete("/{set_id}", status_code=204)
async def delete_set(set_id: str, db: Db, user: Teacher):
    await service.delete(db, user, set_id)


@router.post("/{set_id}/questions", response_model=ProblemSetOut)
async def add_questions(set_id: str, body: AddQuestionsIn, db: Db, user: Teacher):
    return await service.add_questions(db, user, set_id, body)


@router.post("/{set_id}/questions/{key}/regenerate", response_model=ProblemSetOut)
async def regenerate_question(set_id: str, key: str, db: Db, user: Teacher):
    return await service.regenerate(db, user, set_id, key)


@router.post("/{set_id}/duplicate", response_model=ProblemSetSummary, status_code=201)
async def duplicate_set(set_id: str, db: Db, user: Teacher):
    return await service.duplicate(db, user, set_id)
