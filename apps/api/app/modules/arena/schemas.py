from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.modules.exams.schemas import ExamAnswer, ExamQuestionOut, TemplateRef

ArenaPool = Literal["basic", "thpt"]
ARENA_DURATIONS = (5, 15, 30)


class StartRunIn(BaseModel):
    pool: ArenaPool = "basic"
    duration_minutes: Literal[5, 15, 30] = 5


class AnswerIn(BaseModel):
    key: str = Field(max_length=16)
    # Bỏ trống = bỏ qua câu (không mất điểm, nhưng mất chuỗi đúng)
    answer: ExamAnswer | None = None


class ArenaItem(BaseModel):
    """Một câu đã trả lời, xem lại sau khi kết thúc lượt."""

    statement: str
    template: TemplateRef
    given: dict | None
    is_correct: bool
    points: int
    answer_display: str


class RunOut(BaseModel):
    id: str
    pool: ArenaPool
    duration_minutes: int
    started_at: datetime
    ends_at: datetime
    finished: bool
    score: int
    correct: int
    answered: int
    combo: int
    best_combo: int
    # Câu đang hỏi (không có đáp án); hết giờ thì không còn
    question: ExamQuestionOut | None = None
    # Sau khi kết thúc: các câu đã làm, hạng trong tuần, có phá kỷ lục cá nhân không
    history: list[ArenaItem] | None = None
    week_rank: int | None = None
    personal_best: bool | None = None


class AnswerOut(BaseModel):
    is_correct: bool
    points: int
    correct_answer: dict
    correct_answer_display: str
    run: RunOut


class BoardRow(BaseModel):
    rank: int
    user_id: str
    full_name: str
    grade: int | None
    score: int
    correct: int
    answered: int
    is_me: bool


class BoardOut(BaseModel):
    rows: list[BoardRow]
    # Hạng của tôi khi không nằm trong danh sách trên
    me: BoardRow | None


class BestOut(BaseModel):
    pool: ArenaPool
    duration_minutes: int
    score: int


class RunSummary(BaseModel):
    id: str
    pool: ArenaPool
    duration_minutes: int
    score: int
    correct: int
    answered: int
    finished_at: datetime


class ArenaMeOut(BaseModel):
    best: list[BestOut]
    recent: list[RunSummary]
    # Lượt chưa hết giờ (mở lại khi tải lại trang)
    active_run_id: str | None
