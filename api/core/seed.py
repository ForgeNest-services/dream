from pathlib import Path

from sqlalchemy import text

from core.database import SessionLocal
from core.configs import settings
from core.security import hash_password
from core.storage import upload_file_at_key, build_public_url
from shared_models import PlatformAdmin, App
from utils.bikram_sambat import to_bs_iso
from utils.logger import logger


# Path to the on-disk assets directory. Bundled into the api/ image at build
# time, so this resolves inside the container as /app/assets.
_ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"


def _app_catalog() -> list[dict]:
    """The `icon_asset` key names a PNG in api/assets/ that gets uploaded to
    MinIO on startup (see seed_app_icons). It's NOT persisted to the DB — the
    resulting public URL lands in the app row's `icon_url` column."""
    return [
        {
            "code": "srota_pms",
            "slug": "srota-pms",
            "name": "Srota PMS",
            "tagline": "Run your hotel from one calm dashboard.",
            "description": (
                "Property management for hotels: bookings, check-in/out, folios, "
                "VAT invoices, housekeeping, guest profiles, and payments — "
                "unified across every property you manage."
            ),
            "icon": "Hotel",
            "icon_asset": "PMS.png",
            "url": "https://pms.srotaapps.com",
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
        {
            "code": "srota_rms",
            "slug": "srota-rms",
            "name": "Srota RMS",
            "tagline": "The floor-friendly restaurant POS.",
            "description": (
                "Restaurant point-of-sale built for fast service: floor tables, "
                "menu & variants, kitchen display, manual inventory, and sales "
                "reports — with Bikram Sambat dates and multi-branch support."
            ),
            "icon": "Restaurant",
            "icon_asset": "RMS.png",
            "url": "https://rms.srotaapps.com",
            "screenshots": [],
            "features": [
                "Floor & table management with reservations",
                "Menu with variants, images and sold-out toggle",
                "Kitchen display board (New → Cooking → Ready → Served)",
                "Waiter order-taking on tablets",
                "Manual inventory with stock movement history",
                "Sales, category and staff performance reports",
            ],
            "display_order": 2,
            "is_active": True,
            "is_public": True,
        },
        {
            "code": "srota_ims",
            "slug": "srota-ims",
            "name": "Srota IMS",
            "tagline": "Inventory that stays in sync with the shop floor.",
            "description": (
                "Inventory management for retail and hospitality: SKU catalog, "
                "stock movements with restock and adjustment history, low-stock "
                "alerts, and multi-branch stock visibility."
            ),
            "icon": "Inventory",
            "icon_asset": "IMS.png",
            "url": "https://ims.srotaapps.com",
            "screenshots": [],
            "features": [
                "SKU catalog with unit and threshold per item",
                "Stock movements: restock, adjust, transfer",
                "Low-stock alerts per branch",
                "Movement audit trail with actor snapshot",
                "Multi-branch stock visibility",
            ],
            "display_order": 3,
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


def _ensure_apps_schema(db) -> None:
    """One-off idempotent column additions for the `apps` table. Base.create_all
    only creates missing tables — it never ALTERs existing ones — so any new
    columns added to the App model must be back-filled here. Uses Postgres's
    ADD COLUMN IF NOT EXISTS so re-running is a no-op."""
    db.execute(text(
        "ALTER TABLE public.apps "
        "ADD COLUMN IF NOT EXISTS icon_url VARCHAR(500)"
    ))
    db.commit()


def ensure_ims_products_schema() -> None:
    """Same back-fill pattern as _ensure_apps_schema, for the is_active
    column added to ims_products for soft-delete. Also drops the old plain
    unique constraint on (tenant_id, sku) if it still exists from before the
    partial-unique-index migration, so a soft-deleted product's SKU can be
    reused — IF EXISTS makes both statements safe to re-run."""
    db = SessionLocal()
    try:
        db.execute(text(
            "ALTER TABLE public.ims_products "
            "ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true"
        ))
        db.execute(text(
            "ALTER TABLE public.ims_products "
            "DROP CONSTRAINT IF EXISTS uq_ims_product_tenant_sku"
        ))
        db.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_ims_product_tenant_sku_active "
            "ON public.ims_products (tenant_id, sku) WHERE is_active = true"
        ))
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to backfill ims_products schema: {type(e).__name__}: {str(e)}")
        raise
    finally:
        db.close()


def ensure_ims_parties_schema() -> None:
    """Back-fill ON DELETE CASCADE onto ims_ledger_entries.party_id so a
    hard-deleted party (see IMSPartyService.delete) also removes its ledger
    entries at the DB level. Base.create_all doesn't ALTER existing FKs, so
    this drops and recreates the constraint — IF EXISTS/re-running is a
    no-op once the cascade is in place."""
    db = SessionLocal()
    try:
        db.execute(text(
            "ALTER TABLE public.ims_ledger_entries "
            "DROP CONSTRAINT IF EXISTS ims_ledger_entries_party_id_fkey"
        ))
        db.execute(text(
            "ALTER TABLE public.ims_ledger_entries "
            "ADD CONSTRAINT ims_ledger_entries_party_id_fkey "
            "FOREIGN KEY (party_id) REFERENCES public.ims_parties(id) ON DELETE CASCADE"
        ))
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to backfill ims_parties schema: {type(e).__name__}: {str(e)}")
        raise
    finally:
        db.close()


def ensure_ims_bs_date_schema() -> None:
    """Back-fill the date_bs mirror column onto ims_purchases and
    ims_stock_movements (added so Purchase Bills / Stock Movements can
    filter natively in Bikram Sambat, matching restro_order.placed_at_bs —
    see api/utils/bikram_sambat.py). Existing rows' date_bs can't be derived
    with a SQL constant like the other backfills here, so this adds the
    column nullable, converts each row's AD `date` in Python via
    to_bs_iso(), then sets NOT NULL — safe to re-run since the UPDATE only
    touches rows where date_bs IS NULL."""
    db = SessionLocal()
    try:
        db.execute(text(
            "ALTER TABLE public.ims_purchases ADD COLUMN IF NOT EXISTS date_bs VARCHAR(10)"
        ))
        db.execute(text(
            "ALTER TABLE public.ims_stock_movements ADD COLUMN IF NOT EXISTS date_bs VARCHAR(10)"
        ))
        db.commit()

        for table in ("ims_purchases", "ims_stock_movements"):
            rows = db.execute(text(
                f"SELECT id, date FROM public.{table} WHERE date_bs IS NULL"
            )).fetchall()
            for row in rows:
                bs = to_bs_iso(row.date) or ""
                db.execute(
                    text(f"UPDATE public.{table} SET date_bs = :bs WHERE id = :id"),
                    {"bs": bs, "id": row.id},
                )
            db.commit()

        db.execute(text(
            "ALTER TABLE public.ims_purchases ALTER COLUMN date_bs SET NOT NULL"
        ))
        db.execute(text(
            "ALTER TABLE public.ims_stock_movements ALTER COLUMN date_bs SET NOT NULL"
        ))
        db.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_ims_purchase_branch_date_bs "
            "ON public.ims_purchases (branch_id, date_bs)"
        ))
        db.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_ims_stock_movement_branch_date_bs "
            "ON public.ims_stock_movements (branch_id, date_bs)"
        ))
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to backfill ims BS date schema: {type(e).__name__}: {str(e)}")
        raise
    finally:
        db.close()


