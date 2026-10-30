from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from sqlalchemy import text

from app.core.db import engine
from app.core.errors import install_handlers
from app.core.redis import get_redis
from app.modules.arena.router import router as arena
from app.modules.classifier.router import router as classifier
from app.modules.classroom.router import router as classroom
from app.modules.crawler.router import router as crawler
from app.modules.exams.router import router as exams
from app.modules.family.router import router as family
from app.modules.ingestion.router import router as ingestion
from app.modules.learning.router import router as learning
from app.modules.problem_bank.router import router as problem_bank
from app.modules.problem_sets.router import router as problem_sets
from app.modules.quality.router import router as quality
from app.modules.regions.router import router as regions
from app.modules.round_table.router import router as round_table
from app.modules.users.admin_router import router as admin_users
from app.modules.users.router import router as users


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Nạp mô hình phân loại ở nền (không chặn khởi động); không có mô hình / thư viện thì bỏ qua
    from app.modules.classifier import service as classifier

    classifier.warm_up()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="MathGen AI API", version="0.1.0", openapi_url="/api/openapi.json", docs_url="/api/docs", redoc_url=None,
                  lifespan=lifespan)
    install_handlers(app)

    api = APIRouter(prefix="/api")
    for r in (users, problem_bank, learning, exams, ingestion, classroom, problem_sets, arena, family, round_table, crawler, regions, admin_users, quality, classifier):
        api.include_router(r)

    @api.get("/health", tags=["ops"])
    async def health():
        async with engine.connect() as conn:
            await conn.execute(text("select 1"))
        redis_ok = True
        try:
            await get_redis().ping()
        except Exception:
            redis_ok = False
        return {"status": "ok", "db": True, "redis": redis_ok}

    app.include_router(api)

    return app


app = create_app()
