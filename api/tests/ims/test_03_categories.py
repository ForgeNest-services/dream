"""Ordered test #3: categories. Depends on test_01-02 passing first.
Real HTTP against the live srota-api container, both business types.

Unlike RMS's flat, branch-scoped, auto-seeded categories, IMS categories
are a genuinely-empty-by-default, tenant-wide TREE (parent_id, unlimited
nesting) -- confirmed via shared_models/ims_category.py's two partial
unique indexes (one for root-level names WHERE parent_id IS NULL, one for
sibling names WHERE parent_id IS NOT NULL) rather than one plain
UNIQUE(tenant_id, parent_id, name), specifically because Postgres treats
each NULL as distinct in a unique index.

Every category name here carries a _RUN_ID suffix: test_05_products.py's
"Instant Noodles" gets real initial_stock, which (per
reset_dummy_tenants.py's own docstring) makes it -- and therefore its
category -- permanently undeletable across resets. A second full-suite run
without this suffix would collide with the first run's surviving
category tree."""
import uuid

from conftest import auth_headers

_RUN_ID = uuid.uuid4().hex[:8]
BEVERAGES = f"Beverages-{_RUN_ID}"
SOFT_DRINKS = f"Soft Drinks-{_RUN_ID}"
SNACKS = f"Snacks-{_RUN_ID}"
GROCERIES = f"Groceries-{_RUN_ID}"
GROCERY_ITEMS = f"Grocery Items-{_RUN_ID}"
IMPORTED = f"Imported-{_RUN_ID}"


def _find(categories, name):
    return next(c for c in categories if c["name"] == name)


def test_list_categories_endpoint_reachable(api_client, business, tokens):
    """Not necessarily empty -- a prior run's category tree, still
    referenced by its own surviving (permanently-undeletable) product,
    may still be present."""
    resp = api_client.get("/ims/categories", headers=auth_headers(tokens["owner"]))
    assert resp.status_code == 200, resp.text
    assert isinstance(resp.json()["data"], list)


def test_storekeeper_cannot_create_category(api_client, business, tokens):
    resp = api_client.post(
        "/ims/categories",
        headers=auth_headers(tokens["storekeeper"]),
        json={"name": BEVERAGES},
    )
    assert resp.status_code == 403, resp.text


