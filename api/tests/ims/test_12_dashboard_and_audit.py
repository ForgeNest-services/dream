"""Ordered test #12: dashboard + audit log. Depends on test_01-11 passing
first, specifically on test_09_invoices.py's real invoices/credit-notes/
conversions and test_01_login.py's real login/login_failed events for the
audit log to have real rows to filter against."""
from conftest import auth_headers


def test_dashboard_reachable_by_any_staff(api_client, business, tokens):
    resp = api_client.get("/ims/dashboard", headers=auth_headers(tokens["storekeeper"]))
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    for key in (
        "sales_total", "sales_count", "receivable", "payable", "stock_value",
        "low_stock_count", "sales_trend", "sales_by_category", "top_sellers",
        "low_stock_alerts", "recent_movements",
    ):
        assert key in data

    # test_09_invoices.py recorded many real, paid sales in this tenant.
    assert data["sales_count"] >= 1
    assert float(data["sales_total"]) != 0.0


def test_dashboard_filter_by_branch(api_client, business, tokens):
    resp = api_client.get(
        "/ims/dashboard", params={"branch_id": business["branch_id"]}, headers=auth_headers(tokens["owner"])
    )
    assert resp.status_code == 200, resp.text


def test_dashboard_filter_by_date_range(api_client, business, tokens):
    resp = api_client.get(
        "/ims/dashboard",
        params={"bs_from": "2083-01-01", "bs_to": "2083-12-30"},
        headers=auth_headers(tokens["manager"]),
    )
    assert resp.status_code == 200, resp.text


class TestAuditLog:
    def test_storekeeper_cannot_view_audit_log(self, api_client, business, tokens):
        resp = api_client.get("/ims/audit-log", headers=auth_headers(tokens["storekeeper"]))
        assert resp.status_code == 403, resp.text

    def test_manager_can_view_audit_log(self, api_client, business, tokens):
        resp = api_client.get("/ims/audit-log", headers=auth_headers(tokens["manager"]))
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert "data" in body and "meta" in body
        assert body["meta"]["total"] >= 1

    def test_owner_sees_login_events(self, api_client, business, tokens):
        resp = api_client.get(
            "/ims/audit-log", params={"action": "login", "per_page": 100},
            headers=auth_headers(tokens["owner"]),
        )
        assert resp.status_code == 200, resp.text
        rows = resp.json()["data"]
        assert len(rows) >= 1
        assert all(r["action"] == "login" for r in rows)
        assert all(r["entity_type"] == "credential" for r in rows)

    def test_owner_sees_login_failed_events(self, api_client, business, tokens):
        resp = api_client.get(
            "/ims/audit-log", params={"action": "login_failed", "per_page": 100},
            headers=auth_headers(tokens["owner"]),
        )
        assert resp.status_code == 200, resp.text
        assert len(resp.json()["data"]) >= 1

    def test_filter_by_entity_type_invoice(self, api_client, business, tokens):
        resp = api_client.get(
            "/ims/audit-log", params={"entity_type": "invoice", "per_page": 200},
            headers=auth_headers(tokens["owner"]),
        )
        assert resp.status_code == 200, resp.text
        rows = resp.json()["data"]
        assert len(rows) >= 1
        assert all(r["entity_type"] == "invoice" for r in rows)
        actions = {r["action"] for r in rows}
        assert actions <= {"create", "credit_note", "void_quotation", "convert_quotation", "record_payment"}

    def test_filter_by_action_credit_note(self, api_client, business, tokens):
        resp = api_client.get(
            "/ims/audit-log", params={"action": "credit_note", "per_page": 200},
            headers=auth_headers(tokens["owner"]),
        )
        assert resp.status_code == 200, resp.text
        rows = resp.json()["data"]
        assert len(rows) >= 1
        assert all(r["action"] == "credit_note" for r in rows)

    def test_filter_by_nonexistent_action_returns_empty(self, api_client, business, tokens):
        resp = api_client.get(
            "/ims/audit-log", params={"action": "this_action_does_not_exist"},
            headers=auth_headers(tokens["owner"]),
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["data"] == []
        assert resp.json()["meta"]["total"] == 0

    def test_pagination_respected(self, api_client, business, tokens):
        resp = api_client.get(
            "/ims/audit-log", params={"page": 1, "per_page": 2}, headers=auth_headers(tokens["owner"])
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        # parse_paging floors per_page at MIN_PER_PAGE=10, same real
        # clamping behavior confirmed in RMS's audit-log test.
        assert len(body["data"]) <= 10
        assert body["meta"]["per_page"] == 10

    def test_tenant_isolation(self, api_client, owner_token_pan, owner_token_vat):
        pan_resp = api_client.get(
            "/ims/audit-log", params={"entity_type": "invoice", "per_page": 200},
            headers=auth_headers(owner_token_pan),
        )
        vat_resp = api_client.get(
            "/ims/audit-log", params={"entity_type": "invoice", "per_page": 200},
            headers=auth_headers(owner_token_vat),
        )
        assert pan_resp.status_code == 200, pan_resp.text
        assert vat_resp.status_code == 200, vat_resp.text
        pan_ids = {r["entity_id"] for r in pan_resp.json()["data"]}
        vat_ids = {r["entity_id"] for r in vat_resp.json()["data"]}
        assert pan_ids, "PAN tenant should have real invoice audit rows"
        assert vat_ids, "VAT tenant should have real invoice audit rows"
        assert pan_ids.isdisjoint(vat_ids)
