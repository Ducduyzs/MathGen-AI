from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field

from app.modules.exams.schemas import TemplateRef
from app.modules.problem_bank.schemas import SkillOut

# Trạng thái bài giao của một học sinh
#   todo: chưa làm · in_progress: đang làm · submitted: đã nộp · late: nộp sau hạn · missed: quá hạn, chưa nộp
AssignmentStatus = Literal["todo", "in_progress", "submitted", "late", "missed"]


class CreateClassIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    grade: int | None = Field(default=None, ge=6, le=12)


class JoinClassIn(BaseModel):
    code: str = Field(min_length=4, max_length=12)


class ClassOut(BaseModel):
    id: str
    name: str
    grade: int | None
    teacher_name: str
    # Chỉ giáo viên của lớp mới thấy mã lớp
    join_code: str | None = None
    member_count: int
    assignment_count: int
    # Học sinh: số bài chưa làm và còn hạn
    pending_count: int = 0
    created_at: datetime


class MemberOut(BaseModel):
    id: str
    full_name: str
    email: str
    grade: int | None
    joined_at: datetime


class ClassDetailOut(ClassOut):
    members: list[MemberOut] | None = None


class CreateAssignmentIn(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    kind: Literal["practice", "official"] = "practice"
    mode: Literal["choice", "written"] | None = None
    size: int | None = None
    skills: list[Annotated[str, Field(max_length=64)]] | None = Field(default=None, max_length=20)
    # Đề thi THPT luôn 90 phút; đề ôn tập có thể không giới hạn thời gian
    duration_minutes: int | None = Field(default=None, ge=5, le=180)
    due_at: datetime | None = None
    shuffle: bool = False


class AssignmentOut(BaseModel):
    id: str
    class_id: str
    class_name: str
    title: str
    kind: str
    mode: str
    size: int
    duration_minutes: int | None
    due_at: datetime | None
    shuffle: bool
    created_at: datetime
    # Giáo viên: số học sinh đã nộp và điểm trung bình
    member_count: int | None = None
    submitted_count: int | None = None
    average_score: float | None = None
    # Học sinh: bài làm của chính mình
    status: AssignmentStatus | None = None
    exam_id: str | None = None
    score: float | None = None


class StartOut(BaseModel):
    exam_id: str


class StudentResult(BaseModel):
    id: str
    full_name: str
    status: AssignmentStatus
    exam_id: str | None
    score: float | None
    correct: int | None
    total: int
    started_at: datetime | None
    submitted_at: datetime | None
    duration_seconds: int | None


class QuestionStat(BaseModel):
    index: int
    type: str
    statement: str
    template: TemplateRef
    skill: SkillOut
    answer_display: str
    # Tỉ lệ điểm trung bình của câu (0–1) trong số bài đã nộp; câu Đúng/Sai tính cả điểm từng phần
    correct_rate: float | None
    answered: int


class SkillStat(BaseModel):
    skill: SkillOut
    questions: int
    correct_rate: float | None


class ReportSummary(BaseModel):
    member_count: int
    submitted_count: int
    late_count: int
    average_score: float | None
    max_score: float | None
    min_score: float | None
    # Số bài theo khoảng điểm [0,2) [2,4) [4,6) [6,8) [8,10]
    distribution: list[int]


class AssignmentReport(BaseModel):
    assignment: AssignmentOut
    summary: ReportSummary
    students: list[StudentResult]
    questions: list[QuestionStat]
    skills: list[SkillStat]


class LeaderboardRow(BaseModel):
    id: str
    full_name: str
    is_me: bool
    # Điểm trung bình các bài giao đã nộp (thang 10)
    average_score: float | None
    assignments_done: int
    # Số bài đã làm trong 7 ngày gần nhất (luyện tập + làm đề)
    week_problems: int
    streak_days: int
