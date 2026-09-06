"""Ordered test #13 (final): CBMS (IRD Central Billing Monitoring System)
integration -- payload preview, manual sync, and the sync log. Depends on
test_01-12 passing first, specifically on test_08_orders.py's paid orders.

IMPORTANT: neither dummy tenant has real CBMS credentials configured
(CBMSCredentialRepository.get requires OrgTaxSettings.cbms_sync_enabled=True
plus real ird_username/ird_password) -- every path exercised here resolves
to CBMS_NOT_CONFIGURED before any network call to IRD's real sandbox is
ever made. This is deliberate: this suite must never make live IRD calls
using the dummy tenants' fabricated data. Real (separate, credentialed)
CBMS sandbox testing was already done manually earlier this session and is
documented in docs/compliance.md's section 6 -- not repeated here."""
from conftest import auth_headers


def _get_a_paid_order(api_client, business, tokens):
    """test_08_orders.py's TestMarkPaidAndCreditNote left at least one real
    paid, non-credit-note order in this branch."""
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/orders",
        params={"status": "paid", "per_page": 100},
        headers=auth_headers(tokens["owner"]),
    )
    orders = resp.json()["data"]
    paid = next(o for o in orders if not o["is_credit_note"])
    return paid["id"]


def test_cbms_payload_not_configured_for_dummy_tenant(api_client, business, tokens):
    """Neither dummy tenant has CBMS credentials -- confirms the safe,
    no-network-call failure path rather than attempting a real IRD call."""
    order_id = _get_a_paid_order(api_client, business, tokens)
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/orders/{order_id}/cbms-payload",
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp.status_code == 400, resp.text
    assert resp.json()["error"]["code"] == "CBMS_NOT_CONFIGURED"


def test_cbms_payload_requires_paid_order(api_client, business, tokens):
    """A draft order can't be previewed for CBMS submission -- create one
    fresh so it's untouched by anything else."""
    zones_resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/zones",
        headers=auth_headers(tokens["owner"]),
    )
    zone_id = zones_resp.json()["data"][0]["id"]
    import uuid
    table_resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/tables",
        headers=auth_headers(tokens["owner"]),
        json={"zone_id": zone_id, "label": f"CbmsTestTable-{uuid.uuid4().hex[:8]}"},
    )
    table_id = table_resp.json()["data"]["id"]
    order_resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/orders",
        headers=auth_headers(tokens["waiter"]),
        json={"type": "dine-in", "table_id": table_id},
    )
    draft_order_id = order_resp.json()["data"]["id"]

    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/orders/{draft_order_id}/cbms-payload",
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp.status_code == 400, resp.text
    assert resp.json()["error"]["code"] == "NOT_PAID"


def test_cbms_payload_nonexistent_order_returns_404(api_client, business, tokens):
    resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/orders/00000000-0000-0000-0000-000000000000/cbms-payload",
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp.status_code == 404, resp.text
    assert resp.json()["error"]["code"] == "NOT_FOUND"


def test_waiter_cannot_manually_sync_to_cbms(api_client, business, tokens):
    order_id = _get_a_paid_order(api_client, business, tokens)
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/orders/{order_id}/cbms-sync",
        headers=auth_headers(tokens["waiter"]),
    )
    assert resp.status_code == 403, resp.text


def test_manual_sync_requires_paid_order(api_client, business, tokens):
    zones_resp = api_client.get(
        f"/restro/branches/{business['branch_id']}/zones",
        headers=auth_headers(tokens["owner"]),
    )
    zone_id = zones_resp.json()["data"][0]["id"]
    import uuid
    table_resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/tables",
        headers=auth_headers(tokens["owner"]),
        json={"zone_id": zone_id, "label": f"CbmsSyncTestTable-{uuid.uuid4().hex[:8]}"},
    )
    table_id = table_resp.json()["data"]["id"]
    order_resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/orders",
        headers=auth_headers(tokens["waiter"]),
        json={"type": "dine-in", "table_id": table_id},
    )
    draft_order_id = order_resp.json()["data"]["id"]

    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/orders/{draft_order_id}/cbms-sync",
        headers=auth_headers(tokens["manager"]),
    )
    assert resp.status_code == 400, resp.text
    assert resp.json()["error"]["code"] == "NOT_PAID"


def test_manual_sync_nonexistent_order_returns_404(api_client, business, tokens):
    resp = api_client.post(
        f"/restro/branches/{business['branch_id']}/orders/00000000-0000-0000-0000-000000000000/cbms-sync",
        headers=auth_headers(tokens["manager"]),
    )
    assert resp.status_code == 404, resp.text
    assert resp.json()["error"]["code"] == "NOT_FOUND"


class TestSyncLog:
    def test_any_staff_can_list_sync_log(self, api_client, business, tokens):
        """Sync log listing has no explicit role gate in the router --
        unlike sync/resync, any authenticated staff member can view it."""
        resp = api_client.get(
            "/restro/cbms-sync-log",
            headers=auth_headers(tokens["waiter"]),
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert "data" in body
        assert "meta" in body

    def test_sync_log_starts_empty_for_dummy_tenant(self, api_client, business, tokens):
        """No mark-paid/credit-note action in this suite ever enqueued a real
        CBMS job -- both dummy tenants are PAN-only or VAT-registered-but-
        uncredentialed, so _enqueue_cbms_sync's CBMSCredentialRepository.get
        check always skips enqueueing (api/features/restro/router.py's
        _enqueue_cbms_sync). Confirms no accidental real sync was queued."""
        resp = api_client.get(
            "/restro/cbms-sync-log",
            headers=auth_headers(tokens["owner"]),
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["data"] == []
        assert resp.json()["meta"]["total"] == 0

    def test_sync_log_filter_by_status(self, api_client, business, tokens):
        resp = api_client.get(
            "/restro/cbms-sync-log",
            params={"status": "synced"},
            headers=auth_headers(tokens["owner"]),
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["data"] == []

    def test_waiter_cannot_resync(self, api_client, business, tokens):
        resp = api_client.post(
            "/restro/cbms-sync-log/00000000-0000-0000-0000-000000000000/resync",
            headers=auth_headers(tokens["waiter"]),
        )
        assert resp.status_code == 403, resp.text

    def test_manager_resync_nonexistent_log_returns_404(self, api_client, business, tokens):
        resp = api_client.post(
            "/restro/cbms-sync-log/00000000-0000-0000-0000-000000000000/resync",
            headers=auth_headers(tokens["manager"]),
        )
        assert resp.status_code == 404, resp.text
