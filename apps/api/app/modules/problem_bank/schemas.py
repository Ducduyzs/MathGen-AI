from typing import Literal

from pydantic import BaseModel, Field, model_validator


class SkillOut(BaseModel):
    code: str
    name: str


class ChoiceOut(BaseModel):
    key: str
    content: str


class PublicProblem(BaseModel):
    """Bài ở dạng công khai: KHÔNG có đáp án và lời giải."""

    id: str
    statement: str
    grade: int
    skill: SkillOut
    difficulty: float
    answer_type: str
    answer_prefix: str | None = None
    choices: list[ChoiceOut] | None = None
    hints: list[str] | None = None


class ProblemPage(BaseModel):
    items: list[PublicProblem]
    total: int


class CheckOut(BaseModel):
    label: str
    passed: bool


class ReviewItemOut(BaseModel):
    id: str
    origin: str
    statement: str
    answer_display: str
    solution: list[str]
    grade: int
    skill: SkillOut
    difficulty: float
    classification_confidence: float
    parent: dict | None = None
    transform: str | None = None
    source: dict | None = None
    choices: list[ChoiceOut] | None = None
    checks: list[CheckOut]


class ReviewDecisionIn(BaseModel):
    decision: Literal["approve", "reject"]
    reason: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def _reason_for_reject(self):
        if self.decision == "reject" and not (self.reason and len(self.reason.strip()) >= 3):
            raise ValueError("Từ chối cần lý do")
        return self
