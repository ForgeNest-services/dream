"""Ordered test #8: orders (dine-in + delivery, lines, kitchen flow, mark
paid, cancel, credit note). Depends on test_01-07 passing first. Builds its
own real table/customer/menu-item since earlier test files delete theirs.
Real HTTP against the live srota-api container, both business types.

Table labels here MUST be unique per run (not fixed strings) -- once an
order is marked paid or cancelled, its table becomes permanently
undeletable too (restro_orders_immutability's table_id FK survives the
reset script by design, see reset_dummy_tenants.py). A fixed label like
"OrderTestTable" would collide with every previous run's now-permanent
table of the same name. Found for real: the first version of this file did
exactly that and broke on the second full-suite run."""
import uuid
import pytest

from conftest import auth_headers

_RUN_ID = uuid.uuid4().hex[:8]


@pytest.fixture(scope="module")
def order_fixtures(api_client, business, tokens):
    """One real zone->table, one real menu item, one real customer per
    business -- built fresh here since earlier test files' own state gets
    deleted by their own tests."""
    zones_resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/zones",
        headers=auth_headers(tokens["owner"]),
    )
    zone_id = zones_resp.json()["data"][0]["id"]

    table_resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/tables",
        headers=auth_headers(tokens["owner"]),
        json={"zone_id": zone_id, "label": f"OrderTestTable-{_RUN_ID}"},
    )
    table = table_resp.json()["data"]

    cat_resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/categories",
        headers=auth_headers(tokens["owner"]),
    )
    category_id = cat_resp.json()["data"][0]["id"]

    item_resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/menu-items",
        headers=auth_headers(tokens["owner"]),
        json={"category_id": category_id, "name": "Order Test Item", "price": "100"},
    )
    menu_item = item_resp.json()["data"]

    variant_item_resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/menu-items",
        headers=auth_headers(tokens["owner"]),
        json={
            "category_id": category_id,
            "name": "Order Test Variant Item",
            "has_variants": True,
            "variants": [{"name": "Small", "price": "50"}, {"name": "Large", "price": "90"}],
        },
    )
    variant_item = variant_item_resp.json()["data"]

    customer_resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/customers",
        headers=auth_headers(tokens["owner"]),
        json={"name": "Order Test Customer", "phone": "9811111111"},
    )
    customer = customer_resp.json()["data"]

    return {
        "table": table,
        "menu_item": menu_item,
        "variant_item": variant_item,
        "customer": customer,
    }


def test_dine_in_order_requires_table(api_client, business, tokens):
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/orders",
        headers=auth_headers(tokens["waiter"]),
        json={"type": "dine-in"},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "TABLE_REQUIRED"


def test_delivery_order_requires_customer(api_client, business, tokens):
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/orders",
        headers=auth_headers(tokens["waiter"]),
        json={"type": "delivery"},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "CUSTOMER_REQUIRED"


def test_invalid_order_type_rejected(api_client, business, tokens):
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/orders",
        headers=auth_headers(tokens["waiter"]),
        json={"type": "takeaway"},
    )
    assert resp.status_code == 422


def test_any_staff_can_create_dine_in_order(api_client, business, tokens, order_fixtures):
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/orders",
        headers=auth_headers(tokens["waiter"]),
        json={"type": "dine-in", "table_id": order_fixtures["table"]["id"]},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()["data"]
    assert data["type"] == "dine-in"
    assert data["status"] == "draft"
    assert data["table_id"] == order_fixtures["table"]["id"]
    assert data["total_amount"] is None  # not computed until paid


def test_table_already_has_draft_rejected(api_client, business, tokens, order_fixtures):
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/orders",
        headers=auth_headers(tokens["owner"]),
        json={"type": "dine-in", "table_id": order_fixtures["table"]["id"]},
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "TABLE_ALREADY_HAS_DRAFT"


def _get_draft_order(api_client, business, tokens, order_fixtures):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/orders/by-table/{order_fixtures['table']['id']}",
        headers=auth_headers(tokens["owner"]),
    )
    return resp.json()["data"]


