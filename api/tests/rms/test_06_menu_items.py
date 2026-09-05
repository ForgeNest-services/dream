"""Ordered test #6: menu items (flat-price, variant-priced, and combo
items). Depends on test_01-05 passing first -- categories must already
exist. The first call auto-seeds default menu items alongside the default
categories (same seed_lock.py mechanism as test_05_categories.py). Real
HTTP against the live srota-api container, both business types."""
import pytest

from conftest import auth_headers


def _first_category_id(api_client, business, tokens, name="Fast Food") -> str:
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/categories",
        headers=auth_headers(tokens["owner"]),
    )
    return next(c for c in resp.json()["data"] if c["name"] == name)["id"]


def test_list_menu_items_auto_seeds_defaults(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/menu-items",
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp.status_code == 200, resp.text
    items = resp.json()["data"]
    assert len(items) > 0
    # Momo is one of the real seeded fast-food items (menu_seed_images'
    # fastfood/momo.jpg, referenced elsewhere this session).
    assert any("momo" in i["name"].lower() for i in items)


def test_waiter_cannot_create_menu_item(api_client, business, tokens):
    category_id = _first_category_id(api_client, business, tokens)
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/menu-items",
        headers=auth_headers(tokens["waiter"]),
        json={"category_id": category_id, "name": "Should Fail", "price": "100"},
    )
    assert resp.status_code == 403


def test_manager_can_create_flat_price_item(api_client, business, tokens):
    category_id = _first_category_id(api_client, business, tokens)
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/menu-items",
        headers=auth_headers(tokens["manager"]),
        json={"category_id": category_id, "name": "Test Sandwich", "price": "250"},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()["data"]
    assert data["name"] == "Test Sandwich"
    assert float(data["price"]) == 250.0
    assert data["has_variants"] is False
    assert data["sold_out"] is False
    assert data["variants"] == []


def test_flat_item_without_price_rejected(api_client, business, tokens):
    category_id = _first_category_id(api_client, business, tokens)
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/menu-items",
        headers=auth_headers(tokens["owner"]),
        json={"category_id": category_id, "name": "No Price Item"},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "PRICE_REQUIRED"


def test_variant_item_with_flat_price_rejected(api_client, business, tokens):
    category_id = _first_category_id(api_client, business, tokens)
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/menu-items",
        headers=auth_headers(tokens["owner"]),
        json={
            "category_id": category_id,
            "name": "Bad Variant Item",
            "has_variants": True,
            "price": "100",
            "variants": [{"name": "Small", "price": "80"}],
        },
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "PRICE_NOT_ALLOWED_WITH_VARIANTS"


def test_variant_item_without_variants_rejected(api_client, business, tokens):
    category_id = _first_category_id(api_client, business, tokens)
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/menu-items",
        headers=auth_headers(tokens["owner"]),
        json={"category_id": category_id, "name": "Bad No-Variant Item", "has_variants": True},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VARIANTS_REQUIRED"


def test_manager_can_create_variant_priced_item(api_client, business, tokens):
    category_id = _first_category_id(api_client, business, tokens)
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/menu-items",
        headers=auth_headers(tokens["manager"]),
        json={
            "category_id": category_id,
            "name": "Test Momo",
            "has_variants": True,
            "variants": [
                {"name": "Steam", "price": "180"},
                {"name": "Fried", "price": "200"},
            ],
        },
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()["data"]
    assert data["has_variants"] is True
    assert data["price"] is None
    assert len(data["variants"]) == 2
    variant_names = {v["name"] for v in data["variants"]}
    assert variant_names == {"Steam", "Fried"}


def test_category_not_found_rejected(api_client, business, tokens):
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/menu-items",
        headers=auth_headers(tokens["owner"]),
        json={
            "category_id": "00000000-0000-0000-0000-000000000000",
            "name": "Orphan Item",
            "price": "50",
        },
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "CATEGORY_NOT_FOUND"


def test_duplicate_menu_item_name_rejected(api_client, business, tokens):
    category_id = _first_category_id(api_client, business, tokens)
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/menu-items",
        headers=auth_headers(tokens["owner"]),
        json={"category_id": category_id, "name": "Test Sandwich", "price": "300"},
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["error"]["code"] == "NAME_TAKEN"


def test_filter_menu_items_by_category(api_client, business, tokens):
    category_id = _first_category_id(api_client, business, tokens)
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/menu-items",
        params={"category_id": category_id},
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp.status_code == 200, resp.text
    assert all(i["category_id"] == category_id for i in resp.json()["data"])
    names = {i["name"] for i in resp.json()["data"]}
    assert "Test Sandwich" in names
    assert "Test Momo" in names


