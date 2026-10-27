from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine

from app.core.config import get_settings
from app.models import Base

if context.config.config_file_name:
    fileConfig(context.config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(url=get_settings().sync_migration_url, target_metadata=target_metadata, literal_binds=True, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    s = get_settings()
    url = context.config.attributes.get("url") or s.sync_migration_url
    # Migration chạy qua kết nối session (MIGRATION_DATABASE_URL) nên chỉ cần SSL, không cần chế độ pooler.
    engine = create_engine(url, connect_args={"sslmode": "require"} if s.database_ssl else {})
    with engine.connect() as conn:
        context.configure(connection=conn, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
