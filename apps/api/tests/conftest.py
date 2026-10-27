"""Test chạy trên PostgreSQL + Redis thật (docker compose -f infra/docker-compose.yml up -d).

Database riêng `mathgen_test` được tạo lại từ đầu bằng chính migration Alembic (kiểm tra luôn migration),
rồi nạp dữ liệu mẫu. Redis dùng db 15. Task Celery chạy ngay trong tiến trình (CELERY_EAGER).
"""

import os
from pathlib import Path

# Test luôn dùng PostgreSQL trong Docker (xóa và tạo lại database mỗi lần), kể cả khi .env đang trỏ tới Supabase.
os.environ.update({
    "ENV": "test",
    "DATABASE_URL": "postgresql+asyncpg://mathgen:mathgen@localhost:5432/mathgen_test",
    "MIGRATION_DATABASE_URL": "",
    "DATABASE_SSL": "false",
    "DATABASE_PGBOUNCER": "false",
    "REDIS_URL": "redis://localhost:6379/15",
    "CELERY_EAGER": "true",
})

import httpx  # noqa: E402
import psycopg  # noqa: E402
import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
PASSWORD = "123456"


def _recreate_database() -> None:
    with psycopg.connect("postgresql://mathgen:mathgen@localhost:5432/mathgen", autocommit=True) as conn:
        conn.execute("DROP DATABASE IF EXISTS mathgen_test WITH (FORCE)")
        conn.execute("CREATE DATABASE mathgen_test")
    cfg = Config(str(ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(ROOT / "migrations"))
    command.upgrade(cfg, "head")


@pytest.fixture(scope="session", autouse=True)
async def prepared_db():
    _recreate_database()
    from app.core.db import SessionLocal, engine
    from app.core.redis import get_redis
    from app.seed.__main__ import seed

    async with SessionLocal() as db:
        await seed(db, demo=True)
    await get_redis().flushdb()
    yield
    await engine.dispose()


@pytest.fixture
async def client():
    from app.main import app

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://api.test") as c:
        yield c


async def login(client: httpx.AsyncClient, email: str) -> dict[str, str]:
    r = await client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
async def student(client):
    return await login(client, "hs@mathgen.vn")


@pytest.fixture
async def teacher(client):
    return await login(client, "gv@mathgen.vn")
