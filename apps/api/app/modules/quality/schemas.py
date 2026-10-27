from pydantic import BaseModel


class Count(BaseModel):
    key: str
    label: str
    count: int


class SkillCoverage(BaseModel):
    code: str
    name: str
    grade_min: int | None
    grade_max: int | None
    problems: int
    # Dưới ngưỡng tối thiểu: luyện tập dễ lặp bài
    low: bool


class SuspiciousProblem(BaseModel):
    problem_id: str
    statement: str
    skill: str
    grade: int
    origin: str
    attempts: int
    correct_rate: float


class Reason(BaseModel):
    reason: str
    count: int


class QualityOut(BaseModel):
    # Ngân hàng
    problems_total: int
    by_origin: list[Count]
    by_stage: list[Count]
    coverage: list[SkillCoverage]
    min_per_skill: int
    by_province: list[Count]
    # Hàng chờ duyệt (30 ngày)
    pending: int
    pending_by_origin: list[Count]
    approved_recent: int
    rejected_recent: int
    approval_rate: float | None
    reject_reasons: list[Reason]
    # Học tập (7 ngày)
    attempts_week: int
    correct_rate_week: float | None
    active_students_week: int
    suspicious: list[SuspiciousProblem]
    # Pipeline tải đề
    documents: int
    documents_failed: int
    items: int
    recognized: int
    duplicates: int
    recognition_rate: float | None
    documents_with_region: int
    # Bộ gom
    crawl_sources: int
    crawl_active_sources: int
    crawl_jobs: int
    crawl_submitted: int
    crawl_pages: list[Count]
