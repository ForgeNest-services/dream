# Srota — Pre-Submission IRD Compliance Audit Checklist

_Purpose: check your already-built IMS and RMS against every requirement found in research, before either app goes to IRD for verification. Separate, self-contained checklists for each app, plus the shared data your system needs to hold (DB design) and the exact request/response contract IRD's CBMS API expects (JSON schema) — both shared by IMS and RMS since it's the same API either app talks to._

_Where a requirement is confirmed only from vendor sources rather than an official IRD document, it's marked accordingly — worth a final confirmation with IRD, but still worth building/checking for now._

---

## Srota IMS — Audit Checklist

_IMS covers inventory + purchase + supplier + sales + POS, and issues VAT bills through its sales/POS module — full certification requirements apply._

### Invoice generation & format

- [ ] Every VAT invoice has a sequential, unique invoice number (per fiscal year)
- [ ] Seller PAN/VAT number is printed on every invoice
- [ ] Buyer PAN/VAT number field exists and is captured where applicable
- [ ] Invoice shows itemized VAT breakdown, not just a total tax line
- [ ] System supports multiple tax rates on a single invoice
- [ ] A simplified tax invoice format (संक्षिप्त कर बिजक) exists alongside the full VAT invoice
- [ ] Both print and digital/PDF invoice formats are available
- [ ] Invoice numbering cannot skip, duplicate, or be manually overridden by a user

### Credit notes / returns

- [ ] Credit note / sales return function exists, referencing the original invoice number
- [ ] Credit notes carry their own sequential numbering
- [ ] Credit note reason/reference is captured

### Data integrity & audit trail

- [ ] Once issued, an invoice cannot be silently edited or deleted — only reversed via a credit note
- [ ] There's a visible audit log of who issued/modified/reversed what, and when
- [ ] Data backup and recovery process exists and is documented

### Required reports (system must be able to generate these)

