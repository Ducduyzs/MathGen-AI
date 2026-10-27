from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, Timestamped
from app.core.ids import new_id


class CrawlSource(Timestamped, Base):
    """Một nguồn được phép thu thập: tên miền, điểm bắt đầu, phạm vi thư mục, giấy phép và bằng chứng cho phép."""

    __tablename__ = "crawl_sources"

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(200))
    domain: Mapped[str] = mapped_column(String(255), index=True)
    start_urls: Mapped[list] = mapped_column(JSONB)
    include_paths: Mapped[list] = mapped_column(JSONB, default=list)
    license: Mapped[str] = mapped_column(String(32))
    permission_note: Mapped[str | None] = mapped_column(Text)
    terms_url: Mapped[str | None] = mapped_column(String(500))
    grade_min: Mapped[int] = mapped_column(Integer, default=1)
    grade_max: Mapped[int] = mapped_column(Integer, default=12)
    max_pages: Mapped[int] = mapped_column(Integer, default=50)
    max_depth: Mapped[int] = mapped_column(Integer, default=2)
    delay_seconds: Mapped[float] = mapped_column(default=3.0)
    status: Mapped[str] = mapped_column(String(16), default="active")  # active | paused
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))


class CrawlJob(Timestamped, Base):
    """Một lượt thu thập của một nguồn (chạy trong worker `ingest`)."""

    __tablename__ = "crawl_jobs"

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_id)
    source_id: Mapped[str] = mapped_column(ForeignKey("crawl_sources.id", ondelete="CASCADE"), index=True)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(16), default="queued")  # queued | running | done | failed | cancelled
    pages_fetched: Mapped[int] = mapped_column(Integer, default=0)
    documents: Mapped[int] = mapped_column(Integer, default=0)  # trang / file có câu hỏi, đã đưa vào pipeline
    questions: Mapped[int] = mapped_column(Integer, default=0)
    submitted: Mapped[int] = mapped_column(Integer, default=0)  # câu đã vào hàng chờ duyệt
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error: Mapped[str | None] = mapped_column(Text)


class CrawlPage(Base):
    """Kết quả gần nhất của một URL trong một nguồn (thu thập lại thì ghi đè, nội dung không đổi thì bỏ qua)."""

    __tablename__ = "crawl_pages"
    __table_args__ = (UniqueConstraint("source_id", "url", name="uq_crawl_pages_source_url"),)

    id: Mapped[str] = mapped_column(String(26), primary_key=True, default=new_id)
    source_id: Mapped[str] = mapped_column(ForeignKey("crawl_sources.id", ondelete="CASCADE"), index=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("crawl_jobs.id", ondelete="CASCADE"), index=True)
    url: Mapped[str] = mapped_column(String(1000))
    # fetched | unchanged | no_questions | blocked | error
    status: Mapped[str] = mapped_column(String(16))
    http_status: Mapped[int | None] = mapped_column(Integer)
    content_type: Mapped[str | None] = mapped_column(String(120))
    title: Mapped[str | None] = mapped_column(String(200))
    content_hash: Mapped[str | None] = mapped_column(String(64))
    questions: Mapped[int] = mapped_column(Integer, default=0)
    submitted: Mapped[int] = mapped_column(Integer, default=0)
    ingestion_source_id: Mapped[str | None] = mapped_column(String(26))
    error: Mapped[str | None] = mapped_column(Text)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    extra: Mapped[dict | None] = mapped_column(JSONB)
