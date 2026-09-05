"""Ordered test #5: menu categories. Depends on test_01-04 passing first.
The FIRST call to GET /categories (or /menu-items) on a fresh branch
auto-seeds 8 default categories + their default menu items together
(seed_lock.py's ensure_branch_seeded, category_service.py's
DEFAULT_CATEGORIES) -- real, intentional app behavior, not test setup.
Real HTTP against the live srota-api container, both business types."""
import pytest

from conftest import auth_headers

DEFAULT_CATEGORIES = [
    "Hot Beverages",
    "Cold Beverages / Refreshers",
    "Hookah",
    "Fast Food",
    "Thakali Set",
    "Newari Khaja",
    "Cigarettes",
    "Combo",
]


def test_list_categories_auto_seeds_defaults(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/categories",
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp.status_code == 200, resp.text
    names = {c["name"] for c in resp.json()["data"]}
    assert names == set(DEFAULT_CATEGORIES)


def test_waiter_cannot_create_category(api_client, business, tokens):
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/categories",
        headers=auth_headers(tokens["waiter"]),
        json={"name": "Should Fail"},
    )
    assert resp.status_code == 403


def test_manager_can_create_category(api_client, business, tokens):
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/categories",
        headers=auth_headers(tokens["manager"]),
        json={"name": "Desserts", "display_order": 99},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()["data"]
    assert data["name"] == "Desserts"
    assert data["is_active"] is True


def test_empty_category_name_rejected(api_client, business, tokens):
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/categories",
        headers=auth_headers(tokens["owner"]),
        json={"name": "   "},
    )
    assert resp.status_code == 422


def test_duplicate_category_name_rejected(api_client, business, tokens):
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/categories",
        headers=auth_headers(tokens["owner"]),
        json={"name": "Desserts"},
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["error"]["code"] == "NAME_TAKEN"


def test_manager_can_rename_category(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/categories",
        headers=auth_headers(tokens["owner"]),
    )
    desserts = next(c for c in resp.json()["data"] if c["name"] == "Desserts")

    resp2 = api_client.patch(
        f"/restro/branches/{business['branch_id']}/categories/{desserts['id']}",
        headers=auth_headers(tokens["manager"]),
        json={"name": "Sweets"},
    )
    assert resp2.status_code == 200, resp2.text
    assert resp2.json()["data"]["name"] == "Sweets"


def test_waiter_cannot_delete_category(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/categories",
        headers=auth_headers(tokens["owner"]),
    )
    sweets = next(c for c in resp.json()["data"] if c["name"] == "Sweets")

    resp2 = api_client.delete(
        f"/restro/branches/{business['branch_id']}/categories/{sweets['id']}",
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp2.status_code == 403


def test_owner_can_delete_category(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/categories",
        headers=auth_headers(tokens["owner"]),
    )
    sweets = next(c for c in resp.json()["data"] if c["name"] == "Sweets")

    resp2 = api_client.delete(
        f"/restro/branches/{business['branch_id']}/categories/{sweets['id']}",
        headers=auth_headers(tokens["owner"]),
    )
    assert resp2.status_code == 200, resp2.text

    resp3 = api_client.get(
        f"/restro/branches/{business['branch_id']}/categories",
        headers=auth_headers(tokens["owner"]),
    )
    names = {c["name"] for c in resp3.json()["data"]}
    assert names == set(DEFAULT_CATEGORIES)


def test_updating_nonexistent_category_returns_404(api_client, business, tokens):
    resp = api_client.patch(
        f"/restro/branches/{business['branch_id']}/categories/00000000-0000-0000-0000-000000000000",
        headers=auth_headers(tokens["owner"]),
        json={"name": "Ghost"},
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "CATEGORY_NOT_FOUND"
