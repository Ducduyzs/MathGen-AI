"""Import mọi model để metadata đầy đủ (Alembic autogenerate, tạo bảng trong test)."""

from app.core.db import Base
from app.modules.exams.models import Exam, ExamQuestion
from app.modules.ingestion.models import GeneratedVariant, IngestionSource, Upload
from app.modules.learning.models import Attempt, DailyActivity, SkillScore
from app.modules.problem_bank.models import Problem, ReviewItem, Skill
from app.modules.users.models import RefreshToken, User

__all__ = ["Base", "Exam", "ExamQuestion", "GeneratedVariant", "IngestionSource", "Upload", "Attempt", "DailyActivity", "SkillScore", "Problem", "ReviewItem", "Skill", "RefreshToken", "User"]
