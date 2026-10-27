from fastapi import APIRouter

from app.core.deps import Db
from app.modules.regions import service
from app.modules.regions.schemas import ProvinceOut, SchoolOut

router = APIRouter(prefix="/regions", tags=["regions"])


@router.get("", response_model=list[ProvinceOut])
async def provinces(db: Db):
    """34 tỉnh/thành kèm số câu đề thật và số trường đã thu thập (công khai, dùng cho bộ lọc)."""
    return await service.provinces(db)


@router.get("/{province}/schools", response_model=list[SchoolOut])
async def schools(province: str, db: Db):
    return await service.schools(db, province)
