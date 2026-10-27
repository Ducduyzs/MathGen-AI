from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, Timestamped
from app.core.ids import new_id


class Attempt(Timestamped, Base):
    """Lượt làm bài — chỉ ghi thêm, không sửa. (user_id, client_attempt_id) duy nhất để nộp lại không bị trùng."""

    __tablename__ = "attempts"
    __table_args__ = (
        UniqueConstraint("user_id", "client_attempt_id", name="uq_attempts_user_client"),
        Index("ix_attempts_user_created", "user_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    problem_id: Mapped[str] = mapped_column(ForeignKey("problems.id"), index=True)
    client_attempt_id: Mapped[str] = mapped_column(String(64))
    answer: Mapped[dict] = mapped_column(JSONB)
    is_correct: Mapped[bool] = mapped_column(Boolean)
    time_ms: Mapped[int] = mapped_column(Integer, default=0)
    hints_used: Mapped[int] = mapped_column(Integer, default=0)


class SkillScore(Base):
    """Hồ sơ năng lực. Chỉ worker hàng đợi `learning` ghi bảng này."""

    __tablename__ = "skill_scores"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    skill_code: Mapped[str] = mapped_column(ForeignKey("skills.code"), primary_key=True)
    score: Mapped[float] = mapped_column(Float, default=0.5)
    n_attempts: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class DailyActivity(Base):
    """Số bài mỗi ngày (giờ Việt Nam) để tính mục tiêu ngày và chuỗi ngày học."""

    __tablename__ = "daily_activity"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    count: Mapped[int] = mapped_column(Integer, default=0)
