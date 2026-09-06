"""Ordered test #9: invoices (POS checkout -- sale/quotation, conversion,
credit notes, payments, print registration). Depends on test_01-08 passing
first -- needs a real party (test_07) and a real in-stock product (built
fresh here, since test_05/08's leftover stock products get consumed by
earlier test files' own state).

Real invoices are permanently undeletable (trg_ims_invoices_delete_guard,
kind != 'quotation') -- reset_dummy_tenants.py correctly leaves them in
place across resets, same principle as RMS's paid orders."""
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


def _create_stocked_variant(api_client, business, tokens, initial_stock="1000", selling_price="100"):
    """Fresh in-stock product/variant for this file's own use, via a real
    purchase (mirrors how stock actually enters the system in production --
    products don't carry initial_stock from test_05's product-creation
    path in this file, purchases are the real restock mechanism)."""
    category_id = _get_a_category(api_client, tokens)
    unit_id = _get_a_unit(api_client, tokens)
    sku = f"SKU-INVTEST-{uuid.uuid4().hex[:8]}"
    resp = api_client.post(
        "/ims/purchases",
        headers=auth_headers(tokens["owner"]),
        json={
            "date": "2026-09-05T00:00:00",
            "branch_id": business["branch_id"],
            "items": [
                {
                    "kind": "new",
                    "name": f"Invoice Test Product {sku}",
                    "sku": sku,
                    "category_id": category_id,
                    "rows": [
                        {
                            "unit_id": unit_id,
                            "qty": initial_stock,
                            "unit_cost": "10",
                            "selling_price": selling_price,
                        }
                    ],
                }
            ],
        },
    )
    line = resp.json()["data"]["lines"][0]
    return line["variant_id"], line["product_id"]


def _get_variant_stock_qty(api_client, tokens, product_id, variant_id, branch_id):
    """Direct product-by-id lookup -- avoids the paginated /ims/products
    list-search (default 25/page), which can miss this file's own product
    among 50+ others created across every _create_stocked_variant call."""
    resp = api_client.get(f"/ims/products/{product_id}", headers=auth_headers(tokens["owner"]))
    variant = next(v for v in resp.json()["data"]["variants"] if v["id"] == variant_id)
    stock_row = next((s for s in variant["stock"] if s["branch_id"] == branch_id), None)
    return float(stock_row["qty"]) if stock_row else 0.0


def _create_customer(api_client, tokens, name):
    resp = api_client.post(
        "/ims/parties", headers=auth_headers(tokens["owner"]), json={"name": name, "kind": "customer"}
    )
    return resp.json()["data"]["id"]


def test_list_invoices_endpoint_reachable(api_client, business, tokens):
    resp = api_client.get("/ims/invoices", headers=auth_headers(tokens["owner"]))
    assert resp.status_code == 200, resp.text
    assert isinstance(resp.json()["data"], list)


def test_storekeeper_cannot_create_invoice(api_client, business, tokens):
    """create_invoice checks staff['role'] in ('owner', 'manager', 'cashier')
    -- 'cashier' doesn't exist in IMSRole (owner/manager/storekeeper only),
    so this is real, confirmed current behavior: storekeeper can never
    record a sale."""
    variant_id, product_id = _create_stocked_variant(api_client, business, tokens)
    customer_id = _create_customer(api_client, tokens, f"Storekeeper Sale Test {_RUN_ID}")
    resp = api_client.post(
        "/ims/invoices",
        headers=auth_headers(tokens["storekeeper"]),
        json={
            "date": "2026-09-05T12:00:00",
            "branch_id": business["branch_id"],
            "customer_id": customer_id,
            "lines": [{"variant_id": variant_id, "qty": "1", "rate": "100"}],
        },
    )
    assert resp.status_code == 403, resp.text