class TestOrderLines:
    def test_add_line_from_menu_item(self, api_client, business, tokens, order_fixtures):
        order = _get_draft_order(api_client, business, tokens, order_fixtures)

        resp = api_client.post(
            f"/restro/branches/{business['branch_id']}/orders/{order['id']}/lines",
            headers=auth_headers(tokens["waiter"]),
            json={"menu_item_id": order_fixtures["menu_item"]["id"], "qty": 2},
        )
        assert resp.status_code == 200, resp.text
        lines = resp.json()["data"]["lines"]
        assert len(lines) == 1
        assert lines[0]["name"] == "Order Test Item"
        assert float(lines[0]["price"]) == 100.0
        assert lines[0]["qty"] == 2

    def test_variant_item_requires_variant_name(self, api_client, business, tokens, order_fixtures):
        order = _get_draft_order(api_client, business, tokens, order_fixtures)

        resp = api_client.post(
            f"/restro/branches/{business['branch_id']}/orders/{order['id']}/lines",
            headers=auth_headers(tokens["waiter"]),
            json={"menu_item_id": order_fixtures["variant_item"]["id"], "qty": 1},
        )
        assert resp.status_code == 422
        assert resp.json()["error"]["code"] == "VARIANT_REQUIRED"

    def test_add_line_with_variant(self, api_client, business, tokens, order_fixtures):
        order = _get_draft_order(api_client, business, tokens, order_fixtures)

        resp = api_client.post(
            f"/restro/branches/{business['branch_id']}/orders/{order['id']}/lines",
            headers=auth_headers(tokens["waiter"]),
            json={
                "menu_item_id": order_fixtures["variant_item"]["id"],
                "variant_name": "Large",
                "qty": 1,
            },
        )
        assert resp.status_code == 200, resp.text
        lines = resp.json()["data"]["lines"]
        large_line = next(l for l in lines if l["variant_name"] == "Large")
        assert float(large_line["price"]) == 90.0

    def test_sold_out_item_rejected(self, api_client, business, tokens, order_fixtures):
        # Mark the plain item sold out, confirm it can no longer be ordered.
        api_client.patch(
            f"/restro/branches/{business['branch_id']}/menu-items/{order_fixtures['menu_item']['id']}/sold-out",
            headers=auth_headers(tokens["chef"]),
            json={"sold_out": True},
        )
        order = _get_draft_order(api_client, business, tokens, order_fixtures)

        resp = api_client.post(
            f"/restro/branches/{business['branch_id']}/orders/{order['id']}/lines",
            headers=auth_headers(tokens["waiter"]),
            json={"menu_item_id": order_fixtures["menu_item"]["id"], "qty": 1},
        )
        assert resp.status_code == 409
        assert resp.json()["error"]["code"] == "ITEM_SOLD_OUT"

        # Un-sell-out for the rest of the suite.
        api_client.patch(
            f"/restro/branches/{business['branch_id']}/menu-items/{order_fixtures['menu_item']['id']}/sold-out",
            headers=auth_headers(tokens["chef"]),
            json={"sold_out": False},
        )

    def test_add_off_menu_line(self, api_client, business, tokens, order_fixtures):
        order = _get_draft_order(api_client, business, tokens, order_fixtures)

        resp = api_client.post(
            f"/restro/branches/{business['branch_id']}/orders/{order['id']}/lines",
            headers=auth_headers(tokens["waiter"]),
            json={"name": "Custom Special", "price": "75", "qty": 1},
        )
        assert resp.status_code == 200, resp.text
        lines = resp.json()["data"]["lines"]
        custom_line = next(l for l in lines if l["name"] == "Custom Special")
        assert float(custom_line["price"]) == 75.0

    def test_off_menu_line_needs_name_and_price(self, api_client, business, tokens, order_fixtures):
        order = _get_draft_order(api_client, business, tokens, order_fixtures)

        resp = api_client.post(
            f"/restro/branches/{business['branch_id']}/orders/{order['id']}/lines",
            headers=auth_headers(tokens["waiter"]),
            json={"name": "No Price", "qty": 1},
        )
        assert resp.status_code == 422
        assert resp.json()["error"]["code"] == "NAME_AND_PRICE_REQUIRED"


