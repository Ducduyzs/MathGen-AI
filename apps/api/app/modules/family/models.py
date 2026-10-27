from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class ParentLink(Base):
    """Phụ huynh theo dõi một học sinh (chỉ xem, không làm bài thay)."""

    __tablename__ = "parent_links"

    parent_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    student_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LinkCode(Base):
    """Mã liên kết học sinh tạo để đưa phụ huynh; dùng một lần, hết hạn sau 24 giờ."""

    __tablename__ = "parent_link_codes"

    student_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    code: Mapped[str] = mapped_column(String(8), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
