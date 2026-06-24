"""
Database engine and session factory.
Uses synchronous SQLAlchemy 2 with connection pooling.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    echo=False,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


def get_db():
    """
    FastAPI dependency that yields a database session.
    Ensures cleanup on both success and failure.
    """
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
