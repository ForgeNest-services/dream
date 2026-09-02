from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from features.restro.order_repository import (
    OrderRepository,
    ORDER_TYPES,
    ORDER_STATUSES,
    KITCHEN_STATUSES,
    DELIVERY_STATUSES,
    PAYMENT_METHODS,
    KHATA_SETTLEMENT_METHODS,
    DISCOUNT_TYPES,
)
from features.restro.table_repository import TableRepository
from features.restro.menu_item_repository import MenuItemRepository
from features.restro.menu_item_service import combo_note_from_components
from features.restro.customer_repository import CustomerRepository
from features.restro.khata_settlement_repository import KhataSettlementRepository
from features.restro.branch_settings_service import BranchSettingsService
from features.branches.repository import BranchRepository
from features.auth.repository import TenantRepository
from features.hotel_pms.audit_repository import AuditRepository
from shared_models import RestroOrder, RestroOrderLine
from utils.bikram_sambat import to_bs_iso, fiscal_year_from_ad, format_invoice_number
from utils.logger import logger


def order_vat_settings(db: Session, tenant_id: str, branch_id: str) -> tuple[bool, Decimal]:
    """Reads the branch's real VAT config (RestroBranchSettings), which is
    itself gated server-side on tenant.is_vat_registered — never a hardcoded
    default. Goes through BranchSettingsService.get_or_create (not the bare
    repository) so a tenant that just switched PAN<->VAT gets that reflected
    on their very next bill, not just after someone happens to open
    Settings — same auto-sync every other settings read gets."""
    result = BranchSettingsService.get_or_create(db, tenant_id, branch_id)
    if not result["success"]:
        return False, Decimal("13")
    settings = result["settings"]
    return bool(settings.vat_enabled), Decimal(settings.vat_rate)


def compute_order_total(order, vat_enabled: bool = False, vat_rate: Decimal = Decimal("13")) -> Decimal:
    """Mirrors the frontend billTotals(): subtotal from non-voided lines,
    discount (percent or flat), then VAT backed OUT of what remains — line
    prices (RestroMenuItem/Variant.price, snapshotted onto the order line at
    add-line time) are stored VAT-INCLUSIVE, so the total the customer pays
    is subtotal - discount, full stop; VAT is a breakdown of that number for
    the printed bill, never added on top of it. Used server-side both for
    reports and for the khata outstanding-balance calculation, so the number
    always matches what the customer was shown at bill time. vat_enabled/
    vat_rate come from the order's branch settings — callers iterating
    orders across branches must pass the right pair per order (see
    khata_orders_total)."""
    subtotal = sum(
        (Decimal(line.price) * line.qty for line in order.lines if not line.is_voided),
        Decimal("0"),
    )
    if order.discount_type == "percent":
        discount = subtotal * Decimal(order.discount_value) / Decimal("100")
    else:
        discount = Decimal(order.discount_value)
    total = max(Decimal("0"), subtotal - discount)
    return total.quantize(Decimal("0.01"))


