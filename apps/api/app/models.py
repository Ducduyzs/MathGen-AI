"""Import mọi model để metadata đầy đủ (Alembic autogenerate, tạo bảng trong test)."""

from app.core.db import Base
from app.modules.arena.models import ArenaRating, ArenaRun
from app.modules.classroom.models import Assignment, ClassMember, Classroom
from app.modules.crawler.models import CrawlJob, CrawlPage, CrawlSource
from app.modules.exams.models import Exam, ExamQuestion
from app.modules.family.models import LinkCode, ParentLink
from app.modules.ingestion.models import GeneratedVariant, IngestionSource, Upload
from app.modules.learning.models import Attempt, DailyActivity, RewardProfile, SkillScore, UserBadge
from app.modules.problem_bank.models import Problem, ReviewItem, Skill
from app.modules.problem_sets.models import ProblemSet
from app.modules.regions.models import School
from app.modules.users.models import RefreshToken, User

__all__ = ["Base", "ArenaRating", "ArenaRun", "LinkCode", "ParentLink", "Assignment", "ClassMember", "Classroom", "CrawlJob", "CrawlPage", "CrawlSource", "Exam", "ExamQuestion", "GeneratedVariant", "IngestionSource", "Upload", "Attempt", "DailyActivity", "RewardProfile", "SkillScore", "UserBadge", "Problem", "ReviewItem", "Skill", "ProblemSet", "School", "RefreshToken", "User"]
