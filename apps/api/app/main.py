from fastapi import APIRouter, FastAPI
from sqlalchemy import text

from app.core.db import engine
from app.core.errors import install_handlers
from app.core.redis import get_redis
from app.modules.classroom.router import router as classroom
from app.modules.exams.router import router as exams
from app.modules.ingestion.router import router as ingestion
from app.modules.learning.router import router as learning
from app.modules.problem_bank.router import router as problem_bank
from app.modules.users.router import router as users


def create_app() -> FastAPI:
    app = FastAPI(title="MathGen AI API", version="0.1.0", openapi_url="/api/openapi.json", docs_url="/api/docs", redoc_url=None)
    install_handlers(app)

    api = APIRouter(prefix="/api")
    for r in (users, problem_bank, learning, exams, ingestion, classroom):
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