def test_manager_can_record_a_sale(api_client, business, tokens):
    """paid_amount is overpaid on purpose (99999, capped server-side to the
    real total) so this test doesn't need to predict the exact total --
    the VAT tenant's real total includes +13% VAT on top of gross, the PAN
    tenant's doesn't (see _compute_totals), and this test only cares that
    the sale is fully paid, not the exact number.

    kind when show_vat_breakdown is omitted: show_breakdown falls back to
    vat_registered itself (invoice_service.py), so a VAT-registered tenant
    gets "tax" by default, a PAN-only tenant gets "abbreviated" -- both
    real, correct, and different per business type."""
    variant_id, product_id = _create_stocked_variant(api_client, business, tokens)
    customer_id = _create_customer(api_client, tokens, f"Sale Test Customer {_RUN_ID}")
    resp = api_client.post(
        "/ims/invoices",
        headers=auth_headers(tokens["manager"]),
        json={
            "date": "2026-09-05T12:00:00",
            "branch_id": business["branch_id"],
            "customer_id": customer_id,
            "payment_method": "cash",
            "paid_amount": "99999",
            "lines": [{"variant_id": variant_id, "qty": "2", "rate": "100"}],
        },
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()["data"]
    assert data["kind"] == ("tax" if business["is_vat_registered"] else "abbreviated")
    assert data["status"] == "paid"
    assert float(data["paid_amount"]) == float(data["total_amount"])  # capped, not overpaid
    assert float(data["gross_amount"]) == 200.0
    assert data["number"].startswith("INV-")


def test_sale_deducts_stock(api_client, business, tokens):
    variant_id, product_id = _create_stocked_variant(api_client, business, tokens, initial_stock="10")
    customer_id = _create_customer(api_client, tokens, f"Stock Deduct Test {_RUN_ID}")
    resp = api_client.post(
        "/ims/invoices",
        headers=auth_headers(tokens["owner"]),
        json={
            "date": "2026-09-05T12:00:00",
            "branch_id": business["branch_id"],
            "customer_id": customer_id,
            "lines": [{"variant_id": variant_id, "qty": "3", "rate": "100"}],
        },
    )
    assert resp.status_code == 201, resp.text

    # find the variant's current stock via cost-history's sibling data isn't
    # exposed directly here -- confirm via the product detail endpoint.
    qty = _get_variant_stock_qty(api_client, tokens, product_id, variant_id, business["branch_id"])
    assert qty == 7.0  # 10 - 3


def test_insufficient_stock_rejected(api_client, business, tokens):
    variant_id, product_id = _create_stocked_variant(api_client, business, tokens, initial_stock="5")
    customer_id = _create_customer(api_client, tokens, f"Insufficient Stock Test {_RUN_ID}")
    resp = api_client.post(
        "/ims/invoices",
        headers=auth_headers(tokens["owner"]),
        json={
            "date": "2026-09-05T12:00:00",
            "branch_id": business["branch_id"],
            "customer_id": customer_id,
            "lines": [{"variant_id": variant_id, "qty": "999", "rate": "100"}],
        },
    )
    assert resp.status_code == 409, resp.text
    assert resp.json()["error"]["code"] == "INSUFFICIENT_STOCK"


def test_no_items_rejected(api_client, business, tokens):
    customer_id = _create_customer(api_client, tokens, f"No Items Test {_RUN_ID}")
    resp = api_client.post(
        "/ims/invoices",
        headers=auth_headers(tokens["owner"]),
        json={
            "date": "2026-09-05T12:00:00",
            "branch_id": business["branch_id"],
            "customer_id": customer_id,
            "lines": [],
        },
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["error"]["code"] == "NO_ITEMS"


def test_abbreviated_invoice_over_10000_taxable_rejected(api_client, business, tokens):
    """IRD Annexure-6's own abbreviated-invoice template forbids issuing it
    for a sale whose TAXABLE value exceeds Rs 10,000 -- server-enforced
    regardless of what show_vat_breakdown the client sends.

    Real, confirmed behavior: this ceiling only ever triggers for a
    VAT-registered tenant. _compute_totals (invoice_service.py) only ever
    routes a line into taxable_net `if taxable and vat_registered` -- a
    PAN-only tenant's lines always land in exempt_net regardless of the
    line's own taxable flag, so taxable_amount is always 0 there and this
    limit can never be hit. Confirmed via a live 201 (not 422) on the PAN
    tenant with the exact same payload that correctly 422s on VAT."""
    if not business["is_vat_registered"]:
        variant_id, product_id = _create_stocked_variant(api_client, business, tokens, initial_stock="10", selling_price="5000")
        customer_id = _create_customer(api_client, tokens, f"Abbreviated Limit PAN Test {_RUN_ID}")
        resp = api_client.post(
            "/ims/invoices",
            headers=auth_headers(tokens["owner"]),
            json={
                "date": "2026-09-05T12:00:00",
                "branch_id": business["branch_id"],
                "customer_id": customer_id,
                "show_vat_breakdown": False,
                "lines": [{"variant_id": variant_id, "qty": "3", "rate": "5000"}],
            },
        )
        assert resp.status_code == 201, resp.text
        assert float(resp.json()["data"]["taxable_amount"]) == 0.0
        return

    variant_id, product_id = _create_stocked_variant(api_client, business, tokens, initial_stock="1000", selling_price="5000")
    customer_id = _create_customer(api_client, tokens, f"Abbreviated Limit Test {_RUN_ID}")
    resp = api_client.post(
        "/ims/invoices",
        headers=auth_headers(tokens["owner"]),
        json={
            "date": "2026-09-05T12:00:00",
            "branch_id": business["branch_id"],
            "customer_id": customer_id,
            "show_vat_breakdown": False,
            "lines": [{"variant_id": variant_id, "qty": "3", "rate": "5000"}],  # 15000 taxable
        },
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["error"]["code"] == "ABBREVIATED_INVOICE_LIMIT_EXCEEDED"


def test_tax_invoice_shows_vat_breakdown_regardless_of_amount(api_client, business, tokens):
    variant_id, product_id = _create_stocked_variant(api_client, business, tokens, initial_stock="1000", selling_price="5000")
    customer_id = _create_customer(api_client, tokens, f"Tax Invoice Test {_RUN_ID}")
    resp = api_client.post(
        "/ims/invoices",
        headers=auth_headers(tokens["owner"]),
        json={
            "date": "2026-09-05T12:00:00",
            "branch_id": business["branch_id"],
            "customer_id": customer_id,
            "show_vat_breakdown": True,
            "lines": [{"variant_id": variant_id, "qty": "3", "rate": "5000"}],
        },
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["data"]["kind"] == "tax"


def test_variant_not_found_rejected(api_client, business, tokens):
    customer_id = _create_customer(api_client, tokens, f"Bad Variant Test {_RUN_ID}")
    resp = api_client.post(
        "/ims/invoices",
        headers=auth_headers(tokens["owner"]),
        json={
            "date": "2026-09-05T12:00:00",
            "branch_id": business["branch_id"],
            "customer_id": customer_id,
            "lines": [{"variant_id": "00000000-0000-0000-0000-000000000000", "qty": "1", "rate": "1"}],
        },
    )
    assert resp.status_code == 404, resp.text
    assert resp.json()["error"]["code"] == "VARIANT_NOT_FOUND"


class TestQuotations:
    def test_create_quotation_does_not_deduct_stock(self, api_client, business, tokens):
        variant_id, product_id = _create_stocked_variant(api_client, business, tokens, initial_stock="20")
        customer_id = _create_customer(api_client, tokens, f"Quotation Test {_RUN_ID}")
        resp = api_client.post(
            "/ims/invoices",
            headers=auth_headers(tokens["owner"]),
            json={
                "date": "2026-09-05T12:00:00",
                "branch_id": business["branch_id"],
                "customer_id": customer_id,
                "is_quotation": True,
                "lines": [{"variant_id": variant_id, "qty": "5", "rate": "100"}],
            },
        )
        assert resp.status_code == 201, resp.text
        data = resp.json()["data"]
        assert data["kind"] == "quotation"
        assert data["number"].startswith("QT-")
        assert data["status"] == "unpaid"

        qty = _get_variant_stock_qty(api_client, tokens, product_id, variant_id, business["branch_id"])
        assert qty == 20.0  # untouched

    def test_quotation_can_exceed_stock(self, api_client, business, tokens):
        """Quoting an out-of-stock item is fine -- stock is only checked
        for a real sale."""
        variant_id, product_id = _create_stocked_variant(api_client, business, tokens, initial_stock="1")
        customer_id = _create_customer(api_client, tokens, f"Quote Over Stock Test {_RUN_ID}")
        resp = api_client.post(
            "/ims/invoices",
            headers=auth_headers(tokens["owner"]),
            json={
                "date": "2026-09-05T12:00:00",
                "branch_id": business["branch_id"],
                "customer_id": customer_id,
                "is_quotation": True,
                "lines": [{"variant_id": variant_id, "qty": "999", "rate": "100"}],
            },
        )
        assert resp.status_code == 201, resp.text

    def test_convert_quotation_deducts_stock_and_renumbers(self, api_client, business, tokens):
        variant_id, product_id = _create_stocked_variant(api_client, business, tokens, initial_stock="15")
        customer_id = _create_customer(api_client, tokens, f"Convert Test {_RUN_ID}")
        q_resp = api_client.post(
            "/ims/invoices",
            headers=auth_headers(tokens["owner"]),
            json={
                "date": "2026-09-05T12:00:00",
                "branch_id": business["branch_id"],
                "customer_id": customer_id,
                "is_quotation": True,
                "lines": [{"variant_id": variant_id, "qty": "4", "rate": "100"}],
            },
        )
        quotation_id = q_resp.json()["data"]["id"]

        convert_resp = api_client.post(
            f"/ims/invoices/{quotation_id}/convert",
            headers=auth_headers(tokens["manager"]),
            json={"payment_method": "cash", "paid_amount": "99999"},  # overpaid, capped server-side
        )
        assert convert_resp.status_code == 200, convert_resp.text
        data = convert_resp.json()["data"]
        assert data["kind"] in ("tax", "abbreviated")
        assert data["number"].startswith("INV-")
        assert data["status"] == "paid"

        qty = _get_variant_stock_qty(api_client, tokens, product_id, variant_id, business["branch_id"])
        assert qty == 11.0  # 15 - 4

    def test_convert_already_converted_quotation_rejected(self, api_client, business, tokens):
        variant_id, product_id = _create_stocked_variant(api_client, business, tokens, initial_stock="10")
        customer_id = _create_customer(api_client, tokens, f"Double Convert Test {_RUN_ID}")
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
        first = api_client.post(
            f"/ims/invoices/{quotation_id}/convert",
            headers=auth_headers(tokens["owner"]),
            json={},
        )
        assert first.status_code == 200, first.text

        second = api_client.post(
            f"/ims/invoices/{quotation_id}/convert",
            headers=auth_headers(tokens["owner"]),
            json={},
        )
        assert second.status_code == 422, second.text
        assert second.json()["error"]["code"] == "NOT_A_QUOTATION"

    def test_convert_nonexistent_invoice_returns_404(self, api_client, business, tokens):
        resp = api_client.post(
            "/ims/invoices/00000000-0000-0000-0000-000000000000/convert",
            headers=auth_headers(tokens["owner"]),
            json={},
        )
        assert resp.status_code == 404, resp.text
        assert resp.json()["error"]["code"] == "INVOICE_NOT_FOUND"

    def test_void_quotation(self, api_client, business, tokens):
        variant_id, product_id = _create_stocked_variant(api_client, business, tokens, initial_stock="10")
        customer_id = _create_customer(api_client, tokens, f"Void Test {_RUN_ID}")
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
        void_resp = api_client.delete(
            f"/ims/invoices/{quotation_id}/void-quotation",
            headers=auth_headers(tokens["manager"]),
        )
        assert void_resp.status_code == 200, void_resp.text

        get_resp = api_client.get(f"/ims/invoices/{quotation_id}", headers=auth_headers(tokens["owner"]))
        assert get_resp.status_code == 404, get_resp.text

    def test_storekeeper_cannot_void_quotation(self, api_client, business, tokens):
        variant_id, product_id = _create_stocked_variant(api_client, business, tokens, initial_stock="10")
        customer_id = _create_customer(api_client, tokens, f"Void Perm Test {_RUN_ID}")
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
        resp = api_client.delete(
            f"/ims/invoices/{quotation_id}/void-quotation",
            headers=auth_headers(tokens["storekeeper"]),
        )
        assert resp.status_code == 403, resp.text


class TestCreditNotes:
    def test_storekeeper_cannot_issue_credit_note(self, api_client, business, tokens):
        variant_id, product_id = _create_stocked_variant(api_client, business, tokens, initial_stock="10")
        customer_id = _create_customer(api_client, tokens, f"CN Perm Test {_RUN_ID}")
        sale_resp = api_client.post(
            "/ims/invoices",
            headers=auth_headers(tokens["owner"]),
            json={
                "date": "2026-09-05T12:00:00",
                "branch_id": business["branch_id"],
                "customer_id": customer_id,
                "lines": [{"variant_id": variant_id, "qty": "1", "rate": "100"}],
            },
        )
        invoice_id = sale_resp.json()["data"]["id"]
        resp = api_client.post(
            f"/ims/invoices/{invoice_id}/credit-note",
            headers=auth_headers(tokens["storekeeper"]),
            json={"reason": "Not allowed"},
        )
        assert resp.status_code == 403, resp.text

    def test_owner_can_issue_credit_note_and_it_restores_stock(self, api_client, business, tokens):
        variant_id, product_id = _create_stocked_variant(api_client, business, tokens, initial_stock="10")
        customer_id = _create_customer(api_client, tokens, f"CN Restore Test {_RUN_ID}")
        sale_resp = api_client.post(
            "/ims/invoices",
            headers=auth_headers(tokens["owner"]),
            json={
                "date": "2026-09-05T12:00:00",
                "branch_id": business["branch_id"],
                "customer_id": customer_id,
                "lines": [{"variant_id": variant_id, "qty": "3", "rate": "100"}],
            },
        )
        invoice_id = sale_resp.json()["data"]["id"]
        original_total = float(sale_resp.json()["data"]["total_amount"])

        cn_resp = api_client.post(
            f"/ims/invoices/{invoice_id}/credit-note",
            headers=auth_headers(tokens["owner"]),
            json={"reason": "Customer returned goods"},
        )
        assert cn_resp.status_code == 201, cn_resp.text
        cn = cn_resp.json()["data"]
        assert cn["is_credit_note"] is True
        assert cn["original_invoice_id"] == invoice_id
        assert cn["number"].startswith("CN-")
        assert float(cn["total_amount"]) == -original_total
        assert cn["lines"][0]["qty"] == "-3.000"

        qty = _get_variant_stock_qty(api_client, tokens, product_id, variant_id, business["branch_id"])
        assert qty == 10.0  # 10 - 3 + 3 (credit note restores it)

    def test_second_credit_note_on_same_invoice_rejected(self, api_client, business, tokens):
        """Real bug found and fixed this session: issue_credit_note only
        checked whether the ORIGINAL row was itself a credit note, never
        whether the original invoice already HAD a credit note issued
        against it -- a second call used to succeed and silently
        double-restore stock. Mirrors the identical fix already made in
        RMS's order_service.issue_credit_note."""
        variant_id, product_id = _create_stocked_variant(api_client, business, tokens, initial_stock="10")
        customer_id = _create_customer(api_client, tokens, f"CN Duplicate Test {_RUN_ID}")
        sale_resp = api_client.post(
            "/ims/invoices",
            headers=auth_headers(tokens["owner"]),
            json={
                "date": "2026-09-05T12:00:00",
                "branch_id": business["branch_id"],
                "customer_id": customer_id,
                "lines": [{"variant_id": variant_id, "qty": "2", "rate": "100"}],
            },
        )
        invoice_id = sale_resp.json()["data"]["id"]

        first = api_client.post(
            f"/ims/invoices/{invoice_id}/credit-note",
            headers=auth_headers(tokens["owner"]),
            json={"reason": "First return"},
        )
        assert first.status_code == 201, first.text

        second = api_client.post(
            f"/ims/invoices/{invoice_id}/credit-note",
            headers=auth_headers(tokens["owner"]),
            json={"reason": "Second attempt"},
        )
        assert second.status_code == 409, second.text
        assert second.json()["error"]["code"] == "ALREADY_CREDIT_NOTE"

    def test_credit_note_on_a_credit_note_rejected(self, api_client, business, tokens):
        variant_id, product_id = _create_stocked_variant(api_client, business, tokens, initial_stock="10")
        customer_id = _create_customer(api_client, tokens, f"CN On CN Test {_RUN_ID}")
        sale_resp = api_client.post(
            "/ims/invoices",
            headers=auth_headers(tokens["owner"]),
            json={
                "date": "2026-09-05T12:00:00",
                "branch_id": business["branch_id"],
                "customer_id": customer_id,
                "lines": [{"variant_id": variant_id, "qty": "1", "rate": "100"}],
            },
        )
        invoice_id = sale_resp.json()["data"]["id"]
        cn_resp = api_client.post(
            f"/ims/invoices/{invoice_id}/credit-note",
            headers=auth_headers(tokens["owner"]),
            json={"reason": "Return"},
        )
        cn_id = cn_resp.json()["data"]["id"]

        resp = api_client.post(
            f"/ims/invoices/{cn_id}/credit-note",
            headers=auth_headers(tokens["owner"]),
            json={"reason": "Credit the credit note"},
        )
        assert resp.status_code == 409, resp.text
        assert resp.json()["error"]["code"] == "NOT_A_REGULAR_INVOICE"

    def test_credit_note_on_quotation_rejected(self, api_client, business, tokens):
        variant_id, product_id = _create_stocked_variant(api_client, business, tokens, initial_stock="10")
        customer_id = _create_customer(api_client, tokens, f"CN On Quote Test {_RUN_ID}")
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
        resp = api_client.post(
            f"/ims/invoices/{quotation_id}/credit-note",
            headers=auth_headers(tokens["owner"]),
            json={"reason": "Not applicable"},
        )
        assert resp.status_code == 409, resp.text
        assert resp.json()["error"]["code"] == "NOT_A_REGULAR_INVOICE"

    def test_credit_note_on_nonexistent_invoice_returns_404(self, api_client, business, tokens):
        resp = api_client.post(
            "/ims/invoices/00000000-0000-0000-0000-000000000000/credit-note",
            headers=auth_headers(tokens["owner"]),
            json={"reason": "Doesn't matter"},
        )
        assert resp.status_code == 404, resp.text
        assert resp.json()["error"]["code"] == "INVOICE_NOT_FOUND"


class TestPaymentsAndPrint:
    def test_record_payment_on_partially_paid_invoice(self, api_client, business, tokens):
        variant_id, product_id = _create_stocked_variant(api_client, business, tokens, initial_stock="10")
        customer_id = _create_customer(api_client, tokens, f"Partial Pay Test {_RUN_ID}")
        sale_resp = api_client.post(
            "/ims/invoices",
            headers=auth_headers(tokens["owner"]),
            json={
                "date": "2026-09-05T12:00:00",
                "branch_id": business["branch_id"],
                "customer_id": customer_id,
                "paid_amount": "1",  # deliberately far under total, VAT-agnostic
                "lines": [{"variant_id": variant_id, "qty": "1", "rate": "100"}],
            },
        )
        invoice_id = sale_resp.json()["data"]["id"]
        total = float(sale_resp.json()["data"]["total_amount"])
        assert sale_resp.json()["data"]["status"] == "partial"

        pay_resp = api_client.post(
            f"/ims/invoices/{invoice_id}/record-payment",
            headers=auth_headers(tokens["storekeeper"]),
            json={"amount": "99999", "method": "cash"},  # overpaid, capped to remaining due
        )
        assert pay_resp.status_code == 200, pay_resp.text
        assert pay_resp.json()["data"]["status"] == "paid"
        assert float(pay_resp.json()["data"]["paid_amount"]) == total

    def test_record_payment_on_already_paid_invoice_rejected(self, api_client, business, tokens):
        variant_id, product_id = _create_stocked_variant(api_client, business, tokens, initial_stock="10")
        customer_id = _create_customer(api_client, tokens, f"Already Paid Test {_RUN_ID}")
        sale_resp = api_client.post(
            "/ims/invoices",
            headers=auth_headers(tokens["owner"]),
            json={
                "date": "2026-09-05T12:00:00",
                "branch_id": business["branch_id"],
                "customer_id": customer_id,
                "paid_amount": "99999",  # overpaid, capped -- guarantees fully paid regardless of VAT
                "lines": [{"variant_id": variant_id, "qty": "1", "rate": "100"}],
            },
        )
        assert sale_resp.json()["data"]["status"] == "paid"
        invoice_id = sale_resp.json()["data"]["id"]
        resp = api_client.post(
            f"/ims/invoices/{invoice_id}/record-payment",
            headers=auth_headers(tokens["owner"]),
            json={"amount": "10", "method": "cash"},
        )
        assert resp.status_code == 409, resp.text
        assert resp.json()["error"]["code"] == "ALREADY_PAID"

    def test_record_payment_on_quotation_rejected(self, api_client, business, tokens):
        variant_id, product_id = _create_stocked_variant(api_client, business, tokens, initial_stock="10")
        customer_id = _create_customer(api_client, tokens, f"Pay Quote Test {_RUN_ID}")
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
        resp = api_client.post(
            f"/ims/invoices/{quotation_id}/record-payment",
            headers=auth_headers(tokens["owner"]),
            json={"amount": "10", "method": "cash"},
        )
        assert resp.status_code == 422, resp.text
        assert resp.json()["error"]["code"] == "QUOTATION_NOT_PAYABLE"

    def test_negative_payment_amount_rejected(self, api_client, business, tokens):
        variant_id, product_id = _create_stocked_variant(api_client, business, tokens, initial_stock="10")
        customer_id = _create_customer(api_client, tokens, f"Negative Pay Test {_RUN_ID}")
        sale_resp = api_client.post(
            "/ims/invoices",
            headers=auth_headers(tokens["owner"]),
            json={
                "date": "2026-09-05T12:00:00",
                "branch_id": business["branch_id"],
                "customer_id": customer_id,
                "lines": [{"variant_id": variant_id, "qty": "1", "rate": "100"}],
            },
        )
        invoice_id = sale_resp.json()["data"]["id"]
        resp = api_client.post(
            f"/ims/invoices/{invoice_id}/record-payment",
            headers=auth_headers(tokens["owner"]),
            json={"amount": "-5", "method": "cash"},
        )
        assert resp.status_code == 422, resp.text
        assert resp.json()["error"]["code"] == "INVALID_AMOUNT"

    def test_register_print_first_time_not_a_reprint(self, api_client, business, tokens):
        variant_id, product_id = _create_stocked_variant(api_client, business, tokens, initial_stock="10")
        customer_id = _create_customer(api_client, tokens, f"Print Test {_RUN_ID}")
        sale_resp = api_client.post(
            "/ims/invoices",
            headers=auth_headers(tokens["owner"]),
            json={
                "date": "2026-09-05T12:00:00",
                "branch_id": business["branch_id"],
                "customer_id": customer_id,
                "lines": [{"variant_id": variant_id, "qty": "1", "rate": "100"}],
            },
        )
        invoice_id = sale_resp.json()["data"]["id"]
        resp = api_client.post(
            f"/ims/invoices/{invoice_id}/register-print",
            headers=auth_headers(tokens["storekeeper"]),
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["data"]["is_reprint"] is False

    def test_register_print_second_time_is_a_reprint(self, api_client, business, tokens):
        variant_id, product_id = _create_stocked_variant(api_client, business, tokens, initial_stock="10")
        customer_id = _create_customer(api_client, tokens, f"Reprint Test {_RUN_ID}")
        sale_resp = api_client.post(
            "/ims/invoices",
            headers=auth_headers(tokens["owner"]),
            json={
                "date": "2026-09-05T12:00:00",
                "branch_id": business["branch_id"],
                "customer_id": customer_id,
                "lines": [{"variant_id": variant_id, "qty": "1", "rate": "100"}],
            },
        )
        invoice_id = sale_resp.json()["data"]["id"]
        api_client.post(f"/ims/invoices/{invoice_id}/register-print", headers=auth_headers(tokens["owner"]))
        second = api_client.post(f"/ims/invoices/{invoice_id}/register-print", headers=auth_headers(tokens["owner"]))
        assert second.status_code == 200, second.text
        assert second.json()["data"]["is_reprint"] is True

    def test_register_print_on_quotation_never_a_reprint(self, api_client, business, tokens):
        variant_id, product_id = _create_stocked_variant(api_client, business, tokens, initial_stock="10")
        customer_id = _create_customer(api_client, tokens, f"Print Quote Test {_RUN_ID}")
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
        api_client.post(f"/ims/invoices/{quotation_id}/register-print", headers=auth_headers(tokens["owner"]))
        resp = api_client.post(f"/ims/invoices/{quotation_id}/register-print", headers=auth_headers(tokens["owner"]))
        assert resp.status_code == 200, resp.text
        assert resp.json()["data"]["is_reprint"] is False


def test_get_invoice_by_id(api_client, business, tokens):
    variant_id, product_id = _create_stocked_variant(api_client, business, tokens, initial_stock="10")
    customer_id = _create_customer(api_client, tokens, f"Get By Id Test {_RUN_ID}")
    sale_resp = api_client.post(
        "/ims/invoices",
        headers=auth_headers(tokens["owner"]),
        json={
            "date": "2026-09-05T12:00:00",
            "branch_id": business["branch_id"],
            "customer_id": customer_id,
            "lines": [{"variant_id": variant_id, "qty": "1", "rate": "100"}],
        },
    )
    invoice_id = sale_resp.json()["data"]["id"]
    resp = api_client.get(f"/ims/invoices/{invoice_id}", headers=auth_headers(tokens["storekeeper"]))
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["id"] == invoice_id


def test_get_nonexistent_invoice_returns_404(api_client, business, tokens):
    """IMSInvoiceService.get uses DOCUMENT_NOT_FOUND -- a different code
    from convert()/credit-note's INVOICE_NOT_FOUND, both real and correct
    per the router's own _INVOICE_ERROR_MAP entries for each."""
    resp = api_client.get(
        "/ims/invoices/00000000-0000-0000-0000-000000000000",
        headers=auth_headers(tokens["owner"]),
    )
    assert resp.status_code == 404, resp.text
    assert resp.json()["error"]["code"] == "DOCUMENT_NOT_FOUND"


def test_kind_filter_quotation_excludes_real_invoices(api_client, business, tokens):
    resp = api_client.get(
        "/ims/invoices", params={"kind": "quotation"}, headers=auth_headers(tokens["owner"])
    )
    assert resp.status_code == 200, resp.text
    kinds = {i["kind"] for i in resp.json()["data"]}
    assert kinds <= {"quotation"}


def test_default_list_excludes_quotations(api_client, business, tokens):
    resp = api_client.get("/ims/invoices", headers=auth_headers(tokens["owner"]))
    assert resp.status_code == 200, resp.text
    kinds = {i["kind"] for i in resp.json()["data"]}
    assert "quotation" not in kinds
