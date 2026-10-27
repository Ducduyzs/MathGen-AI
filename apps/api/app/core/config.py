from functools import lru_cache
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic_settings import BaseSettings, SettingsConfigDict

# Tham số chỉ dành cho công cụ khác (Prisma: pgbouncer=true…) — driver Python không hiểu nên bỏ đi.
_DROP_QUERY = {"pgbouncer", "sslmode", "ssl", "connection_limit", "pool_timeout", "schema"}


def _with_driver(url: str, driver: str) -> str:
    """postgresql://… hoặc postgres://… → postgresql+<driver>://…, bỏ tham số không dùng được."""
    parts = urlsplit(url.strip().strip('"'))
    scheme = f"postgresql+{driver}"
    query = urlencode([(k, v) for k, v in parse_qsl(parts.query) if k not in _DROP_QUERY])
    return urlunsplit((scheme, parts.netloc, parts.path, query, parts.fragment))


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "dev"
    database_url: str = "postgresql+asyncpg://mathgen:mathgen@localhost:5432/mathgen"
    #: Bắt buộc với Supabase / PostgreSQL được quản lý.
    database_ssl: bool = False
    #: true khi DATABASE_URL đi qua pooler chế độ transaction (Supabase cổng 6543, PgBouncer):
    #: tắt prepared statement và không giữ pool phía ứng dụng.
    database_pgbouncer: bool = False
    database_pool_size: int = 10
    #: Alembic nên chạy qua kết nối session (Supabase cổng 5432). Để trống = dùng DATABASE_URL.
    migration_database_url: str | None = None
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret: str = "dev-only-insecure-secret-change-me-in-prod"
    access_token_minutes: int = 15
    refresh_token_days: int = 30
    cookie_secure: bool = False
    celery_eager: bool = True
    daily_goal: int = 5
    #: Thư mục lưu file tải lên khi dev (production: R2/S3)
    upload_dir: str = str(Path(__file__).resolve().parents[2] / "var" / "uploads")

    @property
    def async_database_url(self) -> str:
        url = _with_driver(self.database_url, "asyncpg")
        # Cache prepared statement của chính SQLAlchemy cũng phải tắt khi đi qua pooler transaction.
        return url + ("&" if "?" in url else "?") + "prepared_statement_cache_size=0" if self.database_pgbouncer else url

    @property
    def sync_database_url(self) -> str:
        """Worker Celery dùng driver đồng bộ (psycopg)."""
        return _with_driver(self.database_url, "psycopg")

    @property
    def sync_migration_url(self) -> str:
        return _with_driver(self.migration_database_url or self.database_url, "psycopg")


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if s.env == "prod" and (s.jwt_secret.startswith("dev-only") or not s.cookie_secure):
        raise RuntimeError("Production cần JWT_SECRET riêng và COOKIE_SECURE=true")
    return s