class TestKitchenFlow:
    def test_send_to_kitchen(self, api_client, business, tokens, order_fixtures):
        order = _get_draft_order(api_client, business, tokens, order_fixtures)

        resp = api_client.post(
            f"/restro/branches/{business['branch_id']}/orders/{order['id']}/send-to-kitchen",
            headers=auth_headers(tokens["waiter"]),
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["data"]["kitchen_status"] in ("new", "cooking")

    def test_update_kitchen_status(self, api_client, business, tokens, order_fixtures):
        order = _get_draft_order(api_client, business, tokens, order_fixtures)

        resp = api_client.patch(
            f"/restro/branches/{business['branch_id']}/orders/{order['id']}/kitchen-status",
            headers=auth_headers(tokens["chef"]),
            json={"kitchen_status": "ready"},
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["data"]["kitchen_status"] == "ready"

    def test_invalid_kitchen_status_rejected(self, api_client, business, tokens, order_fixtures):
        """Rejected by UpdateKitchenStatusRequest's own field_validator
        (schemas.py) before it ever reaches the service layer -- FastAPI
        surfaces Pydantic ValueErrors as a generic VALIDATION_ERROR, not
        _order_error's INVALID_KITCHEN_STATUS mapping (that code exists for
        a different call path -- confirmed live, not assumed)."""
        order = _get_draft_order(api_client, business, tokens, order_fixtures)

        resp = api_client.patch(
            f"/restro/branches/{business['branch_id']}/orders/{order['id']}/kitchen-status",
            headers=auth_headers(tokens["chef"]),
            json={"kitchen_status": "on-fire"},
        )
        assert resp.status_code == 422
        assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


class TestMarkPaidAndCreditNote:
    def test_invalid_payment_method_rejected(self, api_client, business, tokens, order_fixtures):
        """Same story as kitchen-status -- MarkPaidRequest's own
        field_validator rejects this before the service layer, so FastAPI
        returns the generic VALIDATION_ERROR, not INVALID_PAYMENT_METHOD."""
        order = _get_draft_order(api_client, business, tokens, order_fixtures)

        resp = api_client.post(
            f"/restro/branches/{business['branch_id']}/orders/{order['id']}/mark-paid",
            headers=auth_headers(tokens["owner"]),
            json={"payment_method": "bitcoin"},
        )
        assert resp.status_code == 422
        assert resp.json()["error"]["code"] == "VALIDATION_ERROR"

    def test_mark_paid_with_cash(self, api_client, business, tokens, order_fixtures):
        order = _get_draft_order(api_client, business, tokens, order_fixtures)

        resp = api_client.post(
            f"/restro/branches/{business['branch_id']}/orders/{order['id']}/mark-paid",
            headers=auth_headers(tokens["owner"]),
            json={"payment_method": "cash"},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert data["status"] == "paid"
        assert data["payment_method"] == "cash"
        assert data["total_amount"] is not None
        assert data["bill_code"] is not None

    def test_paid_order_cannot_add_lines(self, api_client, business, tokens, order_fixtures):
        order = _get_draft_order(api_client, business, tokens, order_fixtures) or {}
        # Draft is gone now (it's paid) -- fetch by its known id instead via
        # the paginated list, filtering to this table's most recent order.
        list_resp = api_client.get(
            f"/restro/branches/{business['branch_id']}/orders",
            params={"table_id": order_fixtures["table"]["id"]},
            headers=auth_headers(tokens["owner"]),
        )
        paid_order = next(o for o in list_resp.json()["data"] if o["status"] == "paid")

        resp = api_client.post(
            f"/restro/branches/{business['branch_id']}/orders/{paid_order['id']}/lines",
            headers=auth_headers(tokens["waiter"]),
            json={"name": "Too Late", "price": "10", "qty": 1},
        )
        assert resp.status_code == 409
        assert resp.json()["error"]["code"] == "ORDER_NOT_EDITABLE"

    def test_waiter_cannot_issue_credit_note(self, api_client, business, tokens, order_fixtures):
        list_resp = api_client.get(
            f"/restro/branches/{business['branch_id']}/orders",
            params={"table_id": order_fixtures["table"]["id"]},
            headers=auth_headers(tokens["owner"]),
        )
        paid_order = next(o for o in list_resp.json()["data"] if o["status"] == "paid")

        resp = api_client.post(
            f"/restro/branches/{business['branch_id']}/orders/{paid_order['id']}/credit-note",
            headers=auth_headers(tokens["waiter"]),
            json={"reason": "Should fail"},
        )
        assert resp.status_code == 403

    def test_credit_note_needs_a_reason(self, api_client, business, tokens, order_fixtures):
        list_resp = api_client.get(
            f"/restro/branches/{business['branch_id']}/orders",
            params={"table_id": order_fixtures["table"]["id"]},
            headers=auth_headers(tokens["owner"]),
        )
        paid_order = next(o for o in list_resp.json()["data"] if o["status"] == "paid")

        resp = api_client.post(
            f"/restro/branches/{business['branch_id']}/orders/{paid_order['id']}/credit-note",
            headers=auth_headers(tokens["owner"]),
            json={"reason": "  "},
        )
        assert resp.status_code == 422

    def test_owner_can_issue_credit_note(self, api_client, business, tokens, order_fixtures):
        list_resp = api_client.get(
            f"/restro/branches/{business['branch_id']}/orders",
            params={"table_id": order_fixtures["table"]["id"]},
            headers=auth_headers(tokens["owner"]),
        )
        paid_order = next(o for o in list_resp.json()["data"] if o["status"] == "paid")

        resp = api_client.post(
            f"/restro/branches/{business['branch_id']}/orders/{paid_order['id']}/credit-note",
            headers=auth_headers(tokens["owner"]),
            json={"reason": "Customer complaint, refunded"},
        )
        assert resp.status_code == 201, resp.text
        credit_note = resp.json()["data"]
        assert credit_note["original_order_id"] == paid_order["id"]

    def test_credit_note_on_already_credited_order_rejected(
        self, api_client, business, tokens, order_fixtures
    ):
        """A real gap found via this test: issue_credit_note only checked
        whether the target row IS a credit note, not whether the original
        order ALREADY HAS one -- a second call here used to return 201
        every time, letting the same paid bill be credited unlimited
        times. Fixed in order_service.py (CREDIT_NOTE_ALREADY_ISSUED)."""
        list_resp = api_client.get(
            f"/restro/branches/{business['branch_id']}/orders",
            params={"table_id": order_fixtures["table"]["id"]},
            headers=auth_headers(tokens["owner"]),
        )
        paid_order = next(o for o in list_resp.json()["data"] if o["status"] == "paid")

        resp = api_client.post(
            f"/restro/branches/{business['branch_id']}/orders/{paid_order['id']}/credit-note",
            headers=auth_headers(tokens["owner"]),
            json={"reason": "Second attempt"},
        )
        assert resp.status_code == 409
        assert resp.json()["error"]["code"] == "CREDIT_NOTE_ALREADY_ISSUED"


class TestCancelOrder:
    def test_cancel_a_draft_order(self, api_client, business, tokens, order_fixtures):
        # A fresh draft dine-in order on a fresh table, specifically to test
        # cancellation without disturbing the already-paid order above.
        zones_resp = api_client.get(
            f"/restro/branches/{business['branch_id']}/zones",
            headers=auth_headers(tokens["owner"]),
        )
        zone_id = zones_resp.json()["data"][0]["id"]
        table_resp = api_client.post(
            f"/restro/branches/{business['branch_id']}/tables",
            headers=auth_headers(tokens["owner"]),
            json={"zone_id": zone_id, "label": f"CancelTestTable-{_RUN_ID}"},
        )
        cancel_table = table_resp.json()["data"]

        create_resp = api_client.post(
            f"/restro/branches/{business['branch_id']}/orders",
            headers=auth_headers(tokens["waiter"]),
            json={"type": "dine-in", "table_id": cancel_table["id"]},
        )
        order = create_resp.json()["data"]

        resp = api_client.post(
            f"/restro/branches/{business['branch_id']}/orders/{order['id']}/cancel",
            headers=auth_headers(tokens["waiter"]),
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["data"]["status"] == "cancelled"

    def test_cancelled_order_cannot_be_cancelled_again(
        self, api_client, business, tokens, order_fixtures
    ):
        list_resp = api_client.get(
            f"/restro/branches/{business['branch_id']}/orders",
            params={"status": "cancelled"},
            headers=auth_headers(tokens["owner"]),
        )
        cancelled_order = list_resp.json()["data"][0]

        resp = api_client.post(
            f"/restro/branches/{business['branch_id']}/orders/{cancelled_order['id']}/cancel",
            headers=auth_headers(tokens["owner"]),
        )
        assert resp.status_code == 409
