"""Ordered test #11: reports (3 JSON endpoints -- stock-summary/margin/
party-statement -- plus 11 XLSX/PDF exports). Depends on test_01-10 passing
first, specifically on test_09_invoices.py's real sales/purchases/parties
for the reports to have real data to aggregate.

Role gating confirmed real and NOT uniform: only standard-view and
credit-notes exports are owner/manager-only (router.py's own explicit
checks) -- every other report/export (sales, vat-register, purchases,
annexure-13, monthly-vat-summary, tds, stock-summary, margin,
party-statement, and their exports) has no role gate at all, unlike RMS
where every export was owner/manager-only."""
from conftest import auth_headers

GATED_EXPORTS = ["standard-view", "credit-notes"]
UNGATED_EXPORTS = [
    "sales", "vat-register", "purchases", "annexure-13",
    "monthly-vat-summary", "tds", "stock-summary", "margin",
]


def test_stock_summary_endpoint_reachable(api_client, business, tokens):
    resp = api_client.get("/ims/reports/stock-summary", headers=auth_headers(tokens["storekeeper"]))
    assert resp.status_code == 200, resp.text
    assert isinstance(resp.json()["data"], list)


def test_stock_summary_low_stock_filter(api_client, business, tokens):
    resp = api_client.get(
        "/ims/reports/stock-summary", params={"low_stock_only": True}, headers=auth_headers(tokens["owner"])
    )
    assert resp.status_code == 200, resp.text


def test_margin_endpoint_reachable(api_client, business, tokens):
    resp = api_client.get("/ims/reports/margin", headers=auth_headers(tokens["manager"]))
    assert resp.status_code == 200, resp.text
    rows = resp.json()["data"]
    if rows:
        row = rows[0]
        assert "profit" in row and "margin_pct" in row


def test_party_statement_requires_valid_kind(api_client, business, tokens):
    resp = api_client.get(
        "/ims/reports/party-statement", params={"kind": "reseller"}, headers=auth_headers(tokens["owner"])
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["error"]["code"] == "INVALID_KIND"


def test_party_statement_customer(api_client, business, tokens):
    resp = api_client.get(
        "/ims/reports/party-statement", params={"kind": "customer"}, headers=auth_headers(tokens["owner"])
    )
    assert resp.status_code == 200, resp.text
    assert isinstance(resp.json()["data"], list)


def test_party_statement_supplier(api_client, business, tokens):
    resp = api_client.get(
        "/ims/reports/party-statement", params={"kind": "supplier"}, headers=auth_headers(tokens["owner"])
    )
    assert resp.status_code == 200, resp.text


class TestUngatedExports:
    def test_storekeeper_can_export_every_ungated_report_xlsx(self, api_client, business, tokens):
        for name in UNGATED_EXPORTS:
            resp = api_client.get(
                f"/ims/reports/{name}/export",
                params={"format": "xlsx"},
                headers=auth_headers(tokens["storekeeper"]),
            )
            assert resp.status_code == 200, f"{name}: {resp.text}"
            assert resp.headers["content-type"] == (
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )
            assert len(resp.content) > 0

    def test_owner_can_export_every_ungated_report_pdf(self, api_client, business, tokens):
        for name in UNGATED_EXPORTS:
            resp = api_client.get(
                f"/ims/reports/{name}/export",
                params={"format": "pdf"},
                headers=auth_headers(tokens["owner"]),
            )
            assert resp.status_code == 200, f"{name}: {resp.text}"
            assert resp.headers["content-type"] == "application/pdf"
            assert resp.content[:4] == b"%PDF"


class TestGatedExports:
    def test_storekeeper_cannot_export_standard_view_or_credit_notes(self, api_client, business, tokens):
        for name in GATED_EXPORTS:
            resp = api_client.get(
                f"/ims/reports/{name}/export",
                params={"format": "xlsx"},
                headers=auth_headers(tokens["storekeeper"]),
            )
            assert resp.status_code == 403, f"{name}: {resp.text}"

    def test_manager_can_export_standard_view_and_credit_notes(self, api_client, business, tokens):
        for name in GATED_EXPORTS:
            resp = api_client.get(
                f"/ims/reports/{name}/export",
                params={"format": "xlsx"},
                headers=auth_headers(tokens["manager"]),
            )
            assert resp.status_code == 200, f"{name}: {resp.text}"


class TestStockSummaryAndMarginExports:
    """These two report/export pairs (stock-summary, margin) exist both as
    a JSON list endpoint AND their own /export variant -- confirm the
    export path specifically, separate from the ungated bulk-loop above
    (which already covers them, but this asserts real content shape too)."""

    def test_stock_summary_export(self, api_client, business, tokens):
        resp = api_client.get(
            "/ims/reports/stock-summary/export",
            params={"format": "xlsx"},
            headers=auth_headers(tokens["owner"]),
        )
        assert resp.status_code == 200, resp.text

    def test_margin_export(self, api_client, business, tokens):
        resp = api_client.get(
            "/ims/reports/margin/export",
            params={"format": "pdf"},
            headers=auth_headers(tokens["owner"]),
        )
        assert resp.status_code == 200, resp.text


class TestPartyStatementExport:
    def test_party_statement_export_requires_kind(self, api_client, business, tokens):
        """kind has no default -- omitting it entirely hits FastAPI's own
        required-query-param validation (a generic 422), not the app's own
        INVALID_KIND (only reachable once kind is present but not one of
        the two allowed values)."""
        resp = api_client.get(
            "/ims/reports/party-statement/export",
            params={"format": "xlsx"},
            headers=auth_headers(tokens["owner"]),
        )
        assert resp.status_code == 422, resp.text

    def test_party_statement_export_invalid_kind_rejected(self, api_client, business, tokens):
        resp = api_client.get(
            "/ims/reports/party-statement/export",
            params={"format": "xlsx", "kind": "reseller"},
            headers=auth_headers(tokens["owner"]),
        )
        assert resp.status_code == 422, resp.text
        assert resp.json()["error"]["code"] == "INVALID_KIND"

    def test_party_statement_export_customer(self, api_client, business, tokens):
        resp = api_client.get(
            "/ims/reports/party-statement/export",
            params={"format": "xlsx", "kind": "customer"},
            headers=auth_headers(tokens["storekeeper"]),
        )
        assert resp.status_code == 200, resp.text


class TestPartyLedgerExport:
    def test_party_ledger_export(self, api_client, business, tokens):
        parties_resp = api_client.get("/ims/parties", headers=auth_headers(tokens["owner"]))
        parties = parties_resp.json()["data"]
        assert parties, "expected at least one party from earlier test files"
        party_id = parties[0]["id"]
        resp = api_client.get(
            f"/ims/parties/{party_id}/ledger/export",
            params={"format": "xlsx"},
            headers=auth_headers(tokens["storekeeper"]),
        )
        assert resp.status_code == 200, resp.text

    def test_party_ledger_export_nonexistent_party_returns_404(self, api_client, business, tokens):
        resp = api_client.get(
            "/ims/parties/00000000-0000-0000-0000-000000000000/ledger/export",
            params={"format": "xlsx"},
            headers=auth_headers(tokens["owner"]),
        )
        assert resp.status_code == 404, resp.text
        assert resp.json()["error"]["code"] == "PARTY_NOT_FOUND"


def test_invalid_format_rejected(api_client, business, tokens):
    resp = api_client.get(
        "/ims/reports/sales/export",
        params={"format": "csv"},
        headers=auth_headers(tokens["owner"]),
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["error"]["code"] == "INVALID_FORMAT"
