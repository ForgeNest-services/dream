"""Ordered test #7: parties (suppliers + customers, tenant-wide) + party
ledger. Depends on test_01-06 passing first. Real HTTP against the live
srota-api container, both business types.

Unlike RMS's customer-only concept, IMS parties are ONE model covering
both suppliers and customers (kind='supplier'|'customer'), each with a
running ledger. "Opening balance" is the one ledger entry treated as
correctable in place (not append-only) -- party_service.py's update()
patches or deletes that specific row whenever opening_balance changes,
which this file directly verifies (this exact path was a real, broken
production bug fixed earlier this session -- ims_ledger_entries had no
UPDATE/DELETE grant for debit/credit at all)."""
from conftest import auth_headers


def test_list_parties_endpoint_reachable(api_client, business, tokens):
    resp = api_client.get("/ims/parties", headers=auth_headers(tokens["owner"]))
    assert resp.status_code == 200, resp.text
    assert isinstance(resp.json()["data"], list)


def test_any_staff_can_create_customer(api_client, business, tokens):
    """Unlike delete (owner/manager only), create/update have no role gate
    at all in the router -- any authenticated staff can add a party."""
    resp = api_client.post(
        "/ims/parties",
        headers=auth_headers(tokens["storekeeper"]),
        json={"name": "Retail Customer Co", "kind": "customer"},
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()["data"]
    assert data["kind"] == "customer"
    assert float(data["opening_balance"]) == 0.0


def test_any_staff_can_create_supplier(api_client, business, tokens):
    resp = api_client.post(
        "/ims/parties",
        headers=auth_headers(tokens["storekeeper"]),
        json={"name": "Wholesale Supplier Co", "kind": "supplier"},
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["data"]["kind"] == "supplier"


def test_invalid_kind_rejected(api_client, business, tokens):
    resp = api_client.post(
        "/ims/parties",
        headers=auth_headers(tokens["owner"]),
        json={"name": "Bad Kind Party", "kind": "reseller"},
    )
    assert resp.status_code == 422, resp.text


def test_create_customer_with_opening_balance_creates_ledger_entry(api_client, business, tokens):
    resp = api_client.post(
        "/ims/parties",
        headers=auth_headers(tokens["owner"]),
        json={"name": "Customer With Balance", "kind": "customer", "opening_balance": "1000"},
    )
    assert resp.status_code == 201, resp.text
    party_id = resp.json()["data"]["id"]

    ledger_resp = api_client.get(f"/ims/parties/{party_id}/ledger", headers=auth_headers(tokens["owner"]))
    assert ledger_resp.status_code == 200, ledger_resp.text
    entries = ledger_resp.json()["data"]
    assert len(entries) == 1
    assert entries[0]["description"] == "Opening balance"
    # customer opening balance is a debit (receivable)
    assert float(entries[0]["debit"]) == 1000.0
    assert float(entries[0]["credit"]) == 0.0


def test_create_supplier_with_opening_balance_is_a_credit(api_client, business, tokens):
    resp = api_client.post(
        "/ims/parties",
        headers=auth_headers(tokens["owner"]),
        json={"name": "Supplier With Balance", "kind": "supplier", "opening_balance": "2000"},
    )
    party_id = resp.json()["data"]["id"]
    ledger_resp = api_client.get(f"/ims/parties/{party_id}/ledger", headers=auth_headers(tokens["owner"]))
    entries = ledger_resp.json()["data"]
    assert len(entries) == 1
    assert float(entries[0]["credit"]) == 2000.0
    assert float(entries[0]["debit"]) == 0.0


def test_update_opening_balance_corrects_ledger_entry_in_place(api_client, business, tokens):
    """Real, previously-broken production path -- confirms the fix:
    changing opening_balance patches the SAME ledger row (not a new one)."""
    resp = api_client.post(
        "/ims/parties",
        headers=auth_headers(tokens["owner"]),
        json={"name": "Balance Correction Test", "kind": "customer", "opening_balance": "500"},
    )
    party_id = resp.json()["data"]["id"]

    update_resp = api_client.patch(
        f"/ims/parties/{party_id}",
        headers=auth_headers(tokens["manager"]),
        json={"name": "Balance Correction Test", "opening_balance": "750"},
    )
    assert update_resp.status_code == 200, update_resp.text
    assert float(update_resp.json()["data"]["opening_balance"]) == 750.0

    ledger_resp = api_client.get(f"/ims/parties/{party_id}/ledger", headers=auth_headers(tokens["owner"]))
    entries = ledger_resp.json()["data"]
    assert len(entries) == 1  # still one row, corrected in place -- not a second one
    assert float(entries[0]["debit"]) == 750.0


def test_clearing_opening_balance_to_zero_removes_the_ledger_entry(api_client, business, tokens):
    """Real, previously-broken production path (the DELETE half of the
    same fix)."""
    resp = api_client.post(
        "/ims/parties",
        headers=auth_headers(tokens["owner"]),
        json={"name": "Balance Clear Test", "kind": "customer", "opening_balance": "300"},
    )
    party_id = resp.json()["data"]["id"]

    update_resp = api_client.patch(
        f"/ims/parties/{party_id}",
        headers=auth_headers(tokens["owner"]),
        json={"name": "Balance Clear Test", "opening_balance": "0"},
    )
    assert update_resp.status_code == 200, update_resp.text

    ledger_resp = api_client.get(f"/ims/parties/{party_id}/ledger", headers=auth_headers(tokens["owner"]))
    assert ledger_resp.json()["data"] == []


def test_updating_nonexistent_party_returns_404(api_client, business, tokens):
    resp = api_client.patch(
        "/ims/parties/00000000-0000-0000-0000-000000000000",
        headers=auth_headers(tokens["owner"]),
        json={"name": "Doesn't matter"},
    )
    assert resp.status_code == 404, resp.text
    assert resp.json()["error"]["code"] == "PARTY_NOT_FOUND"


def test_ledger_for_nonexistent_party_returns_404(api_client, business, tokens):
    resp = api_client.get(
        "/ims/parties/00000000-0000-0000-0000-000000000000/ledger",
        headers=auth_headers(tokens["owner"]),
    )
    assert resp.status_code == 404, resp.text
    assert resp.json()["error"]["code"] == "PARTY_NOT_FOUND"


def test_search_parties_by_name(api_client, business, tokens):
    resp = api_client.get(
        "/ims/parties", params={"q": "Wholesale Supplier"}, headers=auth_headers(tokens["owner"])
    )
    assert resp.status_code == 200, resp.text
    names = {p["name"] for p in resp.json()["data"]}
    assert "Wholesale Supplier Co" in names


def test_filter_parties_by_kind(api_client, business, tokens):
    resp = api_client.get(
        "/ims/parties", params={"kind": "supplier"}, headers=auth_headers(tokens["owner"])
    )
    assert resp.status_code == 200, resp.text
    kinds = {p["kind"] for p in resp.json()["data"]}
    assert kinds <= {"supplier"}


class TestPayments:
    def test_record_payment_reduces_customer_balance(self, api_client, business, tokens):
        resp = api_client.post(
            "/ims/parties",
            headers=auth_headers(tokens["owner"]),
            json={"name": "Payment Test Customer", "kind": "customer", "opening_balance": "1000"},
        )
        party_id = resp.json()["data"]["id"]

        pay_resp = api_client.post(
            "/ims/ledger/payments",
            headers=auth_headers(tokens["manager"]),
            json={
                "party_id": party_id,
                "amount": "400",
                "date": "2026-09-05T00:00:00",
                "method": "cash",
            },
        )
        assert pay_resp.status_code == 201, pay_resp.text
        entry = pay_resp.json()["data"]
        assert float(entry["credit"]) == 400.0
        assert "received" in entry["description"]

        ledger_resp = api_client.get(f"/ims/parties/{party_id}/ledger", headers=auth_headers(tokens["owner"]))
        entries = ledger_resp.json()["data"]
        assert len(entries) == 2

    def test_record_payment_for_supplier_says_made_not_received(self, api_client, business, tokens):
        resp = api_client.post(
            "/ims/parties",
            headers=auth_headers(tokens["owner"]),
            json={"name": "Payment Test Supplier", "kind": "supplier", "opening_balance": "1000"},
        )
        party_id = resp.json()["data"]["id"]
        pay_resp = api_client.post(
            "/ims/ledger/payments",
            headers=auth_headers(tokens["owner"]),
            json={
                "party_id": party_id,
                "amount": "400",
                "date": "2026-09-05T00:00:00",
                "method": "bank transfer",
            },
        )
        assert pay_resp.status_code == 201, pay_resp.text
        entry = pay_resp.json()["data"]
        assert "made" in entry["description"]
        assert float(entry["debit"]) == 400.0

    def test_negative_payment_rejected(self, api_client, business, tokens):
        resp = api_client.post(
            "/ims/parties",
            headers=auth_headers(tokens["owner"]),
            json={"name": "Negative Payment Test", "kind": "customer"},
        )
        party_id = resp.json()["data"]["id"]
        pay_resp = api_client.post(
            "/ims/ledger/payments",
            headers=auth_headers(tokens["owner"]),
            json={
                "party_id": party_id,
                "amount": "-50",
                "date": "2026-09-05T00:00:00",
                "method": "cash",
            },
        )
        assert pay_resp.status_code == 422, pay_resp.text
        assert pay_resp.json()["error"]["code"] == "INVALID_AMOUNT"

    def test_payment_for_nonexistent_party_returns_404(self, api_client, business, tokens):
        resp = api_client.post(
            "/ims/ledger/payments",
            headers=auth_headers(tokens["owner"]),
            json={
                "party_id": "00000000-0000-0000-0000-000000000000",
                "amount": "50",
                "date": "2026-09-05T00:00:00",
                "method": "cash",
            },
        )
        assert resp.status_code == 404, resp.text
        assert resp.json()["error"]["code"] == "PARTY_NOT_FOUND"


def test_list_all_ledger_entries_tenant_wide(api_client, business, tokens):
    resp = api_client.get("/ims/ledger", headers=auth_headers(tokens["owner"]))
    assert resp.status_code == 200, resp.text
    assert isinstance(resp.json()["data"], list)
    assert len(resp.json()["data"]) >= 1


def test_storekeeper_cannot_delete_party(api_client, business, tokens):
    list_resp = api_client.get(
        "/ims/parties", params={"q": "Retail Customer Co"}, headers=auth_headers(tokens["owner"])
    )
    party_id = list_resp.json()["data"][0]["id"]
    resp = api_client.delete(
        f"/ims/parties/{party_id}", headers=auth_headers(tokens["storekeeper"])
    )
    assert resp.status_code == 403, resp.text


def test_owner_can_delete_party_without_purchase_history(api_client, business, tokens):
    list_resp = api_client.get(
        "/ims/parties", params={"q": "Retail Customer Co"}, headers=auth_headers(tokens["owner"])
    )
    party_id = list_resp.json()["data"][0]["id"]
    resp = api_client.delete(
        f"/ims/parties/{party_id}", headers=auth_headers(tokens["owner"])
    )
    assert resp.status_code == 200, resp.text


def test_deleting_nonexistent_party_returns_404(api_client, business, tokens):
    resp = api_client.delete(
        "/ims/parties/00000000-0000-0000-0000-000000000000",
        headers=auth_headers(tokens["owner"]),
    )
    assert resp.status_code == 404, resp.text
    assert resp.json()["error"]["code"] == "PARTY_NOT_FOUND"
