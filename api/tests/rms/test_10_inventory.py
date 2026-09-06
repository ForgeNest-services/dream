"""Ordered test #10: inventory (stock items + restock/adjust movements).
Depends on test_01-09 passing first. Starts genuinely empty (no auto-seed).
Real HTTP against the live srota-api container, both business types."""
from conftest import auth_headers


def test_list_inventory_starts_empty(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/inventory",
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"] == []


def test_waiter_cannot_create_inventory_item(api_client, business, tokens):
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/inventory",
        headers=auth_headers(tokens["waiter"]),
        json={"name": "Rice", "unit": "kg"},
    )
    assert resp.status_code == 403, resp.text


def test_manager_can_create_inventory_item(api_client, business, tokens):
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/inventory",
        headers=auth_headers(tokens["manager"]),
        json={"name": "Rice", "category": "Grains", "unit": "kg", "threshold": "5", "stock": "20"},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()["data"]
    assert data["name"] == "Rice"
    assert data["category"] == "Grains"
    assert data["unit"] == "kg"
    assert float(data["threshold"]) == 5.0
    assert float(data["stock"]) == 20.0
    assert data["is_active"] is True


def test_create_inventory_item_defaults(api_client, business, tokens):
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/inventory",
        headers=auth_headers(tokens["owner"]),
        json={"name": "Cooking Oil"},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()["data"]
    assert data["category"] == "Other"
    assert data["unit"] == "piece"
    assert float(data["threshold"]) == 0.0
    assert float(data["stock"]) == 0.0


def test_empty_name_rejected(api_client, business, tokens):
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/inventory",
        headers=auth_headers(tokens["owner"]),
        json={"name": "   "},
    )
    assert resp.status_code == 422, resp.text


def test_invalid_unit_rejected(api_client, business, tokens):
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/inventory",
        headers=auth_headers(tokens["owner"]),
        json={"name": "Sugar", "unit": "gallon"},
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["error"]["code"] == "INVALID_UNIT"


def test_negative_threshold_rejected(api_client, business, tokens):
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/inventory",
        headers=auth_headers(tokens["owner"]),
        json={"name": "Sugar", "threshold": "-1"},
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["error"]["code"] == "INVALID_THRESHOLD"


def test_negative_stock_rejected(api_client, business, tokens):
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/inventory",
        headers=auth_headers(tokens["owner"]),
        json={"name": "Sugar", "stock": "-1"},
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["error"]["code"] == "INVALID_STOCK"


def test_duplicate_name_rejected(api_client, business, tokens):
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/inventory",
        headers=auth_headers(tokens["owner"]),
        json={"name": "Rice"},
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["error"]["code"] == "NAME_TAKEN"


def test_opening_stock_recorded_as_initial_movement(api_client, business, tokens):
    """Rice was created with stock=20 -- that should show up as one
    'Initial stock' restock movement, not a phantom starting quantity."""
    list_resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/inventory",
        headers=auth_headers(tokens["waiter"]),
    )
    rice = next(i for i in list_resp.json()["data"] if i["name"] == "Rice")
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/inventory/{rice['id']}/movements",
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp.status_code == 200, resp.text
    movements = resp.json()["data"]
    assert len(movements) == 1
    assert movements[0]["type"] == "restock"
    assert movements[0]["reason"] == "Initial stock"
    assert float(movements[0]["delta"]) == 20.0


