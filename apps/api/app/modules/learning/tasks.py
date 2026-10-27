"""Task hàng đợi `learning`: cập nhật hồ sơ năng lực bất đồng bộ (không làm chậm request nộp bài)."""

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.modules.learning.models import SkillScore
from app.workers.celery_app import celery
from app.workers.db import SyncSession

RATE = 0.12  # tốc độ học của điểm kỹ năng (trung bình trượt mũ)


def next_score(score: float, is_correct: bool, hints_used: int) -> float:
    """Đúng nhờ gợi ý chỉ được cộng nửa mức."""
    delta = RATE * ((1.0 if is_correct else 0.0) - score)
    if is_correct and hints_used > 0:
        delta *= 0.5
    return min(1.0, max(0.0, score + delta))


@celery.task(name="learning.update_skill_score", acks_late=True, autoretry_for=(Exception,), max_retries=3, retry_backoff=True)
def update_skill_score(user_id: str, skill_code: str, is_correct: bool, hints_used: int = 0) -> float:
    with SyncSession() as db, db.begin():
        db.execute(insert(SkillScore).values(user_id=user_id, skill_code=skill_code, score=0.5, n_attempts=0).on_conflict_do_nothing())
        row = db.scalar(select(SkillScore).where(SkillScore.user_id == user_id, SkillScore.skill_code == skill_code).with_for_update())
        row.score = next_score(row.score, is_correct, hints_used)
        row.n_attempts += 1
        return row.score
