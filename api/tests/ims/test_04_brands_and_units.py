"""Ordered test #4: brands and units. Depends on test_01-03 passing first.
Real HTTP against the live srota-api container, both business types.

Brands: tenant-wide, create+list only (no rename/delete -- the frontend
has no UI for either, per router.py's own comment).
Units: tenant-wide, fully read-only, auto-seeded with 8 defaults on first
list call (unit_service.py's DEFAULT_UNITS, matching the mock/demo data)."""
import uuid

from conftest import auth_headers

_RUN_ID = uuid.uuid4().hex[:8]
COCA_COLA = f"Coca-Cola-{_RUN_ID}"


class TestBrands:
    def test_list_brands_endpoint_reachable(self, api_client, business, tokens):
        """Not necessarily empty -- no test in this suite currently attaches
        brand_id to a product, so brands are always unreferenced and get
        cleaned up by reset_dummy_tenants.py normally, but this checks
        reachability rather than assuming that stays true forever."""
        resp = api_client.get("/ims/brands", headers=auth_headers(tokens["owner"]))
        assert resp.status_code == 200, resp.text
        assert isinstance(resp.json()["data"], list)

    def test_storekeeper_cannot_create_brand(self, api_client, business, tokens):
        resp = api_client.post(
            "/ims/brands",
            headers=auth_headers(tokens["storekeeper"]),
            json={"name": COCA_COLA},
        )
        assert resp.status_code == 403, resp.text

    def test_manager_can_create_brand(self, api_client, business, tokens):
        resp = api_client.post(
            "/ims/brands",
            headers=auth_headers(tokens["manager"]),
            json={"name": COCA_COLA},
        )
        assert resp.status_code == 201, resp.text
        assert resp.json()["data"]["name"] == COCA_COLA

    def test_duplicate_brand_name_rejected(self, api_client, business, tokens):
        resp = api_client.post(
            "/ims/brands",
            headers=auth_headers(tokens["owner"]),
            json={"name": COCA_COLA},
        )
        assert resp.status_code == 409, resp.text
        assert resp.json()["error"]["code"] == "NAME_TAKEN"

    def test_list_brands_shows_created(self, api_client, business, tokens):
        resp = api_client.get("/ims/brands", headers=auth_headers(tokens["storekeeper"]))
        assert resp.status_code == 200, resp.text
        names = {b["name"] for b in resp.json()["data"]}
        assert COCA_COLA in names


class TestUnits:
    """Units auto-seed (IMSUnitService.list_for_tenant) ONLY when the
    tenant's unit list is genuinely empty (`if not units:`) -- it never
    tops up a partial set. reset_dummy_tenants.py can only delete units
    that are unreferenced by any surviving variant (real DELETE-grant/FK
    constraint, not a choice), and test_05_products.py's permanently-
    surviving product's variant references "Pieces" specifically -- so
    after a second full-suite run, "Pieces" alone survives forever and the
    other 7 defaults are gone for good and never get reseeded. This is a
    real, permanent side effect of this test suite's own accumulation on a
    tenant that would never occur for a genuine customer (whose units are
    never force-deleted from outside the app) -- these tests only assert
    on what's actually guaranteed to be real and stable: the endpoint
    works, "Pieces" is always present with the right shape, and repeat
    calls don't change the count."""

    def test_list_units_endpoint_reachable(self, api_client, business, tokens):
        resp = api_client.get("/ims/units", headers=auth_headers(tokens["storekeeper"]))
        assert resp.status_code == 200, resp.text
        names = {u["name"] for u in resp.json()["data"]}
        assert "Pieces" in names

    def test_units_have_correct_symbols_and_decimal_flags(self, api_client, business, tokens):
        resp = api_client.get("/ims/units", headers=auth_headers(tokens["owner"]))
        units = {u["name"]: u for u in resp.json()["data"]}
        assert units["Pieces"]["symbol"] == "pcs"
        assert units["Pieces"]["allows_decimals"] is False

    def test_units_list_is_idempotent(self, api_client, business, tokens):
        """Calling list twice must not double-seed (regardless of how many
        units happen to already exist from a prior run)."""
        resp1 = api_client.get("/ims/units", headers=auth_headers(tokens["owner"]))
        resp2 = api_client.get("/ims/units", headers=auth_headers(tokens["owner"]))
        assert len(resp1.json()["data"]) == len(resp2.json()["data"]) >= 1
