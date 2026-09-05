"""Resets the two dummy RMS tenants' DATA (zones, tables, menu items, etc.)
back to empty, WITHOUT deleting the tenants/branches/credentials themselves
-- those come from seed_dummy_tenants.py and login tokens depend on them
staying stable across test runs.

Run this before re-running the full ordered test suite from scratch (each
test file intentionally leaves real state behind for the next file to build
on -- test_03_zones.py's zones, test_04_tables.py's tables, etc. -- so a
second full run collides with the first run's leftovers unless reset first).

Usage (inside the api container, same as seed_dummy_tenants.py):
    docker exec srota-api python /app/tests/rms/reset_dummy_tenants.py

Scoped strictly to the two known dummy tenant/branch IDs read from
dummy_tenants.json -- never touches any other tenant's data. Deletion order
verified against the real FK graph (information_schema.table_constraints),
not assumed -- see this script's own dev notes if restro_* gains new tables.

IMPORTANT: restro_orders/restro_order_lines (and anything hanging off a
PAID/CANCELLED order -- khata settlements, order slips) are only deletable
while status='draft'. restro_orders_immutability and
restro_order_lines_immutability are real DB triggers enforcing IRD clause
6.3घ (built earlier this session) -- a paid/cancelled test order is exactly
as permanently undeletable as a real one. This script only clears drafts
and reports how many issued orders it's leaving in place; it does not (and
should not) try to work around the trigger.
"""
import sys
import json
sys.path.insert(0, "/app")
import main  # noqa: F401

from sqlalchemy import text
from core.database import SessionLocal

_DUMMY_TENANTS_PATH = "/app/tests/rms/dummy_tenants.json"

# Leaf-first order, respecting the real FK graph. restro_credentials is
# deliberately NOT here -- deleting it would invalidate every login token
# the test suite depends on. restro_orders/order_lines/khata_settlements/
# order_slips are handled separately below (draft-only).
_DELETE_BY_TENANT_ID = [
    "restro_menu_items",  # variants/components cascade via menu_item_id below, first
    "restro_categories",
    "restro_customers",
    "restro_employees",
    "restro_expenses",
    "restro_inventory_items",
    # restro_tables/restro_zones handled separately below -- a surviving
    # paid/cancelled order's table_id FK blocks deleting its table.
]

# No tenant_id of their own -- deleted via a parent table's id instead.
_DELETE_MENU_VARIANTS_SQL = """
    DELETE FROM public.restro_menu_item_variants
    WHERE menu_item_id IN (SELECT id FROM public.restro_menu_items WHERE tenant_id = ANY(:ids))
"""
_DELETE_MENU_COMPONENTS_SQL = """
    DELETE FROM public.restro_menu_item_components
    WHERE parent_menu_item_id IN (SELECT id FROM public.restro_menu_items WHERE tenant_id = ANY(:ids))
       OR child_menu_item_id IN (SELECT id FROM public.restro_menu_items WHERE tenant_id = ANY(:ids))
"""

# restro_khata_settlements is keyed by customer_id, not order_id -- it's a
# customer-level ledger, not tied to any specific order -- so it's safe to
# delete by tenant_id directly (must happen before restro_customers, which
# it FKs into).
_DELETE_KHATA_SQL = """
    DELETE FROM public.restro_khata_settlements WHERE tenant_id = ANY(:ids)
"""

