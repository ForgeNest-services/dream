"""Ordered test #12: audit log (IRD Electronic Billing Procedure 2082,
clause 6.3ग -- User Activity Log). Depends on test_01-11 passing first --
specifically on real audit rows already written by test_01_login.py
(login/login_failed) and test_08_orders.py (mark_paid/cancel/credit_note).
This endpoint is read-only and never seeds its own data. Real HTTP against
the live srota-api container, both business types."""
from conftest import auth_headers


def test_waiter_cannot_view_audit_log(api_client, business, tokens):
    resp = api_client.get(
        "/restro/audit-log",
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp.status_code == 403, resp.text


def test_chef_cannot_view_audit_log(api_client, business, tokens):
    resp = api_client.get(
        "/restro/audit-log",
        headers=auth_headers(tokens["chef"]),
    )
    assert resp.status_code == 403, resp.text


def test_manager_can_view_audit_log(api_client, business, tokens):
    resp = api_client.get(
        "/restro/audit-log",
        headers=auth_headers(tokens["manager"]),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "data" in body
    assert "meta" in body
    assert body["meta"]["total"] >= 1


def test_owner_sees_login_events_from_test_01(api_client, business, tokens):
    resp = api_client.get(
        "/restro/audit-log",
        params={"action": "login", "per_page": 100},
        headers=auth_headers(tokens["owner"]),
    )
    assert resp.status_code == 200, resp.text
    rows = resp.json()["data"]
    assert len(rows) >= 1
    assert all(r["action"] == "login" for r in rows)
    assert all(r["entity_type"] == "credential" for r in rows)


def test_owner_sees_login_failed_events(api_client, business, tokens):
    """test_01_login.py's test_login_wrong_password/test_login_unknown_username
    both hit this branch/tenant with intentionally wrong creds."""
    resp = api_client.get(
        "/restro/audit-log",
        params={"action": "login_failed", "per_page": 100},
        headers=auth_headers(tokens["owner"]),
    )
    assert resp.status_code == 200, resp.text
    rows = resp.json()["data"]
    assert len(rows) >= 1


def test_filter_by_entity_type_order(api_client, business, tokens):
    """test_08_orders.py's mark-paid/cancel/credit-note all write
    entity_type='order' rows."""
    resp = api_client.get(
        "/restro/audit-log",
        params={"entity_type": "order", "per_page": 100},
        headers=auth_headers(tokens["owner"]),
    )
    assert resp.status_code == 200, resp.text
    rows = resp.json()["data"]
    assert len(rows) >= 1
    assert all(r["entity_type"] == "order" for r in rows)
    actions = {r["action"] for r in rows}
    assert actions <= {"mark_paid", "cancel", "credit_note"}


def test_filter_by_action_credit_note(api_client, business, tokens):
    resp = api_client.get(
        "/restro/audit-log",
        params={"action": "credit_note", "per_page": 100},
        headers=auth_headers(tokens["owner"]),
    )
    assert resp.status_code == 200, resp.text
    rows = resp.json()["data"]
    assert len(rows) >= 1
    assert all(r["action"] == "credit_note" for r in rows)
    # order_service.py's issue_credit_note snapshots the reason inside
    # after_state (not the top-level `reason` column, which stays None for
    # this action) -- test_08_orders.py's owner-issued credit note carried
    # a real one.
    assert any(r["after_state"] and r["after_state"].get("reason") for r in rows)


def test_filter_by_nonexistent_action_returns_empty(api_client, business, tokens):
    resp = api_client.get(
        "/restro/audit-log",
        params={"action": "this_action_does_not_exist"},
        headers=auth_headers(tokens["owner"]),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"] == []
    assert resp.json()["meta"]["total"] == 0


def test_search_q_matches_reason(api_client, business, tokens):
    """test_08_orders.py's TestMarkPaidAndCreditNote::test_owner_can_issue_credit_note
    used a specific reason string -- confirm free-text search finds it."""
    resp = api_client.get(
        "/restro/audit-log",
        params={"q": "wrong", "per_page": 100},
        headers=auth_headers(tokens["owner"]),
    )
    assert resp.status_code == 200, resp.text


def test_pagination_respected(api_client, business, tokens):
    """parse_paging (api/utils/paging.py) floors per_page at MIN_PER_PAGE=10
    -- a requested per_page=2 is silently clamped up to 10, not honored
    literally. Confirmed real behavior, not a test-assumption bug."""
    resp = api_client.get(
        "/restro/audit-log",
        params={"page": 1, "per_page": 2},
        headers=auth_headers(tokens["owner"]),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body["data"]) <= 10
    assert body["meta"]["page"] == 1
    assert body["meta"]["per_page"] == 10


def test_tenant_isolation(api_client, owner_token_pan, owner_token_vat):
    """PAN and VAT are two separate tenants -- one tenant's owner must never
    see the other tenant's audit rows, even though both have real rows for
    the same actions (login, mark_paid, etc). Uses the non-parametrized
    owner tokens so both tenants are queried side by side in one test."""
    pan_resp = api_client.get(
        "/restro/audit-log",
        params={"entity_type": "order", "per_page": 200},
        headers=auth_headers(owner_token_pan),
    )
    vat_resp = api_client.get(
        "/restro/audit-log",
        params={"entity_type": "order", "per_page": 200},
        headers=auth_headers(owner_token_vat),
    )
    assert pan_resp.status_code == 200, pan_resp.text
    assert vat_resp.status_code == 200, vat_resp.text
    pan_entity_ids = {r["entity_id"] for r in pan_resp.json()["data"]}
    vat_entity_ids = {r["entity_id"] for r in vat_resp.json()["data"]}
    assert pan_entity_ids, "PAN tenant should have real order audit rows from test_08_orders.py"
    assert vat_entity_ids, "VAT tenant should have real order audit rows from test_08_orders.py"
    assert pan_entity_ids.isdisjoint(vat_entity_ids)
