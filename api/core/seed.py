from pathlib import Path

from sqlalchemy import text

from core.database import SessionLocal
from core.configs import settings
from core.security import hash_password
from core.storage import upload_file_at_key, build_public_url, object_exists
from shared_models import PlatformAdmin, App
from utils.bikram_sambat import to_bs_iso
from utils.logger import logger


# Path to the on-disk assets directory. Bundled into the api/ image at build
# time, so this resolves inside the container as /app/assets.
_ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"


def _app_catalog() -> list[dict]:
    """The `icon_asset`/`thumbnail_asset` keys name PNGs in api/assets/ that
    get uploaded to MinIO on startup (see seed_app_icons). Neither is
    persisted to the DB — the resulting public URLs land in the app row's
    `icon_url`/`thumbnail_url` columns.

    Srota PMS is deliberately left out of the catalog for now — we're only
    working with RMS and IMS. Re-add it here (with icon_asset: "PMS.png",
    already on disk) when PMS work resumes."""
    return [
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
            "thumbnail_asset": "rms-thumbnail.png",
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
            "display_order": 1,
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
            "thumbnail_asset": "ims-thumbnail.png",
            "url": "https://ims.srotaapps.com",
            "screenshots": [],
            "features": [
                "SKU catalog with unit and threshold per item",
                "Stock movements: restock, adjust, transfer",
                "Low-stock alerts per branch",
                "Movement audit trail with actor snapshot",
                "Multi-branch stock visibility",
            ],
            "display_order": 2,
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
    db.execute(text(
        "ALTER TABLE public.apps "
        "ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(500)"
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


def backfill_branch_settings_vat_mismatch() -> None:
    """One-time data correction, not a schema change: create_default() on
    both ims_branch_settings and restro_branch_settings used to hardcode
    vat_enabled=True regardless of the owning tenant's real VAT registration
    (fixed to seed from tenants.is_vat_registered — see
    IMSBranchSettingsService.get_or_create / BranchSettingsService.get_or_create).
    Any row auto-provisioned before that fix is stuck with vat_enabled=true
    for a PAN-only tenant, which leaks VAT fields/math into the product,
    purchase and sales UIs for a business that was never VAT-registered.
    Idempotent — only touches rows that are actually wrong, safe to run
    every startup."""
    db = SessionLocal()
    try:
        for table in ("ims_branch_settings", "restro_branch_settings"):
            result = db.execute(text(
                f"UPDATE public.{table} bs "
                "SET vat_enabled = false "
                "FROM public.tenants t "
                "WHERE bs.tenant_id = t.id "
                "AND bs.vat_enabled = true "
                "AND t.is_vat_registered = false"
            ))
            if result.rowcount:
                logger.info(f"Corrected {result.rowcount} stale vat_enabled row(s) in {table}")
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to backfill branch settings VAT mismatch: {type(e).__name__}: {str(e)}")
        raise
    finally:
        db.close()


def ensure_tenants_free_app_schema() -> None:
    """The 'pick one free app during onboarding' model was replaced by
    independent per-app trials (each starts on that app's first credential
    — see SubscriptionService.start_trial_if_needed), so tenants.free_app_code
    is dead. This drops it if an earlier deploy already added it — safe to
    run even if the column was never there (IF EXISTS)."""
    db = SessionLocal()
    try:
        db.execute(text(
            "ALTER TABLE public.tenants "
            "DROP COLUMN IF EXISTS free_app_code"
        ))
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to drop tenants free_app_code column: {type(e).__name__}: {str(e)}")
        raise
    finally:
        db.close()


def ensure_subscription_payments_group_schema() -> None:
    """Back-fills subscription_payments.group_id (bundle purchases share one
    group_id across N per-app rows — see SubscriptionPayment's docstring)
    and drops the old CHECK constraints that still allowed plan='bundle'
    from the original fixed-bundle-SKU design, replacing them with the
    current ones (no 'bundle' plan value anymore). Table has no real rows
    yet in any deployed environment, so no data backfill is needed for
    group_id itself — existing (test) rows get group_id = their own id."""
    db = SessionLocal()
    try:
        db.execute(text(
            "ALTER TABLE public.subscription_payments "
            "ADD COLUMN IF NOT EXISTS group_id VARCHAR"
        ))
        db.execute(text(
            "UPDATE public.subscription_payments SET group_id = id WHERE group_id IS NULL"
        ))
        db.execute(text(
            "ALTER TABLE public.subscription_payments ALTER COLUMN group_id SET NOT NULL"
        ))
        db.execute(text(
            "DROP INDEX IF EXISTS ix_public_subscription_payments_group_id"
        ))
        db.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_public_subscription_payments_group_id "
            "ON public.subscription_payments (group_id)"
        ))
        db.execute(text(
            "ALTER TABLE public.subscription_payments "
            "DROP CONSTRAINT IF EXISTS ck_subscription_payments_plan"
        ))
        db.execute(text(
            "ALTER TABLE public.subscription_payments "
            "ADD CONSTRAINT ck_subscription_payments_plan CHECK (plan IN ('monthly','yearly'))"
        ))
        db.execute(text(
            "ALTER TABLE public.app_subscriptions "
            "DROP CONSTRAINT IF EXISTS ck_app_subscriptions_plan"
        ))
        db.execute(text(
            "ALTER TABLE public.app_subscriptions "
            "ADD CONSTRAINT ck_app_subscriptions_plan CHECK (plan IS NULL OR plan IN ('monthly','yearly'))"
        ))
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to backfill subscription_payments group schema: {type(e).__name__}: {str(e)}")
        raise
    finally:
        db.close()


def ensure_ird_schema() -> None:
    """Adds all IRD Electronic Billing Procedure 2074 columns to restro_orders
    and ims_invoices. Safe to run repeatedly — uses ADD COLUMN IF NOT EXISTS."""
    db = SessionLocal()
    try:
        # ── restro_orders ────────────────────────────────────────────────────
        restro_cols = [
            ("fiscal_year", "VARCHAR"),
            ("subtotal_amount", "NUMERIC(12,2) DEFAULT 0"),
            ("taxable_amount", "NUMERIC(12,2) DEFAULT 0"),
            ("exempt_amount", "NUMERIC(12,2) DEFAULT 0"),
            ("vat_amount", "NUMERIC(12,2) DEFAULT 0"),
            ("total_amount", "NUMERIC(12,2) DEFAULT 0"),
            ("seller_name", "VARCHAR"),
            ("seller_address", "VARCHAR"),
            ("seller_pan", "VARCHAR"),
            ("buyer_name", "VARCHAR"),
            ("buyer_pan", "VARCHAR"),
            ("is_reprint", "BOOLEAN DEFAULT FALSE"),
            ("reprint_of", "VARCHAR"),
            ("reprint_number", "INTEGER"),
            # How many times this bill has actually been printed — 1 after
            # the first print (original, no watermark), >1 means every print
            # from then on must show "COPY OF ORIGINAL" (see order_service.py
            # register_print). Simpler than is_reprint/reprint_of above,
            # which assume a new row per reprint — bill_number is a plain
            # sequential Integer here (unlike IMS/PMS's formatted string
            # invoice_number), so it can't carry a "/Copy-1" suffix without
            # either breaking the UNIQUE(branch, fiscal_year, bill_number)
            # constraint or a bigger schema change. Those legacy columns are
            # kept for forward-compat but print_count is the real mechanism.
            ("print_count", "INTEGER DEFAULT 0"),
            ("is_credit_note", "BOOLEAN DEFAULT FALSE"),
            ("original_order_id", "VARCHAR"),
            ("note_reason", "TEXT"),
            ("cbms_synced", "BOOLEAN DEFAULT FALSE"),
            ("cbms_synced_at", "TIMESTAMP"),
        ]
        for col, col_type in restro_cols:
            db.execute(text(
                f"ALTER TABLE public.restro_orders ADD COLUMN IF NOT EXISTS {col} {col_type}"
            ))

        # ── ims_invoices ─────────────────────────────────────────────────────
        ims_cols = [
            ("seller_name", "VARCHAR"),
            ("seller_address", "VARCHAR"),
            ("seller_pan", "VARCHAR"),
            ("buyer_name", "VARCHAR"),
            ("buyer_pan", "VARCHAR"),
            ("buyer_address", "VARCHAR"),
            ("is_reprint", "BOOLEAN DEFAULT FALSE"),
            ("reprint_of", "VARCHAR"),
            ("reprint_number", "INTEGER"),
            ("is_credit_note", "BOOLEAN DEFAULT FALSE"),
            ("original_invoice_id", "VARCHAR"),
            ("note_reason", "TEXT"),
            ("cbms_synced", "BOOLEAN DEFAULT FALSE"),
            ("cbms_synced_at", "TIMESTAMP"),
        ]
        for col, col_type in ims_cols:
            db.execute(text(
                f"ALTER TABLE public.ims_invoices ADD COLUMN IF NOT EXISTS {col} {col_type}"
            ))

        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to backfill IRD schema: {type(e).__name__}: {str(e)}")
        raise
    finally:
        db.close()


def ensure_ims_cbms_schema() -> None:
    """Creates ims_cbms_credentials table if it doesn't exist (CREATE TABLE IF NOT EXISTS).
    Also adds cbms_synced_at to ims_invoices if missing."""
    db = SessionLocal()
    try:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS public.ims_cbms_credentials (
                id VARCHAR(36) PRIMARY KEY,
                tenant_id VARCHAR(36) NOT NULL UNIQUE,
                ird_username VARCHAR(255) NOT NULL,
                ird_password VARCHAR(255) NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))
        db.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_ims_cbms_credentials_tenant "
            "ON public.ims_cbms_credentials (tenant_id)"
        ))
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to ensure ims_cbms_credentials schema: {type(e).__name__}: {str(e)}")
        raise
    finally:
        db.close()


