from pathlib import Path

from sqlalchemy import text

from core.database import SessionLocal, AdminSessionLocal
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
    db = AdminSessionLocal()
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
    db = AdminSessionLocal()
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
    db = AdminSessionLocal()
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
    db = AdminSessionLocal()
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
    db = AdminSessionLocal()
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

    db = AdminSessionLocal()
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
    db = AdminSessionLocal()
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


def ensure_restro_bill_code_schema() -> None:
    """Back-fill the bill_code column onto restro_orders — the printed/
    displayed bill number ("RMS-<branch code>-83/84-00005"). IRD: Electronic
    Billing Procedure 2082, clause 6.2ग requires the outlet's code appear in
    the bill number once a tenant has 2+ branches. bill_number itself (the
    plain Integer counter) is untouched — this is purely an additive display
    column, computed per-row from bill_number/fiscal_year/branches.code.
    Must run AFTER ensure_branch_code_schema (needs branches.code to exist).
    Safe to re-run — only touches rows where bill_code IS NULL."""
    from utils.bikram_sambat import format_invoice_number

    db = AdminSessionLocal()
    try:
        db.execute(text("ALTER TABLE public.restro_orders ADD COLUMN IF NOT EXISTS bill_code VARCHAR(50)"))
        db.commit()

        rows = db.execute(text(
            "SELECT o.id, o.bill_number, o.fiscal_year, o.is_credit_note, b.code AS branch_code "
            "FROM public.restro_orders o "
            "JOIN public.branches b ON b.id = o.branch_id "
            "WHERE o.bill_code IS NULL AND o.fiscal_year IS NOT NULL"
        )).fetchall()
        for row in rows:
            series = "RMS-CN" if row.is_credit_note else "RMS"
            code = format_invoice_number(series, row.fiscal_year, row.bill_number, row.branch_code)
            db.execute(
                text("UPDATE public.restro_orders SET bill_code = :code WHERE id = :id"),
                {"code": code, "id": row.id},
            )
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to backfill restro bill_code schema: {type(e).__name__}: {str(e)}")
        raise
    finally:
        db.close()


