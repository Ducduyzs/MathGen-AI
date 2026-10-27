from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, Timestamped
from app.core.ids import new_id


class Classroom(Timestamped, Base):
    """Lớp học của một giáo viên. Học sinh vào lớp bằng mã lớp (giáo viên đổi mã được nếu bị lộ)."""

    __tablename__ = "classes"

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_id)
    teacher_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    grade: Mapped[int | None] = mapped_column(Integer)
    join_code: Mapped[str] = mapped_column(String(8), unique=True)


class ClassMember(Base):
    __tablename__ = "class_members"

    class_id: Mapped[str] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Assignment(Timestamped, Base):
    """Bài giao cho cả lớp. Câu hỏi sinh một lần lúc giao (`questions`), nên mọi học sinh làm cùng một đề;
    khi học sinh bắt đầu, câu hỏi được chép sang một Exam riêng của học sinh đó (chấm bằng module exams)."""

    __tablename__ = "assignments"
    __table_args__ = (Index("ix_assignments_class_created", "class_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_id)
    class_id: Mapped[str] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(16))  # practice | official
    mode: Mapped[str] = mapped_column(String(16))  # choice | written
    size: Mapped[int] = mapped_column(Integer)
    duration_minutes: Mapped[int | None] = mapped_column(Integer)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Đảo thứ tự câu trong từng phần cho mỗi học sinh (đề vẫn giống nhau, chỉ khác thứ tự)
    shuffle: Mapped[bool] = mapped_column(Boolean, default=False)
    questions: Mapped[list] = mapped_column(JSONB)