def ensure_ims_invoice_line_vat_schema() -> None:
    """Back-fill tax_rate/vat_amount onto ims_invoice_lines (added so a
    historical invoice's VAT can be recomputed from its own lines, matching
    IMSPurchaseLine's existing tax_rate/vat_amount columns — see
    IMSInvoiceLine's docstring). Existing rows predate per-line VAT
    snapshotting, so they back-fill to 0 rather than a guessed value — the
    header-level taxable_amount/vat_amount on ims_invoices is still correct
    and unaffected; only the per-line breakdown is unknown for old rows."""
    db = SessionLocal()
    try:
        db.execute(text(
            "ALTER TABLE public.ims_invoice_lines "
            "ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0"
        ))
        db.execute(text(
            "ALTER TABLE public.ims_invoice_lines "
            "ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(12,2) NOT NULL DEFAULT 0"
        ))
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to backfill ims_invoice_lines VAT schema: {type(e).__name__}: {str(e)}")
        raise
    finally:
        db.close()


def ensure_ims_variant_expiry_schema() -> None:
    """Back-fill the optional expiry_date column onto ims_variants (single
    date per variant, no batch/lot tracking — see IMSVariant's docstring)."""
    db = SessionLocal()
    try:
        db.execute(text(
            "ALTER TABLE public.ims_variants ADD COLUMN IF NOT EXISTS expiry_date DATE"
        ))
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to backfill ims_variants expiry schema: {type(e).__name__}: {str(e)}")
        raise
    finally:
        db.close()


