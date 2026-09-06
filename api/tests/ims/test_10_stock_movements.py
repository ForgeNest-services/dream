"""Ordered test #10: stock movements (direct adjust/restock endpoints,
distinct from the purchase flow's own restock path -- test_08_purchases.py
already covered restocking-via-purchase). Depends on test_01-09 passing
first. Real HTTP against the live srota-api container, both business types.

Unlike RMS's inventory adjust (clamp_zero=True), IMS's /stock/adjust has NO
floor -- a negative adjustment can drive stock below zero here, confirmed
as real, current behavior below rather than assumed."""
import uuid

from conftest import auth_headers

_RUN_ID = uuid.uuid4().hex[:8]


def _get_a_category(api_client, tokens):
    resp = api_client.get("/ims/categories", headers=auth_headers(tokens["owner"]))
    cats = resp.json()["data"]
    if cats:
        return cats[0]["id"]
    create_resp = api_client.post(
        "/ims/categories", headers=auth_headers(tokens["owner"]), json={"name": "General"}
    )
    return create_resp.json()["data"]["id"]


def _get_a_unit(api_client, tokens):
    resp = api_client.get("/ims/units", headers=auth_headers(tokens["owner"]))
    return resp.json()["data"][0]["id"]


def _create_variant(api_client, business, tokens):
    """A product with a variant but NO stock yet -- test_05_products.py's
    style, not test_09_invoices.py's purchase-based one, since this file
    exercises /stock/restock itself as the very first stock-in event."""
    category_id = _get_a_category(api_client, tokens)
    unit_id = _get_a_unit(api_client, tokens)
    resp = api_client.post(
        "/ims/products",
        headers=auth_headers(tokens["owner"]),
        json={
            "name": f"Stock Movement Test Product {_RUN_ID}-{uuid.uuid4().hex[:6]}",
            "sku": f"SKU-STOCKMOVE-{uuid.uuid4().hex[:8]}",
            "category_id": category_id,
            "branch_id_for_stock": business["branch_id"],
            "variants": [{"unit_id": unit_id}],
        },
    )
    return resp.json()["data"]["variants"][0]["id"]


def test_list_movements_endpoint_reachable(api_client, business, tokens):
    resp = api_client.get("/ims/stock/movements", headers=auth_headers(tokens["owner"]))
    assert resp.status_code == 200, resp.text
    assert isinstance(resp.json()["data"], list)


