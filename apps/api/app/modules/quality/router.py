from fastapi import APIRouter

from app.core.deps import Admin, Db
from app.modules.quality import service
from app.modules.quality.schemas import QualityOut

router = APIRouter(prefix="/admin/quality", tags=["admin"])


@router.get("", response_model=QualityOut)
async def quality(db: Db, _: Admin):
    return await service.report(db)