def ensure_ims_fiscal_year_link_schema() -> None:
    """Back-fill fiscal_year_id onto ims_invoices and ims_purchases (see
    both models' docstrings) — a real FK so sales/purchases are directly
    filterable/joinable by fiscal year, instead of the fiscal year only
    ever appearing baked into the human-readable `number` string. Existing
    rows are resolved from their own date_bs via the same
    Shrawan-1-through-Ashad-end rule used for new rows, auto-creating any
    fiscal_years row that doesn't exist yet — safe to re-run since the
    UPDATE only touches rows where fiscal_year_id IS NULL."""
    from features.ims.nepali_date import fiscal_year_start_for_bs_date
    from shared_models import IMSFiscalYear

    db = SessionLocal()
    try:
        db.execute(text(
            "ALTER TABLE public.ims_invoices "
            "ADD COLUMN IF NOT EXISTS fiscal_year_id VARCHAR(36) "
            "REFERENCES public.ims_fiscal_years(id)"
        ))
        db.execute(text(
            "ALTER TABLE public.ims_purchases "
            "ADD COLUMN IF NOT EXISTS fiscal_year_id VARCHAR(36) "
            "REFERENCES public.ims_fiscal_years(id)"
        ))
        db.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_ims_invoice_fiscal_year "
            "ON public.ims_invoices (fiscal_year_id)"
        ))
        db.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_ims_purchase_fiscal_year "
            "ON public.ims_purchases (fiscal_year_id)"
        ))
        db.commit()

        # tenant_id + start_year -> fiscal_year_id, populated lazily as rows
        # are resolved below rather than pre-scanning every tenant.
        fy_cache: dict[tuple[str, int], str] = {}

        def resolve_fy_id(tenant_id: str, date_bs: str) -> str:
            start_year = fiscal_year_start_for_bs_date(date_bs)
            key = (tenant_id, start_year)
            if key in fy_cache:
                return fy_cache[key]
            fy = (
                db.query(IMSFiscalYear)
                .filter(IMSFiscalYear.tenant_id == tenant_id, IMSFiscalYear.start_year == start_year)
                .first()
            )
            if not fy:
                fy = IMSFiscalYear(tenant_id=tenant_id, start_year=start_year, is_active=False)
                db.add(fy)
                db.flush()
            fy_cache[key] = fy.id
            return fy.id

        for table in ("ims_invoices", "ims_purchases"):
            rows = db.execute(text(
                f"SELECT id, tenant_id, date_bs FROM public.{table} WHERE fiscal_year_id IS NULL"
            )).fetchall()
            for row in rows:
                fy_id = resolve_fy_id(row.tenant_id, row.date_bs)
                db.execute(
                    text(f"UPDATE public.{table} SET fiscal_year_id = :fy_id WHERE id = :id"),
                    {"fy_id": fy_id, "id": row.id},
                )
            db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to backfill ims fiscal year link schema: {type(e).__name__}: {str(e)}")
        raise
    finally:
        db.close()


def ensure_ims_branch_settings_qr_schema() -> None:
    """Back-fill the optional qr_image_url column onto ims_branch_settings
    (see IMSBranchSettings' docstring) — mirrors restro_branch_settings'
    existing qr_image_url column."""
    db = SessionLocal()
    try:
        db.execute(text(
            "ALTER TABLE public.ims_branch_settings "
            "ADD COLUMN IF NOT EXISTS qr_image_url VARCHAR(1000)"
        ))
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to backfill ims_branch_settings QR schema: {type(e).__name__}: {str(e)}")
        raise
    finally:
        db.close()


