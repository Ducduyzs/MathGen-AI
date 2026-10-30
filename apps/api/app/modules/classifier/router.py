import asyncio

from fastapi import APIRouter

from app.core.deps import Teacher
from app.core.errors import ApiError
from app.modules.classifier import service
from app.modules.classifier.schemas import ClassifierStatus, PredictIn, Prediction

router = APIRouter(prefix="/classifier", tags=["classifier"])


@router.get("/status", response_model=ClassifierStatus)
async def status(_: Teacher):
    return service.status()


@router.post("/predict", response_model=list[Prediction])
async def predict(body: PredictIn, _: Teacher):
    """Thử phân loại vài đề (giáo viên): chủ đề, cấp lớp, lớp, độ khó. Chạy trên CPU trong luồng riêng."""
    out = await asyncio.to_thread(service.predict, body.texts)
    if out is None:
        raise ApiError(503, "classifier_unavailable")
    return out
