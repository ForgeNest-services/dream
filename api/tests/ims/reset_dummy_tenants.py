"""Resets the two dummy IMS tenants' DATA (categories, products, purchases,
etc.) back to empty, WITHOUT deleting the tenants/branches/credentials
themselves -- those come from seed_dummy_tenants.py and login tokens depend
on them staying stable across test runs.

Run this before re-running the full ordered test suite from scratch (each
test file intentionally leaves real state behind for the next file to build
on, so a second full run collides with the first run's leftovers unless
reset first).

Usage (inside the api container, same as seed_dummy_tenants.py):
    docker exec srota-api python /app/tests/ims/reset_dummy_tenants.py

Scoped strictly to the two known dummy tenant/branch IDs read from
dummy_tenants.json -- never touches any other tenant's data. Deletion order
verified against the real FK graph (information_schema + pg_constraint's
confdeltype), not assumed.

IMPORTANT: trg_ims_invoices_delete_guard (a real DB trigger, mirroring
RMS's order immutability triggers) permits deleting an ims_invoices row
ONLY when kind='quotation' -- a real invoice (kind='sale'/'credit_note') is
permanently undeletable, same principle as RMS's paid/cancelled orders.
This script only clears quotations and reports how many real invoices it's
leaving in place; it does not (and should not) try to work around the
trigger.

Every other ims_* FK uses ON DELETE RESTRICT (confdeltype='a'), not
CASCADE -- ims_variants/ims_variant_stock/ims_stock_movements/
ims_invoice_lines/ims_purchase_lines all block deleting a still-referenced
product/variant/invoice/purchase, so this script deletes leaf-first in the
verified real order below (only ims_invoice_lines->ims_invoices,
ims_ledger_entries->ims_parties, and ims_purchase_lines->ims_purchases are
CASCADE; everything else needs an explicit delete).

ALSO IMPORTANT: ims_stock_movements and ims_ledger_entries both have
ZERO mutable columns in core/seed.py's _IMMUTABLE_TABLES -- UPDATE/DELETE
are fully revoked for the app's own DB role, correctly (both tables are
genuinely append-only in real app code; confirmed via grep, no delete path
exists for either). Since product creation with initial_stock > 0 always
writes a stock movement, this means most real products/variants are
permanently un-hard-deletable via this script, the same way RMS's tables
referenced by a paid order are -- this script only deletes
products/variants with NO movement history and reports how many it
leaves in place."""
import sys
import json
import uuid
sys.path.insert(0, "/app")
import main  # noqa: F401

from sqlalchemy import text
from core.database import SessionLocal
from shared_models import IMSInvoice, IMSInvoiceSerial
from utils.bikram_sambat import fiscal_year_from_ad

_DUMMY_TENANTS_PATH = "/app/tests/ims/dummy_tenants.json"

# Draft-only (quotation) invoice cleanup -- child-first, mirroring RMS's
# draft-order-only reset. Real invoices (kind != 'quotation') are left in
# place; trg_ims_invoices_delete_guard would reject deleting them anyway.
_DELETE_QUOTATION_INVOICE_LINES_SQL = """
    DELETE FROM public.ims_invoice_lines
    WHERE invoice_id IN (
        SELECT id FROM public.ims_invoices WHERE tenant_id = ANY(:ids) AND kind = 'quotation'
    )
"""
_DELETE_QUOTATION_INVOICES_SQL = """
    DELETE FROM public.ims_invoices WHERE tenant_id = ANY(:ids) AND kind = 'quotation'
"""
_COUNT_REAL_INVOICES_SQL = """
    SELECT count(*) FROM public.ims_invoices WHERE tenant_id = ANY(:ids) AND kind != 'quotation'
"""

# Purchases have no immutability trigger (they're not IRD-regulated sales
# documents) -- safe to delete unconditionally, lines cascade automatically.
_DELETE_PURCHASES_SQL = "DELETE FROM public.ims_purchases WHERE tenant_id = ANY(:ids)"

# ims_ledger_entries has debit/credit UPDATE and table-level DELETE
# specifically re-granted in core/seed.py (a real, previously-broken
# production bug fixed this session: IMSPartyService.update() corrects a
# party's "Opening balance" entry in place via IMSLedgerRepository
# .update/.delete -- this is NOT dead code, it just had no grant to
# actually run). This script still never deletes ims_ledger_entries
# directly, though -- it deletes parties and lets the real
# ims_ledger_entries_party_id_fkey CASCADE (confdeltype='c') remove their
# ledger rows, same as the app's own party-delete path does.
#
# A party still referenced by a real (non-quotation) invoice's customer_id
# is RESTRICT-blocked (confdeltype='a', no cascade) -- same
# permanently-undeletable-once-referenced pattern as everything else here.
_DELETE_PARTIES_SQL = """
    DELETE FROM public.ims_parties
    WHERE tenant_id = ANY(:ids)
      AND id NOT IN (SELECT DISTINCT customer_id FROM public.ims_invoices WHERE customer_id IS NOT NULL)
"""

