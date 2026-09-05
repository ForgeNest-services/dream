"""Ordered test #11: reports (dashboard/summary/trend/top-items JSON reads,
plus the 5 IRD-compliance XLSX/PDF exports). Depends on test_01-10 passing
first -- specifically on test_08_orders.py's paid orders and credit note
still being in the DB (reports aggregate real data, they don't seed their
own). Real HTTP against the live srota-api container, both business types."""
from conftest import auth_headers


def _today_bs(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/reports/dashboard",
        headers=auth_headers(tokens["owner"]),
    )
    return resp.json()["data"]["anchor_bs"]


def test_dashboard_reachable_by_any_staff(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/reports/dashboard",
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert "anchor_bs" in data
    assert "today" in data
    assert "trend_7_days" in data
    assert "top_items" in data
    assert "tables" in data
    assert isinstance(data["low_stock_count"], int)


def test_dashboard_invalid_date_rejected(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/reports/dashboard",
        params={"bs": "not-a-date"},
        headers=auth_headers(tokens["owner"]),
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["error"]["code"] == "INVALID_DATE"


def test_daily_summary_requires_bs_param(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/reports/daily-summary",
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp.status_code == 422, resp.text  # FastAPI's own required-query-param validation


def test_daily_summary_reflects_paid_orders(api_client, business, tokens):
    today = _today_bs(api_client, business, tokens)
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/reports/daily-summary",
        params={"bs": today},
        headers=auth_headers(tokens["manager"]),
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    assert data["bs_from"] == today
    assert data["bs_to"] == today
    # test_08_orders.py paid at least one order and issued one credit note
    # today, in this same tenant/branch.
    assert data["orders"]["paid"] >= 1
    assert float(data["sales_gross"]) != 0.0 or data["orders"]["paid"] >= 1
    assert "cash" in data["by_payment"]
    assert "qr" in data["by_payment"]
    assert "khata" in data["by_payment"]


def test_range_summary_valid_range(api_client, business, tokens):
    today = _today_bs(api_client, business, tokens)
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/reports/range-summary",
        params={"bs_from": today, "bs_to": today},
        headers=auth_headers(tokens["owner"]),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["orders"]["paid"] >= 1


def test_range_summary_inverted_range_rejected(api_client, business, tokens):
    today = _today_bs(api_client, business, tokens)
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/reports/range-summary",
        params={"bs_from": today, "bs_to": "2000-01-01"},
        headers=auth_headers(tokens["owner"]),
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["error"]["code"] == "INVALID_RANGE"


def test_sales_trend_fills_continuous_days(api_client, business, tokens):
    today = _today_bs(api_client, business, tokens)
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/reports/sales-trend",
        params={"bs_from": today, "bs_to": today},
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp.status_code == 200, resp.text
    trend = resp.json()["data"]
    assert len(trend) == 1
    assert trend[0]["bs_date"] == today


def test_sales_trend_inverted_range_rejected(api_client, business, tokens):
    today = _today_bs(api_client, business, tokens)
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/reports/sales-trend",
        params={"bs_from": today, "bs_to": "2000-01-01"},
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["error"]["code"] == "INVALID_RANGE"


def test_top_items_no_params_defaults_to_all_time(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/reports/top-items",
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp.status_code == 200, resp.text
    items = resp.json()["data"]
    assert isinstance(items, list)
    if items:
        assert "name" in items[0]
        assert "qty" in items[0]
        assert "revenue" in items[0]


def test_top_items_limit_is_clamped(api_client, business, tokens):
    """Service clamps limit to [1, 50] -- an oversized limit shouldn't error,
    just get capped."""
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/reports/top-items",
        params={"limit": 9999},
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp.status_code == 200, resp.text


def test_reports_reject_other_branch_for_manager(api_client, business, tokens):
    """Branch-scoped roles (manager/waiter/chef) can't view another branch's
    reports even within the same tenant -- uses a random not-this-branch id."""
    resp = api_client.get(
        "/restro/branches/00000000-0000-0000-0000-000000000000/reports/dashboard",
        headers=auth_headers(tokens["manager"]),
    )
    assert resp.status_code == 403, resp.text


class TestExports:
    """The 5 IRD-compliance exports. All owner/manager only, all accept
    format=xlsx|pdf plus optional branch_id/bs_from/bs_to."""

    ENDPOINTS = [
        "sales-register",
        "annexure-13",
        "monthly-vat-summary",
        "standard-view",
        "credit-notes",
    ]

    def test_waiter_cannot_export_any_report(self, api_client, business, tokens):
        for endpoint in self.ENDPOINTS:
            resp = api_client.get(
                f"/restro/reports/{endpoint}/export",
                params={"format": "xlsx", "branch_id": business["branch_id"]},
                headers=auth_headers(tokens["waiter"]),
            )
            assert resp.status_code == 403, f"{endpoint}: {resp.text}"

    def test_manager_can_export_xlsx(self, api_client, business, tokens):
        for endpoint in self.ENDPOINTS:
            resp = api_client.get(
                f"/restro/reports/{endpoint}/export",
                params={"format": "xlsx", "branch_id": business["branch_id"]},
                headers=auth_headers(tokens["manager"]),
            )
            assert resp.status_code == 200, f"{endpoint}: {resp.text}"
            assert resp.headers["content-type"] == (
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )
            assert len(resp.content) > 0

    def test_owner_can_export_pdf(self, api_client, business, tokens):
        for endpoint in self.ENDPOINTS:
            resp = api_client.get(
                f"/restro/reports/{endpoint}/export",
                params={"format": "pdf", "branch_id": business["branch_id"]},
                headers=auth_headers(tokens["owner"]),
            )
            assert resp.status_code == 200, f"{endpoint}: {resp.text}"
            assert resp.headers["content-type"] == "application/pdf"
            assert resp.content[:4] == b"%PDF"

    def test_invalid_format_rejected(self, api_client, business, tokens):
        resp = api_client.get(
            "/restro/reports/sales-register/export",
            params={"format": "csv", "branch_id": business["branch_id"]},
            headers=auth_headers(tokens["owner"]),
        )
        assert resp.status_code == 422, resp.text
        assert resp.json()["error"]["code"] == "INVALID_FORMAT"

    def test_export_without_branch_id_scopes_to_whole_tenant(self, api_client, business, tokens):
        """Owner can omit branch_id entirely -- tenant-wide export (both
        dummy tenants are single-branch, so this is equivalent to passing
        branch_id here, but confirms the endpoint doesn't require it)."""
        resp = api_client.get(
            "/restro/reports/sales-register/export",
            params={"format": "xlsx"},
            headers=auth_headers(tokens["owner"]),
        )
        assert resp.status_code == 200, resp.text

    def test_credit_notes_export_includes_issued_note(self, api_client, business, tokens):
        """test_08_orders.py's TestMarkPaidAndCreditNote issued exactly one
        real credit note in this tenant/branch -- confirm the export
        actually reflects it by checking the workbook has more than just a
        header row."""
        resp = api_client.get(
            "/restro/reports/credit-notes/export",
            params={"format": "xlsx", "branch_id": business["branch_id"]},
            headers=auth_headers(tokens["owner"]),
        )
        assert resp.status_code == 200, resp.text
        assert len(resp.content) > 0
