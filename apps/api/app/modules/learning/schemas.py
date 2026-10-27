from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field

from app.modules.problem_bank.schemas import SkillOut


class ChoiceAnswer(BaseModel):
    type: Literal["choice"]
    value: str = Field(max_length=4)


class NumberAnswer(BaseModel):
    type: Literal["number"]
    value: str = Field(max_length=40)


class SetAnswer(BaseModel):
    type: Literal["set"]
    value: list[Annotated[str, Field(max_length=40)]] = Field(max_length=10)


AnswerValue = Annotated[ChoiceAnswer | NumberAnswer | SetAnswer, Field(discriminator="type")]


class AttemptIn(BaseModel):
    client_attempt_id: str = Field(min_length=8, max_length=64)
    problem_id: str
    answer: AnswerValue
    time_ms: int = Field(ge=0, le=24 * 3600 * 1000)
    hints_used: int = Field(default=0, ge=0, le=10)


class AttemptResult(BaseModel):
    attempt_id: str
    is_correct: bool
    correct_answer: dict
    correct_answer_display: str
    solution: list[str]
    xp_gained: int = 0


class SkillScoreOut(SkillOut):
    score: float
    n_attempts: int


class ProgressOut(BaseModel):
    skills: list[SkillScoreOut]
    total_attempts: int
    correct_attempts: int
    daily_goal: int
    today_attempts: int
    streak_days: int


class AttemptSummary(BaseModel):
    id: str
    problem_id: str
    statement: str
    skill: SkillOut
    is_correct: bool
    created_at: datetime


class QuestOut(BaseModel):
    code: str
    title: str
    target: int
    progress: int
    reward: int
    done: bool


class BadgeOut(BaseModel):
    code: str
    title: str
    description: str
    earned_at: datetime | None


class CalendarDay(BaseModel):
    day: date
    count: int
    status: Literal["met", "frozen", "partial", "none"]


class RewardsOut(BaseModel):
    today: date
    xp_total: int
    xp_today: int
    daily_goal: int
    today_attempts: int
    streak_days: int
    longest_streak: int
    freezes: int
    max_freezes: int
    freeze_every: int
    quests: list[QuestOut]
    badges: list[BadgeOut]
    calendar: list[CalendarDay]