def seed_apps():
    db = SessionLocal()
    try:
        _ensure_apps_schema(db)
        for entry in _app_catalog():
            # icon_asset is a seed-time hint, not a DB column — strip before insert.
            db_entry = {k: v for k, v in entry.items() if k != "icon_asset"}
            existing = db.query(App).filter(App.code == entry["code"]).first()
            if existing:
                logger.info(f"App exists: {entry['code']}")
                continue

            app_row = App(**db_entry)
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


_DEFAULT_PLANS = [
    {"app_code": "srota_pms", "plan": "monthly", "price_npr": 2999, "label": "PMS Monthly"},
    {"app_code": "srota_pms", "plan": "yearly",  "price_npr": 11999, "label": "PMS Yearly"},
    {"app_code": "srota_rms", "plan": "monthly", "price_npr": 1299,  "label": "RMS Monthly"},
    {"app_code": "srota_rms", "plan": "yearly",  "price_npr": 6999,  "label": "RMS Yearly"},
    {"app_code": "srota_ims", "plan": "monthly", "price_npr": 1299,  "label": "IMS Monthly"},
    {"app_code": "srota_ims", "plan": "yearly",  "price_npr": 6999,  "label": "IMS Yearly"},
    {"app_code": "bundle",    "plan": "monthly", "price_npr": 4999,  "label": "Bundle Monthly (All Apps)"},
    {"app_code": "bundle",    "plan": "yearly",  "price_npr": 19999, "label": "Bundle Yearly (All Apps)"},
]


def seed_subscription_plans():
    from shared_models import SubscriptionPlan
    db = SessionLocal()
    try:
        for entry in _DEFAULT_PLANS:
            exists = (
                db.query(SubscriptionPlan)
                .filter(
                    SubscriptionPlan.app_code == entry["app_code"],
                    SubscriptionPlan.plan == entry["plan"],
                )
                .first()
            )
            if not exists:
                db.add(SubscriptionPlan(**entry))
        db.commit()
        logger.info("Subscription plans seeded")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to seed subscription plans: {type(e).__name__}: {str(e)}")
        raise
    finally:
        db.close()


def seed_app_icons():
    """Uploads each app's icon PNG from api/assets/ to MinIO at a stable key
    (platform/app-icons/{code}.png) and stores the resulting URL on the app
    row's `icon_url` column.

    Idempotent: skips upload when the app already has an `icon_url` pointing
    at our current public URL. Re-uploads if the URL is missing, points at a
    stale bucket/host (env change), or the asset is present but the DB row
    isn't tracking it yet."""
    db = SessionLocal()
    try:
        current_prefix = f"{settings.S3_PUBLIC_URL}/{settings.S3_BUCKET}/"
        for entry in _app_catalog():
            asset_name = entry.get("icon_asset")
            if not asset_name:
                continue
            asset_path = _ASSETS_DIR / asset_name
            if not asset_path.exists():
                logger.warning(f"App icon asset missing on disk: {asset_path}")
                continue

            app_row = db.query(App).filter(App.code == entry["code"]).first()
            if not app_row:
                logger.warning(f"App row not found for icon seed: {entry['code']}")
                continue

            key = f"platform/app-icons/{entry['code']}.png"
            expected_url = build_public_url(key)

            if app_row.icon_url == expected_url:
                logger.info(f"App icon up to date: {entry['code']}")
                continue

            with asset_path.open("rb") as fp:
                content = fp.read()
            uploaded_url = upload_file_at_key(key, content, "image/png")
            app_row.icon_url = uploaded_url
            db.commit()
            logger.info(f"App icon uploaded: {entry['code']} → {uploaded_url}")

    except Exception as e:
        db.rollback()
        logger.error(f"Failed to seed app icons: {type(e).__name__}: {str(e)}")
        # Don't re-raise — a missing/broken MinIO shouldn't block API startup.
        # Frontend falls back to the react-icons `icon` field when icon_url is null.
    finally:
        db.close()
