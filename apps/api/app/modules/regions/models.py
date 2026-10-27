from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, Timestamped
from app.core.ids import new_id


class School(Timestamped, Base):
    """Trường học, tạo dần từ đề thu thập được (tên + tỉnh). `name_key` là tên đã bỏ dấu để không tạo trùng."""

    __tablename__ = "schools"
    __table_args__ = (UniqueConstraint("province_code", "name_key", name="uq_schools_province_name"),)

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(200))
    name_key: Mapped[str] = mapped_column(String(200))
    province_code: Mapped[str] = mapped_column(String(32), index=True)
    level: Mapped[str | None] = mapped_column(String(16))  # primary | lower | upper | multi
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
