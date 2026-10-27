from app.core.config import Settings

SUPA = "postgresql://postgres.abc:pw@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true"


def test_chuan_hoa_chuoi_ket_noi_supabase():
    s = Settings(database_url=f'"{SUPA}"', database_pgbouncer=True, _env_file=None)
    # Bỏ tham số của Prisma (pgbouncer=true), đổi driver, tắt cache prepared statement của SQLAlchemy
    assert s.async_database_url == "postgresql+asyncpg://postgres.abc:pw@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?prepared_statement_cache_size=0"
    assert s.sync_database_url == "postgresql+psycopg://postgres.abc:pw@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres"


def test_migration_dung_ket_noi_session_rieng():
    s = Settings(database_url=SUPA, migration_database_url=SUPA.replace(":6543", ":5432").split("?")[0], _env_file=None)
    assert s.sync_migration_url.endswith(":5432/postgres") and s.sync_migration_url.startswith("postgresql+psycopg://")
    local = Settings(database_url="postgresql+asyncpg://u:p@localhost:5432/db", _env_file=None)
    assert local.async_database_url == "postgresql+asyncpg://u:p@localhost:5432/db"
    assert local.sync_migration_url == "postgresql+psycopg://u:p@localhost:5432/db"
