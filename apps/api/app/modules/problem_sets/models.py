from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, Timestamped
from app.core.ids import new_id


class ProblemSet(Timestamped, Base):
    """Bộ đề giáo viên tự soạn: chọn từng câu từ các dạng bài, đổi số liệu, sắp xếp rồi giao cho lớp.

    Câu hỏi lưu cả đáp án trong `questions` (JSONB, cùng dạng với câu của bài giao), mỗi câu có `key` ổn định
    để sắp xếp, xóa hay đổi số liệu từng câu.
    """

    __tablename__ = "problem_sets"

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_id)
    teacher_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    questions: Mapped[list] = mapped_column(JSONB, default=list)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
