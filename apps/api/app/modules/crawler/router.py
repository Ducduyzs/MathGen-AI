from fastapi import APIRouter

from app.core.deps import Admin, Db
from app.modules.crawler import service
from app.modules.crawler.schemas import JobOut, JobSummary, RobotsCheck, SourceIn, SourceOut, SourceUpdate

router = APIRouter(prefix="/crawler", tags=["crawler"])


@router.get("/sources", response_model=list[SourceOut])
async def list_sources(db: Db, _: Admin):
    return await service.list_sources(db)


@router.post("/sources", response_model=SourceOut, status_code=201)
async def create_source(body: SourceIn, db: Db, user: Admin):
    return await service.create_source(db, user, body)


@router.patch("/sources/{source_id}", response_model=SourceOut)
async def update_source(source_id: str, body: SourceUpdate, db: Db, _: Admin):
    return await service.update_source(db, source_id, body)


@router.delete("/sources/{source_id}", status_code=204)
async def delete_source(source_id: str, db: Db, _: Admin):
    await service.delete_source(db, source_id)


@router.post("/sources/{source_id}/robots", response_model=list[RobotsCheck])
async def check_robots(source_id: str, db: Db, _: Admin):
    return await service.check_robots(db, source_id)


@router.post("/sources/{source_id}/jobs", response_model=JobSummary, status_code=201)
async def start_job(source_id: str, db: Db, user: Admin):
    return await service.start_job(db, user, source_id)


@router.get("/sources/{source_id}/jobs", response_model=list[JobSummary])
async def list_jobs(source_id: str, db: Db, _: Admin):
    return await service.list_jobs(db, source_id)


@router.get("/jobs/{job_id}", response_model=JobOut)
async def get_job(job_id: str, db: Db, _: Admin):
    return await service.get_job(db, job_id)


@router.post("/jobs/{job_id}/cancel", response_model=JobSummary)
async def cancel_job(job_id: str, db: Db, _: Admin):
    return await service.cancel_job(db, job_id)
