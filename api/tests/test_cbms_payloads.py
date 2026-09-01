"""Tests that build_cbms_payload/build_credit_note_payload (both apps)
produce every field docs/Srota_IRD_Compliance_Checklist.md's JSON schema
table requires, correctly typed and named. Uses lightweight fake objects
(SimpleNamespace) rather than real DB rows — these functions only read
attributes, no DB access needed."""
from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace

from core.crypto import encrypt_secret
from features.ims.cbms_service import (
    build_cbms_payload as ims_build_cbms_payload,
    build_credit_note_payload as ims_build_credit_note_payload,
)
from features.restro.cbms_service import (
    build_cbms_payload as restro_build_cbms_payload,
    build_credit_note_payload as restro_build_credit_note_payload,
)

# Every field docs/Srota_IRD_Compliance_Checklist.md's "What you send for an
# invoice (/api/bill)" table lists.
REQUIRED_BILL_FIELDS = {
    "username", "password", "seller_pan", "buyer_pan", "fiscal_year",
    "buyer_name", "invoice_number", "invoice_date", "total_sales",
    "taxable_sales_vat", "vat", "excisable_amount", "excise",
    "taxable_sales_hst", "hst", "amount_for_esf", "esf", "export_sales",
    "tax_exempted_sales", "isrealtime", "datetimeClient",
}

# "What you send for a credit note (/api/billreturn)" — same as above minus
# invoice_number/invoice_date, plus ref_invoice_number/credit_note_number/
# credit_note_date/reason_for_return.
REQUIRED_CREDIT_NOTE_FIELDS = (REQUIRED_BILL_FIELDS - {"invoice_number", "invoice_date"}) | {
    "ref_invoice_number", "credit_note_number", "credit_note_date", "reason_for_return",
}


def _fake_org(username="testuser", password="hunter2"):
    return SimpleNamespace(ird_username=username, ird_password=encrypt_secret(password))