- [ ] Sales register
- [ ] Purchase register
- [ ] Annexure 13 (अनुसूची १३)
- [ ] मासिक (monthly) VAT summary return
- [ ] TDS report (relevant given IMS's purchase/supplier side)

### CBMS integration capability

- [ ] System can construct and send the CBMS bill payload (seller/buyer PAN, fiscal year, invoice number/date, tax breakdown fields, etc.)
- [ ] System can construct and send the CBMS credit-note/return payload
- [ ] System handles IRD's documented response codes rather than assuming every call succeeds (200 success · 100 auth mismatch · 101 already exists/not found · 102 processing exception · 103 unknown error · 104 invalid payload · 105 bill not found)
- [ ] A failed sync doesn't block or roll back the actual sale/invoice — it's a separate concern from billing itself
- [ ] There's a way to see which invoices have/haven't synced, and manually retry a failed one

### Tax settings (admin, org-level — shared with RMS, not duplicated per app)

- [ ] Settings screen exists for entering the org's PAN and IRD Taxpayer Portal username/password
- [ ] Credentials are encrypted at rest, not stored in plaintext
- [ ] Auto-sync is off by default and only enabled once credentials are saved
- [ ] Consent/disclosure text is shown before saving credentials (this is their live tax portal login, not a scoped token — say so)
- [ ] A path exists to update credentials if the org's IRD password changes, without silently breaking sync

### Documentation to have ready for the application itself

- [ ] Company PAN/VAT certificate
- [ ] Business registration certificate
- [ ] Latest tax clearance certificate
- [ ] Cover letter to IRD
- [ ] Full software/module documentation covering inventory, purchase, supplier, sales, and POS flows
- [ ] Sample invoices, print and digital
- [ ] User manual
- [ ] System architecture document
- [ ] Written statement/guarantee that invoice data cannot be altered or manipulated post-issue
- [ ] Data backup & recovery documentation
- [ ] CBMS API connection details, demonstrable on request

### Self-test before submitting

- [ ] Walk through creating an invoice → generating each required report → issuing a credit note against it, end to end, with no manual workarounds needed
- [ ] Confirm every invoice/report field is populated correctly with real (or realistic) data, not placeholders
- [ ] Test the CBMS payload construction against the documented field list even if you can't yet test a live submit (no confirmed sandbox exists — see note below)

---

## Srota RMS — Audit Checklist

_RMS bills restaurant/hospitality sales directly. This sector has the lower mandatory e-billing threshold (NPR 5 crore vs. 10 crore generally), so RMS customers are more likely to hit mandatory compliance sooner — worth treating this certification as higher priority if you have to sequence the two._

### Invoice generation & format

- [ ] Every VAT bill has a sequential, unique invoice number (per fiscal year)
- [ ] Seller PAN/VAT number is printed on every bill
- [ ] Buyer PAN/VAT field exists — confirm with IRD whether it can be left blank for a walk-in guest with no PAN, since that's the normal case in a restaurant/retail setting and isn't clearly answered in what we found
- [ ] Bill shows itemized VAT breakdown, not just a total tax line
- [ ] System supports multiple tax rates on a single bill (e.g. VAT plus any service charge treated separately)
- [ ] A simplified tax invoice format (संक्षिप्त कर बिजक) exists alongside the full VAT invoice
- [ ] Both print and digital/PDF bill formats are available
- [ ] Invoice numbering cannot skip, duplicate, or be manually overridden by a user

### Credit notes / voids

- [ ] Credit note / void-and-reissue function exists, referencing the original bill number
- [ ] Credit notes carry their own sequential numbering
- [ ] Reason for void/return is captured

### Data integrity & audit trail

- [ ] Once issued, a bill cannot be silently edited or deleted — only reversed via a credit note
- [ ] Visible audit log of who issued/modified/reversed what, and when
- [ ] Data backup and recovery process exists and is documented

### Required reports

- [ ] Sales register
- [ ] Purchase register, if RMS tracks any purchasing — confirm whether this applies to a pure billing/POS app or only to IMS
- [ ] Annexure 13 (अनुसूची १३)
- [ ] मासिक (monthly) VAT summary return
- [ ] TDS report, if applicable

### CBMS integration capability

- [ ] System can construct and send the CBMS bill payload
- [ ] System can construct and send the CBMS credit-note/return payload
- [ ] System handles IRD's documented response codes (200/100/101/102/103/104/105)
- [ ] A failed sync doesn't block or roll back the actual sale/bill
- [ ] A way exists to see which bills have/haven't synced, and manually retry a failed one

### Tax settings (admin, org-level — shared with IMS, not duplicated per app)

- [ ] Same settings screen as IMS reads from — no separate RMS-only credential entry
- [ ] Credentials encrypted at rest
- [ ] Auto-sync off by default, only enabled once credentials are saved
- [ ] Consent/disclosure text shown before saving credentials
- [ ] Path exists to update credentials without silently breaking sync

### Documentation to have ready for the application itself

- [ ] Company PAN/VAT certificate
- [ ] Business registration certificate
- [ ] Latest tax clearance certificate
- [ ] Cover letter to IRD
- [ ] Full software/module documentation covering the order/table/billing/POS flow
- [ ] Sample invoices, print and digital
- [ ] User manual
- [ ] System architecture document
- [ ] Written statement/guarantee that invoice data cannot be altered or manipulated post-issue
- [ ] Data backup & recovery documentation
- [ ] CBMS API connection details, demonstrable on request

### Self-test before submitting

- [ ] Walk through a table/order → bill → payment → each required report, end to end, no manual workarounds
- [ ] Test a walk-in-guest scenario (no buyer PAN available) and confirm the bill still generates correctly
- [ ] Test the CBMS payload construction against the documented field list even without a live submit

---

---

## What your DB needs to hold

Not new business-logic code — just the data your system needs somewhere, on top of whatever invoice/credit-note tables IMS and RMS already have, to actually meet the checklist items above. Shared by both apps at the org level; each app's own sync log is kept separate so IMS and RMS don't share sync history.

### 1. Org-level tax settings — one record per business, read by both apps

| Field                      | Purpose                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| `organization_id`          | Which business this belongs to                                                                          |
| `pan`                      | The business's own PAN, used as `seller_pan` in every CBMS submission                                   |
| `ird_username` (encrypted) | Their live IRD Taxpayer Portal login — **encrypted at rest, never stored or logged in plaintext**       |
| `ird_password` (encrypted) | Same — this is their real tax portal password, treat it accordingly                                     |
| `cbms_sync_enabled`        | Off by default; only true once they've saved credentials                                                |
| `consent_acknowledged_at`  | Timestamp they accepted the disclosure that this is their live tax credential                           |
| `credentials_updated_at`   | Bumped whenever they re-save — used to tell "stale password" failures apart from one-off network errors |

**Why one shared record, not one per app:** if a business runs both IMS and RMS, you don't want them entering their tax portal password twice into two different settings screens, and you don't want two copies of the same sensitive credential sitting in two databases.

### 2. Sync log — one row per sync _attempt_, per app

Needed because a single invoice can be retried multiple times before it succeeds, and your admin screen needs to show that history, not just a final state.

| Field                                             | Purpose                                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `organization_id`                                 | For scoping the admin sync-status view per business                                                           |
| `source_app`                                      | `ims` or `rms` — kept separate per app even though the org record is shared                                   |
| `document_type`                                   | `invoice` or `credit_note`                                                                                    |
| `document_id`, `document_number`                  | Which invoice/credit note this attempt is for                                                                 |
| `status`                                          | `pending`, `synced`, or `failed`                                                                              |
| `cbms_response_code`, `cbms_response_body`        | What IRD actually said back — needed for debugging and for telling a real failure apart from "already synced" |
| `attempt_count`, `last_attempted_at`, `synced_at` | Retry history and the timestamp for "last successfully synced" shown to the business                          |

This is what powers: the per-invoice sync status indicator, the "resync" button for a failed one, and a dashboard count of pending/failed/synced per business.

**One integrity rule worth enforcing at the DB level, not just in app code:** don't let the same invoice be marked `synced` twice — guard against double-submitting a bill that already went through, on top of relying on IRD's own "already exists" response code as a second layer of protection rather than the only one.

---

## Request/response JSON schema — exactly what IRD wants sent

Two endpoints, confirmed identically from two independent sources (IRD's own technical PDF and a developer forum thread quoting the same document), so the field list itself is solid — the caveats noted below are about formats and edge cases the sources didn't spell out, not about whether these are the right fields.

- `POST https://cbapi.ird.gov.np/api/bill` — every invoice
- `POST https://cbapi.ird.gov.np/api/billreturn` — every credit note / sales return

_(An older address, `http://202.166.207.75:9050`, also appeared in early vendor documentation — `cbapi.ird.gov.np` is confirmed current from IRD's own CBMS API PDF (updated 2079 Ashoj 28).)_

### What you send for an invoice (`/api/bill`)

| Field                | Type     | Notes                                                                                                                                                  |
| -------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `username`           | string   | The business's live IRD Taxpayer Portal username                                                                                                       |
| `password`           | string   | Their live IRD Taxpayer Portal password                                                                                                                |
| `seller_pan`         | string   | The billing business's own PAN                                                                                                                         |
| `buyer_pan`          | string   | Documented as required — **unconfirmed** how to handle a walk-in customer with no PAN (common in RMS); don't assume blank is accepted without checking |
| `buyer_name`         | string   | Same caveat as `buyer_pan`                                                                                                                             |
| `fiscal_year`        | string   | Nepali fiscal year — **confirmed format `"2081.082"`** (dot-separated: start year + `.` + 3-digit end year, e.g. `"2073.074"` from IRD API PDF)       |
| `invoice_number`     | string   | Must match your own sequential numbering                                                                                                               |
| `invoice_date`       | string   | **Confirmed BS date with dots**: `"YYYY.MM.DD"` e.g. `"2074.07.06"` — Bikram Sambat date, confirmed from IRD API PDF sample                           |
| `total_sales`        | number   |                                                                                                                                                        |
| `taxable_sales_vat`  | number   | Portion of sales subject to VAT                                                                                                                        |
| `vat`                | number   | VAT amount                                                                                                                                             |
| `excisable_amount`   | number   |                                                                                                                                                        |
| `excise`             | number   |                                                                                                                                                        |
| `taxable_sales_hst`  | number   | Health service tax portion, where applicable                                                                                                           |
| `hst`                | number   |                                                                                                                                                        |
| `amount_for_esf`     | number   | Education service fee portion, where applicable                                                                                                        |
| `esf`                | number   |                                                                                                                                                        |
| `export_sales`       | number   |                                                                                                                                                        |
| `tax_exempted_sales` | number   |                                                                                                                                                        |
| `isrealtime`         | boolean  | Whether this is a real-time submission                                                                                                                 |
| `datetimeClient`     | datetime | Client-side transaction timestamp                                                                                                                      |

### What you send for a credit note (`/api/billreturn`)

Same fields as above, except `invoice_number`/`invoice_date` are replaced with:

| Field                | Type   | Notes                                          |
| -------------------- | ------ | ---------------------------------------------- |
| `ref_invoice_number` | string | The original invoice this credit note reverses |
| `credit_note_number` | string |                                                |
| `credit_note_date`   | string | Same format caveat as `invoice_date`           |
| `reason_for_return`  | string |                                                |

### What IRD sends back

IRD's response includes a status code your system needs to branch on — not every non-200 is the same kind of failure:

| Code  | Meaning                                        | What your system should do                                                                                |
| ----- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `200` | Success                                        | Mark `synced`, record timestamp                                                                           |
| `100` | Auth mismatch                                  | Don't just retry blindly — the credentials are likely stale; flag for the business to re-enter them       |
| `101` | Already exists (bill) / doesn't exist (return) | Treat as effectively handled, not a fresh failure — check before assuming it needs a resend               |
| `102` | Exception during processing                    | Transient — safe to retry with backoff                                                                    |
| `103` | Unknown error                                  | Transient — safe to retry with backoff                                                                    |
| `104` | Invalid payload structure                      | A data problem, not a network one — retrying the same bad payload won't help, needs investigation         |
| `105` | Bill doesn't exist (returns only)              | The credit note references an invoice IRD doesn't have on record — needs investigation, not a blind retry |

The practical point for your DB design above: `102`/`103` are worth auto-retrying, `100`/`104`/`105` are worth surfacing to a human rather than retrying forever, and `101` needs a quick check rather than being treated as either a clean success or a hard failure.

---

## Things neither checklist can fully close out — confirm with IRD directly before submitting either app

- Whether IMS and RMS being submitted separately, while sharing backend/billing infrastructure, changes anything about the second app's review
- Current certification fee and processing timeline (only found from a secondary source, not an official IRD page)
- Whether buyer PAN/name are truly mandatory on every CBMS submission, or there's an accepted way to handle anonymous/walk-in sales (matters most for RMS)
- ~~Whether any production sandbox exists for end-to-end testing against a real IRD system.~~ **CONFIRMED 2026-09-04**: yes — `Test_CBMS`/`test@321` (`seller_pan="999999999"`) works live against the real `cbapi.ird.gov.np` endpoints. Posted a fresh bill (got `200`), re-posted it (got `101`, correctly handled as idempotent), and posted a credit note against it (got `200`) — full round trip, through the app's actual `post_to_cbms()` code, not just curl. A wrong password still returned `200`, not `100` — the sandbox may not validate password for this account; untested whether a bad username behaves differently. `seller_pan` must match `999999999` — a real order snapshotted with a different (even a syntactically valid) PAN gets back `100` (auth mismatch) using these same credentials, confirming the sandbox validates the seller PAN, not just username/password. This test also caught and fixed a real bug: `_parse_ird_response()` assumed an object-shaped body and crashed on IRD's real bare-integer response (`200`, `101`, ...) — see `docs/compliance.md`'s §6 for the fix. These are publicly documented test credentials; treat them as integration test credentials only, not for real submissions.
- ~~Whether the RQ background-job pipeline that actually delivers these submissions in production works at all.~~ **CONFIRMED, then found broken, then fixed — 2026-09-04**: it did not work. `api/worker.py` never imported `main` before starting `Worker.work()`, so the moment a real job's lazy `features.*` import ran (`jobs/cbms_jobs.py`'s `_load_document`), the worker process crashed on the same `features.auth` ↔ `core.deps` circular import this repo has hit before in ad-hoc scripts — except this was the real, deployed worker container, not a test script missing `import main`. No CBMS sync job could have completed successfully in production before this fix, independent of the `_parse_ird_response` bug above. Fixed by adding `import main` to `worker.py`; note `worker` is built from its own image (`dream-worker`), not `dream-api` — rebuilding `api` alone does not pick up a `worker.py` change. Re-verified after the fix: a real RMS order, enqueued through the real `job_queue`, picked up by the real worker, reached the real IRD sandbox, got a real `103` back, correctly raised for RQ's retry policy, and the retry was confirmed sitting in `ScheduledJobRegistry`. Full details in `docs/compliance.md`'s §6.
