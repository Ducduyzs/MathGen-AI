from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, model_serializer

from app.modules.problem_bank.schemas import ChoiceOut, SkillOut


class ChoiceAnswer(BaseModel):
    type: Literal["choice"]
    value: str = Field(max_length=4)


class NumberAnswer(BaseModel):
    type: Literal["number"]
    value: str = Field(max_length=40)


class TrueFalseAnswer(BaseModel):
    type: Literal["true_false"]
    value: dict[Annotated[str, Field(max_length=2)], bool] = Field(max_length=4)


ExamAnswer = Annotated[ChoiceAnswer | NumberAnswer | TrueFalseAnswer, Field(discriminator="type")]


class CreateExamIn(BaseModel):
    kind: Literal["practice", "official"] = "practice"
    blueprint: Literal["thpt"] | None = None
    mode: Literal["choice", "written"] | None = None
    size: int | None = None
    skills: list[Annotated[str, Field(max_length=64)]] | None = Field(default=None, max_length=20)
    # Chỉ sinh câu thuộc các dạng này (tạo đề từ dạng đã sai)
    templates: list[Annotated[str, Field(max_length=64)]] | None = Field(default=None, max_length=50)
    # Làm lại các câu sai của đề này
    retry_of: str | None = Field(default=None, max_length=26)
    # Đề theo khu vực: ưu tiên câu thật thu thập từ đề của tỉnh (và trường) này, thiếu thì bổ sung câu tự sinh
    province: str | None = Field(default=None, max_length=32)
    school_id: str | None = Field(default=None, max_length=26)


class SubmitExamIn(BaseModel):
    answers: dict[Annotated[str, Field(max_length=40)], ExamAnswer] = Field(max_length=200)


class TemplateRef(BaseModel):
    code: str
    name: str


class TFStatementOut(BaseModel):
    key: str
    content: str


class ExamQuestionOut(BaseModel):
    """Câu hỏi công khai: KHÔNG có đáp án và lời giải."""

    id: str
    index: int
    type: str
    template: TemplateRef
    skill: SkillOut
    grade: int
    difficulty: float
    statement: str
    choices: list[ChoiceOut] | None = None
    statements: list[TFStatementOut] | None = None
    answer_prefix: str | None = None

    @model_serializer(mode="wrap")
    def _drop_empty(self, handler) -> dict[str, Any]:
        # Giống mock: trường không áp dụng cho loại câu thì không có trong JSON
        return {k: v for k, v in handler(self).items() if v is not None}


class ExamResultItem(BaseModel):
    question_id: str
    is_correct: bool
    # Điểm của câu (0–1). Đúng/Sai chấm từng phần: 1 ý 0,1 · 2 ý 0,25 · 3 ý 0,5 · 4 ý 1
    points: float
    correct_answer: dict
    correct_answer_display: str
    solution: list[str]


class PartScore(BaseModel):
    label: str
    earned: float
    max: float


class ExamResult(BaseModel):
    correct: int
    total: int
    score: float  # thang 10
    parts: list[PartScore]
    items: list[ExamResultItem]
    wrong_templates: list[TemplateRef]
    submitted_at: datetime


class ExamOut(BaseModel):
    id: str
    title: str
    kind: str
    mode: str
    size: int
    created_at: datetime
    duration_minutes: int | None
    ends_at: datetime | None
    questions: list[ExamQuestionOut]
    result: ExamResult | None
    # Bài giao của lớp (nếu có): giao diện hiện đường quay về lớp
    assignment_id: str | None = None
    # Bài làm của học sinh, chỉ có sau khi nộp
    answers: dict[str, dict] | None = None


class ExamSummary(BaseModel):
    id: str
    title: str
    kind: str
    mode: str
    size: int
    created_at: datetime
    score: float | None
    correct: int | None


class TemplateInfo(BaseModel):
    code: str
    name: str
    skill: str
    grade: int
    difficulty: float
    mode: str
    type: str
    part: str | None = None