def test_manager_can_update_item(api_client, business, tokens):
    list_resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/inventory",
        headers=auth_headers(tokens["waiter"]),
    )
    rice = next(i for i in list_resp.json()["data"] if i["name"] == "Rice")
    resp = api_client.patch(
        f"/restro/branches/{business['branch_id']}/inventory/{rice['id']}",
        headers=auth_headers(tokens["manager"]),
        json={"threshold": "10", "category": "Staples"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert float(data["threshold"]) == 10.0
    assert data["category"] == "Staples"
    assert data["name"] == "Rice"


def test_waiter_cannot_update_item(api_client, business, tokens):
    list_resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/inventory",
        headers=auth_headers(tokens["waiter"]),
    )
    rice = next(i for i in list_resp.json()["data"] if i["name"] == "Rice")
    resp = api_client.patch(
        f"/restro/branches/{business['branch_id']}/inventory/{rice['id']}",
        headers=auth_headers(tokens["waiter"]),
        json={"threshold": "1"},
    )
    assert resp.status_code == 403, resp.text


def test_update_invalid_unit_rejected(api_client, business, tokens):
    list_resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/inventory",
        headers=auth_headers(tokens["waiter"]),
    )
    rice = next(i for i in list_resp.json()["data"] if i["name"] == "Rice")
    resp = api_client.patch(
        f"/restro/branches/{business['branch_id']}/inventory/{rice['id']}",
        headers=auth_headers(tokens["owner"]),
        json={"unit": "gallon"},
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["error"]["code"] == "INVALID_UNIT"


def test_updating_nonexistent_item_returns_404(api_client, business, tokens):
    resp = api_client.patch(
        f"/restro/branches/{business['branch_id']}/inventory/00000000-0000-0000-0000-000000000000",
        headers=auth_headers(tokens["owner"]),
        json={"threshold": "1"},
    )
    assert resp.status_code == 404, resp.text
    assert resp.json()["error"]["code"] == "ITEM_NOT_FOUND"


class TestRestock:
    """Restock is deliberately open to ANY staff role -- a waiter or chef
    receiving a delivery in the kitchen shouldn't need a manager present."""

    def test_any_staff_can_restock(self, api_client, business, tokens):
        list_resp = api_client.get(
            f"/restro/branches/{business['branch_id']}/inventory",
            headers=auth_headers(tokens["waiter"]),
        )
        rice = next(i for i in list_resp.json()["data"] if i["name"] == "Rice")
        resp = api_client.post(
            f"/restro/branches/{business['branch_id']}/inventory/{rice['id']}/restock",
            headers=auth_headers(tokens["chef"]),
            json={"qty": "10", "cost": "1500", "note": "Weekly delivery"},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert float(data["item"]["stock"]) == 30.0  # 20 + 10
        assert data["movement"]["type"] == "restock"
        assert float(data["movement"]["delta"]) == 10.0
        assert float(data["movement"]["cost"]) == 1500.0
        assert data["movement"]["note"] == "Weekly delivery"

    def test_restock_zero_qty_rejected(self, api_client, business, tokens):
        list_resp = api_client.get(
            f"/restro/branches/{business['branch_id']}/inventory",
            headers=auth_headers(tokens["waiter"]),
        )
        rice = next(i for i in list_resp.json()["data"] if i["name"] == "Rice")
        resp = api_client.post(
            f"/restro/branches/{business['branch_id']}/inventory/{rice['id']}/restock",
            headers=auth_headers(tokens["waiter"]),
            json={"qty": "0"},
        )
        assert resp.status_code == 422, resp.text
        assert resp.json()["error"]["code"] == "INVALID_QTY"

    def test_restock_negative_qty_rejected(self, api_client, business, tokens):
        list_resp = api_client.get(
            f"/restro/branches/{business['branch_id']}/inventory",
            headers=auth_headers(tokens["waiter"]),
        )
        rice = next(i for i in list_resp.json()["data"] if i["name"] == "Rice")
        resp = api_client.post(
            f"/restro/branches/{business['branch_id']}/inventory/{rice['id']}/restock",
            headers=auth_headers(tokens["waiter"]),
            json={"qty": "-5"},
        )
        assert resp.status_code == 422, resp.text
        assert resp.json()["error"]["code"] == "INVALID_QTY"

    def test_restock_negative_cost_rejected(self, api_client, business, tokens):
        list_resp = api_client.get(
            f"/restro/branches/{business['branch_id']}/inventory",
            headers=auth_headers(tokens["waiter"]),
        )
        rice = next(i for i in list_resp.json()["data"] if i["name"] == "Rice")
        resp = api_client.post(
            f"/restro/branches/{business['branch_id']}/inventory/{rice['id']}/restock",
            headers=auth_headers(tokens["waiter"]),
            json={"qty": "5", "cost": "-1"},
        )
        assert resp.status_code == 422, resp.text
        assert resp.json()["error"]["code"] == "INVALID_COST"


class TestAdjust:
    """Adjust is also open to any staff role (e.g. reporting spoilage/wastage
    on the spot), but always requires a reason."""

    def test_any_staff_can_adjust_down(self, api_client, business, tokens):
        list_resp = api_client.get(
            f"/restro/branches/{business['branch_id']}/inventory",
            headers=auth_headers(tokens["waiter"]),
        )
        rice = next(i for i in list_resp.json()["data"] if i["name"] == "Rice")
        resp = api_client.post(
            f"/restro/branches/{business['branch_id']}/inventory/{rice['id']}/adjust",
            headers=auth_headers(tokens["chef"]),
            json={"delta": "-5", "reason": "Spoilage", "note": "Rice bag got wet"},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert float(data["item"]["stock"]) == 25.0  # 30 - 5
        assert data["movement"]["type"] == "adjust"
        assert float(data["movement"]["delta"]) == -5.0
        assert data["movement"]["reason"] == "Spoilage"

    def test_adjust_clamps_at_zero(self, api_client, business, tokens):
        """clamp_zero=True -- an adjustment that would push stock negative
        is clamped to exactly 0, not rejected and not allowed to go negative."""
        resp = api_client.post(
            f"/restro/branches/{business['branch_id']}/inventory",
            headers=auth_headers(tokens["owner"]),
            json={"name": "Small Stock Item", "stock": "3"},
        )
        item_id = resp.json()["data"]["id"]
        resp2 = api_client.post(
            f"/restro/branches/{business['branch_id']}/inventory/{item_id}/adjust",
            headers=auth_headers(tokens["owner"]),
            json={"delta": "-100", "reason": "Stock count correction"},
        )
        assert resp2.status_code == 200, resp2.text
        assert float(resp2.json()["data"]["item"]["stock"]) == 0.0

    def test_adjust_zero_delta_rejected(self, api_client, business, tokens):
        list_resp = api_client.get(
            f"/restro/branches/{business['branch_id']}/inventory",
            headers=auth_headers(tokens["waiter"]),
        )
        rice = next(i for i in list_resp.json()["data"] if i["name"] == "Rice")
        resp = api_client.post(
            f"/restro/branches/{business['branch_id']}/inventory/{rice['id']}/adjust",
            headers=auth_headers(tokens["waiter"]),
            json={"delta": "0", "reason": "No change"},
        )
        assert resp.status_code == 422, resp.text
        assert resp.json()["error"]["code"] == "INVALID_DELTA"

    def test_adjust_without_reason_rejected(self, api_client, business, tokens):
        """AdjustStockRequest's own Pydantic field_validator rejects a blank
        reason before the service layer's REASON_REQUIRED check is ever
        reached -- same VALIDATION_ERROR pattern as order kitchen_status/
        payment_method (test_08_orders.py)."""
        list_resp = api_client.get(
            f"/restro/branches/{business['branch_id']}/inventory",
            headers=auth_headers(tokens["waiter"]),
        )
        rice = next(i for i in list_resp.json()["data"] if i["name"] == "Rice")
        resp = api_client.post(
            f"/restro/branches/{business['branch_id']}/inventory/{rice['id']}/adjust",
            headers=auth_headers(tokens["waiter"]),
            json={"delta": "-1", "reason": "   "},
        )
        assert resp.status_code == 422, resp.text
        assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


def test_movements_list_newest_actions_present(api_client, business, tokens):
    list_resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/inventory",
        headers=auth_headers(tokens["waiter"]),
    )
    rice = next(i for i in list_resp.json()["data"] if i["name"] == "Rice")
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/inventory/{rice['id']}/movements",
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp.status_code == 200, resp.text
    types = [m["type"] for m in resp.json()["data"]]
    assert types.count("restock") == 2  # initial stock + weekly delivery
    assert types.count("adjust") == 1


def test_movements_for_nonexistent_item_returns_404(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/inventory/00000000-0000-0000-0000-000000000000/movements",
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp.status_code == 404, resp.text
    assert resp.json()["error"]["code"] == "ITEM_NOT_FOUND"


def test_waiter_cannot_delete_item(api_client, business, tokens):
    list_resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/inventory",
        headers=auth_headers(tokens["waiter"]),
    )
    rice = next(i for i in list_resp.json()["data"] if i["name"] == "Rice")
    resp = api_client.delete(
        f"/restro/branches/{business['branch_id']}/inventory/{rice['id']}",
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp.status_code == 403, resp.text


def test_owner_can_delete_item(api_client, business, tokens):
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/inventory",
        headers=auth_headers(tokens["owner"]),
        json={"name": "Disposable Cups"},
    )
    item_id = resp.json()["data"]["id"]
    del_resp = api_client.delete(
        f"/restro/branches/{business['branch_id']}/inventory/{item_id}",
        headers=auth_headers(tokens["owner"]),
    )
    assert del_resp.status_code == 200, del_resp.text

    list_resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/inventory",
        headers=auth_headers(tokens["waiter"]),
    )
    names = {i["name"] for i in list_resp.json()["data"]}
    assert "Disposable Cups" not in names
