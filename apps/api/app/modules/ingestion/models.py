from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, Timestamped
from app.core.ids import new_id


class Upload(Timestamped, Base):
    """File tải lên qua link ký sẵn. Nội dung nằm ở kho lưu trữ (dev: thư mục cục bộ; production: R2/S3)."""

    __tablename__ = "uploads"

    key: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(120))
    size: Mapped[int] = mapped_column(Integer)
    uploaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class IngestionSource(Timestamped, Base):
    """Một tài liệu (file hoặc nội dung dán vào) đi qua pipeline 5 bước. Worker `ingest` cập nhật tiến trình."""

    __tablename__ = "ingestion_sources"
    __table_args__ = (Index("ix_ingestion_sources_user_created", "user_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(200))
    origin: Mapped[str] = mapped_column(String(8))  # file | text
    upload_key: Mapped[str | None] = mapped_column(ForeignKey("uploads.key", ondelete="SET NULL"))
    text: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default="processing")  # processing | done | failed
    #: Số bước đã xong (1–5): tải lên, trích xuất, tách câu, nhận dạng, kiểm chứng
    progress: Mapped[int] = mapped_column(Integer, default=1)
    failed_at: Mapped[int | None] = mapped_column(Integer)
    error: Mapped[str | None] = mapped_column(Text)
    #: Các câu đã tách, kèm cấu trúc nội bộ (_structure, _key) để sinh biến thể
    items: Mapped[list] = mapped_column(JSONB, default=list)


class GeneratedVariant(Timestamped, Base):
    """Biến thể đã sinh, chờ giáo viên chọn gửi vào hàng chờ duyệt."""

    __tablename__ = "generated_variants"

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    source_id: Mapped[str] = mapped_column(ForeignKey("ingestion_sources.id", ondelete="CASCADE"), index=True)
    item_id: Mapped[str] = mapped_column(String(64))
    #: Biến thể ở dạng trả ra API (Variant của frontend)
    payload: Mapped[dict] = mapped_column(JSONB)
    answer: Mapped[dict | None] = mapped_column(JSONB)
    canonical_hash: Mapped[str] = mapped_column(String(64))
    accepted: Mapped[bool] = mapped_column(Boolean)
    submitted: Mapped[bool] = mapped_column(Boolean, default=False)
