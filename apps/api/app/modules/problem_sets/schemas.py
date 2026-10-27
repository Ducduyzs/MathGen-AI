from datetime import datetime
from typing import Annotated, Any

from pydantic import BaseModel, Field, model_serializer

from app.modules.exams.schemas import TemplateRef, TFStatementOut
from app.modules.problem_bank.schemas import ChoiceOut, SkillOut

MAX_QUESTIONS = 100


class TemplateCount(BaseModel):
    template: str = Field(max_length=64)
    count: int = Field(default=1, ge=1, le=20)


class CreateSetIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    items: list[TemplateCount] = Field(default_factory=list, max_length=50)


class AddQuestionsIn(BaseModel):
    items: list[TemplateCount] = Field(min_length=1, max_length=50)


class UpdateSetIn(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    # Thứ tự mới của các câu (theo `key`); câu không có trong danh sách bị xóa khỏi bộ đề
    order: list[Annotated[str, Field(max_length=16)]] | None = Field(default=None, max_length=MAX_QUESTIONS)


class SetQuestionOut(BaseModel):
    """Câu trong bộ đề, nhìn từ phía giáo viên: có cả đáp án và lời giải."""

    key: str
    type: str
    template: TemplateRef
    skill: SkillOut
    grade: int
    difficulty: float
    statement: str
    choices: list[ChoiceOut] | None = None
    statements: list[TFStatementOut] | None = None
    answer_prefix: str | None = None
    answer: dict
    answer_display: str
    solution: list[str]

    @model_serializer(mode="wrap")
    def _drop_empty(self, handler) -> dict[str, Any]:
        return {k: v for k, v in handler(self).items() if v is not None}


class TypeCounts(BaseModel):
    choice: int = 0
    true_false: int = 0
    number: int = 0


class ProblemSetSummary(BaseModel):
    id: str
    title: str
    description: str | None
    size: int
    counts: TypeCounts
    skills: list[SkillOut]
    created_at: datetime
    updated_at: datetime


class ProblemSetOut(ProblemSetSummary):
    questions: list[SetQuestionOut]
