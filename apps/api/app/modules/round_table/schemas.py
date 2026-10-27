from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.modules.exams.schemas import ExamAnswer, ExamQuestionOut

TablePool = Literal["primary", "basic", "thpt"]
Phase = Literal["lobby", "question", "reveal", "finished"]


class CreateRoomIn(BaseModel):
    pool: TablePool = "basic"
    rounds: Literal[10, 15, 20] = 10


class AnswerIn(BaseModel):
    round: int = Field(ge=1)
    # Bỏ trống = bỏ qua (tính như trả lời sai: phải quay vòng)
    answer: ExamAnswer | None = None


class LastResult(BaseModel):
    """Kết quả lượt vừa chấm của một người: đúng/sai, điểm, có phải quay vòng không, có trúng hố đen không."""

    correct: bool
    points: int
    spun: bool
    hit: bool


class PlayerOut(BaseModel):
    seat: int
    name: str
    is_bot: bool
    is_me: bool
    is_host: bool
    score: int
    correct: int
    alive: bool
    # Số lần đã quay: lần quay kế tiếp trúng hố đen với xác suất 1 / (CHAMBERS - spins)
    spins: int
    answered: bool
    last: LastResult | None = None
    out_round: int | None = None


class RevealOut(BaseModel):
    answer_display: str
    solution: list[str]
    my_answer: dict | None = None


class RoomOut(BaseModel):
    code: str
    pool: TablePool
    rounds: int
    chambers: int
    phase: Phase
    round: int
    answer_seconds: int
    now: datetime
    deadline: datetime | None
    question: ExamQuestionOut | None = None
    reveal: RevealOut | None = None
    players: list[PlayerOut]
    my_seat: int
    # Ghế thắng cuộc (khi kết thúc)
    winners: list[int] = []
