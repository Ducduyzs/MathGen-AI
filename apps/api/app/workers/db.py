"""Phiên DB đồng bộ cho worker Celery (task Celery là hàm đồng bộ)."""

from sqlalchemy import NullPool, create_engine
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401  worker chạy tiến trình riêng: phải nạp đủ model để SQLAlchemy giải được khóa ngoại
from app.core.config import get_settings


def sync_connect_args() -> dict:
    s = get_settings()
    args: dict = {}
    if s.database_ssl:
        args["sslmode"] = "require"
    if s.database_pgbouncer:
        args["prepare_threshold"] = None  # psycopg không tự tạo prepared statement (pooler transaction)
    return args


_s = get_settings()
sync_engine = (
    create_engine(_s.sync_database_url, poolclass=NullPool, connect_args=sync_connect_args())
    if _s.database_pgbouncer
    else create_engine(_s.sync_database_url, pool_size=5, pool_pre_ping=True, connect_args=sync_connect_args())
)
SyncSession = sessionmaker(sync_engine, expire_on_commit=False)