def test_manager_can_create_root_category(api_client, business, tokens):
    resp = api_client.post(
        "/ims/categories",
        headers=auth_headers(tokens["manager"]),
        json={"name": BEVERAGES},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()["data"]
    assert data["name"] == BEVERAGES
    assert data["parent_id"] is None


def test_create_sub_category(api_client, business, tokens):
    list_resp = api_client.get("/ims/categories", headers=auth_headers(tokens["owner"]))
    beverages = _find(list_resp.json()["data"], BEVERAGES)
    resp = api_client.post(
        "/ims/categories",
        headers=auth_headers(tokens["owner"]),
        json={"name": SOFT_DRINKS, "parent_id": beverages["id"]},
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["data"]["parent_id"] == beverages["id"]


def test_duplicate_root_category_name_rejected(api_client, business, tokens):
    resp = api_client.post(
        "/ims/categories",
        headers=auth_headers(tokens["owner"]),
        json={"name": BEVERAGES},
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["error"]["code"] == "NAME_TAKEN"


def test_duplicate_sub_category_name_under_same_parent_rejected(api_client, business, tokens):
    list_resp = api_client.get("/ims/categories", headers=auth_headers(tokens["owner"]))
    beverages = _find(list_resp.json()["data"], BEVERAGES)
    resp = api_client.post(
        "/ims/categories",
        headers=auth_headers(tokens["owner"]),
        json={"name": SOFT_DRINKS, "parent_id": beverages["id"]},
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["error"]["code"] == "NAME_TAKEN"


def test_same_name_as_root_and_as_child_is_allowed(api_client, business, tokens):
    """The whole reason for two separate partial unique indexes -- a root
    category and a sub-category are allowed to share a name, since Postgres
    scopes each index by its own WHERE clause (parent_id IS NULL vs IS NOT
    NULL), not one flat (tenant_id, parent_id, name) constraint."""
    list_resp = api_client.get("/ims/categories", headers=auth_headers(tokens["owner"]))
    beverages = _find(list_resp.json()["data"], BEVERAGES)
    resp = api_client.post(
        "/ims/categories",
        headers=auth_headers(tokens["owner"]),
        json={"name": SNACKS, "parent_id": beverages["id"]},
    )
    assert resp.status_code == 201, resp.text
    resp2 = api_client.post(
        "/ims/categories",
        headers=auth_headers(tokens["owner"]),
        json={"name": SNACKS},
    )
    assert resp2.status_code == 201, resp2.text
    assert resp2.json()["data"]["parent_id"] is None


def test_same_name_under_different_parents_is_allowed(api_client, business, tokens):
    list_resp = api_client.get("/ims/categories", headers=auth_headers(tokens["owner"]))
    beverages = _find(list_resp.json()["data"], BEVERAGES)
    other_root_resp = api_client.post(
        "/ims/categories",
        headers=auth_headers(tokens["owner"]),
        json={"name": GROCERIES},
    )
    groceries = other_root_resp.json()["data"]

    r1 = api_client.post(
        "/ims/categories",
        headers=auth_headers(tokens["owner"]),
        json={"name": IMPORTED, "parent_id": beverages["id"]},
    )
    r2 = api_client.post(
        "/ims/categories",
        headers=auth_headers(tokens["owner"]),
        json={"name": IMPORTED, "parent_id": groceries["id"]},
    )
    assert r1.status_code == 201, r1.text
    assert r2.status_code == 201, r2.text


def test_create_with_nonexistent_parent_returns_404(api_client, business, tokens):
    resp = api_client.post(
        "/ims/categories",
        headers=auth_headers(tokens["owner"]),
        json={"name": f"Orphan Category-{_RUN_ID}", "parent_id": "00000000-0000-0000-0000-000000000000"},
    )
    assert resp.status_code == 404, resp.text
    assert resp.json()["error"]["code"] == "PARENT_NOT_FOUND"


def test_manager_can_rename_category(api_client, business, tokens):
    list_resp = api_client.get("/ims/categories", headers=auth_headers(tokens["owner"]))
    groceries = _find(list_resp.json()["data"], GROCERIES)
    resp = api_client.patch(
        f"/ims/categories/{groceries['id']}",
        headers=auth_headers(tokens["manager"]),
        json={"name": GROCERY_ITEMS},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["name"] == GROCERY_ITEMS


def test_storekeeper_cannot_rename_category(api_client, business, tokens):
    list_resp = api_client.get("/ims/categories", headers=auth_headers(tokens["owner"]))
    beverages = _find(list_resp.json()["data"], BEVERAGES)
    resp = api_client.patch(
        f"/ims/categories/{beverages['id']}",
        headers=auth_headers(tokens["storekeeper"]),
        json={"name": "New Name"},
    )
    assert resp.status_code == 403, resp.text


def test_renaming_nonexistent_category_returns_404(api_client, business, tokens):
    resp = api_client.patch(
        "/ims/categories/00000000-0000-0000-0000-000000000000",
        headers=auth_headers(tokens["owner"]),
        json={"name": "Doesn't matter"},
    )
    assert resp.status_code == 404, resp.text
    assert resp.json()["error"]["code"] == "CATEGORY_NOT_FOUND"


def test_deleting_category_with_children_rejected(api_client, business, tokens):
    list_resp = api_client.get("/ims/categories", headers=auth_headers(tokens["owner"]))
    beverages = _find(list_resp.json()["data"], BEVERAGES)
    resp = api_client.delete(
        f"/ims/categories/{beverages['id']}",
        headers=auth_headers(tokens["owner"]),
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["error"]["code"] == "CATEGORY_HAS_CHILDREN"


def test_storekeeper_cannot_delete_category(api_client, business, tokens):
    list_resp = api_client.get("/ims/categories", headers=auth_headers(tokens["owner"]))
    leaf = _find(list_resp.json()["data"], SOFT_DRINKS)
    resp = api_client.delete(
        f"/ims/categories/{leaf['id']}",
        headers=auth_headers(tokens["storekeeper"]),
    )
    assert resp.status_code == 403, resp.text


def test_owner_can_delete_leaf_category(api_client, business, tokens):
    list_resp = api_client.get("/ims/categories", headers=auth_headers(tokens["owner"]))
    leaf = _find(list_resp.json()["data"], SOFT_DRINKS)
    resp = api_client.delete(
        f"/ims/categories/{leaf['id']}",
        headers=auth_headers(tokens["owner"]),
    )
    assert resp.status_code == 200, resp.text

    list_resp2 = api_client.get("/ims/categories", headers=auth_headers(tokens["owner"]))
    names = {c["name"] for c in list_resp2.json()["data"]}
    assert SOFT_DRINKS not in names
