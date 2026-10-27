from fastapi import APIRouter

from app.core.deps import CurrentUser, Db
from app.modules.exams import service
from app.modules.exams.schemas import CreateExamIn, ExamOut, ExamSummary, SubmitExamIn, TemplateInfo

router = APIRouter(prefix="/exams", tags=["exams"])


@router.get("/templates", response_model=list[TemplateInfo], response_model_exclude_none=True)
async def list_templates(_: CurrentUser):
    return service.templates()


@router.get("", response_model=list[ExamSummary])
async def recent_exams(db: Db, user: CurrentUser):
    return await service.recent(db, user)


@router.post("", response_model=ExamOut, status_code=201)
async def create_exam(body: CreateExamIn, db: Db, user: CurrentUser):
    return await service.create(db, user, body)


@router.get("/{exam_id}", response_model=ExamOut)
async def get_exam(exam_id: str, db: Db, user: CurrentUser):
    return await service.get(db, user, exam_id)


@router.post("/{exam_id}/submit", response_model=ExamOut)
async def submit_exam(exam_id: str, body: SubmitExamIn, db: Db, user: CurrentUser):
    return await service.submit(db, user, exam_id, body)
