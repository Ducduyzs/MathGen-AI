"""Celery: broker Redis. Mỗi nhóm hàng đợi chạy worker riêng để pipeline nặng không làm chậm `learning`.

    celery -A app.workers.celery_app worker -Q learning -c 4 --pool threads     # cập nhật điểm kỹ năng
    celery -A app.workers.celery_app worker -Q ingest,verify,generate -c 2      # pipeline (M3)
"""

from celery import Celery

from app.core.config import get_settings

s = get_settings()
celery = Celery("mathgen", broker=s.redis_url, include=["app.modules.learning.tasks"])
celery.conf.update(
    task_always_eager=s.celery_eager,  # dev/test: chạy ngay trong tiến trình, không cần worker
    task_eager_propagates=True,
    task_ignore_result=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_routes={"learning.*": {"queue": "learning"}, "ingest.*": {"queue": "ingest"}, "verify.*": {"queue": "verify"}, "generate.*": {"queue": "generate"}},
    task_default_queue="learning",
    timezone="Asia/Ho_Chi_Minh",
)
