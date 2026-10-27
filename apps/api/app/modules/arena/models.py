from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, Timestamped
from app.core.ids import new_id


class ArenaRun(Timestamped, Base):
    """Một lượt Đấu trường: trả lời càng nhiều câu đúng càng tốt trước khi hết giờ.

    Câu đang hỏi (kèm đáp án) nằm ở `current`, chỉ phần công khai được trả về; câu đã trả lời dồn vào `history`.
    Giờ kết thúc do server giữ, câu trả lời gửi sau giờ không được chấm.
    """

    __tablename__ = "arena_runs"
    __table_args__ = (Index("ix_arena_runs_board", "pool", "duration_minutes", "finished_at"),)

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    pool: Mapped[str] = mapped_column(String(16))  # basic | thpt
    duration_minutes: Mapped[int] = mapped_column(Integer)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    score: Mapped[int] = mapped_column(Integer, default=0)
    correct: Mapped[int] = mapped_column(Integer, default=0)
    answered: Mapped[int] = mapped_column(Integer, default=0)
    combo: Mapped[int] = mapped_column(Integer, default=0)
    best_combo: Mapped[int] = mapped_column(Integer, default=0)
    current: Mapped[dict | None] = mapped_column(JSONB)
    history: Mapped[list] = mapped_column(JSONB, default=list)
