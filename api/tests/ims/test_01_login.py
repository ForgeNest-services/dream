"""Ordered test #1: login. Depends on nothing but seed_dummy_tenants.py
having been run. Real HTTP against the live srota-api container, both
business types (PAN-only and VAT-registered), all 3 IMS roles
(owner/manager/storekeeper -- no waiter/chef equivalent, unlike RMS)."""
import pytest

from conftest import auth_headers


ROLES = ["owner", "manager", "storekeeper"]


@pytest.mark.parametrize("role", ROLES)
def test_login_succeeds_for_each_role(api_client, business, role):
    creds = business["credentials"][role]
    resp = api_client.post(
        "/ims/auth/login",
        json={"username": creds["username"], "password": creds["password"]},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["role"] == role
    assert data["tenant_id"] == business["tenant_id"]
    assert "token" in data and data["token"]


def test_owner_has_no_branch_id(api_client, business):
    creds = business["credentials"]["owner"]
    resp = api_client.post(
        "/ims/auth/login",
        json={"username": creds["username"], "password": creds["password"]},
    )
    assert resp.json()["data"]["branch_id"] is None


@pytest.mark.parametrize("role", ["manager", "storekeeper"])
def test_branch_scoped_roles_have_branch_id(api_client, business, role):
    creds = business["credentials"][role]
    resp = api_client.post(
        "/ims/auth/login",
        json={"username": creds["username"], "password": creds["password"]},
    )
    assert resp.json()["data"]["branch_id"] == business["branch_id"]


def test_login_wrong_password_rejected(api_client, business):
    creds = business["credentials"]["owner"]
    resp = api_client.post(
        "/ims/auth/login",
        json={"username": creds["username"], "password": "wrong-password"},
    )
    assert resp.status_code == 401, resp.text
    assert resp.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_login_unknown_username_rejected(api_client):
    resp = api_client.post(
        "/ims/auth/login",
        json={"username": "no-such-ims-user", "password": "whatever"},
    )
    assert resp.status_code == 401, resp.text
    assert resp.json()["error"]["code"] == "INVALID_CREDENTIALS"
