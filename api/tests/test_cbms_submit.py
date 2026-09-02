"""Tests for features/cbms/submit.py's response-code classification —
docs/Srota_IRD_Compliance_Checklist.md's exact per-code decision table.
Pure logic, no DB/network needed: this is the piece most likely to have a
subtle bug and the cheapest to fully cover, so it gets the most thorough
tests in this suite."""
import pytest
from features.cbms.submit import (
    classify_response,
    _parse_ird_response,
    CLASSIFICATION_SYNCED,
    CLASSIFICATION_RETRY,
    CLASSIFICATION_MANUAL,
    CLASSIFICATION_AUTH_STALE,
)


class TestClassifyResponseForBill:
    """/api/bill (is_credit_note=False) — every code's meaning per the
    checklist table."""

    def test_200_is_synced(self):
        assert classify_response("200", is_credit_note=False) == CLASSIFICATION_SYNCED

    def test_100_is_auth_stale(self):
        # Auth mismatch — credentials likely stale, needs a human to
        # re-enter them, not a blind retry.
        assert classify_response("100", is_credit_note=False) == CLASSIFICATION_AUTH_STALE

    def test_101_on_bill_is_synced(self):
        # "Already exists" on a bill submission means it genuinely made it
        # through on a prior attempt — idempotent success, not a failure.
        assert classify_response("101", is_credit_note=False) == CLASSIFICATION_SYNCED

    def test_102_is_retry(self):
        assert classify_response("102", is_credit_note=False) == CLASSIFICATION_RETRY

    def test_103_is_retry(self):
        assert classify_response("103", is_credit_note=False) == CLASSIFICATION_RETRY

    def test_104_is_manual(self):
        # Invalid payload — retrying the identical bad payload won't help.
        assert classify_response("104", is_credit_note=False) == CLASSIFICATION_MANUAL

    def test_105_is_manual(self):
        assert classify_response("105", is_credit_note=False) == CLASSIFICATION_MANUAL

    def test_undocumented_code_is_manual_not_synced(self):
        # An unknown code must never be silently treated as success.
        assert classify_response("999", is_credit_note=False) == CLASSIFICATION_MANUAL


class TestClassifyResponseForCreditNote:
    """/api/billreturn (is_credit_note=True) — 101 and 105 mean something
    different here than on a plain bill submission."""

    def test_200_is_synced(self):
        assert classify_response("200", is_credit_note=True) == CLASSIFICATION_SYNCED

    def test_101_on_credit_note_is_manual_not_synced(self):
        # "Doesn't exist" on a return means the ORIGINAL invoice was never
        # accepted by IRD — resubmitting the same credit note won't fix
        # that. Must NOT be treated as idempotent success like it is for
        # /api/bill's 101.
        assert classify_response("101", is_credit_note=True) == CLASSIFICATION_MANUAL

    def test_105_on_credit_note_is_manual(self):
        assert classify_response("105", is_credit_note=True) == CLASSIFICATION_MANUAL

    def test_102_and_103_still_retry_on_credit_note(self):
        assert classify_response("102", is_credit_note=True) == CLASSIFICATION_RETRY
        assert classify_response("103", is_credit_note=True) == CLASSIFICATION_RETRY

    def test_100_still_auth_stale_on_credit_note(self):
        assert classify_response("100", is_credit_note=True) == CLASSIFICATION_AUTH_STALE


class TestParseIrdResponse:
    def test_explicit_code_field(self):
        code, status = _parse_ird_response({"code": "200", "status": "OK"})
        assert code == "200"
        assert status == "OK"

    def test_error_code_field_fallback(self):
        code, _ = _parse_ird_response({"errorCode": "104"})
        assert code == "104"

    def test_nested_data_status(self):
        code, status = _parse_ird_response({"data": {"status": "SUCCESS", "code": "200"}})
        assert code == "200"
        assert status == "SUCCESS"

    def test_no_code_but_success_message_infers_200(self):
        code, _ = _parse_ird_response({"message": "Success"})
        assert code == "200"

    def test_no_code_and_no_success_message_is_unknown_not_success(self):
        # Must never default to "200" (success) for an ambiguous response —
        # that would silently mark a possibly-failed submission as synced.
        code, _ = _parse_ird_response({"message": "something unexpected"})
        assert code == "103"

    def test_completely_empty_body_is_unknown(self):
        code, _ = _parse_ird_response({})
        assert code == "103"
