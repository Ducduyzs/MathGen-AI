from fastapi import APIRouter

from app.core.deps import CurrentUser, Db, Teacher
from app.modules.classroom import service
from app.modules.classroom.schemas import (
    AssignmentOut, AssignmentReport, ClassDetailOut, ClassOut, CreateAssignmentIn, CreateClassIn, JoinClassIn, LeaderboardRow, StartOut,
)
from app.modules.exams.schemas import ExamOut

router = APIRouter(tags=["classroom"])


@router.get("/classes", response_model=list[ClassOut], response_model_exclude_none=True)
async def list_classes(db: Db, user: CurrentUser):
    return await service.list_classes(db, user)


@router.post("/classes", response_model=ClassOut, status_code=201)
async def create_class(body: CreateClassIn, db: Db, user: Teacher):
    return await service.create_class(db, user, body)


@router.post("/classes/join", response_model=ClassOut, response_model_exclude_none=True)
async def join_class(body: JoinClassIn, db: Db, user: CurrentUser):
    return await service.join(db, user, body.code)


@router.get("/classes/{class_id}", response_model=ClassDetailOut, response_model_exclude_none=True)
async def get_class(class_id: str, db: Db, user: CurrentUser):
    return await service.get_class(db, user, class_id)


@router.delete("/classes/{class_id}", status_code=204)
async def delete_class(class_id: str, db: Db, user: Teacher):
    await service.delete_class(db, user, class_id)


@router.post("/classes/{class_id}/code", response_model=ClassDetailOut)
async def reset_code(class_id: str, db: Db, user: Teacher):
    return await service.reset_code(db, user, class_id)


@router.delete("/classes/{class_id}/members/{member_id}", status_code=204)
async def remove_member(class_id: str, member_id: str, db: Db, user: CurrentUser):
    await service.remove_member(db, user, class_id, member_id)


@router.get("/classes/{class_id}/leaderboard", response_model=list[LeaderboardRow])
async def leaderboard(class_id: str, db: Db, user: CurrentUser):
    return await service.leaderboard(db, user, class_id)


@router.get("/classes/{class_id}/assignments", response_model=list[AssignmentOut], response_model_exclude_none=True)
async def list_assignments(class_id: str, db: Db, user: CurrentUser):
    return await service.list_assignments(db, user, class_id)


@router.post("/classes/{class_id}/assignments", response_model=AssignmentOut, status_code=201)
async def create_assignment(class_id: str, body: CreateAssignmentIn, db: Db, user: Teacher):
    return await service.create_assignment(db, user, class_id, body)


@router.get("/me/assignments", response_model=list[AssignmentOut], response_model_exclude_none=True)
async def my_assignments(db: Db, user: CurrentUser):
    return await service.my_assignments(db, user)


@router.post("/assignments/{assignment_id}/start", response_model=StartOut)
async def start_assignment(assignment_id: str, db: Db, user: CurrentUser):
    return StartOut(exam_id=await service.start(db, user, assignment_id))


@router.delete("/assignments/{assignment_id}", status_code=204)
async def delete_assignment(assignment_id: str, db: Db, user: Teacher):
    await service.delete_assignment(db, user, assignment_id)


@router.get("/assignments/{assignment_id}/report", response_model=AssignmentReport)
async def assignment_report(assignment_id: str, db: Db, user: Teacher):
    return await service.report(db, user, assignment_id)


@router.get("/assignments/{assignment_id}/submissions/{student_id}", response_model=ExamOut)
async def student_submission(assignment_id: str, student_id: str, db: Db, user: Teacher):
    return await service.submission(db, user, assignment_id, student_id)
