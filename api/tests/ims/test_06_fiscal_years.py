"""Ordered test #6: fiscal years. Depends on test_01-05 passing first.
Real HTTP against the live srota-api container, both business types.

Auto-seeds 3 years (current-2, current-1, current) on first list call --
current-year is marked active. Owner-only for create/activate/delete.

Like units' "only seeds when the list is genuinely empty" behavior, this
only tops up to 3 on a truly fresh tenant -- IMSFiscalYearService
.list_for_tenant's `if not years:` never re-seeds a partial set. A real
(permanently undeletable) invoice created in test_09 keeps its own fiscal
year alive across resets while the other two (unreferenced) get correctly
deleted, so a second full-suite run sees exactly 1 surviving fiscal year
here, not 3 -- these tests only assert on what's actually guaranteed:
reachability and there being at most one active year."""
from conftest import auth_headers


def test_list_fiscal_years_endpoint_reachable(api_client, business, tokens):
    resp = api_client.get("/ims/fiscal-years", headers=auth_headers(tokens["owner"]))
    assert resp.status_code == 200, resp.text
    years = resp.json()["data"]
    assert len(years) >= 1
    active = [y for y in years if y["is_active"]]
    assert len(active) == 1


def test_get_active_fiscal_year(api_client, business, tokens):
    resp = api_client.get("/ims/fiscal-years/active", headers=auth_headers(tokens["storekeeper"]))
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["is_active"] is True


def test_manager_cannot_create_fiscal_year(api_client, business, tokens):
    resp = api_client.post(
        "/ims/fiscal-years",
        headers=auth_headers(tokens["manager"]),
        json={"start_year": 2070},
    )
    assert resp.status_code == 403, resp.text


def test_owner_can_create_fiscal_year(api_client, business, tokens):
    resp = api_client.post(
        "/ims/fiscal-years",
        headers=auth_headers(tokens["owner"]),
        json={"start_year": 2070},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()["data"]
    assert data["start_year"] == 2070
    assert data["is_active"] is False


def test_duplicate_fiscal_year_rejected(api_client, business, tokens):
    resp = api_client.post(
        "/ims/fiscal-years",
        headers=auth_headers(tokens["owner"]),
        json={"start_year": 2070},
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["error"]["code"] == "YEAR_EXISTS"


def test_manager_cannot_activate_fiscal_year(api_client, business, tokens):
    list_resp = api_client.get("/ims/fiscal-years", headers=auth_headers(tokens["owner"]))
    fy = next(y for y in list_resp.json()["data"] if y["start_year"] == 2070)
    resp = api_client.post(
        f"/ims/fiscal-years/{fy['id']}/activate",
        headers=auth_headers(tokens["manager"]),
    )
    assert resp.status_code == 403, resp.text


def test_owner_can_activate_fiscal_year(api_client, business, tokens):
    list_resp = api_client.get("/ims/fiscal-years", headers=auth_headers(tokens["owner"]))
    years = list_resp.json()["data"]
    fy = next(y for y in years if y["start_year"] == 2070)
    previously_active = next(y for y in years if y["is_active"])

    resp = api_client.post(
        f"/ims/fiscal-years/{fy['id']}/activate",
        headers=auth_headers(tokens["owner"]),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["is_active"] is True

    list_resp2 = api_client.get("/ims/fiscal-years", headers=auth_headers(tokens["owner"]))
    years2 = {y["id"]: y for y in list_resp2.json()["data"]}
    assert years2[fy["id"]]["is_active"] is True
    assert years2[previously_active["id"]]["is_active"] is False

    # restore the original active year so later test files (which rely on
    # the "current" fiscal year being active for invoice creation) aren't
    # affected by this file's own activation test.
    api_client.post(
        f"/ims/fiscal-years/{previously_active['id']}/activate",
        headers=auth_headers(tokens["owner"]),
    )


def test_activating_nonexistent_fiscal_year_returns_404(api_client, business, tokens):
    resp = api_client.post(
        "/ims/fiscal-years/00000000-0000-0000-0000-000000000000/activate",
        headers=auth_headers(tokens["owner"]),
    )
    assert resp.status_code == 404, resp.text
    assert resp.json()["error"]["code"] == "FISCAL_YEAR_NOT_FOUND"


def test_cannot_delete_active_fiscal_year(api_client, business, tokens):
    list_resp = api_client.get("/ims/fiscal-years", headers=auth_headers(tokens["owner"]))
    active = next(y for y in list_resp.json()["data"] if y["is_active"])
    resp = api_client.delete(
        f"/ims/fiscal-years/{active['id']}",
        headers=auth_headers(tokens["owner"]),
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["error"]["code"] == "CANNOT_DELETE_ACTIVE"


def test_manager_cannot_delete_fiscal_year(api_client, business, tokens):
    list_resp = api_client.get("/ims/fiscal-years", headers=auth_headers(tokens["owner"]))
    inactive = next(y for y in list_resp.json()["data"] if not y["is_active"])
    resp = api_client.delete(
        f"/ims/fiscal-years/{inactive['id']}",
        headers=auth_headers(tokens["manager"]),
    )
    assert resp.status_code == 403, resp.text


def test_owner_can_delete_unreferenced_inactive_fiscal_year(api_client, business, tokens):
    list_resp = api_client.get("/ims/fiscal-years", headers=auth_headers(tokens["owner"]))
    fy = next(y for y in list_resp.json()["data"] if y["start_year"] == 2070)
    resp = api_client.delete(
        f"/ims/fiscal-years/{fy['id']}",
        headers=auth_headers(tokens["owner"]),
    )
    assert resp.status_code == 200, resp.text

    list_resp2 = api_client.get("/ims/fiscal-years", headers=auth_headers(tokens["owner"]))
    ids = {y["id"] for y in list_resp2.json()["data"]}
    assert fy["id"] not in ids


def test_deleting_nonexistent_fiscal_year_returns_404(api_client, business, tokens):
    resp = api_client.delete(
        "/ims/fiscal-years/00000000-0000-0000-0000-000000000000",
        headers=auth_headers(tokens["owner"]),
    )
    assert resp.status_code == 404, resp.text
    assert resp.json()["error"]["code"] == "FISCAL_YEAR_NOT_FOUND"
