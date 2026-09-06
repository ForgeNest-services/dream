"""Ordered test #13 (final): CBMS (IRD Central Billing Monitoring System)
integration -- payload preview, manual sync, and the sync log. Depends on
test_01-12 passing first, specifically on test_09_invoices.py's real
tax/abbreviated invoices.

IMPORTANT: neither dummy tenant has real CBMS credentials configured
(CBMSCredentialRepository.get requires OrgTaxSettings.cbms_sync_enabled=True
plus real ird_username/ird_password) -- every path exercised here resolves
to CBMS_NOT_CONFIGURED before any network call to IRD's real sandbox is
ever made, same deliberate boundary as RMS's test_13_cbms.py. Real,
credentialed live-sandbox testing (if ever repeated for IMS) should be a
separate, manual, one-off exercise -- not part of this automated suite."""
import uuid

from conftest import auth_headers

_RUN_ID = uuid.uuid4().hex[:8]


def _get_a_category(api_client, tokens):
    resp = api_client.get("/ims/categories", headers=auth_headers(tokens["owner"]))
    cats = resp.json()["data"]
    if cats:
        return cats[0]["id"]
    create_resp = api_client.post(
        "/ims/categories", headers=auth_headers(tokens["owner"]), json={"name": "General"}
    )
    return create_resp.json()["data"]["id"]


def _get_a_unit(api_client, tokens):
    resp = api_client.get("/ims/units", headers=auth_headers(tokens["owner"]))
    return resp.json()["data"][0]["id"]


def _create_paid_invoice(api_client, business, tokens):
    category_id = _get_a_category(api_client, tokens)
    unit_id = _get_a_unit(api_client, tokens)
    sku = f"SKU-CBMSTEST-{uuid.uuid4().hex[:8]}"
    purchase_resp = api_client.post(
        "/ims/purchases",
        headers=auth_headers(tokens["owner"]),
        json={
            "date": "2026-09-05T00:00:00",
            "branch_id": business["branch_id"],
            "items": [
                {
                    "kind": "new",
                    "name": f"CBMS Test Product {sku}",
                    "sku": sku,
                    "category_id": category_id,
                    "rows": [{"unit_id": unit_id, "qty": "10", "unit_cost": "10", "selling_price": "100"}],
                }
            ],
        },
    )
    variant_id = purchase_resp.json()["data"]["lines"][0]["variant_id"]

    customer_resp = api_client.post(
        "/ims/parties",
        headers=auth_headers(tokens["owner"]),
        json={"name": f"CBMS Test Customer {_RUN_ID}", "kind": "customer"},
    )
    customer_id = customer_resp.json()["data"]["id"]

    inv_resp = api_client.post(
        "/ims/invoices",
        headers=auth_headers(tokens["owner"]),
        json={
            "date": "2026-09-05T12:00:00",
            "branch_id": business["branch_id"],
            "customer_id": customer_id,
            "paid_amount": "99999",
            "lines": [{"variant_id": variant_id, "qty": "1", "rate": "100"}],
        },
    )
    return inv_resp.json()["data"]["id"]


def test_cbms_payload_not_configured_for_dummy_tenant(api_client, business, tokens):
    invoice_id = _create_paid_invoice(api_client, business, tokens)
    resp = api_client.get(
        f"/ims/invoices/{invoice_id}/cbms-payload",
        headers=auth_headers(tokens["storekeeper"]),
    )
    assert resp.status_code == 400, resp.text
    assert resp.json()["error"]["code"] == "CBMS_NOT_CONFIGURED"