# Draft-order-scoped deletes, in child-first order. Only orders genuinely
# still in 'draft' status are touched -- paid/cancelled orders (and
# anything hanging off them) are left untouched by design.
_DELETE_DRAFT_ORDER_SLIPS_SQL = """
    DELETE FROM public.restro_order_slips
    WHERE tenant_id = ANY(:ids) AND order_id IN (
        SELECT id FROM public.restro_orders WHERE tenant_id = ANY(:ids) AND status = 'draft'
    )
"""
_DELETE_DRAFT_ORDER_LINES_SQL = """
    DELETE FROM public.restro_order_lines
    WHERE order_id IN (
        SELECT id FROM public.restro_orders WHERE tenant_id = ANY(:ids) AND status = 'draft'
    )
"""
_DELETE_DRAFT_ORDERS_SQL = """
    DELETE FROM public.restro_orders WHERE tenant_id = ANY(:ids) AND status = 'draft'
"""
_COUNT_ISSUED_ORDERS_SQL = """
    SELECT count(*) FROM public.restro_orders WHERE tenant_id = ANY(:ids) AND status != 'draft'
"""

# A surviving paid/cancelled order's table_id FK blocks deleting its table
# -- only delete tables NOT referenced by any remaining order. Same idea
# for zones once their tables are gone.
_DELETE_UNREFERENCED_TABLES_SQL = """
    DELETE FROM public.restro_tables
    WHERE tenant_id = ANY(:ids)
      AND id NOT IN (SELECT table_id FROM public.restro_orders WHERE table_id IS NOT NULL)
"""
_DELETE_UNREFERENCED_ZONES_SQL = """
    DELETE FROM public.restro_zones
    WHERE tenant_id = ANY(:ids)
      AND id NOT IN (SELECT zone_id FROM public.restro_tables WHERE zone_id IS NOT NULL)
"""
_DELETE_BRANCH_SETTINGS_SQL = """
    DELETE FROM public.restro_branch_settings WHERE tenant_id = ANY(:ids)
"""

# stock_movements aren't order-scoped directly but only ever get written
# for real sales -- once an order can't be deleted, its stock movements
# stay too (they reference item_id, not order_id, so they're not actually
# FK-blocked, but deleting them would misrepresent inventory history for a
# still-existing paid order -- left alone deliberately, not swept by
# _DELETE_BY_TENANT_ID).

# branch_id-scoped, not tenant_id-scoped. Neither serial table is here --
# see _RESYNC_INVOICE_SERIALS_SQL/_RESYNC_ORDER_SLIP_SERIALS_SQL below.
# Blanket-deleting them (the original approach) reset every branch's
# bill-number/slip-number counter to 0 while surviving paid/cancelled
# orders (and their order slips) keep their real numbers already in use --
# the next order/slip created would collide with a real existing number on
# uq_restro_order_bill_number / uq_restro_order_slip_number. For orders
# this used to be silently (and wrongly) surfaced as TABLE_ALREADY_HAS_DRAFT
# (fixed separately in order_service.py); for slips there was no such
# handling at all -- a real uncaught 500 on POST .../send-to-kitchen. Both
# found via the ordered RMS test suite's real HTTP testing (test_08_orders.py).
_DELETE_BY_BRANCH_ID: list[str] = []

# Re-derives each surviving branch/fiscal-year's serial counter from the
# real max bill_number still in restro_orders (the paid/cancelled orders
# left in place above), instead of deleting it -- keeps future order
# creation's _next_bill_number in sync with what's actually on the table.
# A branch/fiscal-year with zero surviving orders needs no row here at all
# (OrderRepository._next_bill_number creates one starting at 0 on demand).
_RESYNC_INVOICE_SERIALS_SQL = """
    INSERT INTO public.restro_invoice_serials (id, branch_id, fiscal_year, last_number)
    SELECT gen_random_uuid()::text, branch_id, fiscal_year, max(bill_number)
    FROM public.restro_orders
    WHERE branch_id = ANY(:branch_ids)
    GROUP BY branch_id, fiscal_year
    ON CONFLICT (branch_id, fiscal_year) DO UPDATE
        SET last_number = GREATEST(restro_invoice_serials.last_number, EXCLUDED.last_number)
"""

