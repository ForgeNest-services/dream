"""Ordered test #1: RMS staff login, both business types, all 4 roles.
Must pass before any later-ordered test file (table/menu/order/etc.) exists.
Real HTTP against the live srota-api container -- no mocks."""
import pytest


ALL_ROLES = ["owner", "manager", "waiter", "chef"]


@pytest.mark.parametrize("role", ALL_ROLES)
def test_login_succeeds_for_each_role(api_client, business, role):
    creds = business["credentials"][role]
    resp = api_client.post(
        "/restro/auth/login",
        json={"username": creds["username"], "password": creds["password"]},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["role"] == role
    assert body["data"]["tenant_id"] == business["tenant_id"]
    assert body["data"]["token"]


def test_login_rejects_wrong_password(api_client, business):
    owner = business["credentials"]["owner"]
    resp = api_client.post(
        "/restro/auth/login",
        json={"username": owner["username"], "password": "definitely-wrong"},
    )
    assert resp.status_code == 401
    body = resp.json()
    assert body["success"] is False


def test_login_rejects_unknown_username(api_client, business):
    resp = api_client.post(
        "/restro/auth/login",
        json={"username": "this-user-does-not-exist", "password": "whatever"},
    )
    assert resp.status_code == 401
    body = resp.json()
    assert body["success"] is False


def test_owner_login_has_no_branch_id(api_client, business):
    owner = business["credentials"]["owner"]
    resp = api_client.post(
        "/restro/auth/login",
        json={"username": owner["username"], "password": owner["password"]},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["branch_id"] is None


@pytest.mark.parametrize("role", ["manager", "waiter", "chef"])
def test_branch_scoped_role_login_has_branch_id(api_client, business, role):
    creds = business["credentials"][role]
    resp = api_client.post(
        "/restro/auth/login",
        json={"username": creds["username"], "password": creds["password"]},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["branch_id"] == business["branch_id"]
