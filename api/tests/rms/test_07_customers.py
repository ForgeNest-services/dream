"""Ordered test #7: customers (walk-in/khata customer records). Depends on
test_01-06 passing first. Unlike zones/categories/menu-items, customers do
NOT auto-seed -- a fresh branch genuinely starts with none. Real HTTP
against the live srota-api container, both business types."""
import pytest

from conftest import auth_headers


def test_list_customers_starts_empty(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/customers",
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"] == []


def test_any_staff_can_create_customer(api_client, business, tokens):
    """Unlike menu items/categories, waiter CAN create customers -- they
    may need to add one inline while closing an order as khata."""
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/customers",
        headers=auth_headers(tokens["waiter"]),
        json={"name": "Ram Sharma", "phone": "9800000001", "address": "Baneshwor"},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()["data"]
    assert data["name"] == "Ram Sharma"
    assert data["phone"] == "9800000001"
    assert data["is_active"] is True
    assert float(data["outstanding_balance"]) == 0.0


def test_empty_name_rejected(api_client, business, tokens):
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/customers",
        headers=auth_headers(tokens["owner"]),
        json={"name": "   "},
    )
    assert resp.status_code == 422


def test_customer_without_phone_allowed(api_client, business, tokens):
    """phone is optional -- a walk-in customer with just a name."""
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/customers",
        headers=auth_headers(tokens["chef"]),
        json={"name": "Walk-in Guest"},
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["data"]["phone"] is None


def test_duplicate_phone_in_same_branch_rejected(api_client, business, tokens):
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/customers",
        headers=auth_headers(tokens["owner"]),
        json={"name": "Different Name", "phone": "9800000001"},
    )
    assert resp.status_code == 409, resp.text
    body = resp.json()
    assert body["error"]["code"] == "PHONE_TAKEN"
    # The existing customer is returned so the client can offer "use
    # existing" instead of forcing a retry.
    assert body["error"]["details"]["existing_customer"]["name"] == "Ram Sharma"


def test_search_customers_by_name(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/customers",
        params={"q": "ram"},
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp.status_code == 200, resp.text
    names = {c["name"] for c in resp.json()["data"]}
    assert names == {"Ram Sharma"}


def test_waiter_cannot_update_customer(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/customers",
        params={"q": "ram"},
        headers=auth_headers(tokens["owner"]),
    )
    ram = resp.json()["data"][0]

    resp2 = api_client.patch(
        f"/restro/branches/{business['branch_id']}/customers/{ram['id']}",
        headers=auth_headers(tokens["waiter"]),
        json={"notes": "Should fail"},
    )
    assert resp2.status_code == 403


def test_manager_can_update_customer(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/customers",
        params={"q": "ram"},
        headers=auth_headers(tokens["owner"]),
    )
    ram = resp.json()["data"][0]

    resp2 = api_client.patch(
        f"/restro/branches/{business['branch_id']}/customers/{ram['id']}",
        headers=auth_headers(tokens["manager"]),
        json={"notes": "Regular customer, prefers window seat"},
    )
    assert resp2.status_code == 200, resp2.text
    assert resp2.json()["data"]["notes"] == "Regular customer, prefers window seat"


def test_clear_phone(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/customers",
        params={"q": "ram"},
        headers=auth_headers(tokens["owner"]),
    )
    ram = resp.json()["data"][0]
    assert ram["phone"] == "9800000001"

    resp2 = api_client.patch(
        f"/restro/branches/{business['branch_id']}/customers/{ram['id']}",
        headers=auth_headers(tokens["owner"]),
        json={"clear_phone": True},
    )
    assert resp2.status_code == 200, resp2.text
    assert resp2.json()["data"]["phone"] is None


def test_deactivate_customer(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/customers",
        params={"q": "ram"},
        headers=auth_headers(tokens["owner"]),
    )
    ram = resp.json()["data"][0]

    resp2 = api_client.patch(
        f"/restro/branches/{business['branch_id']}/customers/{ram['id']}",
        headers=auth_headers(tokens["owner"]),
        json={"is_active": False},
    )
    assert resp2.status_code == 200, resp2.text
    assert resp2.json()["data"]["is_active"] is False


def test_waiter_cannot_delete_customer(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/customers",
        params={"q": "Walk-in"},
        headers=auth_headers(tokens["owner"]),
    )
    guest = resp.json()["data"][0]

    resp2 = api_client.delete(
        f"/restro/branches/{business['branch_id']}/customers/{guest['id']}",
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp2.status_code == 403


def test_owner_can_delete_customer(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/customers",
        params={"q": "Walk-in"},
        headers=auth_headers(tokens["owner"]),
    )
    guest = resp.json()["data"][0]

    resp2 = api_client.delete(
        f"/restro/branches/{business['branch_id']}/customers/{guest['id']}",
        headers=auth_headers(tokens["owner"]),
    )
    assert resp2.status_code == 200, resp2.text