def ensure_branch_code_schema() -> None:
    """Back-fill the `code` column onto branches — IRD: Electronic Billing
    Procedure 2082, clause 6.2ग requires each billing outlet's code appear
    in a tenant's printed bill numbers once it has 2+ branches. Adds the
    column nullable, derives a code per existing row via the same
    derive_unique_code logic new branches use (processed one row at a time,
    tenant-ordered, so each newly-assigned code is visible to the next
    row's uniqueness check), then sets NOT NULL + the unique index. Safe to
    re-run — only touches rows where code IS NULL."""
    from features.branches.service import derive_unique_code

    db = AdminSessionLocal()
    try:
        db.execute(text("ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS code VARCHAR(10)"))
        db.commit()

        rows = db.execute(text(
            "SELECT id, tenant_id, name FROM public.branches WHERE code IS NULL ORDER BY tenant_id, created_at"
        )).fetchall()
        for row in rows:
            code = derive_unique_code(db, row.tenant_id, row.name)
            db.execute(
                text("UPDATE public.branches SET code = :code WHERE id = :id"),
                {"code": code, "id": row.id},
            )
            db.commit()

        db.execute(text("ALTER TABLE public.branches ALTER COLUMN code SET NOT NULL"))
        db.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_branch_tenant_code "
            "ON public.branches (tenant_id, code)"
        ))
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to backfill branch code schema: {type(e).__name__}: {str(e)}")
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
    db = AdminSessionLocal()
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
    db = AdminSessionLocal()
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
    """Adds all IRD Electronic Billing Procedure, 2082 columns (this
    supersedes the 2074 procedure — clause 12(ग) of the 2082 text repeals it
    outright; see docs/Srota_IRD_Compliance_Checklist.md) to restro_orders
    and ims_invoices. Safe to run repeatedly — uses ADD COLUMN IF NOT EXISTS."""
    db = AdminSessionLocal()
    try:
        # ── restro_orders ────────────────────────────────────────────────────
        restro_cols = [
            ("fiscal_year", "VARCHAR"),
            # IRD: simplified vs full VAT breakdown bill — display-only,
            # see shared_models/restro_order.py's kind column comment.
            ("kind", "VARCHAR"),
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
            # Annexure-5 Standard View fields — see shared_models/restro_order.py
            ("discount_amount", "NUMERIC(12,2)"),
            ("is_bill_printed", "BOOLEAN DEFAULT FALSE"),
            ("printed_time", "TIMESTAMP WITH TIME ZONE"),
            ("printed_by", "VARCHAR"),
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
            # Annexure-5 Standard View fields — see shared_models/ims_invoice.py
            ("is_bill_printed", "BOOLEAN DEFAULT FALSE"),
            ("printed_time", "TIMESTAMP WITH TIME ZONE"),
            ("printed_by", "VARCHAR"),
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


def ensure_org_tax_settings_schema() -> None:
    """org_tax_settings and cbms_sync_log (see shared_models/org_tax_settings.py
    and shared_models/cbms_sync_log.py) are BRAND NEW tables, unlike most of
    this file's other ensure_* functions — Base.metadata.create_all() (run
    once in main.py's lifespan, right before these ensure_* calls) already
    creates them from their model definitions, indexes included, since
    create_all only fails to ALTER existing tables, not create new ones.
    This function only does what create_all genuinely can't: drop the old
    per-app ims_cbms_credentials table these two superseded (had zero real
    rows at migration time, confirmed against the dev DB before removing
    it)."""
    db = AdminSessionLocal()
    try:
        db.execute(text("DROP TABLE IF EXISTS public.ims_cbms_credentials"))
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to drop legacy ims_cbms_credentials table: {type(e).__name__}: {str(e)}")
        raise
    finally:
        db.close()


# IRD: Electronic Billing Procedure 2082, clause 6.3घ — "transaction data
# already entered into the software must not be removable or modifiable,
# from either the front-end or the back-end." A REVOKE only means something
# if the app connects as a non-superuser role (superusers bypass all
# grants) — see ensure_app_role below.
#
# Each entry: table -> set of columns that legitimately change AFTER the
# row is first written (a follow-on event like a payment or a reprint —
# never the original billed facts: amounts, line items, seller/buyer, tax).
# UPDATE is revoked on the table entirely, then re-granted column-by-column
# for just these. Tables not listed here aren't transaction records (stock
# balances, catalog data, credentials, etc.) and keep full UPDATE/DELETE —
# only add a table here if it holds data an issued bill/order is built
# from and IRD's immutability rule should actually cover.
_IMMUTABLE_TABLES: dict[str, set[str]] = {
    "ims_invoices": {
        "paid_amount", "status", "is_bill_printed", "printed_time",
        "printed_by", "is_reprint", "reprint_number", "cbms_synced",
        "cbms_synced_at",
        # IMSInvoiceService.convert() — turning a saved quotation into a
        # real sale. A quotation isn't an issued bill yet (no IRD serial,
        # no VAT breakdown), so this conversion IS the actual point of
        # issuance — it just lands on the quotation's existing row instead
        # of a fresh INSERT. One-time, audited transition (see
        # AuditRepository.write in convert()), not an edit of an
        # already-issued bill's facts.
        "number", "kind", "gross_amount", "discount_amount", "taxable_amount",
        "exempt_amount", "vat_amount", "total_amount", "payment_method",
        "seller_name", "seller_address", "seller_pan",
    },
    "ims_invoice_lines": {"tax_rate", "vat_amount"},
    "ims_stock_movements": set(),
    "ims_ledger_entries": set(),
    "audit_log": set(),
}


def ensure_restro_immutability_trigger() -> None:
    """IRD: Electronic Billing Procedure 2082, clause 6.3घ — issued
    transaction data can't be modified from the back-end either. RMS's
    restro_orders can't use the simple column-GRANT approach IMS uses
    (see _IMMUTABLE_TABLES) because the SAME columns (status, totals,
    discount, ...) are legitimately written many times while an order is
    still status='draft' (cart-building), then must freeze permanently the
    instant it becomes 'paid' or 'cancelled' — Postgres column grants have
    no concept of "writable only in this row's current state". A
    BEFORE UPDATE trigger does: once OLD.status is 'paid' or 'cancelled',
    any attempt to change a column outside the explicit follow-on allowlist
    (print/reprint tracking, CBMS sync flags, updated_at) raises and aborts
    the whole UPDATE. restro_order_lines gets the same treatment via its
    parent order's status (a paid/cancelled order's lines never change).

    This is real row-level enforcement — even the DATABASE_ADMIN_URL
    superuser trips it (triggers apply regardless of role), which is
    stricter than the column-GRANT approach but matches what RMS's write
    pattern actually needs. Idempotent — CREATE OR REPLACE + drop-if-exists
    before creating the trigger itself, safe to re-run every startup."""
    db = AdminSessionLocal()
    try:
        db.execute(text("""
            CREATE OR REPLACE FUNCTION public.restro_orders_immutability() RETURNS trigger AS $$
            BEGIN
                IF TG_OP = 'DELETE' THEN
                    IF OLD.status IN ('paid', 'cancelled') THEN
                        RAISE EXCEPTION 'restro_orders: cannot delete an issued (paid/cancelled) order — IRD Electronic Billing Procedure 2082, clause 6.3घ'
                            USING ERRCODE = '23514';
                    END IF;
                    RETURN OLD;
                END IF;
                IF OLD.status IN ('paid', 'cancelled') THEN
                    IF NEW.status IS DISTINCT FROM OLD.status
                        OR NEW.kitchen_status IS DISTINCT FROM OLD.kitchen_status
                        OR NEW.bill_number IS DISTINCT FROM OLD.bill_number
                        OR NEW.bill_code IS DISTINCT FROM OLD.bill_code
                        OR NEW.fiscal_year IS DISTINCT FROM OLD.fiscal_year
                        OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
                        OR NEW.kind IS DISTINCT FROM OLD.kind
                        OR NEW.placed_at IS DISTINCT FROM OLD.placed_at
                        OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
                        OR NEW.settled_at IS DISTINCT FROM OLD.settled_at
                        OR NEW.placed_at_bs IS DISTINCT FROM OLD.placed_at_bs
                        OR NEW.paid_at_bs IS DISTINCT FROM OLD.paid_at_bs
                        OR NEW.settled_at_bs IS DISTINCT FROM OLD.settled_at_bs
                        OR NEW.discount_type IS DISTINCT FROM OLD.discount_type
                        OR NEW.discount_value IS DISTINCT FROM OLD.discount_value
                        OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
                        OR NEW.subtotal_amount IS DISTINCT FROM OLD.subtotal_amount
                        OR NEW.taxable_amount IS DISTINCT FROM OLD.taxable_amount
                        OR NEW.exempt_amount IS DISTINCT FROM OLD.exempt_amount
                        OR NEW.vat_amount IS DISTINCT FROM OLD.vat_amount
                        OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
                        OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
                        OR NEW.seller_name IS DISTINCT FROM OLD.seller_name
                        OR NEW.seller_address IS DISTINCT FROM OLD.seller_address
                        OR NEW.seller_pan IS DISTINCT FROM OLD.seller_pan
                        OR NEW.buyer_name IS DISTINCT FROM OLD.buyer_name
                        OR NEW.buyer_pan IS DISTINCT FROM OLD.buyer_pan
                        OR NEW.waiter_name IS DISTINCT FROM OLD.waiter_name
                        OR NEW.waiter_cred_id IS DISTINCT FROM OLD.waiter_cred_id
                        OR NEW.delivery_status IS DISTINCT FROM OLD.delivery_status
                        OR NEW.is_credit_note IS DISTINCT FROM OLD.is_credit_note
                        OR NEW.original_order_id IS DISTINCT FROM OLD.original_order_id
                        OR NEW.note_reason IS DISTINCT FROM OLD.note_reason
                        OR NEW.table_id IS DISTINCT FROM OLD.table_id
                    THEN
                        RAISE EXCEPTION 'restro_orders: cannot modify an issued (paid/cancelled) order — IRD Electronic Billing Procedure 2082, clause 6.3घ'
                            USING ERRCODE = '23514';
                    END IF;
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        """))
        db.execute(text(
            "DROP TRIGGER IF EXISTS trg_restro_orders_immutability ON public.restro_orders"
        ))
        db.execute(text("""
            CREATE TRIGGER trg_restro_orders_immutability
            BEFORE UPDATE OR DELETE ON public.restro_orders
            FOR EACH ROW EXECUTE FUNCTION public.restro_orders_immutability();
        """))

        db.execute(text("""
            CREATE OR REPLACE FUNCTION public.restro_order_lines_immutability() RETURNS trigger AS $$
            DECLARE
                parent_status varchar;
            BEGIN
                SELECT status INTO parent_status FROM public.restro_orders WHERE id = OLD.order_id;
                IF parent_status IN ('paid', 'cancelled') THEN
                    IF TG_OP = 'DELETE' THEN
                        RAISE EXCEPTION 'restro_order_lines: cannot delete a line on an issued (paid/cancelled) order — IRD Electronic Billing Procedure 2082, clause 6.3घ'
                            USING ERRCODE = '23514';
                    END IF;
                    RAISE EXCEPTION 'restro_order_lines: cannot modify a line on an issued (paid/cancelled) order — IRD Electronic Billing Procedure 2082, clause 6.3घ'
                        USING ERRCODE = '23514';
                END IF;
                IF TG_OP = 'DELETE' THEN
                    RETURN OLD;
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        """))
        db.execute(text(
            "DROP TRIGGER IF EXISTS trg_restro_order_lines_immutability ON public.restro_order_lines"
        ))
        db.execute(text("""
            CREATE TRIGGER trg_restro_order_lines_immutability
            BEFORE UPDATE OR DELETE ON public.restro_order_lines
            FOR EACH ROW EXECUTE FUNCTION public.restro_order_lines_immutability();
        """))
        db.commit()
        logger.info("restro_orders/restro_order_lines immutability triggers ready")
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to create restro immutability triggers: {type(e).__name__}: {str(e)}")
        raise
    finally:
        db.close()


def ensure_app_role() -> None:
    """Creates (or updates the password of) the restricted DATABASE_URL
    role the app actually connects as for request traffic, and applies
    _IMMUTABLE_TABLES' column-level UPDATE grants. Runs every startup via
    the admin (superuser) connection — idempotent, safe to re-run; also
    what picks up a newly-added table in _IMMUTABLE_TABLES on the next
    deploy without a separate manual migration step.

    Scoped to IMS's tables only for now — RMS's restro_orders/lines follow
    a different write pattern (fields are first written at mark-paid time,
    not at row creation) and need their own analysis before being added
    here, not a copy of IMS's column list."""
    if not settings.DATABASE_APP_PASSWORD:
        logger.warning(
            "DATABASE_APP_PASSWORD not set — skipping restricted app role "
            "setup. The app will keep connecting as the superuser "
            "(DATABASE_URL), so IRD's back-end immutability requirement "
            "isn't actually enforced yet. Set DATABASE_APP_PASSWORD and "
            "point DATABASE_URL at DATABASE_APP_USER to fix."
        )
        return

    user = settings.DATABASE_APP_USER
    # CREATE ROLE / ALTER ROLE are DDL — Postgres doesn't support bind
    # parameters for them (confirmed: PREPARE rejects a param there), so
    # the password has to be inlined as a SQL string literal. quote_literal
    # via a throwaway SELECT is the standard safe way to escape it (handles
    # embedded quotes/backslashes) rather than hand-rolling .replace("'", "''").
    db = AdminSessionLocal()
    try:
        quoted_pw = db.execute(
            text("SELECT quote_literal(:pw)"), {"pw": settings.DATABASE_APP_PASSWORD}
        ).scalar()

        exists = db.execute(
            text("SELECT 1 FROM pg_roles WHERE rolname = :user"), {"user": user}
        ).scalar()
        if exists:
            # ALTER ROLE ... PASSWORD is idempotent to re-run (just resets
            # to the same value) and picks up a rotated DATABASE_APP_PASSWORD.
            db.execute(text(f'ALTER ROLE "{user}" WITH LOGIN PASSWORD {quoted_pw}'))
        else:
            db.execute(text(f'CREATE ROLE "{user}" WITH LOGIN PASSWORD {quoted_pw}'))
        db.commit()

        db.execute(text(f'GRANT USAGE ON SCHEMA public TO "{user}"'))
        # Broad baseline: everything not in _IMMUTABLE_TABLES keeps normal
        # read/write. Re-run every startup so a brand-new table (created
        # moments ago by create_all) is immediately writable — Postgres
        # GRANTs don't apply retroactively to tables that didn't exist yet.
        db.execute(text(f'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "{user}"'))
        db.commit()

        for table, mutable_cols in _IMMUTABLE_TABLES.items():
            db.execute(text(f'REVOKE UPDATE, DELETE ON public."{table}" FROM "{user}"'))
            if mutable_cols:
                cols = ", ".join(f'"{c}"' for c in sorted(mutable_cols))
                db.execute(text(f'GRANT UPDATE ({cols}) ON public."{table}" TO "{user}"'))
        db.commit()
        logger.info(
            f"App role '{user}' ready — UPDATE/DELETE revoked on "
            f"{len(_IMMUTABLE_TABLES)} transaction table(s), "
            f"column-level UPDATE re-granted where legitimately needed."
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to ensure app DB role: {type(e).__name__}: {str(e)}")
        raise
    finally:
        db.close()


def seed_apps():
    # Uses the admin session (not the restricted app role) because this
    # calls _ensure_apps_schema(db) first, which runs ALTER TABLE — the
    # inserts that follow work fine under either session, but splitting
    # one function across two DB connections isn't worth it here.
    db = AdminSessionLocal()
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
    # {"app_code": "srota_pms", "plan": "monthly", "price_npr": 2999, "label": "PMS Monthly"},
    # {"app_code": "srota_pms", "plan": "yearly",  "price_npr": 11999, "label": "PMS Yearly"},
    {"app_code": "srota_rms", "plan": "monthly", "price_npr": 1299,  "label": "RMS Monthly"},
    {"app_code": "srota_rms", "plan": "yearly",  "price_npr": 6999,  "label": "RMS Yearly"},
    {"app_code": "srota_ims", "plan": "monthly", "price_npr": 1699,  "label": "IMS Monthly"},
    {"app_code": "srota_ims", "plan": "yearly",  "price_npr": 7999,  "label": "IMS Yearly"},
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