def test_search_menu_items_by_name(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/menu-items",
        params={"q": "sandwich"},
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp.status_code == 200, resp.text
    names = {i["name"].lower() for i in resp.json()["data"]}
    assert all("sandwich" in n for n in names)
    assert len(names) >= 1


def test_manager_can_update_price(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/menu-items",
        params={"q": "Test Sandwich"},
        headers=auth_headers(tokens["owner"]),
    )
    item = resp.json()["data"][0]

    resp2 = api_client.patch(
        f"/restro/branches/{business['branch_id']}/menu-items/{item['id']}",
        headers=auth_headers(tokens["manager"]),
        json={"price": "275"},
    )
    assert resp2.status_code == 200, resp2.text
    assert float(resp2.json()["data"]["price"]) == 275.0


def test_any_staff_can_toggle_sold_out(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/menu-items",
        params={"q": "Test Sandwich"},
        headers=auth_headers(tokens["owner"]),
    )
    item = resp.json()["data"][0]
    assert item["sold_out"] is False

    resp2 = api_client.patch(
        f"/restro/branches/{business['branch_id']}/menu-items/{item['id']}/sold-out",
        headers=auth_headers(tokens["waiter"]),
        json={"sold_out": True},
    )
    assert resp2.status_code == 200, resp2.text
    assert resp2.json()["data"]["sold_out"] is True

    resp3 = api_client.patch(
        f"/restro/branches/{business['branch_id']}/menu-items/{item['id']}/sold-out",
        headers=auth_headers(tokens["chef"]),
        json={"sold_out": False},
    )
    assert resp3.status_code == 200, resp3.text
    assert resp3.json()["data"]["sold_out"] is False


class TestComboItems:
    def test_combo_without_price_rejected(self, api_client, business, tokens):
        category_id = _first_category_id(api_client, business, tokens, name="Combo")
        resp = api_client.post(
            f"/restro/branches/{business['branch_id']}/menu-items",
            headers=auth_headers(tokens["owner"]),
            json={"category_id": category_id, "name": "Bad Combo No Price", "is_combo": True},
        )
        assert resp.status_code == 422
        assert resp.json()["error"]["code"] == "PRICE_REQUIRED"

    def test_combo_requires_at_least_one_component(self, api_client, business, tokens):
        category_id = _first_category_id(api_client, business, tokens, name="Combo")
        resp = api_client.post(
            f"/restro/branches/{business['branch_id']}/menu-items",
            headers=auth_headers(tokens["owner"]),
            json={"category_id": category_id, "name": "Bad Combo", "is_combo": True, "price": "300"},
        )
        assert resp.status_code == 422
        assert resp.json()["error"]["code"] == "COMPONENTS_REQUIRED"

    def test_combo_cannot_have_variants(self, api_client, business, tokens):
        category_id = _first_category_id(api_client, business, tokens, name="Combo")
        # Need a real component item to get past component validation first
        # and actually hit the combo-vs-variants rule.
        sandwich_resp = api_client.get(
            f"/restro/branches/{business['branch_id']}/menu-items",
            params={"q": "Test Sandwich"},
            headers=auth_headers(tokens["owner"]),
        )
        sandwich = sandwich_resp.json()["data"][0]

        resp = api_client.post(
            f"/restro/branches/{business['branch_id']}/menu-items",
            headers=auth_headers(tokens["owner"]),
            json={
                "category_id": category_id,
                "name": "Bad Variant Combo",
                "is_combo": True,
                "has_variants": True,
                "variants": [{"name": "Small", "price": "100"}],
                "components": [{"child_menu_item_id": sandwich["id"], "qty": 1}],
            },
        )
        assert resp.status_code == 422
        assert resp.json()["error"]["code"] == "COMBO_CANNOT_HAVE_VARIANTS"

    def test_create_valid_combo(self, api_client, business, tokens):
        combo_category_id = _first_category_id(api_client, business, tokens, name="Combo")

        sandwich_resp = api_client.get(
            f"/restro/branches/{business['branch_id']}/menu-items",
            params={"q": "Test Sandwich"},
            headers=auth_headers(tokens["owner"]),
        )
        sandwich = sandwich_resp.json()["data"][0]

        resp = api_client.post(
            f"/restro/branches/{business['branch_id']}/menu-items",
            headers=auth_headers(tokens["manager"]),
            json={
                "category_id": combo_category_id,
                "name": "Test Combo Meal",
                "is_combo": True,
                "price": "400",
                "components": [{"child_menu_item_id": sandwich["id"], "qty": 2}],
            },
        )
        assert resp.status_code == 201, resp.text
        data = resp.json()["data"]
        assert data["is_combo"] is True
        assert len(data["components"]) == 1
        assert data["components"][0]["child_menu_item_id"] == sandwich["id"]
        assert data["components"][0]["qty"] == 2

    def test_combo_cannot_reference_a_combo(self, api_client, business, tokens):
        combo_category_id = _first_category_id(api_client, business, tokens, name="Combo")

        combo_resp = api_client.get(
            f"/restro/branches/{business['branch_id']}/menu-items",
            params={"q": "Test Combo Meal"},
            headers=auth_headers(tokens["owner"]),
        )
        combo = combo_resp.json()["data"][0]

        resp = api_client.post(
            f"/restro/branches/{business['branch_id']}/menu-items",
            headers=auth_headers(tokens["owner"]),
            json={
                "category_id": combo_category_id,
                "name": "Combo Of Combos",
                "is_combo": True,
                "price": "500",
                "components": [{"child_menu_item_id": combo["id"], "qty": 1}],
            },
        )
        assert resp.status_code == 422
        assert resp.json()["error"]["code"] == "COMPONENT_CANNOT_BE_COMBO"


def test_waiter_cannot_delete_menu_item(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/menu-items",
        params={"q": "Test Momo"},
        headers=auth_headers(tokens["owner"]),
    )
    item = resp.json()["data"][0]

    resp2 = api_client.delete(
        f"/restro/branches/{business['branch_id']}/menu-items/{item['id']}",
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp2.status_code == 403


def test_owner_can_delete_menu_item(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/menu-items",
        params={"q": "Test Momo"},
        headers=auth_headers(tokens["owner"]),
    )
    item = resp.json()["data"][0]

    resp2 = api_client.delete(
        f"/restro/branches/{business['branch_id']}/menu-items/{item['id']}",
        headers=auth_headers(tokens["owner"]),
    )
    assert resp2.status_code == 200, resp2.text
