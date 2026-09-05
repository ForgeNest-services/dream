"""Ordered test #8: purchases (bulk stock-in against a supplier bill).
Depends on test_01-07 passing first -- needs a real category/unit (test_03/
04) and can optionally use a real supplier party (test_07).

Purchases are append-only (list + create only, no update/delete endpoints
at all) and support two item shapes in one request via a discriminated
union on "kind": "new" (creates a brand-new product+variant inline, in the
SAME request) or "existing" (restocks an already-existing variant and
updates its cost/selling price). Both write real ims_stock_movements rows
(type='restock'), which is exactly what makes a purchase's products
permanently undeletable later (per reset_dummy_tenants.py's own finding)."""
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


def test_list_purchases_endpoint_reachable(api_client, business, tokens):
    resp = api_client.get("/ims/purchases", headers=auth_headers(tokens["owner"]))
    assert resp.status_code == 200, resp.text
    assert isinstance(resp.json()["data"], list)


def test_storekeeper_can_create_purchase_with_new_product(api_client, business, tokens):
    category_id = _get_a_category(api_client, tokens)
    unit_id = _get_a_unit(api_client, tokens)
    resp = api_client.post(
        "/ims/purchases",
        headers=auth_headers(tokens["storekeeper"]),
        json={
            "date": "2026-09-05T00:00:00",
            "branch_id": business["branch_id"],
            "bill_no": f"BILL-{_RUN_ID}",
            "bill_amount": "5000",
            "items": [
                {
                    "kind": "new",
                    "name": f"Purchased New Item {_RUN_ID}",
                    "sku": f"SKU-PURCHASE-NEW-{_RUN_ID}",
                    "category_id": category_id,
                    "rows": [
                        {"unit_id": unit_id, "qty": "50", "unit_cost": "100", "selling_price": "150"}
                    ],
                }
            ],
        },
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()["data"]
    assert data["bill_no"] == f"BILL-{_RUN_ID}"
    assert float(data["items_total"]) == 5000.0  # 50 * 100
    assert len(data["lines"]) == 1
    assert data["number"].startswith("PB-")


def test_purchase_with_no_items_rejected(api_client, business, tokens):
    resp = api_client.post(
        "/ims/purchases",
        headers=auth_headers(tokens["owner"]),
        json={
            "date": "2026-09-05T00:00:00",
            "branch_id": business["branch_id"],
            "items": [],
        },
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["error"]["code"] == "NO_ITEMS"


def test_purchase_nonexistent_branch_rejected(api_client, business, tokens):
    category_id = _get_a_category(api_client, tokens)
    unit_id = _get_a_unit(api_client, tokens)
    resp = api_client.post(
        "/ims/purchases",
        headers=auth_headers(tokens["owner"]),
        json={
            "date": "2026-09-05T00:00:00",
            "branch_id": "00000000-0000-0000-0000-000000000000",
            "items": [
                {
                    "kind": "new",
                    "name": "Doesn't matter",
                    "sku": f"SKU-NOBRANCH-{_RUN_ID}",
                    "category_id": category_id,
                    "rows": [{"unit_id": unit_id, "qty": "1", "unit_cost": "1"}],
                }
            ],
        },
    )
    assert resp.status_code == 404, resp.text
    assert resp.json()["error"]["code"] == "BRANCH_NOT_FOUND"


def test_purchase_new_item_duplicate_sku_rejected(api_client, business, tokens):
    category_id = _get_a_category(api_client, tokens)
    unit_id = _get_a_unit(api_client, tokens)
    resp = api_client.post(
        "/ims/purchases",
        headers=auth_headers(tokens["owner"]),
        json={
            "date": "2026-09-05T00:00:00",
            "branch_id": business["branch_id"],
            "items": [
                {
                    "kind": "new",
                    "name": "Duplicate SKU Attempt",
                    "sku": f"SKU-PURCHASE-NEW-{_RUN_ID}",  # already used above
                    "category_id": category_id,
                    "rows": [{"unit_id": unit_id, "qty": "1", "unit_cost": "1"}],
                }
            ],
        },
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["error"]["code"] == "SKU_TAKEN"


def test_purchase_new_item_nonexistent_category_rejected(api_client, business, tokens):
    unit_id = _get_a_unit(api_client, tokens)
    resp = api_client.post(
        "/ims/purchases",
        headers=auth_headers(tokens["owner"]),
        json={
            "date": "2026-09-05T00:00:00",
            "branch_id": business["branch_id"],
            "items": [
                {
                    "kind": "new",
                    "name": "Orphan Purchase Item",
                    "sku": f"SKU-ORPHANPURCHASE-{_RUN_ID}",
                    "category_id": "00000000-0000-0000-0000-000000000000",
                    "rows": [{"unit_id": unit_id, "qty": "1", "unit_cost": "1"}],
                }
            ],
        },
    )
    assert resp.status_code == 404, resp.text
    assert resp.json()["error"]["code"] == "CATEGORY_NOT_FOUND"


def test_purchase_restocks_existing_product_and_updates_cost(api_client, business, tokens):
    """The 'existing' item kind restocks a real, already-created variant --
    reuses the one from test_storekeeper_can_create_purchase_with_new_product
    -- and updates its cost_price/selling_price in place."""
    list_resp = api_client.get(
        "/ims/products", params={"q": f"Purchased New Item {_RUN_ID}"}, headers=auth_headers(tokens["owner"])
    )
    product = list_resp.json()["data"][0]
    variant = product["variants"][0]
    original_qty = float(variant["stock"][0]["qty"]) if variant["stock"] else 0.0

    resp = api_client.post(
        "/ims/purchases",
        headers=auth_headers(tokens["manager"]),
        json={
            "date": "2026-09-05T00:00:00",
            "branch_id": business["branch_id"],
            "items": [
                {
                    "kind": "existing",
                    "product_id": product["id"],
                    "rows": [
                        {"variant_id": variant["id"], "qty": "25", "unit_cost": "110", "selling_price": "160"}
                    ],
                }
            ],
        },
    )
    assert resp.status_code == 201, resp.text
    assert float(resp.json()["data"]["items_total"]) == 2750.0  # 25 * 110

    updated_product_resp = api_client.get(f"/ims/products/{product['id']}", headers=auth_headers(tokens["owner"]))
    updated_variant = updated_product_resp.json()["data"]["variants"][0]
    assert float(updated_variant["cost_price"]) == 110.0
    assert float(updated_variant["selling_price"]) == 160.0
    new_qty = float(updated_variant["stock"][0]["qty"])
    assert new_qty == original_qty + 25.0


def test_purchase_existing_item_nonexistent_product_rejected(api_client, business, tokens):
    resp = api_client.post(
        "/ims/purchases",
        headers=auth_headers(tokens["owner"]),
        json={
            "date": "2026-09-05T00:00:00",
            "branch_id": business["branch_id"],
            "items": [
                {
                    "kind": "existing",
                    "product_id": "00000000-0000-0000-0000-000000000000",
                    "rows": [{"variant_id": "00000000-0000-0000-0000-000000000000", "qty": "1", "unit_cost": "1"}],
                }
            ],
        },
    )
    assert resp.status_code == 404, resp.text
    assert resp.json()["error"]["code"] == "PRODUCT_NOT_FOUND"


def test_purchase_with_supplier_and_post_to_ledger(api_client, business, tokens):
    category_id = _get_a_category(api_client, tokens)
    unit_id = _get_a_unit(api_client, tokens)
    party_resp = api_client.post(
        "/ims/parties",
        headers=auth_headers(tokens["owner"]),
        json={"name": f"Purchase Supplier {_RUN_ID}", "kind": "supplier"},
    )
    party_id = party_resp.json()["data"]["id"]

    resp = api_client.post(
        "/ims/purchases",
        headers=auth_headers(tokens["owner"]),
        json={
            "date": "2026-09-05T00:00:00",
            "branch_id": business["branch_id"],
            "party_id": party_id,
            "bill_amount": "3000",
            "paid_amount": "1000",
            "payment_method": "cash",
            "post_to_ledger": True,
            "items": [
                {
                    "kind": "new",
                    "name": f"Ledger Test Item {_RUN_ID}",
                    "sku": f"SKU-LEDGERTEST-{_RUN_ID}",
                    "category_id": category_id,
                    "rows": [{"unit_id": unit_id, "qty": "10", "unit_cost": "300"}],
                }
            ],
        },
    )
    assert resp.status_code == 201, resp.text

    ledger_resp = api_client.get(f"/ims/parties/{party_id}/ledger", headers=auth_headers(tokens["owner"]))
    entries = ledger_resp.json()["data"]
    assert len(entries) == 2  # bill amount (credit) + paid amount (debit)
    descriptions = {e["description"] for e in entries}
    assert any("Purchase bill" in d for d in descriptions)
    assert any("Payment made" in d for d in descriptions)


def test_purchase_without_post_to_ledger_does_not_touch_ledger(api_client, business, tokens):
    category_id = _get_a_category(api_client, tokens)
    unit_id = _get_a_unit(api_client, tokens)
    party_resp = api_client.post(
        "/ims/parties",
        headers=auth_headers(tokens["owner"]),
        json={"name": f"No Ledger Supplier {_RUN_ID}", "kind": "supplier"},
    )
    party_id = party_resp.json()["data"]["id"]

    resp = api_client.post(
        "/ims/purchases",
        headers=auth_headers(tokens["owner"]),
        json={
            "date": "2026-09-05T00:00:00",
            "branch_id": business["branch_id"],
            "party_id": party_id,
            "bill_amount": "3000",
            "post_to_ledger": False,
            "items": [
                {
                    "kind": "new",
                    "name": f"No Ledger Item {_RUN_ID}",
                    "sku": f"SKU-NOLEDGER-{_RUN_ID}",
                    "category_id": category_id,
                    "rows": [{"unit_id": unit_id, "qty": "5", "unit_cost": "200"}],
                }
            ],
        },
    )
    assert resp.status_code == 201, resp.text

    ledger_resp = api_client.get(f"/ims/parties/{party_id}/ledger", headers=auth_headers(tokens["owner"]))
    assert ledger_resp.json()["data"] == []


def test_cost_history_for_variant(api_client, business, tokens):
    """test_purchase_restocks_existing_product_and_updates_cost bought the
    same variant twice at different costs (100, then 110) -- confirm both
    show up in the cost history, most recent first or at least both present."""
    list_resp = api_client.get(
        "/ims/products", params={"q": f"Purchased New Item {_RUN_ID}"}, headers=auth_headers(tokens["owner"])
    )
    product = list_resp.json()["data"][0]
    variant_id = product["variants"][0]["id"]

    resp = api_client.get(
        f"/ims/variants/{variant_id}/cost-history", headers=auth_headers(tokens["storekeeper"])
    )
    assert resp.status_code == 200, resp.text
    entries = resp.json()["data"]
    costs = {float(e["unit_cost"]) for e in entries}
    assert costs == {100.0, 110.0}


def test_cost_history_for_nonexistent_variant_returns_404(api_client, business, tokens):
    """This endpoint uses a plain raise HTTPException(404, ...), not the
    _purchase_error/error-map pattern the rest of this file's 404s go
    through -- so the real code is FastAPI's generic HTTP_ERROR, not
    VARIANT_NOT_FOUND."""
    resp = api_client.get(
        "/ims/variants/00000000-0000-0000-0000-000000000000/cost-history",
        headers=auth_headers(tokens["owner"]),
    )
    assert resp.status_code == 404, resp.text
    assert resp.json()["error"]["code"] == "HTTP_ERROR"


def test_filter_purchases_by_branch(api_client, business, tokens):
    resp = api_client.get(
        "/ims/purchases", params={"branch_id": business["branch_id"]}, headers=auth_headers(tokens["owner"])
    )
    assert resp.status_code == 200, resp.text
    assert len(resp.json()["data"]) >= 1


def test_search_purchases_by_bill_no(api_client, business, tokens):
    resp = api_client.get(
        "/ims/purchases", params={"q": f"BILL-{_RUN_ID}"}, headers=auth_headers(tokens["owner"])
    )
    assert resp.status_code == 200, resp.text
    bill_nos = {p["bill_no"] for p in resp.json()["data"]}
    assert f"BILL-{_RUN_ID}" in bill_nos
