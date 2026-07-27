from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker
from .configs import settings

engine = create_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    pool_recycle=3600,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@event.listens_for(engine, "connect")
def set_rls_tenant_id(dbapi_conn, _connection_record):
    if "postgresql" in settings.DATABASE_URL:
        cursor = dbapi_conn.cursor()
        cursor.execute("SET app.current_tenant_id = ''")
        cursor.close()
