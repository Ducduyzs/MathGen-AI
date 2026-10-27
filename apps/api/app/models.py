"""Import mọi model để metadata đầy đủ (Alembic autogenerate, tạo bảng trong test)."""

from app.core.db import Base
from app.modules.arena.models import ArenaRun
from app.modules.classroom.models import Assignment, ClassMember, Classroom
from app.modules.exams.models import Exam, ExamQuestion
from app.modules.family.models import LinkCode, ParentLink
from app.modules.ingestion.models import GeneratedVariant, IngestionSource, Upload
from app.modules.learning.models import Attempt, DailyActivity, SkillScore
from app.modules.problem_bank.models import Problem, ReviewItem, Skill
from app.modules.problem_sets.models import ProblemSet
from app.modules.users.models import RefreshToken, User

__all__ = ["Base", "ArenaRun", "LinkCode", "ParentLink", "Assignment", "ClassMember", "Classroom", "Exam", "ExamQuestion", "GeneratedVariant", "IngestionSource", "Upload", "Attempt", "DailyActivity", "SkillScore", "Problem", "ReviewItem", "Skill", "ProblemSet", "RefreshToken", "User"]
