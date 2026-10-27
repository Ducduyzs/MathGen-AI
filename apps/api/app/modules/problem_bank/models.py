from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, Timestamped
from app.core.ids import new_id


class Skill(Base):
    __tablename__ = "skills"

    code: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    sort: Mapped[int] = mapped_column(Integer, default=0)
    # Khoảng lớp của kỹ năng: tiểu học 1–5, còn lại từ lớp 6
    grade_min: Mapped[int] = mapped_column(Integer, default=6, server_default="6")
    grade_max: Mapped[int] = mapped_column(Integer, default=12, server_default="12")


class Problem(Timestamped, Base):
    """Bài trong ngân hàng. `answer` chỉ đọc ở server (chấm bài); không bao giờ trả ra API công khai."""

    __tablename__ = "problems"
    __table_args__ = (
        CheckConstraint("answer_type in ('choice', 'number', 'set')", name="answer_type"),
        CheckConstraint("status in ('draft', 'verified', 'approved', 'rejected')", name="status"),
        Index("ix_problems_skill_status_difficulty", "skill_code", "status", "difficulty"),
        # Tìm kiếm đề bài (?q=) bằng trigram; cần extension pg_trgm (tạo ở migration đầu tiên)
        Index("ix_problems_statement_trgm", "statement", postgresql_using="gin", postgresql_ops={"statement": "gin_trgm_ops"}),
    )

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_id)
    statement: Mapped[str] = mapped_column(Text)
    grade: Mapped[int] = mapped_column(Integer)
    skill_code: Mapped[str] = mapped_column(ForeignKey("skills.code"))
    difficulty: Mapped[float] = mapped_column(Float)
    answer_type: Mapped[str] = mapped_column(String(16))
    answer_prefix: Mapped[str | None] = mapped_column(String(80))
    choices: Mapped[list | None] = mapped_column(JSONB)
    hints: Mapped[list | None] = mapped_column(JSONB)
    answer: Mapped[dict] = mapped_column(JSONB)
    answer_display: Mapped[str] = mapped_column(Text)
    solution: Mapped[list] = mapped_column(JSONB, default=list)
    #: dạng chuẩn đã băm (chống trùng); NULL với bài chưa qua bộ chuẩn hóa
    canonical_hash: Mapped[str | None] = mapped_column(String(64), unique=True)
    status: Mapped[str] = mapped_column(String(16), default="approved")
    origin: Mapped[str] = mapped_column(String(16), default="seed")


class ReviewItem(Timestamped, Base):
    """Bài do AI trích xuất/sinh, chờ giáo viên duyệt."""

    __tablename__ = "review_items"
    __table_args__ = (CheckConstraint("status in ('pending', 'approved', 'rejected')", name="status"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=new_id)
    origin: Mapped[str] = mapped_column(String(16))
    statement: Mapped[str] = mapped_column(Text)
    answer_display: Mapped[str] = mapped_column(Text)
    solution: Mapped[list] = mapped_column(JSONB, default=list)
    grade: Mapped[int] = mapped_column(Integer)
    skill_code: Mapped[str] = mapped_column(ForeignKey("skills.code"))
    difficulty: Mapped[float] = mapped_column(Float)
    classification_confidence: Mapped[float] = mapped_column(Float)
    parent: Mapped[dict | None] = mapped_column(JSONB)
    transform: Mapped[str | None] = mapped_column(Text)
    source: Mapped[dict | None] = mapped_column(JSONB)
    choices: Mapped[list | None] = mapped_column(JSONB)
    checks: Mapped[list] = mapped_column(JSONB, default=list)
    #: Đáp án có cấu trúc để chấm tự động khi bài vào ngân hàng; NULL nếu chỉ chấm được bằng mắt (tập nghiệm, nhân tử)
    answer: Mapped[dict | None] = mapped_column(JSONB)
    answer_prefix: Mapped[str | None] = mapped_column(String(80))
    canonical_hash: Mapped[str | None] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True)
    decided_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str | None] = mapped_column(Text)
