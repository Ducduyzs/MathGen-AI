from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, Timestamped
from app.core.ids import new_id


class User(Timestamped, Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role in ('student', 'teacher', 'admin', 'parent')", name="role"),)

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(16), default="student")
    grade: Mapped[int | None] = mapped_column(Integer)
    # Tỉnh/thành (đơn vị hành chính mới): gợi ý đề theo khu vực
    province_code: Mapped[str | None] = mapped_column(String(32))


class RefreshToken(Timestamped, Base):
    """Refresh token lưu dạng băm SHA-256; thu hồi được (đăng xuất, khóa tài khoản)."""

    __tablename__ = "refresh_tokens"

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