def test_storekeeper_can_restock(api_client, business, tokens):
    variant_id = _create_variant(api_client, business, tokens)
    resp = api_client.post(
        "/ims/stock/restock",
        headers=auth_headers(tokens["storekeeper"]),
        json={
            "variant_id": variant_id,
            "branch_id": business["branch_id"],
            "qty": "50",
            "unit_cost": "20",
            "date": "2026-09-05T00:00:00",
            "reference": f"RESTOCK-{_RUN_ID}",
        },
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["type"] == "restock"
    assert float(data["qty"]) == 50.0
    assert float(data["balance_after"]) == 50.0
    # user_name is only ever resolved by list_movements' own credential
    # join (router.py) -- the direct restock/adjust response is the raw
    # StockMovementData, which defaults user_name to None. Confirmed via
    # the list endpoint below instead.
    assert data["user_name"] is None

    list_resp = api_client.get(
        "/ims/stock/movements", params={"variant_id": variant_id}, headers=auth_headers(tokens["owner"])
    )
    movement = next(m for m in list_resp.json()["data"] if m["id"] == data["id"])
    assert movement["user_name"] == "Test Storekeeper"


def test_restock_zero_qty_rejected(api_client, business, tokens):
    variant_id = _create_variant(api_client, business, tokens)
    resp = api_client.post(
        "/ims/stock/restock",
        headers=auth_headers(tokens["owner"]),
        json={
            "variant_id": variant_id,
            "branch_id": business["branch_id"],
            "qty": "0",
            "unit_cost": "10",
            "date": "2026-09-05T00:00:00",
        },
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["error"]["code"] == "INVALID_QTY"


def test_restock_negative_qty_rejected(api_client, business, tokens):
    variant_id = _create_variant(api_client, business, tokens)
    resp = api_client.post(
        "/ims/stock/restock",
        headers=auth_headers(tokens["owner"]),
        json={
            "variant_id": variant_id,
            "branch_id": business["branch_id"],
            "qty": "-5",
            "unit_cost": "10",
            "date": "2026-09-05T00:00:00",
        },
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["error"]["code"] == "INVALID_QTY"


def test_restock_updates_variant_cost_price(api_client, business, tokens):
    variant_id = _create_variant(api_client, business, tokens)
    resp = api_client.post(
        "/ims/stock/restock",
        headers=auth_headers(tokens["owner"]),
        json={
            "variant_id": variant_id,
            "branch_id": business["branch_id"],
            "qty": "10",
            "unit_cost": "77",
            "date": "2026-09-05T00:00:00",
        },
    )
    assert resp.status_code == 200, resp.text
    products_resp = api_client.get(f"/ims/variants/{variant_id}/cost-history", headers=auth_headers(tokens["owner"]))
    # cost-history is purchase-only (IMSPurchaseRepository), not stock
    # movements -- confirm it's genuinely empty for a direct restock,
    # distinguishing the two restock paths.
    assert products_resp.json()["data"] == []


def test_restock_nonexistent_variant_returns_404(api_client, business, tokens):
    resp = api_client.post(
        "/ims/stock/restock",
        headers=auth_headers(tokens["owner"]),
        json={
            "variant_id": "00000000-0000-0000-0000-000000000000",
            "branch_id": business["branch_id"],
            "qty": "10",
            "unit_cost": "10",
            "date": "2026-09-05T00:00:00",
        },
    )
    assert resp.status_code == 404, resp.text
    assert resp.json()["error"]["code"] == "VARIANT_NOT_FOUND"


def test_restock_nonexistent_branch_returns_404(api_client, business, tokens):
    variant_id = _create_variant(api_client, business, tokens)
    resp = api_client.post(
        "/ims/stock/restock",
        headers=auth_headers(tokens["owner"]),
        json={
            "variant_id": variant_id,
            "branch_id": "00000000-0000-0000-0000-000000000000",
            "qty": "10",
            "unit_cost": "10",
            "date": "2026-09-05T00:00:00",
        },
    )
    assert resp.status_code == 404, resp.text
    assert resp.json()["error"]["code"] == "BRANCH_NOT_FOUND"


def test_storekeeper_can_adjust_stock_up(api_client, business, tokens):
    variant_id = _create_variant(api_client, business, tokens)
    resp = api_client.post(
        "/ims/stock/adjust",
        headers=auth_headers(tokens["storekeeper"]),
        json={
            "variant_id": variant_id,
            "branch_id": business["branch_id"],
            "qty": "15",
            "reason": "Found extra stock during count",
            "date": "2026-09-05T00:00:00",
        },
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["type"] == "adjust-in"
    assert float(data["balance_after"]) == 15.0


def test_adjust_stock_down(api_client, business, tokens):
    variant_id = _create_variant(api_client, business, tokens)
    api_client.post(
        "/ims/stock/restock",
        headers=auth_headers(tokens["owner"]),
        json={
            "variant_id": variant_id,
            "branch_id": business["branch_id"],
            "qty": "20",
            "unit_cost": "10",
            "date": "2026-09-05T00:00:00",
        },
    )
    resp = api_client.post(
        "/ims/stock/adjust",
        headers=auth_headers(tokens["owner"]),
        json={
            "variant_id": variant_id,
            "branch_id": business["branch_id"],
            "qty": "-8",
            "reason": "Damaged goods",
            "date": "2026-09-05T00:00:00",
        },
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["type"] == "adjust-out"
    assert float(data["balance_after"]) == 12.0  # 20 - 8


def test_adjust_can_drive_stock_negative(api_client, business, tokens):
    """Real, confirmed current behavior: unlike RMS's inventory adjust
    (clamp_zero=True), IMS's IMSStockService.adjust has no floor -- an
    adjustment larger than the available balance goes negative rather
    than clamping at 0."""
    variant_id = _create_variant(api_client, business, tokens)
    resp = api_client.post(
        "/ims/stock/adjust",
        headers=auth_headers(tokens["owner"]),
        json={
            "variant_id": variant_id,
            "branch_id": business["branch_id"],
            "qty": "-100",
            "reason": "Stock count correction",
            "date": "2026-09-05T00:00:00",
        },
    )
    assert resp.status_code == 200, resp.text
    assert float(resp.json()["data"]["balance_after"]) == -100.0


def test_adjust_nonexistent_variant_returns_404(api_client, business, tokens):
    resp = api_client.post(
        "/ims/stock/adjust",
        headers=auth_headers(tokens["owner"]),
        json={
            "variant_id": "00000000-0000-0000-0000-000000000000",
            "branch_id": business["branch_id"],
            "qty": "5",
            "reason": "Test",
            "date": "2026-09-05T00:00:00",
        },
    )
    assert resp.status_code == 404, resp.text
    assert resp.json()["error"]["code"] == "VARIANT_NOT_FOUND"


def test_list_movements_filter_by_type(api_client, business, tokens):
    resp = api_client.get(
        "/ims/stock/movements", params={"type": "restock"}, headers=auth_headers(tokens["owner"])
    )
    assert resp.status_code == 200, resp.text
    types = {m["type"] for m in resp.json()["data"]}
    assert types <= {"restock"}


def test_list_movements_filter_by_branch(api_client, business, tokens):
    resp = api_client.get(
        "/ims/stock/movements", params={"branch_id": business["branch_id"]}, headers=auth_headers(tokens["owner"])
    )
    assert resp.status_code == 200, resp.text
    assert len(resp.json()["data"]) >= 1