def seed_apps():
    db = SessionLocal()
    try:
        _ensure_apps_schema(db)
        for entry in _app_catalog():
            # icon_asset/thumbnail_asset are seed-time hints, not DB columns —
            # strip before insert.
            db_entry = {
                k: v for k, v in entry.items()
                if k not in ("icon_asset", "thumbnail_asset")
            }
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
]

# Default % knocked off the summed individual prices when a tenant buys 2+
# apps together in one purchase (see SubscriptionService.price_selection).
# Superadmin-editable afterward — this is only the seed default.
_DEFAULT_BUNDLE_DISCOUNT_PERCENT = "20"


def seed_subscription_plans():
    from shared_models import SubscriptionPlan, PlatformSetting
    db = SessionLocal()
    try:
        # 'bundle' was an earlier design's fixed SKU — no longer a real
        # app_code (bundles are now computed, see SubscriptionPlan's
        # docstring). Remove any leftover rows from that design.
        db.query(SubscriptionPlan).filter(SubscriptionPlan.app_code == "bundle").delete()

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

        if not db.query(PlatformSetting).filter(PlatformSetting.key == "bundle_discount_percent").first():
            db.add(PlatformSetting(key="bundle_discount_percent", value=_DEFAULT_BUNDLE_DISCOUNT_PERCENT))

        db.commit()
        logger.info("Subscription plans seeded")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to seed subscription plans: {type(e).__name__}: {str(e)}")
        raise
    finally:
        db.close()


