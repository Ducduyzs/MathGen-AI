from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, HttpUrl, model_validator

License = Literal["government", "public_domain", "cc0", "cc_by", "cc_by_sa", "permission"]


class SourceIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    start_urls: list[HttpUrl] = Field(min_length=1, max_length=20)
    # Chỉ đi trong các thư mục này (vd. "/de-thi/"); để trống = cả tên miền
    include_paths: list[Annotated[str, Field(max_length=200, pattern=r"^/")]] = Field(default=[], max_length=20)
    license: License
    permission_note: str | None = Field(default=None, max_length=2000)
    terms_url: HttpUrl | None = None
    # Khu vực mặc định (vd. website một Sở GD&ĐT): mã tỉnh mới và tên trường (tùy chọn)
    province_code: str | None = Field(default=None, max_length=32)
    school_name: str | None = Field(default=None, max_length=200)
    grade_min: int = Field(default=1, ge=1, le=12)
    grade_max: int = Field(default=12, ge=1, le=12)
    max_pages: int = Field(default=50, ge=1, le=500)
    max_depth: int = Field(default=2, ge=0, le=5)
    delay_seconds: float = Field(default=3.0, ge=1, le=60)
    # Quản trị viên xác nhận đã kiểm tra điều khoản sử dụng / giấy phép của nguồn
    confirm: Literal[True]

    @model_validator(mode="after")
    def _check(self):
        if self.grade_min > self.grade_max:
            raise ValueError("grade_min > grade_max")
        if self.license == "permission" and not (self.permission_note or "").strip():
            raise ValueError("Cần ghi bằng chứng cho phép (văn bản, email, đường dẫn điều khoản)")
        return self


class SourceUpdate(BaseModel):
    status: Literal["active", "paused"] | None = None
    max_pages: int | None = Field(default=None, ge=1, le=500)
    max_depth: int | None = Field(default=None, ge=0, le=5)
    delay_seconds: float | None = Field(default=None, ge=1, le=60)


class JobSummary(BaseModel):
    id: str
    status: str
    pages_fetched: int
    documents: int
    questions: int
    submitted: int
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    error: str | None


class SourceOut(BaseModel):
    id: str
    name: str
    domain: str
    start_urls: list[str]
    include_paths: list[str]
    license: str
    license_label: str
    permission_note: str | None
    terms_url: str | None
    province_code: str | None
    province_name: str | None
    school_name: str | None
    grade_min: int
    grade_max: int
    max_pages: int
    max_depth: int
    delay_seconds: float
    status: str
    created_at: datetime
    last_job: JobSummary | None = None


class RobotsCheck(BaseModel):
    url: str
    allowed: bool
    reason: str | None = None
    crawl_delay: float | None = None


class PageOut(BaseModel):
    url: str
    status: str
    http_status: int | None
    title: str | None
    questions: int
    submitted: int
    ingestion_source_id: str | None
    error: str | None
    fetched_at: datetime
    # Khu vực của tài liệu (tỉnh, trường, kỳ thi, năm học)
    region: dict | None = None


class JobOut(JobSummary):
    source_id: str
    pages: list[PageOut]
