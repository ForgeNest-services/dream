"""Ordered test #2: branch settings. Depends on test_01 passing first.
Real HTTP against the live srota-api container, both business types.
Unlike RMS, IMS branch settings have no default_hs_code -- HS codes are
per-product here instead (tested in test_06_products.py)."""
from conftest import auth_headers


def test_get_settings_auto_provisions_defaults_matching_tenant_vat_status(api_client, business, tokens):
    resp = api_client.get(
        f"/ims/branches/{business['branch_id']}/settings",
        headers=auth_headers(tokens["owner"]),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["vat_enabled"] == business["is_vat_registered"]


def test_storekeeper_cannot_update_settings(api_client, business, tokens):
    resp = api_client.patch(
        f"/ims/branches/{business['branch_id']}/settings",
        headers=auth_headers(tokens["storekeeper"]),
        json={"vat_rate": "13"},
    )
    assert resp.status_code == 403, resp.text


def test_manager_can_update_qr_image_url(api_client, business, tokens):
    resp = api_client.patch(
        f"/ims/branches/{business['branch_id']}/settings",
        headers=auth_headers(tokens["manager"]),
        json={"qr_image_url": "https://example.com/qr.png"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["qr_image_url"] == "https://example.com/qr.png"


def test_invalid_vat_rate_rejected(api_client, business, tokens):
    resp = api_client.patch(
        f"/ims/branches/{business['branch_id']}/settings",
        headers=auth_headers(tokens["owner"]),
        json={"vat_rate": "150"},
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["error"]["code"] == "INVALID_VAT_RATE"


def test_negative_vat_rate_rejected(api_client, business, tokens):
    resp = api_client.patch(
        f"/ims/branches/{business['branch_id']}/settings",
        headers=auth_headers(tokens["owner"]),
        json={"vat_rate": "-1"},
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["error"]["code"] == "INVALID_VAT_RATE"


def test_enabling_vat_on_pan_only_tenant_is_rejected(api_client, owner_token_pan, dummy_tenants):
    resp = api_client.patch(
        f"/ims/branches/{dummy_tenants['pan']['branch_id']}/settings",
        headers=auth_headers(owner_token_pan),
        json={"vat_enabled": True},
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["error"]["code"] == "NOT_VAT_REGISTERED"


def test_enabling_vat_on_vat_registered_tenant_succeeds(api_client, owner_token_vat, dummy_tenants):
    resp = api_client.patch(
        f"/ims/branches/{dummy_tenants['vat']['branch_id']}/settings",
        headers=auth_headers(owner_token_vat),
        json={"vat_enabled": True, "vat_rate": "13"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["vat_enabled"] is True
    assert float(data["vat_rate"]) == 13.0
