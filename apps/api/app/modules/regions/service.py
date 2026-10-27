"""Tỉnh/thành (34 đơn vị mới) và trường học; nhận diện khu vực từ đề và gắn vào bài thu thập được."""

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.modules.problem_bank import service as bank
from app.modules.regions.data import EXAM_KINDS, NAMES, PROVINCES
from app.modules.regions.detect import Region, detect, fold, level_label
from app.modules.regions.models import School
from app.modules.regions.schemas import ProvinceOut, SchoolOut

__all__ = ["EXAM_KINDS", "NAMES", "Region", "detect", "province_name", "provenance_sync"]


def province_name(code: str | None) -> str | None:
    return NAMES.get(code or "")


def check_province(code: str | None) -> None:
    if code is not None and code not in NAMES:
        raise ApiError(422, "unknown_province")


async def provinces(db: AsyncSession) -> list[ProvinceOut]:
    problems = await bank.count_by_province(db)
    schools = dict((await db.execute(select(School.province_code, func.count()).group_by(School.province_code))).all())
    return [ProvinceOut(code=c, name=n, problems=problems.get(c, 0), schools=schools.get(c, 0)) for c, n in PROVINCES]


async def schools(db: AsyncSession, province: str) -> list[SchoolOut]:
    check_province(province)
    rows = list(await db.scalars(select(School).where(School.province_code == province).order_by(School.name)))
    counts = await bank.count_by_school(db, [s.id for s in rows])
    out = [SchoolOut(id=s.id, name=s.name, province_code=s.province_code, level=s.level, level_label=level_label(s.level),
                     problems=counts.get(s.id, 0)) for s in rows]
    return sorted(out, key=lambda s: (-s.problems, s.name))


async def get_school(db: AsyncSession, school_id: str) -> School | None:
    return await db.get(School, school_id)


def _school_sync(db: Session, name: str, province: str, level: str | None, user_id: str | None) -> School:
    key = fold(name)
    stmt = insert(School).values(name=name, name_key=key, province_code=province, level=level, created_by=user_id)
    db.execute(stmt.on_conflict_do_nothing(index_elements=["province_code", "name_key"]))
    return db.scalar(select(School).where(School.province_code == province, School.name_key == key))


def provenance_sync(db: Session, detected: dict | None, default_province: str | None, default_school: str | None,
                    user_id: str | None) -> dict:
    """Khu vực của một tài liệu: ưu tiên thông tin ghi trên đề, thiếu thì dùng mặc định của nguồn.

    Biết tỉnh và tên trường thì tạo/nhận trường trong danh mục. Trả về các khóa ghi vào `source` của bài chờ duyệt.
    """
    r = Region(**(detected or {}))
    province = r.province_code or default_province
    school_name = r.school_name or (default_school if not r.province_code or r.province_code == default_province else None)
    school = _school_sync(db, school_name, province, r.school_level, user_id) if school_name and province else None
    return {
        "province_code": province, "province_name": province_name(province), "province_raw": r.province_raw,
        "school_id": school.id if school else None, "school_name": school.name if school else school_name,
        "exam_kind": r.exam_kind, "exam_kind_label": EXAM_KINDS.get(r.exam_kind or ""), "exam_year": r.exam_year,
    }