def test_cbms_payload_on_quotation_rejected(api_client, business, tokens):
    category_id = _get_a_category(api_client, tokens)
    unit_id = _get_a_unit(api_client, tokens)
    purchase_resp = api_client.post(
        "/ims/purchases",
        headers=auth_headers(tokens["owner"]),
        json={
            "date": "2026-09-05T00:00:00",
            "branch_id": business["branch_id"],
            "items": [
                {
                    "kind": "new",
                    "name": f"CBMS Quote Test Product {uuid.uuid4().hex[:8]}",
                    "sku": f"SKU-CBMSQUOTE-{uuid.uuid4().hex[:8]}",
                    "category_id": category_id,
                    "rows": [{"unit_id": unit_id, "qty": "5", "unit_cost": "10"}],
                }
            ],
        },
    )
    variant_id = purchase_resp.json()["data"]["lines"][0]["variant_id"]
    customer_resp = api_client.post(
        "/ims/parties",
        headers=auth_headers(tokens["owner"]),
        json={"name": f"CBMS Quote Customer {_RUN_ID}", "kind": "customer"},
    )
    customer_id = customer_resp.json()["data"]["id"]
    q_resp = api_client.post(
        "/ims/invoices",
        headers=auth_headers(tokens["owner"]),
        json={
            "date": "2026-09-05T12:00:00",
            "branch_id": business["branch_id"],
            "customer_id": customer_id,
            "is_quotation": True,
            "lines": [{"variant_id": variant_id, "qty": "1", "rate": "100"}],
        },
    )
    quotation_id = q_resp.json()["data"]["id"]

    resp = api_client.get(
        f"/ims/invoices/{quotation_id}/cbms-payload",
        headers=auth_headers(tokens["owner"]),
    )
    assert resp.status_code == 400, resp.text
    assert resp.json()["error"]["code"] == "NOT_AN_INVOICE"


def test_cbms_payload_nonexistent_invoice_returns_404(api_client, business, tokens):
    resp = api_client.get(
        "/ims/invoices/00000000-0000-0000-0000-000000000000/cbms-payload",
        headers=auth_headers(tokens["owner"]),
    )
    assert resp.status_code == 404, resp.text
    assert resp.json()["error"]["code"] == "NOT_FOUND"


def test_storekeeper_cannot_manually_sync_to_cbms(api_client, business, tokens):
    invoice_id = _create_paid_invoice(api_client, business, tokens)
    resp = api_client.post(
        f"/ims/invoices/{invoice_id}/cbms-sync",
        headers=auth_headers(tokens["storekeeper"]),
    )
    assert resp.status_code == 403, resp.text


def test_manual_sync_nonexistent_invoice_returns_404(api_client, business, tokens):
    resp = api_client.post(
        "/ims/invoices/00000000-0000-0000-0000-000000000000/cbms-sync",
        headers=auth_headers(tokens["manager"]),
    )
    assert resp.status_code == 404, resp.text
    assert resp.json()["error"]["code"] == "NOT_FOUND"


class TestSyncLog:
    def test_any_staff_can_list_sync_log(self, api_client, business, tokens):
        resp = api_client.get("/ims/cbms-sync-log", headers=auth_headers(tokens["storekeeper"]))
        assert resp.status_code == 200, resp.text
        assert "data" in resp.json() and "meta" in resp.json()

    def test_sync_log_empty_for_dummy_tenant(self, api_client, business, tokens):
        """No invoice create/credit-note ever enqueued a real CBMS job for
        this dummy tenant -- _enqueue_cbms_sync's CBMSCredentialRepository
        .get check always skips enqueueing (router.py's own logic, same as
        RMS)."""
        resp = api_client.get("/ims/cbms-sync-log", headers=auth_headers(tokens["owner"]))
        assert resp.status_code == 200, resp.text
        assert resp.json()["data"] == []
        assert resp.json()["meta"]["total"] == 0

    def test_waiter_cannot_resync(self, api_client, business, tokens):
        resp = api_client.post(
            "/ims/cbms-sync-log/00000000-0000-0000-0000-000000000000/resync",
            headers=auth_headers(tokens["storekeeper"]),
        )
        assert resp.status_code == 403, resp.text

    def test_manager_resync_nonexistent_log_returns_404(self, api_client, business, tokens):
        resp = api_client.post(
            "/ims/cbms-sync-log/00000000-0000-0000-0000-000000000000/resync",
            headers=auth_headers(tokens["manager"]),
        )
        assert resp.status_code == 404, resp.text
