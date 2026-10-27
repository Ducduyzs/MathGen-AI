from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field

from app.modules.problem_bank.schemas import CheckOut, ChoiceOut, SkillOut


class UploadUrlIn(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    content_type: str = Field(default="application/octet-stream", max_length=120)
    size: int = Field(ge=1)


class UploadUrlOut(BaseModel):
    upload_url: str
    file_key: str


class CreateSourceIn(BaseModel):
    name: str = Field(default="", max_length=200)
    file_key: str | None = Field(default=None, max_length=26)
    text: str | None = Field(default=None, max_length=200_000)


class StepOut(BaseModel):
    key: str
    label: str
    state: Literal["pending", "running", "done", "failed"]


class RuleOut(BaseModel):
    code: str
    label: str
    description: str


class StructureOut(BaseModel):
    kind: str
    kind_label: str
    general_form: str
    params: list[dict]
    canonical: str
    hash: str


class ExtractedItemOut(BaseModel):
    id: str
    index: int
    raw_text: str
    statement: str
    choices: list[ChoiceOut]
    status: Literal["recognized", "unrecognized"]
    reason: str | None
    structure: StructureOut | None
    answer_display: str | None
    solution: list[str]
    grade: int | None
    skill: SkillOut | None
    difficulty: float | None
    confidence: float
    checks: list[CheckOut]
    duplicate_of: str | None
    matched_choice: str | None
    rules: list[RuleOut]


class StatsOut(BaseModel):
    total: int
    recognized: int
    duplicates: int


class SourceSummaryOut(BaseModel):
    id: str
    name: str
    origin: Literal["file", "text"]
    status: Literal["processing", "done", "failed"]
    created_at: datetime
    stats: StatsOut


class SourceOut(SourceSummaryOut):
    steps: list[StepOut]
    error: str | None
    items: list[ExtractedItemOut]


class GenerateIn(BaseModel):
    item_id: str = Field(max_length=64)
    count: Literal[3, 5, 10]
    rules: list[Annotated[str, Field(max_length=40)]] = Field(min_length=1, max_length=20)
    target: Literal["easier", "same", "harder"] = "same"
    format: Literal["original", "choice", "short"] = "original"


class VariantOut(BaseModel):
    id: str
    item_id: str
    statement: str
    format: Literal["original", "choice", "short"]
    choices: list[ChoiceOut]
    answer_display: str
    answer_short: str | None
    answer_prefix: str | None
    solution: list[str]
    rule: RuleOut
    transform: str
    grade: int
    skill: SkillOut
    difficulty: float
    checks: list[CheckOut]
    accepted: bool


class SubmitVariantsIn(BaseModel):
    variant_ids: list[Annotated[str, Field(max_length=26)]] = Field(min_length=1, max_length=50)


class SubmitVariantsOut(BaseModel):
    added: int