def _seed_app_asset(db, entry: dict, asset_key: str, url_column: str, key_prefix: str) -> None:
    """Shared upload logic for one app-catalog asset (icon or thumbnail).
    Uploads api/assets/{entry[asset_key]} to MinIO at a stable key
    ({key_prefix}/{code}.png) and stores the resulting URL on the app row's
    `url_column`. Idempotent — skips when the row already points at the
    current public URL; re-uploads on a missing/stale URL."""
    asset_name = entry.get(asset_key)
    if not asset_name:
        return
    asset_path = _ASSETS_DIR / asset_name
    if not asset_path.exists():
        logger.warning(f"App asset missing on disk ({asset_key}): {asset_path}")
        return

    app_row = db.query(App).filter(App.code == entry["code"]).first()
    if not app_row:
        logger.warning(f"App row not found for asset seed: {entry['code']}")
        return

    key = f"{key_prefix}/{entry['code']}.png"
    expected_url = build_public_url(key)

    if getattr(app_row, url_column) == expected_url:
        logger.info(f"App {asset_key} up to date: {entry['code']}")
        return

    with asset_path.open("rb") as fp:
        content = fp.read()
    uploaded_url = upload_file_at_key(key, content, "image/png")
    setattr(app_row, url_column, uploaded_url)
    db.commit()
    logger.info(f"App {asset_key} uploaded: {entry['code']} → {uploaded_url}")