# ims_stock_movements is in _IMMUTABLE_TABLES with zero mutable columns
# (core/seed.py) -- UPDATE/DELETE fully revoked, correctly: real app code
# only ever appends via IMSMovementRepository.create (confirmed via a full
# grep of every caller -- no delete path exists). This means ANY variant
# that has ever had initial_stock/a restock/an adjustment -- i.e. nearly
# every real variant, since product creation itself writes one whenever
# initial_stock > 0 -- is now permanently un-hard-deletable, via the same
# FK RESTRICT chain (ims_stock_movements -> ims_variants/ims_products).
# Mirrors RMS's "a table referenced by a paid order becomes permanently
# undeletable" situation exactly. This script therefore only deletes
# variants/products/categories/brands that have NO stock-movement history
# at all, and reports how many it's leaving in place -- it does not (and
# should not) try to work around the missing grant.
_DELETE_VARIANT_STOCK_FOR_UNMOVED_VARIANTS_SQL = """
    DELETE FROM public.ims_variant_stock
    WHERE variant_id IN (
        SELECT v.id FROM public.ims_variants v
        JOIN public.ims_products p ON p.id = v.product_id
        WHERE p.tenant_id = ANY(:ids)
          AND v.id NOT IN (SELECT DISTINCT variant_id FROM public.ims_stock_movements)
    )
"""
_DELETE_UNMOVED_VARIANTS_SQL = """
    DELETE FROM public.ims_variants
    WHERE product_id IN (SELECT id FROM public.ims_products WHERE tenant_id = ANY(:ids))
      AND id NOT IN (SELECT DISTINCT variant_id FROM public.ims_stock_movements)
"""
_COUNT_MOVED_VARIANTS_SQL = """
    SELECT count(*) FROM public.ims_variants v
    JOIN public.ims_products p ON p.id = v.product_id
    WHERE p.tenant_id = ANY(:ids)
      AND v.id IN (SELECT DISTINCT variant_id FROM public.ims_stock_movements)
"""
# A product with ANY surviving variant (moved or otherwise still present,
# e.g. one sibling variant has history but another doesn't and wasn't
# deleted for some other reason) can't be deleted either -- only delete
# products with zero variants left after the above.
_DELETE_PRODUCTS_WITH_NO_VARIANTS_LEFT_SQL = """
    DELETE FROM public.ims_products
    WHERE tenant_id = ANY(:ids)
      AND id NOT IN (SELECT DISTINCT product_id FROM public.ims_variants)
"""
_DELETE_CATEGORIES_SQL = """
    DELETE FROM public.ims_categories
    WHERE tenant_id = ANY(:ids)
      AND id NOT IN (SELECT DISTINCT category_id FROM public.ims_products WHERE category_id IS NOT NULL)
"""
_DELETE_BRANDS_SQL = """
    DELETE FROM public.ims_brands
    WHERE tenant_id = ANY(:ids)
      AND id NOT IN (SELECT DISTINCT brand_id FROM public.ims_products WHERE brand_id IS NOT NULL)
"""
# A surviving (moved) variant's unit_id/purchase_unit_id FK blocks
# deleting that unit -- same "unreferenced only" pattern as everything else
# above, since units are auto-seeded on demand and cheap to recreate.
_DELETE_UNITS_SQL = """
    DELETE FROM public.ims_units
    WHERE tenant_id = ANY(:ids)
      AND id NOT IN (
          SELECT unit_id FROM public.ims_variants WHERE unit_id IS NOT NULL
          UNION
          SELECT purchase_unit_id FROM public.ims_variants WHERE purchase_unit_id IS NOT NULL
      )
"""
_DELETE_MEDIA_SQL = "DELETE FROM public.ims_media WHERE tenant_id = ANY(:ids)"
# A fiscal year still referenced by a real (non-quotation, permanently
# undeletable) invoice's fiscal_year_id is RESTRICT-blocked -- same pattern
# as parties above. Purchases also FK into this table, but they're deleted
# unconditionally earlier in this script, so only surviving invoices can
# still be holding a fiscal year in place by this point.
_DELETE_FISCAL_YEARS_SQL = """
    DELETE FROM public.ims_fiscal_years
    WHERE tenant_id = ANY(:ids)
      AND id NOT IN (SELECT DISTINCT fiscal_year_id FROM public.ims_invoices WHERE fiscal_year_id IS NOT NULL)
"""
_DELETE_BRANCH_SETTINGS_SQL = "DELETE FROM public.ims_branch_settings WHERE tenant_id = ANY(:ids)"
# cbms_sync_log has no restriction -- unconditionally safe to clear.
# Without this, every test_09_invoices.py run's real invoice/credit-note
# create leaves a real (failed, no-CBMS-configured) row behind forever,
# since nothing else in the app ever deletes this table.
_DELETE_CBMS_SYNC_LOG_SQL = "DELETE FROM public.cbms_sync_log WHERE tenant_id = ANY(:ids)"

