from datetime import date, datetime

from pydantic import BaseModel, Field

from app.modules.arena.schemas import BestOut
from app.modules.classroom.schemas import AssignmentOut
from app.modules.exams.schemas import ExamSummary
from app.modules.learning.schemas import ProgressOut


class LinkCodeOut(BaseModel):
    code: str
    expires_at: datetime


class LinkIn(BaseModel):
    code: str = Field(min_length=4, max_length=12)


class ParentOut(BaseModel):
    id: str
    full_name: str
    email: str
    linked_at: datetime


class ChildSummary(BaseModel):
    id: str
    full_name: str
    grade: int | None
    linked_at: datetime
    daily_goal: int
    today_problems: int
    week_problems: int
    streak_days: int
    # Bài lớp giao chưa làm và còn hạn / đã quá hạn mà chưa nộp
    pending_assignments: int
    missed_assignments: int
    last_active: date | None


class DayCount(BaseModel):
    day: date
    count: int


class ChildReport(BaseModel):
    child: ChildSummary
    progress: ProgressOut
    # 14 ngày gần nhất, cũ → mới, có cả ngày không học (count = 0)
    activity: list[DayCount]
    exams: list[ExamSummary]
    assignments: list[AssignmentOut]
    arena: list[BestOut]