def seed_app_icons():
    """Uploads each app's icon and thumbnail PNGs from api/assets/ to MinIO
    (platform/app-icons/{code}.png, platform/app-thumbnails/{code}.png) and
    stores the resulting URLs on the app row's `icon_url`/`thumbnail_url`
    columns.

    Idempotent: skips upload when the app already has a URL pointing at our
    current public URL. Re-uploads if the URL is missing, points at a stale
    bucket/host (env change), or the asset is present but the DB row isn't
    tracking it yet."""
    db = SessionLocal()
    try:
        for entry in _app_catalog():
            _seed_app_asset(db, entry, "icon_asset", "icon_url", "platform/app-icons")
            _seed_app_asset(db, entry, "thumbnail_asset", "thumbnail_url", "platform/app-thumbnails")

    except Exception as e:
        db.rollback()
        logger.error(f"Failed to seed app icons: {type(e).__name__}: {str(e)}")
        # Don't re-raise — a missing/broken MinIO shouldn't block API startup.
        # Frontend falls back to the react-icons `icon` field when icon_url is null.
    finally:
        db.close()


# Path to Zestro/RMS's default-menu seed images. Same "images are bundled
# assets, not DB rows" pattern as _ASSETS_DIR, just a different directory —
# these are per-feature (features/restro/) rather than platform-wide.
_RMS_MENU_SEED_IMAGES_DIR = (
    Path(__file__).resolve().parent.parent / "features" / "restro" / "menu_seed_images"
)
_RMS_MENU_SEED_IMAGE_PREFIX = "platform/menu-seed-images"

_MENU_SEED_IMAGE_MIME = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


def seed_menu_seed_images() -> None:
    """Uploads every image under features/restro/menu_seed_images/ to MinIO
    ONCE at a stable, shared key (platform/menu-seed-images/{relative-path})
    — not per-tenant, not per-branch. Every new RMS branch's default-menu
    seed then just builds the URL for these pre-uploaded images instead of
    re-uploading identical bytes on every signup.

    Why this exists: menu_seeder.py used to call storage.upload_file() once
    per seeded item (19 items) synchronously inside the request that seeds a
    fresh branch's menu — 19 sequential MinIO round-trips under a Postgres
    advisory lock, which is what was making a brand-new RMS account's menu
    take 10-15s to appear. Uploading the (fixed, shared) image set once at
    API startup instead makes the per-branch seed a pure DB write — fast
    enough to finish inside the request that triggers it.

    Idempotent via object_exists() — skips any image already in MinIO, so
    a normal restart does zero uploads. Never raises: a missing MinIO or a
    partial image set shouldn't block API startup; menu_seeder.py falls
    back to seeding the item without an image if its key isn't present."""
    if not _RMS_MENU_SEED_IMAGES_DIR.exists():
        return

    uploaded = 0
    skipped = 0
    for path in sorted(_RMS_MENU_SEED_IMAGES_DIR.rglob("*")):
        if not path.is_file() or path.name.lower() == "readme.md":
            continue
        rel_path = path.relative_to(_RMS_MENU_SEED_IMAGES_DIR).as_posix()
        key = f"{_RMS_MENU_SEED_IMAGE_PREFIX}/{rel_path}"

        try:
            if object_exists(key):
                skipped += 1
                continue
            mime = _MENU_SEED_IMAGE_MIME.get(path.suffix.lower())
            if not mime:
                logger.warning(f"Menu seed image has unsupported extension, skipping: {rel_path}")
                continue
            with path.open("rb") as fp:
                content = fp.read()
            upload_file_at_key(key, content, mime)
            uploaded += 1
        except Exception as e:
            logger.error(f"Failed to seed menu image {rel_path}: {type(e).__name__}: {str(e)}")
            # Keep going — one bad image shouldn't block the rest or API startup.

    if uploaded:
        logger.info(f"Menu seed images uploaded: {uploaded} (already present: {skipped})")


def menu_seed_image_url(relative_path: str) -> str:
    """Public URL for a pre-uploaded menu seed image (see
    seed_menu_seed_images). Pure string-building — no I/O — safe to call
    per seeded item without a network round-trip."""
    return build_public_url(f"{_RMS_MENU_SEED_IMAGE_PREFIX}/{relative_path}")
