from collections.abc import AsyncIterator
from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, MetaData, NullPool, func
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.core.config import get_settings

# Đặt tên ràng buộc ổn định để migration Alembic không đổi tên lung tung giữa các lần autogenerate.
NAMING = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING)


class Timestamped:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


def _make_engine():
    s = get_settings()
    connect_args: dict = {}
    if s.database_ssl:
        connect_args["ssl"] = "require"
    if s.database_pgbouncer:
        # Pooler chế độ transaction không giữ prepared statement giữa các truy vấn: tắt cache, đặt tên ngẫu nhiên,
        # và không giữ pool phía ứng dụng (pooler đã làm việc đó).
        connect_args |= {"statement_cache_size": 0, "prepared_statement_name_func": lambda: f"__asyncpg_{uuid4()}__"}
        return create_async_engine(s.async_database_url, poolclass=NullPool, connect_args=connect_args)
    return create_async_engine(s.async_database_url, pool_size=s.database_pool_size, max_overflow=5, pool_pre_ping=True, connect_args=connect_args)


engine = _make_engine()
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    """Phiên ghi (primary)."""
    async with SessionLocal() as session:
        yield session


# Pha A: đọc và ghi cùng một PostgreSQL. Pha B chỉ cần trỏ phiên đọc sang read replica.
get_read_db = get_db
