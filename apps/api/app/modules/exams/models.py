from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, Timestamped
from app.core.ids import new_id


class Exam(Timestamped, Base):
    """Một đề của một học sinh (ôn tập hoặc đề thi). Nộp xong thì `result` cố định: nộp lại chỉ trả kết quả cũ."""

    __tablename__ = "exams"
    __table_args__ = (Index("ix_exams_user_created", "user_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(16))  # practice | official
    mode: Mapped[str] = mapped_column(String(16))  # choice | written
    size: Mapped[int] = mapped_column(Integer)
    duration_minutes: Mapped[int | None] = mapped_column(Integer)
    # Hạn nộp do server tính; đồng hồ ở frontend đếm ngược theo mốc này
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    answers: Mapped[dict | None] = mapped_column(JSONB)
    result: Mapped[dict | None] = mapped_column(JSONB)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ExamQuestion(Base):
    """Câu hỏi đã sinh của một đề, kèm đáp án và lời giải (chỉ trả về sau khi nộp)."""

    __tablename__ = "exam_questions"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)  # <exam_id>_q<số thứ tự>
    exam_id: Mapped[str] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    type: Mapped[str] = mapped_column(String(16))  # choice | true_false | number
    template_code: Mapped[str] = mapped_column(String(64))
    template_name: Mapped[str] = mapped_column(String(200))
    skill_code: Mapped[str] = mapped_column(ForeignKey("skills.code"))
    grade: Mapped[int] = mapped_column(Integer)
    difficulty: Mapped[float] = mapped_column(Float)
    statement: Mapped[str] = mapped_column(Text)
    choices: Mapped[list | None] = mapped_column(JSONB)
    statements: Mapped[list | None] = mapped_column(JSONB)
    answer_prefix: Mapped[str | None] = mapped_column(String(64))
    answer: Mapped[dict] = mapped_column(JSONB)
    answer_display: Mapped[str] = mapped_column(Text)
    solution: Mapped[list] = mapped_column(JSONB)
    tolerance: Mapped[float | None] = mapped_column(Float)
