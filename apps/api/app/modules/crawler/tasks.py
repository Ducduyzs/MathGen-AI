"""Task hàng đợi `ingest`: thu thập một nguồn theo chiều rộng (BFS) trong phạm vi đã khai báo.

Mỗi trang HTML / file PDF, DOCX có từ MIN_QUESTIONS câu đánh số trở lên được đưa vào pipeline tải đề;
câu nhận dạng và kiểm chứng đủ vào hàng chờ duyệt kèm nguồn gốc. Trang có nội dung không đổi so với lần trước thì bỏ qua.
"""

import hashlib
import logging
from collections import deque
from datetime import UTC, datetime

from sqlalchemy import select

from app.modules.crawler import fetch, html, policy
from app.modules.crawler.models import CrawlJob, CrawlPage, CrawlSource
from app.modules.ingestion import service as ingestion
from app.modules.ingestion.pipeline.extract import ExtractError, clean, extract_text
from app.modules.ingestion.pipeline.split import split_questions
from app.workers.celery_app import celery
from app.workers.db import SyncSession

log = logging.getLogger(__name__)
MIN_QUESTIONS = 2


def _record(db, src: CrawlSource, job: CrawlJob, url: str, **fields) -> CrawlPage:
    page = db.scalar(select(CrawlPage).where(CrawlPage.source_id == src.id, CrawlPage.url == url))
    if not page:
        page = CrawlPage(source_id=src.id, url=url)
        db.add(page)
    for k, v in {"job_id": job.id, "fetched_at": datetime.now(UTC), "error": None, "questions": 0, "submitted": 0, **fields}.items():
        setattr(page, k, v)
    return page


def _document(got: fetch.Fetched) -> tuple[str, str, list[str], bool]:
    """(tiêu đề, văn bản, liên kết, noindex) của trang HTML hoặc file tài liệu."""
    ext = policy.extension(got.url)
    if got.content_type == "application/pdf" or ext == "pdf":
        return got.url.rsplit("/", 1)[-1], extract_text("doc.pdf", got.body), [], False
    if "wordprocessingml" in got.content_type or ext == "docx":
        return got.url.rsplit("/", 1)[-1], extract_text("doc.docx", got.body), [], False
    if got.content_type in ("text/html", "application/xhtml+xml", ""):
        page = html.parse(got.body.decode("utf-8", errors="replace"))
        return page.title or got.url, page.text, page.links, page.noindex
    return got.url, "", [], False


@celery.task(name="ingest.crawl_job", acks_late=True)
def crawl_job(job_id: str) -> str:
    with SyncSession() as db:
        job = db.get(CrawlJob, job_id)
        if not job or job.status != "queued":
            return "skip"
        src = db.get(CrawlSource, job.source_id)
        if src.status != "active":
            job.status, job.error, job.finished_at = "failed", "Nguồn đang tạm dừng.", datetime.now(UTC)
            db.commit()
            return "failed"
        job.status, job.started_at = "running", datetime.now(UTC)
        db.commit()

        provenance_base = {"site": src.domain, "license": policy.LICENSES[src.license], "source_id": src.id}
        fetcher = fetch.Fetcher(fetch.CLIENT_FACTORY(), src.delay_seconds, src.domain, src.include_paths)
        queue = deque((u, 0) for u in src.start_urls)
        seen: set[str] = set()
        try:
            while queue and job.pages_fetched < src.max_pages:
                db.refresh(job, attribute_names=["status"])
                if job.status == "cancelled":
                    break
                raw, depth = queue.popleft()
                url = policy.normalize(raw)
                if not url or url in seen or not policy.in_scope(url, src.domain, src.include_paths):
                    continue
                seen.add(url)
                if not fetcher.allowed(url):
                    _record(db, src, job, url, status="blocked", error="robots.txt không cho phép")
                    db.commit()
                    continue
                try:
                    got = fetcher.get(url)
                except fetch.FetchError as e:
                    _record(db, src, job, url, status="error", error=str(e))
                    db.commit()
                    continue
                job.pages_fetched += 1
                if got.status >= 400:
                    _record(db, src, job, url, status="error", http_status=got.status, error=f"HTTP {got.status}")
                    db.commit()
                    continue
                try:
                    title, text, links, noindex = _document(got)
                except ExtractError as e:
                    _record(db, src, job, url, status="error", http_status=got.status, content_type=got.content_type, error=str(e))
                    db.commit()
                    continue
                if depth < src.max_depth:
                    queue.extend((link, depth + 1) for link in (policy.normalize(x, got.url) for x in links) if link and link not in seen)

                text = clean(text)
                digest = hashlib.sha256(text.encode()).hexdigest()
                old = db.scalar(select(CrawlPage.content_hash).where(CrawlPage.source_id == src.id, CrawlPage.url == url))
                base = {"http_status": got.status, "content_type": got.content_type, "title": title[:200], "content_hash": digest}
                if noindex:  # trang tự khai báo không muốn được lập chỉ mục: tôn trọng, không lấy nội dung
                    _record(db, src, job, url, status="blocked", error="Trang đặt noindex", **base)
                elif old == digest:
                    _record(db, src, job, url, status="unchanged", **base)
                elif len(split_questions(text)) < MIN_QUESTIONS:
                    _record(db, src, job, url, status="no_questions", **base)
                else:
                    provenance = {"name": title[:200], "url": got.url, **provenance_base}
                    source_id, n, sent, region = ingestion.ingest_crawled_sync(
                        db, job.created_by, f"{src.name} · {title}", text, provenance, src.province_code, src.school_name)
                    _record(db, src, job, url, status="fetched", questions=n, submitted=sent, ingestion_source_id=source_id,
                            extra={"region": region}, **base)
                    job.documents += 1
                    job.questions += n
                    job.submitted += sent
                db.commit()
        except Exception:  # lỗi bất ngờ: ghi lại để quản trị viên thấy, không để lượt treo ở "running"
            log.exception("crawl job %s", job_id)
            db.rollback()
            job = db.get(CrawlJob, job_id)
            job.status, job.error, job.finished_at = "failed", "Lỗi không mong muốn khi thu thập (xem log worker).", datetime.now(UTC)
            db.commit()
            return "failed"
        finally:
            fetcher.client.close()

        if job.status != "cancelled":
            job.status = "done"
        job.finished_at = datetime.now(UTC)
        db.commit()
        return job.status
