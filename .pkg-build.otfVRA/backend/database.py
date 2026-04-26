"""Database engine & session factory — PostgreSQL via SQLAlchemy async."""
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://patchmaster:patchmaster@127.0.0.1:5432/patchmaster",
)

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,       # Verify connection liveness before use (prevents stale conn errors)
    pool_recycle=1800,        # Recycle connections every 30 min (prevents PostgreSQL idle timeout)
    connect_args={"command_timeout": 30},  # Kill runaway queries after 30 s
)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    """FastAPI dependency — yields an async DB session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db():
    """Create all tables on startup."""
    async with engine.begin() as conn:
        from models import db_models  # noqa: F401 — import to register models
        await conn.run_sync(Base.metadata.create_all)