def _resync_invoice_serials(db, branch_ids: list[str]) -> int:
    """Resyncs each (branch, fiscal_year, series) invoice-number serial to
    the real max still in use (same real bug class found and fixed in
    RMS's reset script this session: blanket-deleting the serial while
    real invoices survive leaves the counter at 0, colliding with an
    already-issued number on the next invoice created).

    Done in Python, not raw SQL: ims_invoices.number is a formatted string
    (format_invoice_number in utils/bikram_sambat.py, e.g.
    "INV-IMSVAT01-83/84-00007") built from a fiscal-year STRING
    ("2081-82") that is never itself stored on the invoice row -- only
    fiscal_year_id (a FK to ims_fiscal_years, keyed by integer
    start_year) is. invoice_service.py recomputes the string fresh via
    fiscal_year_from_ad(invoice.date) every time a serial is needed, so
    this reset does exactly the same, rather than reverse-parsing the
    formatted number string for a fiscal year it never actually contains.
    The trailing serial digits and leading series code (e.g. "INV"/"CN")
    ARE parsed from the formatted number, since those genuinely are baked
    into it (format_invoice_number's own doctest: always the series as
    the first '-'-delimited segment, always the last 5 digits, zero-padded)."""
    invoices = (
        db.query(IMSInvoice)
        .filter(IMSInvoice.branch_id.in_(branch_ids))
        .all()
    )
    max_serial: dict[tuple[str, str, str], int] = {}
    for inv in invoices:
        tail = inv.number[-5:]
        if not tail.isdigit():
            continue
        series = inv.number.split("-", 1)[0]
        fy = fiscal_year_from_ad(inv.date)
        if not fy:
            continue
        key = (inv.branch_id, fy, series)
        max_serial[key] = max(max_serial.get(key, 0), int(tail))

    updated = 0
    for (branch_id, fy, series), serial in max_serial.items():
        row = (
            db.query(IMSInvoiceSerial)
            .filter_by(branch_id=branch_id, fiscal_year=fy, series=series)
            .first()
        )
        if row is None:
            row = IMSInvoiceSerial(
                id=str(uuid.uuid4()), branch_id=branch_id, fiscal_year=fy,
                series=series, last_number=serial,
            )
            db.add(row)
            updated += 1
        elif row.last_number < serial:
            row.last_number = serial
            updated += 1
    return updated


def main_reset():
    with open(_DUMMY_TENANTS_PATH) as f:
        dummy_tenants = json.load(f)

    tenant_ids = [dummy_tenants["pan"]["tenant_id"], dummy_tenants["vat"]["tenant_id"]]
    branch_ids = [dummy_tenants["pan"]["branch_id"], dummy_tenants["vat"]["branch_id"]]

    db = SessionLocal()
    try:
        for sql in (_DELETE_QUOTATION_INVOICE_LINES_SQL, _DELETE_QUOTATION_INVOICES_SQL):
            result = db.execute(text(sql), {"ids": tenant_ids})
            if result.rowcount:
                print(f"(quotation invoice data): deleted {result.rowcount} row(s)")

        real_count = db.execute(text(_COUNT_REAL_INVOICES_SQL), {"ids": tenant_ids}).scalar()
        if real_count:
            print(
                f"NOTE: leaving {real_count} real invoice(s) in place -- "
                "permanently undeletable by design (trg_ims_invoices_delete_guard), not a bug."
            )

        for sql, label in (
            (_DELETE_PURCHASES_SQL, "ims_purchases"),
            (_DELETE_PARTIES_SQL, "ims_parties"),
            (_DELETE_VARIANT_STOCK_FOR_UNMOVED_VARIANTS_SQL, "ims_variant_stock"),
            (_DELETE_UNMOVED_VARIANTS_SQL, "ims_variants"),
            (_DELETE_PRODUCTS_WITH_NO_VARIANTS_LEFT_SQL, "ims_products"),
            (_DELETE_CATEGORIES_SQL, "ims_categories"),
            (_DELETE_BRANDS_SQL, "ims_brands"),
            (_DELETE_UNITS_SQL, "ims_units"),
            (_DELETE_MEDIA_SQL, "ims_media"),
            (_DELETE_FISCAL_YEARS_SQL, "ims_fiscal_years"),
            (_DELETE_BRANCH_SETTINGS_SQL, "ims_branch_settings"),
            (_DELETE_CBMS_SYNC_LOG_SQL, "cbms_sync_log"),
        ):
            result = db.execute(text(sql), {"ids": tenant_ids})
            if result.rowcount:
                print(f"{label}: deleted {result.rowcount} row(s)")

        moved_count = db.execute(text(_COUNT_MOVED_VARIANTS_SQL), {"ids": tenant_ids}).scalar()
        if moved_count:
            print(
                f"NOTE: leaving {moved_count} variant(s) with real stock-movement "
                "history in place (and their parent products/categories/brands) -- "
                "permanently undeletable, ims_stock_movements has no DELETE grant "
                "by design, not a bug."
            )

        resynced = _resync_invoice_serials(db, branch_ids)
        if resynced:
            print(f"ims_invoice_serials: resynced {resynced} row(s) to match surviving invoices")

        db.commit()
        print("Reset complete -- tenants/branches/credentials untouched.")
    finally:
        db.close()


if __name__ == "__main__":
    main_reset()
