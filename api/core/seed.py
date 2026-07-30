from core.database import SessionLocal
from core.configs import settings
from core.security import hash_password
from shared_models import PlatformAdmin, Module
from utils.logger import logger


MODULE_CATALOG = [
    {
        "code": "hotel_pms",
        "name": "Hotel PMS",
        "description": "Property management for hotels: bookings, rooms, folios, invoices.",
        "is_core": True,
        "scope": "tenant",
        "default_trial_days": 30,
        "monthly_price": 2999,
        "yearly_price": 11999,
    },
]


def seed_superadmin():
    if not settings.SUPERADMIN_EMAIL or not settings.SUPERADMIN_PASSWORD:
        logger.error("SUPERADMIN_EMAIL or SUPERADMIN_PASSWORD not set in .env")
        return

    db = SessionLocal()
    try:
        existing_admin = db.query(PlatformAdmin).filter(
            PlatformAdmin.email == settings.SUPERADMIN_EMAIL
        ).first()

        if existing_admin:
            logger.info(f"Superadmin exists: {settings.SUPERADMIN_EMAIL}")
            return

        hashed_password = hash_password(settings.SUPERADMIN_PASSWORD)
        superadmin = PlatformAdmin(
            email=settings.SUPERADMIN_EMAIL,
            password_hash=hashed_password,
            is_active=True,
        )

        db.add(superadmin)
        db.commit()
        db.refresh(superadmin)

        logger.info(f"Superadmin created: {settings.SUPERADMIN_EMAIL}")

    except Exception as e:
        db.rollback()
        logger.error(f"Failed to seed superadmin: {type(e).__name__}: {str(e)}")
        raise
    finally:
        db.close()


def seed_modules():
    db = SessionLocal()
    try:
        for entry in MODULE_CATALOG:
            existing = db.query(Module).filter(Module.code == entry["code"]).first()
            if existing:
                logger.info(f"Module exists: {entry['code']}")
                continue

            module = Module(**entry)
            db.add(module)
            db.commit()
            db.refresh(module)
            logger.info(f"Module created: {entry['code']}")

    except Exception as e:
        db.rollback()
        logger.error(f"Failed to seed modules: {type(e).__name__}: {str(e)}")
        raise
    finally:
        db.close()