# Same idea as _RESYNC_INVOICE_SERIALS_SQL, for order-slip numbering
# (restro_order_slips survives on any order whose parent order survives --
# draft orders' slips are already deleted above via
# _DELETE_DRAFT_ORDER_SLIPS_SQL, so every remaining slip belongs to a
# surviving paid/cancelled order).
_RESYNC_ORDER_SLIP_SERIALS_SQL = """
    INSERT INTO public.restro_order_slip_serials (id, branch_id, fiscal_year, last_number)
    SELECT gen_random_uuid()::text, branch_id, fiscal_year, max(slip_number)
    FROM public.restro_order_slips
    WHERE branch_id = ANY(:branch_ids)
    GROUP BY branch_id, fiscal_year
    ON CONFLICT (branch_id, fiscal_year) DO UPDATE
        SET last_number = GREATEST(restro_order_slip_serials.last_number, EXCLUDED.last_number)
"""


def main_reset():
    with open(_DUMMY_TENANTS_PATH) as f:
        dummy_tenants = json.load(f)

    tenant_ids = [dummy_tenants["pan"]["tenant_id"], dummy_tenants["vat"]["tenant_id"]]
    branch_ids = [dummy_tenants["pan"]["branch_id"], dummy_tenants["vat"]["branch_id"]]

    db = SessionLocal()
    try:
        for sql in (
            _DELETE_KHATA_SQL,
            _DELETE_DRAFT_ORDER_SLIPS_SQL,
            _DELETE_DRAFT_ORDER_LINES_SQL,
            _DELETE_DRAFT_ORDERS_SQL,
        ):
            result = db.execute(text(sql), {"ids": tenant_ids})
            if result.rowcount:
                print(f"(draft order data): deleted {result.rowcount} row(s)")

        issued_count = db.execute(text(_COUNT_ISSUED_ORDERS_SQL), {"ids": tenant_ids}).scalar()
        if issued_count:
            print(
                f"NOTE: leaving {issued_count} paid/cancelled order(s) in place "
                "-- permanently immutable by design (IRD clause 6.3घ), not a bug."
            )

        for sql in (_DELETE_MENU_VARIANTS_SQL, _DELETE_MENU_COMPONENTS_SQL):
            result = db.execute(text(sql), {"ids": tenant_ids})
            if result.rowcount:
                print(f"(child rows): deleted {result.rowcount} row(s)")

        for table in _DELETE_BY_TENANT_ID:
            result = db.execute(
                text(f'DELETE FROM public."{table}" WHERE tenant_id = ANY(:ids)'),
                {"ids": tenant_ids},
            )
            if result.rowcount:
                print(f"{table}: deleted {result.rowcount} row(s)")

        for sql, label in (
            (_DELETE_UNREFERENCED_TABLES_SQL, "restro_tables"),
            (_DELETE_UNREFERENCED_ZONES_SQL, "restro_zones"),
            (_DELETE_BRANCH_SETTINGS_SQL, "restro_branch_settings"),
        ):
            result = db.execute(text(sql), {"ids": tenant_ids})
            if result.rowcount:
                print(f"{label}: deleted {result.rowcount} row(s)")

        for table in _DELETE_BY_BRANCH_ID:
            result = db.execute(
                text(f'DELETE FROM public."{table}" WHERE branch_id = ANY(:ids)'),
                {"ids": branch_ids},
            )
            if result.rowcount:
                print(f"{table}: deleted {result.rowcount} row(s)")

        for sql, label in (
            (_RESYNC_INVOICE_SERIALS_SQL, "restro_invoice_serials"),
            (_RESYNC_ORDER_SLIP_SERIALS_SQL, "restro_order_slip_serials"),
        ):
            result = db.execute(text(sql), {"branch_ids": branch_ids})
            if result.rowcount:
                print(f"{label}: resynced {result.rowcount} row(s) to match surviving orders")

        db.commit()
        print("Reset complete -- tenants/branches/credentials untouched.")
    finally:
        db.close()


if __name__ == "__main__":
    main_reset()
