"""Ordered test #5: products (tenant-wide catalog; stock is per-branch,
per-variant). Depends on test_01-04 passing first -- needs at least one
real category (test_03) and unit (test_04, auto-seeded) to reference.

Unlike RMS's menu items, IMS products have NO flat-price concept at all --
every product mandatorily has at least one variant (VARIANTS_REQUIRED if
omitted), and each variant carries its own unit_id/cost_price/selling_price/
low_stock_at. HS code (मानक) is per-product here, manual/optional -- unlike
RMS's simpler branch-level default_hs_code.

Every SKU in this file carries a _RUN_ID suffix, not just the one with real
stock ("Instant Noodles"): even a zero-stock product/variant survives a
run that never called reset_dummy_tenants.py in between (a fixed SKU would
collide with itself on a second back-to-back run of just this file)."""
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


def test_list_products_endpoint_reachable(api_client, business, tokens):
    """Not necessarily empty -- a product with real stock-movement history
    (from a previous run of this same file) is permanently undeletable by
    reset_dummy_tenants.py, by design (see that script's own docstring)."""
    resp = api_client.get("/ims/products", headers=auth_headers(tokens["owner"]))
    assert resp.status_code == 200, resp.text
    assert isinstance(resp.json()["data"], list)


def test_storekeeper_can_create_product(api_client, business, tokens):
    """Unlike RMS menu items (owner/manager only), any IMS staff role
    including storekeeper can create products -- a warehouse worker adding
    new stock items shouldn't need a manager present."""
    category_id = _get_a_category(api_client, tokens)
    unit_id = _get_a_unit(api_client, tokens)
    resp = api_client.post(
        "/ims/products",
        headers=auth_headers(tokens["storekeeper"]),
        json={
            "name": f"Instant Noodles {_RUN_ID}",
            "sku": f"SKU-001-{_RUN_ID}",
            "category_id": category_id,
            "branch_id_for_stock": business["branch_id"],
            "variants": [
                {"unit_id": unit_id, "cost_price": "50", "selling_price": "70", "initial_stock": "100"}
            ],
        },
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()["data"]
    assert data["name"] == f"Instant Noodles {_RUN_ID}"
    assert data["sku"] == f"SKU-001-{_RUN_ID}"
    assert len(data["variants"]) == 1
    variant = data["variants"][0]
    assert variant["name"] == "Default"
    assert float(variant["cost_price"]) == 50.0
    assert float(variant["selling_price"]) == 70.0
    assert variant["stock"] == [{"branch_id": business["branch_id"], "qty": "100.000"}]


def test_product_without_variants_rejected(api_client, business, tokens):
    category_id = _get_a_category(api_client, tokens)
    resp = api_client.post(
        "/ims/products",
        headers=auth_headers(tokens["owner"]),
        json={
            "name": f"No Variants Product {_RUN_ID}",
            "sku": f"SKU-NOVAR-{_RUN_ID}",
            "category_id": category_id,
            "branch_id_for_stock": business["branch_id"],
            "variants": [],
        },
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["error"]["code"] == "VARIANTS_REQUIRED"


def test_duplicate_sku_rejected(api_client, business, tokens):
    category_id = _get_a_category(api_client, tokens)
    unit_id = _get_a_unit(api_client, tokens)
    resp = api_client.post(
        "/ims/products",
        headers=auth_headers(tokens["owner"]),
        json={
            "name": "Different Name Same SKU",
            "sku": f"SKU-001-{_RUN_ID}",
            "category_id": category_id,
            "branch_id_for_stock": business["branch_id"],
            "variants": [{"unit_id": unit_id}],
        },
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["error"]["code"] == "SKU_TAKEN"


def test_nonexistent_category_rejected(api_client, business, tokens):
    unit_id = _get_a_unit(api_client, tokens)
    resp = api_client.post(
        "/ims/products",
        headers=auth_headers(tokens["owner"]),
        json={
            "name": f"Orphan Product {_RUN_ID}",
            "sku": f"SKU-ORPHAN-{_RUN_ID}",
            "category_id": "00000000-0000-0000-0000-000000000000",
            "branch_id_for_stock": business["branch_id"],
            "variants": [{"unit_id": unit_id}],
        },
    )
    assert resp.status_code == 404, resp.text
    assert resp.json()["error"]["code"] == "CATEGORY_NOT_FOUND"


def test_duplicate_barcode_across_variants_in_same_request_rejected(api_client, business, tokens):
    category_id = _get_a_category(api_client, tokens)
    unit_id = _get_a_unit(api_client, tokens)
    resp = api_client.post(
        "/ims/products",
        headers=auth_headers(tokens["owner"]),
        json={
            "name": f"Two Variants Same Barcode {_RUN_ID}",
            "sku": f"SKU-DUPBARCODE-{_RUN_ID}",
            "category_id": category_id,
            "branch_id_for_stock": business["branch_id"],
            "variants": [
                {"name": "Small", "unit_id": unit_id, "barcode": f"BC-SHARED-{_RUN_ID}"},
                {"name": "Large", "unit_id": unit_id, "barcode": f"BC-SHARED-{_RUN_ID}"},
            ],
        },
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["error"]["code"] == "BARCODE_TAKEN"


def test_duplicate_barcode_across_products_rejected(api_client, business, tokens):
    category_id = _get_a_category(api_client, tokens)
    unit_id = _get_a_unit(api_client, tokens)
    r1 = api_client.post(
        "/ims/products",
        headers=auth_headers(tokens["owner"]),
        json={
            "name": f"Barcode Owner Product {_RUN_ID}",
            "sku": f"SKU-BARCODEOWNER-{_RUN_ID}",
            "category_id": category_id,
            "branch_id_for_stock": business["branch_id"],
            "variants": [{"unit_id": unit_id, "barcode": f"BC-UNIQUE-001-{_RUN_ID}"}],
        },
    )
    assert r1.status_code == 201, r1.text

    r2 = api_client.post(
        "/ims/products",
        headers=auth_headers(tokens["owner"]),
        json={
            "name": f"Barcode Stealer Product {_RUN_ID}",
            "sku": f"SKU-BARCODESTEALER-{_RUN_ID}",
            "category_id": category_id,
            "branch_id_for_stock": business["branch_id"],
            "variants": [{"unit_id": unit_id, "barcode": f"BC-UNIQUE-001-{_RUN_ID}"}],
        },
    )
    assert r2.status_code == 409, r2.text
    assert r2.json()["error"]["code"] == "BARCODE_TAKEN"


def test_create_product_with_multiple_variants(api_client, business, tokens):
    category_id = _get_a_category(api_client, tokens)
    unit_id = _get_a_unit(api_client, tokens)
    resp = api_client.post(
        "/ims/products",
        headers=auth_headers(tokens["owner"]),
        json={
            "name": f"T-Shirt {_RUN_ID}",
            "sku": f"SKU-TSHIRT-{_RUN_ID}",
            "category_id": category_id,
            "branch_id_for_stock": business["branch_id"],
            "variants": [
                {"name": "Small", "unit_id": unit_id, "selling_price": "500"},
                {"name": "Medium", "unit_id": unit_id, "selling_price": "550"},
                {"name": "Large", "unit_id": unit_id, "selling_price": "600"},
            ],
        },
    )
    assert resp.status_code == 201, resp.text
    variants = resp.json()["data"]["variants"]
    assert {v["name"] for v in variants} == {"Small", "Medium", "Large"}


def test_product_with_hs_code(api_client, business, tokens):
    """HS Code (मानक) is manual/optional, per-product -- IMS genuinely needs
    this (mixed retail categories), unlike RMS's simpler branch-level
    default."""
    category_id = _get_a_category(api_client, tokens)
    unit_id = _get_a_unit(api_client, tokens)
    resp = api_client.post(
        "/ims/products",
        headers=auth_headers(tokens["owner"]),
        json={
            "name": f"HS Coded Product {_RUN_ID}",
            "sku": f"SKU-HSCODE-{_RUN_ID}",
            "category_id": category_id,
            "branch_id_for_stock": business["branch_id"],
            "hs_code": "1905.90",
            "variants": [{"unit_id": unit_id}],
        },
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["data"]["hs_code"] == "1905.90"


def test_hs_code_optional(api_client, business, tokens):
    category_id = _get_a_category(api_client, tokens)
    unit_id = _get_a_unit(api_client, tokens)
    resp = api_client.post(
        "/ims/products",
        headers=auth_headers(tokens["owner"]),
        json={
            "name": f"No HS Code Product {_RUN_ID}",
            "sku": f"SKU-NOHSCODE-{_RUN_ID}",
            "category_id": category_id,
            "branch_id_for_stock": business["branch_id"],
            "variants": [{"unit_id": unit_id}],
        },
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["data"]["hs_code"] is None


def test_get_product_by_id(api_client, business, tokens):
    list_resp = api_client.get("/ims/products", headers=auth_headers(tokens["owner"]))
    product_id = list_resp.json()["data"][0]["id"]
    resp = api_client.get(f"/ims/products/{product_id}", headers=auth_headers(tokens["storekeeper"]))
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["id"] == product_id


def test_get_nonexistent_product_returns_404(api_client, business, tokens):
    resp = api_client.get(
        "/ims/products/00000000-0000-0000-0000-000000000000",
        headers=auth_headers(tokens["owner"]),
    )
    assert resp.status_code == 404, resp.text
    assert resp.json()["error"]["code"] == "PRODUCT_NOT_FOUND"


def test_search_products_by_name(api_client, business, tokens):
    resp = api_client.get(
        "/ims/products", params={"q": f"Noodles {_RUN_ID}"}, headers=auth_headers(tokens["owner"])
    )
    assert resp.status_code == 200, resp.text
    names = {p["name"] for p in resp.json()["data"]}
    assert f"Instant Noodles {_RUN_ID}" in names


def test_manager_can_update_product_price(api_client, business, tokens):
    # Search by _RUN_ID, not just "Instant Noodles" -- a prior run's
    # surviving (permanently-undeletable, real stock history) product
    # would otherwise substring-match too and this could grab the wrong one.
    list_resp = api_client.get(
        "/ims/products", params={"q": f"Instant Noodles {_RUN_ID}"}, headers=auth_headers(tokens["owner"])
    )
    product = list_resp.json()["data"][0]
    variant = product["variants"][0]
    resp = api_client.patch(
        f"/ims/products/{product['id']}",
        headers=auth_headers(tokens["manager"]),
        json={
            "name": product["name"],
            "sku": product["sku"],
            "category_id": product["category_id"],
            "variants": [
                {
                    "id": variant["id"],
                    "unit_id": variant["unit_id"],
                    "cost_price": "55",
                    "selling_price": "80",
                }
            ],
        },
    )
    assert resp.status_code == 200, resp.text
    updated_variant = resp.json()["data"]["variants"][0]
    assert float(updated_variant["selling_price"]) == 80.0
    # stock survives an in-place variant patch (same variant id, not
    # recreated) even though initial_stock isn't resent on update.
    assert updated_variant["stock"] == [{"branch_id": business["branch_id"], "qty": "100.000"}]


def test_variant_with_stock_history_cannot_be_removed(api_client, business, tokens):
    """The Instant Noodles variant has real stock (100 units, set at
    creation) -- omitting it from an update's variants list should be
    rejected, not silently deleted, since IMSMovementRepository already has
    a real row referencing it."""
    list_resp = api_client.get(
        "/ims/products", params={"q": f"Instant Noodles {_RUN_ID}"}, headers=auth_headers(tokens["owner"])
    )
    product = list_resp.json()["data"][0]
    unit_id = _get_a_unit(api_client, tokens)
    resp = api_client.patch(
        f"/ims/products/{product['id']}",
        headers=auth_headers(tokens["owner"]),
        json={
            "name": product["name"],
            "sku": product["sku"],
            "category_id": product["category_id"],
            "variants": [{"name": "Brand New Variant", "unit_id": unit_id}],
        },
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["error"]["code"] == "VARIANT_HAS_HISTORY"


def test_updating_nonexistent_product_returns_404(api_client, business, tokens):
    unit_id = _get_a_unit(api_client, tokens)
    category_id = _get_a_category(api_client, tokens)
    resp = api_client.patch(
        "/ims/products/00000000-0000-0000-0000-000000000000",
        headers=auth_headers(tokens["owner"]),
        json={
            "name": "Doesn't matter",
            "sku": f"SKU-DOESNT-MATTER-{_RUN_ID}",
            "category_id": category_id,
            "variants": [{"unit_id": unit_id}],
        },
    )
    assert resp.status_code == 404, resp.text
    assert resp.json()["error"]["code"] == "PRODUCT_NOT_FOUND"


def test_storekeeper_cannot_delete_product(api_client, business, tokens):
    list_resp = api_client.get(
        "/ims/products", params={"q": f"T-Shirt {_RUN_ID}"}, headers=auth_headers(tokens["owner"])
    )
    product_id = list_resp.json()["data"][0]["id"]
    resp = api_client.delete(
        f"/ims/products/{product_id}", headers=auth_headers(tokens["storekeeper"])
    )
    assert resp.status_code == 403, resp.text


def test_owner_can_delete_product(api_client, business, tokens):
    list_resp = api_client.get(
        "/ims/products", params={"q": f"T-Shirt {_RUN_ID}"}, headers=auth_headers(tokens["owner"])
    )
    product_id = list_resp.json()["data"][0]["id"]
    resp = api_client.delete(
        f"/ims/products/{product_id}", headers=auth_headers(tokens["owner"])
    )
    assert resp.status_code == 200, resp.text

    # soft_delete flips is_active=False -- get_by_id defaults
    # include_inactive=False, so a direct fetch now 404s just like a
    # genuinely nonexistent product would.
    get_resp = api_client.get(f"/ims/products/{product_id}", headers=auth_headers(tokens["owner"]))
    assert get_resp.status_code == 404, get_resp.text

    list_resp2 = api_client.get("/ims/products", headers=auth_headers(tokens["owner"]))
    ids = {p["id"] for p in list_resp2.json()["data"]}
    assert product_id not in ids
