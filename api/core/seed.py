from core.database import SessionLocal
from core.configs import settings
from core.security import hash_password
from shared_models import PlatformAdmin, App
from utils.logger import logger


def _app_catalog() -> list[dict]:
    return [
        {
            "code": "hotel_pms",
            "slug": "hotel-pms",
            "name": "Hotel PMS",
            "tagline": "Run your hotel from one calm dashboard.",
            "description": (
                "Property management for hotels: bookings, check-in/out, folios, "
                "VAT invoices, housekeeping, guest profiles, and payments — "
                "unified across every property you manage."
            ),
            "icon": "Hotel",
            "url": "http://localhost:3002",
            "screenshots": [],
            "features": [
                "Booking calendar with walk-in and advance reservations",
                "Check-in / check-out workflow with folio tracking",
                "Fiscal-year invoicing with VAT breakdown",
                "Housekeeping status per room",
                "Multi-property support",
            ],
            "display_order": 1,
            "is_active": True,
            "is_public": True,
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


def seed_apps():
    db = SessionLocal()
    try:
        for entry in _app_catalog():
            existing = db.query(App).filter(App.code == entry["code"]).first()
            if existing:
                logger.info(f"App exists: {entry['code']}")
                continue

            app_row = App(**entry)
            db.add(app_row)
            db.commit()
            db.refresh(app_row)
            logger.info(f"App created: {entry['code']}")

    except Exception as e:
        db.rollback()
        logger.error(f"Failed to seed apps: {type(e).__name__}: {str(e)}")
        raise
    finally:
        db.close()