def _fake_ims_invoice(**overrides):
    defaults = dict(
        date=datetime(2025, 1, 15, tzinfo=timezone.utc),
        date_bs="2081-09-30",
        seller_pan="111111111",
        buyer_pan="222222222",
        buyer_name="Test Buyer",
        number="INV-2081-82-000001",
        total_amount=Decimal("113.00"),
        taxable_amount=Decimal("100.00"),
        vat_amount=Decimal("13.00"),
        exempt_amount=Decimal("0.00"),
        note_reason=None,
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def _fake_restro_order(**overrides):
    defaults = dict(
        paid_at=datetime(2025, 1, 15, tzinfo=timezone.utc),
        placed_at=datetime(2025, 1, 15, tzinfo=timezone.utc),
        fiscal_year="2081-82",
        seller_pan="111111111",
        buyer_pan="222222222",
        buyer_name="Test Buyer",
        bill_number=42,
        total_amount=Decimal("113.00"),
        taxable_amount=Decimal("100.00"),
        vat_amount=Decimal("13.00"),
        exempt_amount=Decimal("0.00"),
        note_reason=None,
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


class TestImsBillPayload:
    def test_has_every_required_field(self):
        payload = ims_build_cbms_payload(_fake_ims_invoice(), _fake_org())
        assert REQUIRED_BILL_FIELDS.issubset(payload.keys())

    def test_credentials_round_trip(self):
        payload = ims_build_cbms_payload(_fake_ims_invoice(), _fake_org("myuser", "mypass"))
        assert payload["username"] == "myuser"
        assert payload["password"] == "mypass"  # decrypted back to plaintext for the wire

    def test_fiscal_year_format_converted(self):
        # date_bs "2081-09-30" -> BS month 9 (>= month 4) -> FY starts 2081
        # -> "2081-82" -> IRD format "2081/082"
        payload = ims_build_cbms_payload(_fake_ims_invoice(date_bs="2081-09-30"), _fake_org())
        assert payload["fiscal_year"] == "2081/082"

    def test_amounts_are_floats_not_decimal(self):
        payload = ims_build_cbms_payload(_fake_ims_invoice(), _fake_org())
        assert isinstance(payload["total_sales"], float)
        assert payload["total_sales"] == 113.0

    def test_missing_buyer_pan_becomes_empty_string_not_none(self):
        # A None here would serialize as JSON null, not an empty string —
        # walk-in/no-PAN scenario from the checklist's self-test item.
        payload = ims_build_cbms_payload(_fake_ims_invoice(buyer_pan=None), _fake_org())
        assert payload["buyer_pan"] == ""


class TestImsCreditNotePayload:
    def test_has_every_required_field(self):
        original = _fake_ims_invoice(number="INV-2081-82-000001")
        cn = _fake_ims_invoice(number="CN-2081-82-000001", total_amount=Decimal("-113.00"))
        payload = ims_build_credit_note_payload(cn, original, _fake_org())
        assert REQUIRED_CREDIT_NOTE_FIELDS.issubset(payload.keys())

    def test_no_leftover_invoice_number_key(self):
        # Credit notes use ref_invoice_number, not invoice_number — a stray
        # invoice_number key would be silently ignored by IRD's schema but
        # signals a copy-paste bug if present.
        original = _fake_ims_invoice()
        cn = _fake_ims_invoice(total_amount=Decimal("-113.00"))
        payload = ims_build_credit_note_payload(cn, original, _fake_org())
        assert "invoice_number" not in payload
        assert "invoice_date" not in payload

    def test_ref_invoice_number_points_to_original(self):
        original = _fake_ims_invoice(number="INV-ORIGINAL-001")
        cn = _fake_ims_invoice(number="CN-001", total_amount=Decimal("-113.00"))
        payload = ims_build_credit_note_payload(cn, original, _fake_org())
        assert payload["ref_invoice_number"] == "INV-ORIGINAL-001"

    def test_amounts_are_absolute_value_not_negative(self):
        # Credit note amounts are stored negated (reversal) but IRD expects
        # positive magnitudes on the wire.
        cn = _fake_ims_invoice(
            total_amount=Decimal("-113.00"),
            taxable_amount=Decimal("-100.00"),
            vat_amount=Decimal("-13.00"),
        )
        payload = ims_build_credit_note_payload(cn, _fake_ims_invoice(), _fake_org())
        assert payload["total_sales"] == 113.0
        assert payload["taxable_sales_vat"] == 100.0
        assert payload["vat"] == 13.0

    def test_missing_original_invoice_handled_gracefully(self):
        # original can be None (e.g. it was deleted or the FK is stale) —
        # must not raise, just leave ref fields blank.
        cn = _fake_ims_invoice(total_amount=Decimal("-113.00"))
        payload = ims_build_credit_note_payload(cn, None, _fake_org())
        assert payload["ref_invoice_number"] == ""


class TestRestroBillPayload:
    def test_has_every_required_field(self):
        payload = restro_build_cbms_payload(_fake_restro_order(), _fake_org())
        assert REQUIRED_BILL_FIELDS.issubset(payload.keys())

    def test_bill_number_becomes_string_invoice_number(self):
        payload = restro_build_cbms_payload(_fake_restro_order(bill_number=42), _fake_org())
        assert payload["invoice_number"] == "42"

    def test_fiscal_year_passthrough_and_converted(self):
        payload = restro_build_cbms_payload(_fake_restro_order(fiscal_year="2081-82"), _fake_org())
        assert payload["fiscal_year"] == "2081/082"

    def test_paid_at_preferred_over_placed_at_for_date(self):
        payload = restro_build_cbms_payload(
            _fake_restro_order(
                paid_at=datetime(2025, 2, 1, tzinfo=timezone.utc),
                placed_at=datetime(2025, 1, 15, tzinfo=timezone.utc),
            ),
            _fake_org(),
        )
        assert payload["invoice_date"] == "2025.02.01"


class TestRestroCreditNotePayload:
    def test_has_every_required_field(self):
        original = _fake_restro_order(bill_number=42)
        cn = _fake_restro_order(bill_number=43, total_amount=Decimal("-113.00"))
        payload = restro_build_credit_note_payload(cn, original, _fake_org())
        assert REQUIRED_CREDIT_NOTE_FIELDS.issubset(payload.keys())

    def test_ref_invoice_number_is_original_bill_number(self):
        original = _fake_restro_order(bill_number=42)
        cn = _fake_restro_order(bill_number=43, total_amount=Decimal("-113.00"))
        payload = restro_build_credit_note_payload(cn, original, _fake_org())
        assert payload["ref_invoice_number"] == "42"

    def test_credit_note_number_is_own_bill_number(self):
        cn = _fake_restro_order(bill_number=43, total_amount=Decimal("-113.00"))
        payload = restro_build_credit_note_payload(cn, _fake_restro_order(), _fake_org())
        assert payload["credit_note_number"] == "43"
