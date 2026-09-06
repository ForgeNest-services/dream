"""Ordered test #2: branch settings (VAT toggle, QR, CBMS real-time flag).
Depends on test_01_login.py's login flow (via the tokens fixture) --
requires that file to pass first. Real HTTP against the live srota-api
container, both business types side by side."""
import pytest

from conftest import auth_headers


def test_get_settings_auto_provisions_defaults(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/settings",
        headers=auth_headers(tokens["owner"]),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["branch_id"] == business["branch_id"]
    assert data["tenant_id"] == business["tenant_id"]
    # Default vat_enabled matches the tenant's real registration status --
    # confirmed in branch_settings_service.py's get_or_create.
    assert data["vat_enabled"] == business["is_vat_registered"]


def test_waiter_cannot_update_settings(api_client, business, tokens):
    resp = api_client.patch(
        f"/restro/branches/{business['branch_id']}/settings",
        headers=auth_headers(tokens["waiter"]),
        json={"default_hs_code": "1234.56"},
    )
    assert resp.status_code == 403


def test_chef_cannot_update_settings(api_client, business, tokens):
    resp = api_client.patch(
        f"/restro/branches/{business['branch_id']}/settings",
        headers=auth_headers(tokens["chef"]),
        json={"default_hs_code": "1234.56"},
    )
    assert resp.status_code == 403


def test_manager_can_update_default_hs_code(api_client, business, tokens):
    resp = api_client.patch(
        f"/restro/branches/{business['branch_id']}/settings",
        headers=auth_headers(tokens["manager"]),
        json={"default_hs_code": "9999.99"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["default_hs_code"] == "9999.99"


def test_invalid_vat_rate_rejected(api_client, business, tokens):
    resp = api_client.patch(
        f"/restro/branches/{business['branch_id']}/settings",
        headers=auth_headers(tokens["owner"]),
        json={"vat_rate": 150},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "INVALID_VAT_RATE"


def test_enabling_vat_on_pan_only_tenant_is_rejected(api_client, dummy_tenants, owner_token_pan):
    pan_business = dummy_tenants["pan"]
    resp = api_client.patch(
        f"/restro/branches/{pan_business['branch_id']}/settings",
        headers=auth_headers(owner_token_pan),
        json={"vat_enabled": True},
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["error"]["code"] == "NOT_VAT_REGISTERED"


def test_enabling_vat_on_vat_registered_tenant_succeeds(api_client, dummy_tenants, owner_token_vat):
    vat_business = dummy_tenants["vat"]
    resp = api_client.patch(
        f"/restro/branches/{vat_business['branch_id']}/settings",
        headers=auth_headers(owner_token_vat),
        json={"vat_enabled": True, "vat_rate": 13},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["vat_enabled"] is True
    assert float(data["vat_rate"]) == 13.0
