from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker
from .configs import settings

# Runtime engine — what every request actually uses (get_db below). Points
# at the restricted DATABASE_URL role once ensure_app_role() has created it;
# see core/configs.py's comment on DATABASE_ADMIN_URL vs DATABASE_URL.
engine = create_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    pool_recycle=3600,
)

# Admin engine — full-privilege Postgres connection, used ONLY for one-time
# startup work (create_all, schema backfills, ensure_app_role's own
# CREATE ROLE/GRANT/REVOKE). Never used for request traffic. A separate,
# small pool since it's only touched at boot, not per-request.
admin_engine = create_engine(
    settings.DATABASE_ADMIN_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=2,
    max_overflow=0,
    pool_recycle=3600,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
# Bound to admin_engine — only ensure_app_role() and the one-time
# create_all/schema-backfill calls in main.py's lifespan should use this.
AdminSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=admin_engine)
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
