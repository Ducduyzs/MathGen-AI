"""Nguồn thu thập và lượt thu thập (chỉ quản trị viên). Việc tải trang chạy trong worker (tasks.py)."""

import asyncio
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ApiError
from app.modules.crawler import fetch, policy, tasks
from app.modules.crawler.models import CrawlJob, CrawlPage, CrawlSource
from app.modules.crawler.schemas import JobOut, JobSummary, PageOut, RobotsCheck, SourceIn, SourceOut, SourceUpdate
from app.modules.regions import service as regions
from app.modules.users.models import User

PAGES_SHOWN = 200


def _job_summary(j: CrawlJob) -> JobSummary:
    return JobSummary(id=j.id, status=j.status, pages_fetched=j.pages_fetched, documents=j.documents, questions=j.questions,
                      submitted=j.submitted, created_at=j.created_at, started_at=j.started_at, finished_at=j.finished_at, error=j.error)


def _out(s: CrawlSource, last: CrawlJob | None) -> SourceOut:
    return SourceOut(
        id=s.id, name=s.name, domain=s.domain, start_urls=s.start_urls, include_paths=s.include_paths, license=s.license,
        license_label=policy.LICENSES[s.license], permission_note=s.permission_note, terms_url=s.terms_url,
        province_code=s.province_code, province_name=regions.province_name(s.province_code), school_name=s.school_name, grade_min=s.grade_min,
        grade_max=s.grade_max, max_pages=s.max_pages, max_depth=s.max_depth, delay_seconds=s.delay_seconds, status=s.status,
        created_at=s.created_at, last_job=_job_summary(last) if last else None,
    )


async def _last_job(db: AsyncSession, source_id: str) -> CrawlJob | None:
    return await db.scalar(select(CrawlJob).where(CrawlJob.source_id == source_id).order_by(CrawlJob.created_at.desc()).limit(1))


async def _source(db: AsyncSession, source_id: str) -> CrawlSource:
    s = await db.get(CrawlSource, source_id)
    if not s:
        raise ApiError(404, "not_found")
    return s


async def list_sources(db: AsyncSession) -> list[SourceOut]:
    rows = list(await db.scalars(select(CrawlSource).order_by(CrawlSource.created_at.desc())))
    return [_out(s, await _last_job(db, s.id)) for s in rows]


async def create_source(db: AsyncSession, user: User, body: SourceIn) -> SourceOut:
    urls = [policy.normalize(str(u)) for u in body.start_urls]
    hosts = {policy.host_of(u) for u in urls if u}
    if None in urls or len(hosts) != 1:
        raise ApiError(422, "crawl_one_domain")  # mỗi nguồn một tên miền
    domain = hosts.pop()
    paths = sorted(set(body.include_paths))
    if any(not policy.in_scope(u, domain, paths) for u in urls):
        raise ApiError(422, "crawl_out_of_scope")  # điểm bắt đầu phải nằm trong thư mục được phép
    regions.check_province(body.province_code)
    if not await asyncio.to_thread(fetch.PUBLIC_HOST_CHECK, domain):
        raise ApiError(422, "crawl_private_host")
    s = CrawlSource(
        name=body.name.strip(), domain=domain, start_urls=urls, include_paths=paths, license=body.license,
        permission_note=(body.permission_note or "").strip() or None, terms_url=str(body.terms_url) if body.terms_url else None,
        province_code=body.province_code, school_name=(body.school_name or "").strip() or None,
        grade_min=body.grade_min, grade_max=body.grade_max, max_pages=body.max_pages, max_depth=body.max_depth,
        delay_seconds=body.delay_seconds, status="active", created_by=user.id, created_at=datetime.now(UTC),
    )
    db.add(s)
    await db.commit()
    return _out(s, None)


async def update_source(db: AsyncSession, source_id: str, body: SourceUpdate) -> SourceOut:
    s = await _source(db, source_id)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(s, k, v)
    await db.commit()
    return _out(s, await _last_job(db, s.id))


async def delete_source(db: AsyncSession, source_id: str) -> None:
    await db.delete(await _source(db, source_id))
    await db.commit()


def _robots_check(s: CrawlSource) -> list[RobotsCheck]:
    f = fetch.Fetcher(fetch.CLIENT_FACTORY(), 0, s.domain, s.include_paths)
    f.delay = 0  # chỉ đọc robots.txt một lần cho mỗi origin
    out = []
    try:
        for url in s.start_urls:
            r = f.robots(url)
            reason = None if r.allowed(url) else ("robots.txt không truy cập được (lỗi máy chủ)" if r.disallow_all else "robots.txt cấm đường dẫn này")
            out.append(RobotsCheck(url=url, allowed=reason is None, reason=reason, crawl_delay=r.crawl_delay))
    finally:
        f.client.close()
    return out


async def check_robots(db: AsyncSession, source_id: str) -> list[RobotsCheck]:
    """Xem trước robots.txt có cho phép các điểm bắt đầu không (trước khi chạy thu thập)."""
    return await asyncio.to_thread(_robots_check, await _source(db, source_id))


async def start_job(db: AsyncSession, user: User, source_id: str) -> JobSummary:
    s = await _source(db, source_id)
    if s.status != "active":
        raise ApiError(409, "crawl_paused")
    running = await db.scalar(select(CrawlJob.id).where(CrawlJob.source_id == s.id, CrawlJob.status.in_(("queued", "running"))))
    if running:
        raise ApiError(409, "crawl_running")
    job = CrawlJob(source_id=s.id, created_by=user.id, status="queued", created_at=datetime.now(UTC))
    db.add(job)
    await db.commit()
    tasks.crawl_job.delay(job.id)  # sau commit; dev/test (eager) chạy xong ngay
    await db.refresh(job)
    return _job_summary(job)


async def cancel_job(db: AsyncSession, job_id: str) -> JobSummary:
    job = await db.get(CrawlJob, job_id)
    if not job:
        raise ApiError(404, "not_found")
    if job.status in ("queued", "running"):
        job.status, job.finished_at = "cancelled", datetime.now(UTC)  # worker kiểm tra trạng thái trước mỗi trang
        await db.commit()
    return _job_summary(job)


async def list_jobs(db: AsyncSession, source_id: str) -> list[JobSummary]:
    rows = await db.scalars(select(CrawlJob).where(CrawlJob.source_id == source_id).order_by(CrawlJob.created_at.desc()).limit(20))
    return [_job_summary(j) for j in rows]


async def get_job(db: AsyncSession, job_id: str) -> JobOut:
    job = await db.get(CrawlJob, job_id)
    if not job:
        raise ApiError(404, "not_found")
    pages = await db.scalars(select(CrawlPage).where(CrawlPage.job_id == job.id).order_by(CrawlPage.fetched_at).limit(PAGES_SHOWN))
    return JobOut(**_job_summary(job).model_dump(), source_id=job.source_id, pages=[
        PageOut(url=p.url, status=p.status, http_status=p.http_status, title=p.title, questions=p.questions, submitted=p.submitted,
                ingestion_source_id=p.ingestion_source_id, error=p.error, fetched_at=p.fetched_at, region=(p.extra or {}).get("region"))
        for p in pages])
