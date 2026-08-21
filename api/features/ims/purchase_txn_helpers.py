"""Flush-only (never commit) variants of the product/variant/stock/movement/
ledger writes used elsewhere in features/ims. A purchase or a sale touches
several of these at once and must be one atomic transaction — the shared
repositories each commit per call, which would leave partial writes on a
mid-transaction failure. These mirror the same field shapes but defer
commit to the caller (IMSPurchaseService.create / IMSInvoiceService.create),
which commits once at the end. Despite the filename, this module is shared
by both — not purchase-specific."""

from sqlalchemy.orm import Session
from shared_models import IMSProduct, IMSVariant, IMSVariantStock, IMSStockMovement, IMSLedgerEntry


def create_product(db: Session, tenant_id: str, **fields) -> IMSProduct:
    product = IMSProduct(tenant_id=tenant_id, **fields)
    db.add(product)
    db.flush()
    return product


def add_variant(db: Session, product_id: str, **fields) -> IMSVariant:
    variant = IMSVariant(product_id=product_id, **fields)
    db.add(variant)
    db.flush()
    return variant


def update_variant(db: Session, variant: IMSVariant, **fields) -> IMSVariant:
    for key, value in fields.items():
        setattr(variant, key, value)
    db.flush()
    return variant


def get_or_create_stock_row(db: Session, variant_id: str, branch_id: str) -> IMSVariantStock:
    row = (
        db.query(IMSVariantStock)
        .filter(IMSVariantStock.variant_id == variant_id, IMSVariantStock.branch_id == branch_id)
        .first()
    )
    if row:
        return row
    row = IMSVariantStock(variant_id=variant_id, branch_id=branch_id, qty=0)
    db.add(row)
    db.flush()
    return row


def set_stock_qty(db: Session, row: IMSVariantStock, qty) -> IMSVariantStock:
    row.qty = qty
    db.flush()
    return row


def create_movement(db: Session, **fields) -> IMSStockMovement:
    movement = IMSStockMovement(**fields)
    db.add(movement)
    db.flush()
    return movement


def create_ledger_entry(db: Session, **fields) -> IMSLedgerEntry:
    entry = IMSLedgerEntry(**fields)
    db.add(entry)
    db.flush()
    return entry