class OrderService:
    @staticmethod
    def _assert_branch(db: Session, tenant_id: str, branch_id: str) -> bool:
        return BranchRepository.get_by_id(db, tenant_id, branch_id) is not None

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------

    @staticmethod
    def list_for_branch(
        db: Session,
        tenant_id: str,
        branch_id: str,
        status: str | None = None,
        type: str | None = None,
        kitchen_status: str | None = None,
        table_id: str | None = None,
        limit: int | None = None,
    ) -> dict:
        if not OrderService._assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        orders = OrderRepository.list_for_branch(
            db,
            tenant_id=tenant_id,
            branch_id=branch_id,
            status=status,
            type=type,
            kitchen_status=kitchen_status,
            table_id=table_id,
            limit=limit,
        )
        return {"success": True, "orders": orders}

    @staticmethod
    def list_paginated(
        db: Session,
        tenant_id: str,
        branch_id: str,
        status: str | None = None,
        type: str | None = None,
        kitchen_status: str | None = None,
        table_id: str | None = None,
        payment_method: str | None = None,
        bs_from: str | None = None,
        bs_to: str | None = None,
        search: str | None = None,
        offset: int = 0,
        limit: int = 25,
    ) -> dict:
        if not OrderService._assert_branch(db, tenant_id, branch_id):
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        items, total = OrderRepository.list_paginated(
            db,
            tenant_id=tenant_id,
            branch_id=branch_id,
            status=status,
            type=type,
            kitchen_status=kitchen_status,
            table_id=table_id,
            payment_method=payment_method,
            bs_from=bs_from,
            bs_to=bs_to,
            search=search,
            offset=offset,
            limit=limit,
        )
        return {"success": True, "orders": items, "total": total}

    @staticmethod
    def get(db: Session, tenant_id: str, branch_id: str, order_id: str) -> dict:
        order = OrderRepository.get_by_id(db, tenant_id, order_id)
        if not order or order.branch_id != branch_id:
            return {"success": False, "error_code": "ORDER_NOT_FOUND"}
        return {"success": True, "order": order}

    @staticmethod
    def register_print(
        db: Session, tenant_id: str, branch_id: str, order_id: str, printed_by: str | None = None
    ) -> dict:
        """Call once per actual print of a paid bill — bumps print_count and
        tells the caller whether THIS print is the original (count==1, no
        watermark) or a reprint (count>1, must show "Copy of Original (N)"
        per Electronic Billing Procedure 2082, clause 6.2(च)). Only
        meaningful for a paid bill — a draft being previewed isn't a real
        bill yet, and a credit note is its own document, not a copy of one,
        so neither needs/gets watermark tracking here."""
        order = OrderRepository.get_by_id(db, tenant_id, order_id)
        if not order or order.branch_id != branch_id:
            return {"success": False, "error_code": "ORDER_NOT_FOUND"}
        if order.status != "paid":
            return {"success": True, "is_reprint": False, "print_count": 0}
        order = OrderRepository.increment_print_count(db, order, printed_by)
        return {"success": True, "is_reprint": order.print_count > 1, "print_count": order.print_count}

    @staticmethod
    def get_draft_for_table(
        db: Session, tenant_id: str, branch_id: str, table_id: str
    ) -> dict:
        table = TableRepository.get_by_id(db, tenant_id, table_id)
        if not table or table.branch_id != branch_id or not table.is_active:
            return {"success": False, "error_code": "TABLE_NOT_FOUND"}
        ids = OrderRepository.merge_group_ids(db, tenant_id, table_id)
        order = OrderRepository.get_draft_for_tables(db, tenant_id, ids)
        return {"success": True, "order": order}  # order may be None

    # ------------------------------------------------------------------
    # Create draft order
    # ------------------------------------------------------------------

    @staticmethod
    def create(
        db: Session,
        tenant_id: str,
        branch_id: str,
        type: str,
        waiter_name: str,
        waiter_cred_id: str | None,
        table_id: str | None = None,
        customer_id: str | None = None,
    ) -> dict:
        branch = BranchRepository.get_by_id(db, tenant_id, branch_id)
        if not branch:
            return {"success": False, "error_code": "BRANCH_NOT_FOUND"}
        if type not in ORDER_TYPES:
            return {"success": False, "error_code": "INVALID_TYPE"}

        primary_table_id: str | None = None
        if type == "dine-in":
            if not table_id:
                return {"success": False, "error_code": "TABLE_REQUIRED"}
            table = TableRepository.get_by_id(db, tenant_id, table_id)
            if not table or table.branch_id != branch_id or not table.is_active:
                return {"success": False, "error_code": "TABLE_NOT_FOUND"}
            # If this table is in a merge group, the primary table is the one
            # already holding a draft (if any); otherwise the first in the
            # group by created_at. Keeps "one draft per merge group" invariant.
            ids = OrderRepository.merge_group_ids(db, tenant_id, table_id)
            existing = OrderRepository.get_draft_for_tables(db, tenant_id, ids)
            if existing:
                return {"success": False, "error_code": "TABLE_ALREADY_HAS_DRAFT"}
            primary_table_id = table_id  # caller's chosen table is fine
        else:
            # Delivery: customer_id is required (holds name/phone/address on
            # the customer row). Dine-in can also carry customer_id for repeat
            # walk-ins, but it's optional.
            if not customer_id:
                return {"success": False, "error_code": "CUSTOMER_REQUIRED"}

        # If customer_id is supplied for any type, validate it belongs to
        # this tenant+branch. Skip validation entirely when None (dine-in walk-in).
        if customer_id:
            customer = CustomerRepository.get_by_id(db, tenant_id, customer_id)
            if not customer or customer.branch_id != branch_id or not customer.is_active:
                return {"success": False, "error_code": "CUSTOMER_NOT_FOUND"}

        try:
            order = OrderRepository.create(
                db,
                tenant_id=tenant_id,
                branch_id=branch_id,
                type=type,
                table_id=primary_table_id,
                customer_id=customer_id,
                waiter_name=waiter_name,
                waiter_cred_id=waiter_cred_id,
                branch_code=branch.code,
            )
            logger.info(
                f"Order created: {order.id}",
                extra={"tenant_id": tenant_id, "branch_id": branch_id, "type": type},
            )
            return {"success": True, "order": order}
        except IntegrityError:
            db.rollback()
            # Partial unique on (table_id) WHERE status='draft' AND type='dine-in'
            # caught a race with another simultaneous open.
            return {"success": False, "error_code": "TABLE_ALREADY_HAS_DRAFT"}
        except Exception as e:
            db.rollback()
            logger.error(f"Order creation failed: {str(e)}")
            return {"success": False, "error_code": "CREATION_FAILED"}

    # ------------------------------------------------------------------
    # Lines
    # ------------------------------------------------------------------

    @staticmethod
    def add_line(
        db: Session,
        tenant_id: str,
        branch_id: str,
        order_id: str,
        menu_item_id: str | None,
        name: str | None,
        price: Decimal | None,
        qty: int,
        note: str | None,
        variant_name: str | None,
    ) -> dict:
        order = OrderRepository.get_by_id(db, tenant_id, order_id)
        if not order or order.branch_id != branch_id:
            return {"success": False, "error_code": "ORDER_NOT_FOUND"}
        if order.status != "draft":
            return {"success": False, "error_code": "ORDER_NOT_EDITABLE"}
        if qty < 1:
            return {"success": False, "error_code": "INVALID_QTY"}

        snapshot_name = name
        snapshot_price = price

        # If a menu_item_id is given, snapshot from the menu item — protects
        # against the client sending stale/manipulated prices.
        if menu_item_id:
            item = MenuItemRepository.get_by_id(db, tenant_id, menu_item_id)
            if not item or item.branch_id != branch_id or not item.is_active:
                return {"success": False, "error_code": "MENU_ITEM_NOT_FOUND"}
            if item.sold_out:
                return {"success": False, "error_code": "ITEM_SOLD_OUT"}
            snapshot_name = item.name
            if item.has_variants:
                if not variant_name:
                    return {"success": False, "error_code": "VARIANT_REQUIRED"}
                variant = next(
                    (v for v in item.variants if v.name == variant_name), None
                )
                if not variant:
                    return {"success": False, "error_code": "VARIANT_NOT_FOUND"}
                snapshot_price = Decimal(variant.price)
            else:
                snapshot_price = Decimal(item.price) if item.price is not None else Decimal(0)
            # For combos, auto-populate the line note with the composition so
            # the KOT shows the kitchen what to actually prep. Doesn't
            # override an explicit note the waiter typed.
            if item.is_combo and not (note and note.strip()):
                note = combo_note_from_components(item)
        else:
            # Custom line (e.g. an off-menu item) — client must provide name+price.
            if not snapshot_name or snapshot_price is None:
                return {"success": False, "error_code": "NAME_AND_PRICE_REQUIRED"}

        if snapshot_price is None or snapshot_price < 0:
            return {"success": False, "error_code": "INVALID_PRICE"}

        try:
            # Same-item stacking: if an unsent line for the same menu_item +
            # variant exists, bump its qty instead of creating a duplicate row.
            existing = OrderRepository.find_unsent_matching_line(
                db, order_id, menu_item_id, variant_name
            )
            if existing:
                line = OrderRepository.update_line(db, existing, qty=existing.qty + qty)
            else:
                line = OrderRepository.create_line(
                    db,
                    order_id=order_id,
                    menu_item_id=menu_item_id,
                    name=snapshot_name,
                    variant_name=variant_name,
                    price=Decimal(snapshot_price),
                    qty=qty,
                    note=(note.strip() if note else None),
                )
        except Exception as e:
            db.rollback()
            logger.error(f"Add line failed: {str(e)}")
            return {"success": False, "error_code": "LINE_ADD_FAILED"}

        # Side effect: first line on a dine-in order flips table to occupied.
        if order.type == "dine-in" and order.table_id:
            OrderService._set_group_status(db, tenant_id, order.table_id, "occupied")

        return {"success": True, "order": OrderRepository.get_by_id(db, tenant_id, order_id), "line": line}

    @staticmethod
    def update_line(
        db: Session,
        tenant_id: str,
        branch_id: str,
        order_id: str,
        line_id: str,
        qty: int | None = None,
        note: str | None = None,
        performed_by: str | None = None,
        terminal_ip: str | None = None,
    ) -> dict:
        order = OrderRepository.get_by_id(db, tenant_id, order_id)
        if not order or order.branch_id != branch_id:
            return {"success": False, "error_code": "ORDER_NOT_FOUND"}
        if order.status != "draft":
            return {"success": False, "error_code": "ORDER_NOT_EDITABLE"}
        line = OrderRepository.get_line_by_id(db, order_id, line_id)
        if not line or line.is_voided:
            return {"success": False, "error_code": "LINE_NOT_FOUND"}
        if qty is not None and qty < 1:
            return {"success": False, "error_code": "INVALID_QTY"}
        before_qty = line.qty
        updated = OrderRepository.update_line(db, line, qty=qty, note=note)
        # Only worth an audit entry once the line has been sent to the
        # kitchen — editing an unsent draft line is normal order-building,
        # not a correction to something already in motion.
        if line.sent and qty is not None and qty != before_qty:
            AuditRepository.write(
                db,
                tenant_id=tenant_id,
                app_code="restro",
                entity_type="order_line",
                entity_id=line.id,
                action="update_qty",
                performed_by=performed_by or "unknown",
                performer_type="staff",
                after_state={"order_id": order_id, "before_qty": before_qty, "after_qty": qty},
                terminal_ip=terminal_ip,
            )
            db.commit()
        return {"success": True, "line": updated}

    @staticmethod
    def void_line(
        db: Session,
        tenant_id: str,
        branch_id: str,
        order_id: str,
        line_id: str,
        reason: str | None,
        performed_by: str | None = None,
        terminal_ip: str | None = None,
    ) -> dict:
        order = OrderRepository.get_by_id(db, tenant_id, order_id)
        if not order or order.branch_id != branch_id:
            return {"success": False, "error_code": "ORDER_NOT_FOUND"}
        if order.status != "draft":
            return {"success": False, "error_code": "ORDER_NOT_EDITABLE"}
        line = OrderRepository.get_line_by_id(db, order_id, line_id)
        if not line or line.is_voided:
            return {"success": False, "error_code": "LINE_NOT_FOUND"}
        voided = OrderRepository.mark_line_voided(db, line, reason)
        AuditRepository.write(
            db,
            tenant_id=tenant_id,
            app_code="restro",
            entity_type="order_line",
            entity_id=line.id,
            action="void",
            performed_by=performed_by or "unknown",
            performer_type="staff",
            after_state={
                "order_id": order_id,
                "name": line.name,
                "qty": line.qty,
                "reason": reason,
            },
            terminal_ip=terminal_ip,
        )
        db.commit()
        return {"success": True, "line": voided}

    @staticmethod
    def delete_line(
        db: Session,
        tenant_id: str,
        branch_id: str,
        order_id: str,
        line_id: str,
        performed_by: str | None = None,
        terminal_ip: str | None = None,
    ) -> dict:
        order = OrderRepository.get_by_id(db, tenant_id, order_id)
        if not order or order.branch_id != branch_id:
            return {"success": False, "error_code": "ORDER_NOT_FOUND"}
        if order.status != "draft":
            return {"success": False, "error_code": "ORDER_NOT_EDITABLE"}
        line = OrderRepository.get_line_by_id(db, order_id, line_id)
        if not line:
            return {"success": False, "error_code": "LINE_NOT_FOUND"}
        # Once sent to kitchen, you can't hard-delete — you void with a reason
        # so the audit trail survives.
        if line.sent:
            return {"success": False, "error_code": "CANNOT_DELETE_SENT_LINE"}
        # Unsent lines are pre-kitchen draft-building — not worth an audit
        # entry (same reasoning as update_line above; nothing has "happened"
        # to this line yet from the kitchen/customer's perspective).
        OrderRepository.delete_line(db, line)
        return {"success": True}

    # ------------------------------------------------------------------
    # Workflow transitions
    # ------------------------------------------------------------------

    @staticmethod
    def send_to_kitchen(
        db: Session,
        tenant_id: str,
        branch_id: str,
        order_id: str,
        created_by: str | None = None,
    ) -> dict:
        order = OrderRepository.get_by_id(db, tenant_id, order_id)
        if not order or order.branch_id != branch_id:
            return {"success": False, "error_code": "ORDER_NOT_FOUND"}
        if order.status != "draft":
            return {"success": False, "error_code": "ORDER_NOT_EDITABLE"}
        marked = OrderRepository.mark_all_unsent_as_sent(db, order_id)
        slip = None
        # IRD: Electronic Billing Procedure 2082, clause 6.2घ — each round of
        # items actually sent to the kitchen gets its own sequential Order
        # Slip number + log entry. Nothing to log if this call marked zero
        # lines (e.g. a re-click with nothing new in the cart).
        if marked > 0:
            slip = OrderRepository.create_slip(
                db, tenant_id, branch_id, order, line_count=marked, created_by=created_by
            )
            # Bump placed_at so the kitchen "time since order" clock resets
            # for a follow-up round, and reset kitchen_status if served.
            OrderRepository.bump_placed_at(db, order)
        if order.kitchen_status == "served":
            OrderRepository.set_status(db, order, kitchen_status="new")
        return {"success": True, "order": order, "marked": marked, "slip": slip}

    @staticmethod
    def set_kitchen_status(
        db: Session,
        tenant_id: str,
        branch_id: str,
        order_id: str,
        kitchen_status: str,
    ) -> dict:
        if kitchen_status not in KITCHEN_STATUSES:
            return {"success": False, "error_code": "INVALID_KITCHEN_STATUS"}
        order = OrderRepository.get_by_id(db, tenant_id, order_id)
        if not order or order.branch_id != branch_id:
            return {"success": False, "error_code": "ORDER_NOT_FOUND"}
        if order.status != "draft":
            return {"success": False, "error_code": "ORDER_NOT_EDITABLE"}
        updated = OrderRepository.set_status(db, order, kitchen_status=kitchen_status)
        return {"success": True, "order": updated}

    @staticmethod
    def set_discount(
        db: Session,
        tenant_id: str,
        branch_id: str,
        order_id: str,
        discount_type: str,
        discount_value: Decimal,
        performed_by: str | None = None,
        terminal_ip: str | None = None,
    ) -> dict:
        if discount_type not in DISCOUNT_TYPES:
            return {"success": False, "error_code": "INVALID_DISCOUNT_TYPE"}
        if discount_value < 0:
            return {"success": False, "error_code": "INVALID_DISCOUNT_VALUE"}
        order = OrderRepository.get_by_id(db, tenant_id, order_id)
        if not order or order.branch_id != branch_id:
            return {"success": False, "error_code": "ORDER_NOT_FOUND"}
        if order.status != "draft":
            return {"success": False, "error_code": "ORDER_NOT_EDITABLE"}
        before_type, before_value = order.discount_type, order.discount_value
        updated = OrderRepository.set_discount(db, order, discount_type, Decimal(discount_value))
        # A discount directly reduces what the customer pays — always worth
        # an audit entry, regardless of whether the order's been sent yet.
        if before_type != discount_type or before_value != Decimal(discount_value):
            AuditRepository.write(
                db,
                tenant_id=tenant_id,
                app_code="restro",
                entity_type="order",
                entity_id=order.id,
                action="set_discount",
                performed_by=performed_by or "unknown",
                performer_type="staff",
                after_state={
                    "before": {"type": before_type, "value": float(before_value)},
                    "after": {"type": discount_type, "value": float(discount_value)},
                },
                terminal_ip=terminal_ip,
            )
            db.commit()
        return {"success": True, "order": updated}

    @staticmethod
    def mark_paid(
        db: Session,
        tenant_id: str,
        branch_id: str,
        order_id: str,
        payment_method: str,
        customer_id: str | None = None,
        buyer_pan: str | None = None,
        show_vat_breakdown: bool | None = None,
        terminal_ip: str | None = None,
        performed_by: str | None = None,
    ) -> dict:
        if payment_method not in PAYMENT_METHODS:
            return {"success": False, "error_code": "INVALID_PAYMENT_METHOD"}
        order = OrderRepository.get_by_id(db, tenant_id, order_id)
        if not order or order.branch_id != branch_id:
            return {"success": False, "error_code": "ORDER_NOT_FOUND"}
        if order.status != "draft":
            return {"success": False, "error_code": "ORDER_NOT_EDITABLE"}

        # Khata rule: customer required. Either supplied inline here (waiter
        # picked/created at pay time) or already attached at order creation
        # (delivery flow). If neither, refuse.
        effective_customer_id = customer_id or order.customer_id
        if payment_method == "khata":
            if not effective_customer_id:
                return {"success": False, "error_code": "CUSTOMER_REQUIRED_FOR_KHATA"}
            customer = CustomerRepository.get_by_id(db, tenant_id, effective_customer_id)
            if not customer or customer.branch_id != branch_id or not customer.is_active:
                return {"success": False, "error_code": "CUSTOMER_NOT_FOUND"}

        now = datetime.now(timezone.utc)
        # For cash/qr the money's in — settled_at = paid_at, so the customer
        # never accrues a balance. For khata we deliberately leave settled_at
        # NULL until the customer pays down their tab via /settle-khata.
        settled_at_value = None if payment_method == "khata" else now
        clear_settled = payment_method == "khata"

        # ── IRD: PAN snapshot — seller and buyer ─────────────────────────────
        vat_enabled, vat_rate = order_vat_settings(db, tenant_id, branch_id)

        # Simplified (संक्षिप्त कर बिजक) vs full VAT breakdown — display-only,
        # mirrors IMSInvoice's show_breakdown: the totals below are computed
        # identically either way, this only decides whether the printed bill
        # itemizes Taxable/VAT or shows one total. Defaults to itemized
        # whenever VAT actually applies (matches the POS toggle's own
        # default), since callers that don't pass it (e.g. any future
        # non-POS caller) should keep today's one-flag behavior.
        show_breakdown = vat_enabled if show_vat_breakdown is None else show_vat_breakdown

        # Line prices (RestroMenuItem/Variant.price) are stored VAT-INCLUSIVE
        # — what the customer pays per unit. Discount is a cut off that
        # inclusive subtotal, and VAT is backed OUT of what remains, never
        # added on top: total = subtotal - discount, full stop. taxable/vat
        # are just that same total's breakdown for the printed VAT line.
        subtotal = sum(
            (Decimal(line.price) * line.qty for line in order.lines if not line.is_voided),
            Decimal("0"),
        )
        if order.discount_type == "percent":
            discount = subtotal * Decimal(order.discount_value) / Decimal("100")
        else:
            discount = Decimal(order.discount_value)

        total = max(Decimal("0"), subtotal - discount).quantize(Decimal("0.01"))
        if vat_enabled:
            taxable = (total / (1 + vat_rate / Decimal("100"))).quantize(Decimal("0.01"))
            vat = (total - taxable).quantize(Decimal("0.01"))
        else:
            taxable = Decimal("0")
            vat = Decimal("0")

        # IRD: Electronic Billing Procedure 2082, Annexure-6's own abbreviated
        # ("संक्षिप्त कर बीजक") invoice template states outright: "दश हजार
        # रुपैयाँभन्दा बढी कर लाग्ने मूल्यको वस्तु वा सेवाको बिक्रीमा यो बीजक
        # जारी गरिने छैन" — this format cannot be issued for a sale whose
        # TAXABLE value exceeds Rs 10,000. Only a real ceiling in a VAT
        # context (a PAN-only bill has no VAT breakdown to itemize either
        # way, so the tax/abbreviated distinction doesn't carry the same
        # weight there). show_vat_breakdown is a UI preference; this
        # overrides it, never trusting a client-supplied flag to bypass it.
        if vat_enabled and not show_breakdown and taxable > Decimal("10000"):
            return {"success": False, "error_code": "ABBREVIATED_INVOICE_LIMIT_EXCEEDED"}
        order.kind = "tax" if show_breakdown else "abbreviated"

        tenant = TenantRepository.get_by_id(db, tenant_id)
        branch = BranchRepository.get_by_id(db, tenant_id, branch_id)
        order.seller_name = tenant.name if tenant else None
        order.seller_address = branch.address if branch else None
        order.seller_pan = tenant.pan if tenant else None

        if effective_customer_id:
            customer_obj = CustomerRepository.get_by_id(db, tenant_id, effective_customer_id)
            order.buyer_name = customer_obj.name if customer_obj else None
        order.buyer_pan = buyer_pan

        order.subtotal_amount = subtotal
        # Annexure-5's "Discount" — the actual rupee amount deducted,
        # snapshotted here (not order.discount_value, which is just the
        # raw %/flat INPUT and needs the subtotal to mean anything).
        order.discount_amount = discount.quantize(Decimal("0.01"))
        order.taxable_amount = taxable if vat_enabled else Decimal("0")
        order.exempt_amount = Decimal("0") if vat_enabled else total
        order.vat_amount = vat
        order.total_amount = total

        # Auto-finish the kitchen ticket. Paying = the customer got the food,
        # so the kitchen has no more work to do on it. Prevents a paid order
        # from lingering on the Kitchen Display board in "new"/"cooking"
        # forever (chef can't advance it — status='paid' makes it
        # non-editable — and shops that don't use the kitchen board at all
        # would never touch kitchen_status manually). Kitchen board also
        # filters status='draft' as belt-and-suspenders.
        kitchen_status = "served" if order.kitchen_status != "served" else None
        updated = OrderRepository.set_status(
            db,
            order,
            status="paid",
            kitchen_status=kitchen_status,
            paid_at=now,
            payment_method=payment_method,
            customer_id=effective_customer_id if payment_method == "khata" else None,
            settled_at=settled_at_value,
            clear_settled_at=clear_settled,
        )
        # Free the dine-in table (whole merge group).
        if order.type == "dine-in" and order.table_id:
            OrderService._set_group_status(db, tenant_id, order.table_id, "empty")

        AuditRepository.write(
            db,
            tenant_id=tenant_id,
            app_code="restro",
            entity_type="order",
            entity_id=order.id,
            action="mark_paid",
            performed_by=performed_by or "unknown",
            performer_type="staff",
            after_state={
                "bill_number": order.bill_number,
                "payment_method": payment_method,
                "total": float(total),
            },
            terminal_ip=terminal_ip,
        )
        db.commit()

        logger.info(
            f"Order paid: {order.id} via {payment_method}",
            extra={"tenant_id": tenant_id, "customer_id": effective_customer_id},
        )
        return {"success": True, "order": updated}

    @staticmethod
    def set_customer(
        db: Session,
        tenant_id: str,
        branch_id: str,
        order_id: str,
        customer_id: str | None,
    ) -> dict:
        """Attach or clear a customer on a draft order — mostly used to tag a
        dine-in order to a khata customer before payment, so the waiter can
        write the customer's name on the receipt (and mark-paid can skip the
        customer picker). Only editable while the order is still draft."""
        order = OrderRepository.get_by_id(db, tenant_id, order_id)
        if not order or order.branch_id != branch_id:
            return {"success": False, "error_code": "ORDER_NOT_FOUND"}
        if order.status != "draft":
            return {"success": False, "error_code": "ORDER_NOT_EDITABLE"}
        if customer_id:
            customer = CustomerRepository.get_by_id(db, tenant_id, customer_id)
            if not customer or customer.branch_id != branch_id or not customer.is_active:
                return {"success": False, "error_code": "CUSTOMER_NOT_FOUND"}
        # Direct assign — no set_status call because customer_id is
        # legitimately mutable while draft and we don't want the other
        # side-effects (kitchen_status auto-flip etc.) that set_status has.
        order.customer_id = customer_id
        db.commit()
        db.refresh(order)
        return {"success": True, "order": order}

    @staticmethod
    def khata_orders_total(db: Session, tenant_id: str, customer_id: str) -> Decimal:
        """Sum of every khata order total for a customer (the debit side of
        the ledger). Does NOT subtract settlements — that's the caller's job
        via outstanding_balance(). Uses each order's snapshotted total_amount
        (set once at mark-paid time) rather than recomputing live — branch
        VAT settings can change after the bill was issued, and the ledger
        must match what the customer was actually billed, not today's rate."""
        orders = OrderRepository.list_khata_orders_for_customer(db, tenant_id, customer_id)
        return sum((Decimal(o.total_amount or 0) for o in orders), Decimal("0"))

    @staticmethod
    def outstanding_balance(db: Session, tenant_id: str, customer_id: str) -> Decimal:
        """Live khata balance = SUM(khata order totals) − SUM(settlements).
        Never negative — a customer who over-paid shows 0 (over-payment
        would need a proper credit-note flow we're not modeling yet)."""
        debits = OrderService.khata_orders_total(db, tenant_id, customer_id)
        credits = KhataSettlementRepository.total_for_customer(db, tenant_id, customer_id)
        return max(Decimal("0"), debits - credits)

    @staticmethod
    def record_khata_settlement(
        db: Session,
        tenant_id: str,
        branch_id: str,
        customer_id: str,
        amount: Decimal,
        method: str,
        note: str | None,
        actor_name: str,
        actor_cred_id: str | None,
    ) -> dict:
        """Records a partial or full payment against a customer's khata
        balance. Amount must be > 0 and not exceed the current outstanding
        balance (server-side clamp — the UI can pre-fill "full amount" but
        can't accept an overpayment through this path)."""
        if method not in KHATA_SETTLEMENT_METHODS:
            return {"success": False, "error_code": "INVALID_SETTLEMENT_METHOD"}
        if amount <= 0:
            return {"success": False, "error_code": "INVALID_AMOUNT"}
        customer = CustomerRepository.get_by_id(db, tenant_id, customer_id)
        if not customer or customer.branch_id != branch_id or not customer.is_active:
            return {"success": False, "error_code": "CUSTOMER_NOT_FOUND"}

        balance = OrderService.outstanding_balance(db, tenant_id, customer_id)
        if balance <= 0:
            return {"success": False, "error_code": "NO_BALANCE_TO_SETTLE"}
        if amount > balance:
            return {"success": False, "error_code": "AMOUNT_EXCEEDS_BALANCE"}

        settlement = KhataSettlementRepository.create(
            db,
            tenant_id=tenant_id,
            branch_id=branch_id,
            customer_id=customer_id,
            amount=amount,
            method=method,
            note=note,
            actor_name=actor_name,
            actor_cred_id=actor_cred_id,
        )
        new_balance = OrderService.outstanding_balance(db, tenant_id, customer_id)
        logger.info(
            f"Khata settlement: customer={customer_id} amount={amount} via {method} → balance {new_balance}",
            extra={"tenant_id": tenant_id, "branch_id": branch_id},
        )
        return {
            "success": True,
            "settlement": settlement,
            "new_balance": new_balance,
        }

    @staticmethod
    def cancel(
        db: Session,
        tenant_id: str,
        branch_id: str,
        order_id: str,
        performed_by: str | None = None,
        terminal_ip: str | None = None,
    ) -> dict:
        order = OrderRepository.get_by_id(db, tenant_id, order_id)
        if not order or order.branch_id != branch_id:
            return {"success": False, "error_code": "ORDER_NOT_FOUND"}
        if order.status != "draft":
            return {"success": False, "error_code": "ORDER_NOT_EDITABLE"}
        updated = OrderRepository.set_status(db, order, status="cancelled")
        if order.type == "dine-in" and order.table_id:
            OrderService._set_group_status(db, tenant_id, order.table_id, "empty")
        # Cancelling permanently burns this order's bill_number (never
        # reused/reclaimed — see the UNIQUE(branch, fiscal_year, bill_number)
        # constraint) — a real audit entry is what explains the resulting
        # gap to anyone reviewing the sequence later, not just an app log
        # line that isn't tamper-evident and isn't tenant-queryable.
        AuditRepository.write(
            db,
            tenant_id=tenant_id,
            app_code="restro",
            entity_type="order",
            entity_id=order.id,
            action="cancel",
            performed_by=performed_by or "unknown",
            performer_type="staff",
            after_state={"bill_number": order.bill_number, "fiscal_year": order.fiscal_year},
            terminal_ip=terminal_ip,
        )
        db.commit()
        logger.info(f"Order cancelled: {order.id}", extra={"tenant_id": tenant_id})
        return {"success": True, "order": updated}

    @staticmethod
    def set_delivery_status(
        db: Session,
        tenant_id: str,
        branch_id: str,
        order_id: str,
        delivery_status: str,
    ) -> dict:
        if delivery_status not in DELIVERY_STATUSES:
            return {"success": False, "error_code": "INVALID_DELIVERY_STATUS"}
        order = OrderRepository.get_by_id(db, tenant_id, order_id)
        if not order or order.branch_id != branch_id:
            return {"success": False, "error_code": "ORDER_NOT_FOUND"}
        if order.type != "delivery":
            return {"success": False, "error_code": "NOT_A_DELIVERY_ORDER"}
        updated = OrderRepository.set_delivery_status(db, order, delivery_status)
        return {"success": True, "order": updated}

    @staticmethod
    def issue_credit_note(
        db: Session,
        tenant_id: str,
        branch_id: str,
        order_id: str,
        reason: str,
        performed_by: str | None = None,
        terminal_ip: str | None = None,
    ) -> dict:
        original = OrderRepository.get_by_id(db, tenant_id, order_id)
        if not original or original.branch_id != branch_id:
            return {"success": False, "error_code": "ORDER_NOT_FOUND"}
        if original.status != "paid":
            return {"success": False, "error_code": "ORDER_NOT_PAID"}
        if original.is_credit_note:
            return {"success": False, "error_code": "ALREADY_CREDIT_NOTE"}

        now = datetime.now(timezone.utc)
        fy = fiscal_year_from_ad(now) or ""
        bill_num = OrderRepository._next_bill_number(db, branch_id, fy)
        branch = BranchRepository.get_by_id(db, tenant_id, branch_id)
        # IRD: Electronic Billing Procedure 2082, clause 6.2ग — same
        # outlet-code requirement as OrderRepository.create.
        bill_code = format_invoice_number("RMS-CN", fy, bill_num, branch.code if branch else None)

        cn = RestroOrder(
            tenant_id=tenant_id,
            branch_id=branch_id,
            table_id=None,
            bill_number=bill_num,
            bill_code=bill_code,
            fiscal_year=fy,
            customer_id=original.customer_id,
            type=original.type,
            status="paid",
            kitchen_status="served",
            placed_at=now,
            paid_at=now,
            placed_at_bs=to_bs_iso(now) or "",
            paid_at_bs=to_bs_iso(now),
            discount_type=original.discount_type,
            discount_value=Decimal("0"),
            subtotal_amount=-(original.subtotal_amount or Decimal("0")),
            taxable_amount=-(original.taxable_amount or Decimal("0")),
            exempt_amount=-(original.exempt_amount or Decimal("0")),
            vat_amount=-(original.vat_amount or Decimal("0")),
            total_amount=-(original.total_amount or Decimal("0")),
            payment_method=original.payment_method,
            seller_name=original.seller_name,
            seller_address=original.seller_address,
            seller_pan=original.seller_pan,
            buyer_name=original.buyer_name,
            buyer_pan=original.buyer_pan,
            waiter_name="system",
            waiter_cred_id=performed_by,
            is_credit_note=True,
            original_order_id=original.id,
            note_reason=reason,
        )
        db.add(cn)
        db.flush()

        # Mirror each original line onto the credit note — negate qty (not
        # price), so the printed document reads as "returned: -2 x Steam
        # Momo @ Rs 180" instead of showing a bare total with no items.
        # Matches the same fix on IMS's issue_credit_note. No stock
        # restoration here (unlike IMS): menu items have no stock/qty field
        # of their own — RestroInventoryItem tracks raw ingredients, and
        # there's no built recipe/consumption link from an order line back
        # to ingredient quantities, so there's nothing to restore.
        for line in original.lines:
            if line.is_voided:
                continue
            db.add(RestroOrderLine(
                order_id=cn.id,
                menu_item_id=line.menu_item_id,
                name=line.name,
                variant_name=line.variant_name,
                price=line.price,
                qty=-line.qty,
                note=line.note,
                sent=True,
            ))
        db.flush()

        AuditRepository.write(
            db,
            tenant_id=tenant_id,
            app_code="restro",
            entity_type="order",
            entity_id=original.id,
            action="credit_note",
            performed_by=performed_by or "unknown",
            performer_type="staff",
            after_state={"credit_note_id": cn.id, "bill_number": bill_num, "reason": reason},
            terminal_ip=terminal_ip,
        )
        db.commit()
        db.refresh(cn)

        logger.info(f"Credit note issued for order {original.id}: CN bill#{bill_num}",
                    extra={"tenant_id": tenant_id})
        return {"success": True, "order": cn}

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _set_group_status(
        db: Session, tenant_id: str, table_id: str, status: str
    ) -> None:
        """Flip the status of a table AND every other table in its merge
        group. Matches the frontend's setTableStatus behavior."""
        ids = OrderRepository.merge_group_ids(db, tenant_id, table_id)
        tables = TableRepository.get_many_by_ids(db, tenant_id, ids)
        for t in tables:
            t.status = status
        db.commit()
