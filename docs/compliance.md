# IRD Electronic Billing Compliance — Reference

Primary source: **विद्युतीय बीजक सम्बन्धी कार्यविधि, २०८२** ("Electronic Billing
Procedure, 2082" — Nepal Inland Revenue Department, IRD). This is the
**current** procedure — it explicitly repeals विद्युतीय बीजक सम्बन्धी कार्यविधि, २०७४
(clause १२ग). BS 2082 ≈ AD 2025/26.

Source PDF (as verified this session, byte-identical extraction, MD5-matched
across two independent sessions):
`c:\Users\HELIOS\Downloads\विद्युतीय बीजक सम्बन्धी कार्यविधि, २०८२_ab3ktjz.pdf`
(876,304 bytes).

This document translates every clause into what it means for **Srota** (this
repo — apps: `ims/` inventory+sales, `rms/` restaurant POS, `admin/` platform,
`api/` shared FastAPI backend), cross-referenced against the actual code as
of 2026-09-03. Where something in code is unconfirmed against the exact IRD
template, it's flagged explicitly — do not treat this doc as certifying
compliance, it's a map of what exists and what's still open.

**Freshness note**: a dedicated RMS-only audit pass re-verified every row
touching `rms/`/`restro/` against live code and corrected several rows that
had understated what's actually built (Sales Register/Annexure-13/Monthly
VAT Summary/Standard View/Credit-Notes exports, the CBMS RQ retry engine,
the cancellation-vs-return split). Rows explicitly marked "IMS: not
re-verified this pass" reflect the doc's earlier, less-current state for
IMS specifically — check `docs/Srota_IRD_Compliance_Checklist.md` and the
actual IMS code before relying on those.

---

## 1. Structure of the procedure

- **Chapter 1 (प्रारम्भिक)** — short title, commencement.
- **Chapter 2 (परिभाषा)** — definitions (सफ्टवेयर, विद्युतीय बीजक उपकरण, व्यक्ति, उत्पादक,
  विभाग, कार्यालय, वितरक, सूचना प्रविधि अधिकृत, Front End, Back End, CBMS, विद्युतीय बीजक,
  विद्युतीय भुक्तानी उपकरण, उपभोक्ता, सर्भर).
- **Chapter 3 (सूचीकरण तथा अनुमति)** — listing the device/software with IRD (दफा ३),
  then getting a per-business, per-branch permit to actually issue bills with
  it (दफा ४). Two distinct steps: the **software gets listed once nationally**
  by its producer/distributor; **each business gets its own permit** to use a
  listed software.
- **Chapter 4 (उपकरण, सफ्टवेयर तथा सर्भरको मापदण्ड)** — the actual technical
  standard: device standard (दफा ५), software standard (दफा ६ — the bulk of
  what's code-relevant), server standard (दफा ७).
- **Chapter 5 (प्रणाली सञ्चालन, परिवर्तन तथा अनुमति खारेजी)** — issuing bills day-to-day
  (दफा ८), changing device/software (दफा ९), revoking a permit / delisting
  (दफा १०).
- **Chapter 6 (विविध)** — monitoring/inspection (दफा ११), repeal & savings (दफा १२).
- **Annexures १–९** — the actual forms and the two schedules that matter most
  for engineering: **Annexure ५** (Standard View DB fields) and **Annexure ६**
  (exact printed bill/report layouts).

---

## 2. PAN-only vs. VAT-registered — the distinction that runs through everything

The procedure itself doesn't split into two tracks explicitly by name, but
Annexure ६ (दफा ६.२क, ८क/ख) gives **five separate bill templates**, and which
one applies depends on registration status:

| Annexure ६ template | Nepali label | Who it's for |
|---|---|---|
| १.क.अ | कर बीजकको ढाँचा (full tax invoice) | VAT-registered, itemized VAT breakdown |
| १.क.आ | बीमा कम्पनीको कर बीजक | VAT-registered insurance companies (N/A to Srota) |
| १.क.इ | कर बीजकको ढाँचा (variant, service/telecom-style) | VAT-registered, alternate full layout |
| १.क.ई | **संक्षिप्त कर बीजकको ढाँचा** (abbreviated tax invoice) | VAT-registered, taxable value ≤ Rs 10,000 |
| १.ख.अ | **बीजकको ढाँचा** (PAN-only) | Businesses registered for **PAN/income tax only**, not VAT — no VAT columns at all |

**PAN-only businesses (`tenant.is_vat_registered = False`)**: no VAT
breakdown, no VAT rate, no VAT amount columns on the bill at all (template
१.ख.अ). The Rs 10,000 abbreviated-invoice ceiling is a VAT-context rule (it
exists to gate which *VAT* template you may use) — it has no meaning for a
PAN-only business since there's no VAT breakdown to itemize either way. Code
already reflects this: `restro/order_service.py:626-631` only enforces the
cap `if vat_enabled` (i.e. only for VAT-registered tenants); IMS's
`invoice_service.py` similarly only meaningfully triggers when `vat_registered`.

**VAT-registered businesses (`tenant.is_vat_registered = True`)**: must pick
between the full tax invoice (कर बीजक) and the abbreviated one (संक्षिप्त कर बीजक)
per bill, gated by the Rs 10,000 taxable-value ceiling — **hard legal limit,
not a UI preference** (दफा ६.२ङ / Annexure ६ १.क.ई's own footnote: "दश हजार
रुपैयाँभन्दा बढी कर लाग्ने मूल्यको वस्तु वा सेवाको बिक्रीमा यो बीजक जारी गरिने छैन").

**Where this shows up in the DB right now:**
- `Tenant.pan` (String, unique, nullable) — every business's PAN, regardless
  of VAT status.
- `Tenant.is_vat_registered` (Boolean) — the actual gate.
- `IMSInvoice.kind` / `RestroOrder.kind` — `"tax" | "abbreviated"` (plus
  `"quotation"` for IMS only). Set at issue time; drives which printed layout
  renders. Never mutated after issuance for a real invoice.
- Enforcement: `api/features/ims/invoice_service.py:274-285` (create) and
  `:536-549` (convert); `api/features/restro/order_service.py:623-633`
  (mark_paid) — server-side recompute of `taxable_amount` against the *same*
  totals math about to be saved, never trusting a client-sent
  `show_vat_breakdown` flag to bypass the ceiling.

---

## 3. Software standard (दफा ६) — the core checklist, clause by clause

### ६.१ — Software characteristics

| Clause | Requirement | Status in Srota |
|---|---|---|
| ६.१क | User-friendly, simple | — (UX judgment call, not a checkbox) |
| ६.१ख | User management, password change, User Manual (Nepali/English), DB backup features | User management ✅ (staff CRUD in both apps' Settings). DB backup: infra-level, see §9 below — not app-level. User Manual: **not written yet**, needed for the IRD submission packet itself. |
| ६.१ग | Relational DB; **Log Archive Enabled**; DB + log-archive backup to an **external device**, recoverable | Postgres (relational) ✅. Log archiving / external-device backup: **infra/ops concern, not yet formalized** — see §9. |
| ६.१घ | Export tables to Excel/XML/PDF from the front-end app | ✅ — `reports-export.ts` (RMS) and IMS's equivalent export both produce XLSX + PDF from the front end. |
| ६.१ङ | Passwords stored with encryption | ✅ — staff/user passwords are hashed (not the concern here — IRD credentials specifically are handled per ६.४ below). |
| ६.१च | Multi-user, multi-branch support where needed | ✅ — both apps are inherently multi-user (role-gated staff accounts) and multi-branch (`Branch` model, tenant can have N branches). |
| ६.१छ | **Standard View** per Annexure ५ (see §4 below), with printable reporting | ✅ RMS: DB fields present on `RestroOrder`, and the printable export (`GET /restro/reports/standard-view/export`) now emits all 20 fields with a working UI button. Exact column naming/order vs. CBMS's Excel-upload expectation still unconfirmed (see §4). IMS: DB fields present on `IMSInvoice`; export/UI parity not re-verified this pass. |
| ६.१ज | Bill + required reports per Annexure ६ layout | Bills: close match, not byte-exact-verified against Annexure ६ layout (flagged §5). RMS reports: Sales Register, Annexure १३, Monthly VAT Summary, Standard View, Credit Notes all built and UI-reachable — not yet in Annexure-६-exact column layout (flagged §5). TDS: not applicable to RMS (no purchase/supplier side). IMS: reports not re-verified this pass — see `docs/Srota_IRD_Compliance_Checklist.md`. |

### ६.२ — Bill printing & management

| Clause | Requirement | Status |
|---|---|---|
| ६.२क | Print per Annexure ६, satisfying prevailing tax law | Matches structurally; not byte-verified against the annexure images (see §5). |
| ६.२ख | Bill number sequential per fiscal year, starting at 1 | ✅ — `restro_invoice_serials` (RMS) / IMS's per-fiscal-year serial table; `format_invoice_number()` builds `SERIES-[BRANCH]-FY-SERIAL`; DB `UNIQUE` index on `(branch_id, fiscal_year, bill_number)` backstops any race. |
| ६.२ग | **Branch code** in bill number once billing from >1 location | ✅ — `Branch.code` (unique per tenant, `uq_branch_tenant_code`), derived via `derive_unique_code()`, embedded by `format_invoice_number(series, fy, serial, branch_code)` → e.g. `RMS-KTM-83/84-00005`. Applied unconditionally once a branch has a code (not conditionally on branch count — an earlier-bill/later-bill numbering-scheme mismatch is avoided this way). |
| ६.२घ | **Order Slip** sequential number for Hotel/Restaurant, logged, referenced on the bill | ✅ RMS-only — `RestroOrderSlip`/`RestroOrderSlipSerial`, own gapless per-branch/fiscal-year sequence, created at `send_to_kitchen()`, `slip_numbers` surfaced on `OrderDto`. |
| ६.२ङ | **Dynamic QR code** on the bill, offline-scannable, online-verifiable against IRD's URL once CBMS-linked. Must encode: PAN, bill number+date, buyer PAN (if available), total+tax, and (if CBMS-linked) a verification URL | ✅ generated client-side (`ird-qr.ts` + `IrdQrCode.tsx`, both apps) — PAN, bill number, date, total/tax encoded. Generated entirely client-side (never sent to a third-party QR service, since it carries PAN/financial data). **URL field deliberately omitted** — no IRD-published URL-verification format has been found; do not guess it. Renders unconditionally (paid or unpaid preview) whenever `tenant.pan` exists, per explicit product decision this session. |
| ६.२च | Print **once** via the front end; any reprint must show **"Copy of Original"** + a print count | ✅ RMS: `print_count` column on `restro_orders`, `registerPrint()` endpoint bumps it and returns `is_reprint`; watermark rendered client-side. IMS: `is_reprint`/`reprint_of`/`reprint_number` row-per-reprint model (different mechanism, same legal outcome — each reprint traceable). |
| ६.२छ | Bill shows issuer name, date, time | ✅ — `entered_by_name` (RMS) / `user_id`→resolved name (IMS), `placed_at`/`created_at`. |
| ६.२ज | Cancellation/return handling: reverse entry for immediate cancellation, sales-return record for post-issue returns, both logged distinctly in their own registers, Standard View updated | ✅ **RMS**: two distinct, separately-gated mechanisms — `order_service.py::cancel()` only operates on a still-`draft` order (true pre-issuance reverse entry, ररिवर्स एन्ट्री) and `order_service.py::issue_credit_note()` only operates on an already-`paid` order (true post-issuance return, बिक्री फिर्ता), each writing a distinct audit-log action (`"cancel"` vs `"credit_note"`) so they're separately queryable/reportable. Credit notes carry their own sequential numbering, real line items, correct `original_order_id` linkage. IMS: credit notes exist as linked rows but the same cancel-vs-return split hasn't been re-verified for IMS specifically — check before relying on this for IMS. |

### ६.३ — Reporting, audit, immutability

| Clause | Requirement | Status |
|---|---|---|
| ६.३क | Pre-formatted Sales Register, Purchase Register, Sales Return, Purchase Return, ready for CBMS Excel upload | ✅ **RMS**: Sales Register, Annexure 13, Monthly VAT Summary, Standard View (Annex-5), and Credit Notes register all exist as working export endpoints (`GET /restro/reports/{sales-register,annexure-13,monthly-vat-summary,standard-view,credit-notes}/export`), XLSX+PDF, with frontend buttons in `ReportsView.tsx`'s "IRD Reports" card — VAT registers gated to VAT-registered tenants, Standard View/Credit Notes shown to every tenant. No Purchase Register (RMS has no purchasing — correctly N/A). **Column layout now matches Annexure ６ exactly** (2026-09-04): 12-column IRD template including Tax-exempt and Export columns, landscape PDF. ✅ **IMS**: Sales Register (`/reports/vat-register/export`) and Purchase Register (`/reports/purchases/export`) both updated to the same 12-column IRD template (2026-09-04). |
| ६.३ख | **All user activity (User Activity Log)** stored in DB | ✅ — `audit_log` table, append-only (DB grants: INSERT+SELECT only, no UPDATE/DELETE — see model docstring). |
| ६.३ग | Audit Trail Report / Activity Log viewable + filterable from the **front end** | ✅ — RMS: "Activity Log" tab in `SettingsView.tsx` (Owner/Manager only, entity/action filters, search, pagination). IMS: same pattern in `_app.settings.tsx`. |
| ६.३घ | **Once entered, transaction data cannot be removed or modified — from front end OR back end** | ✅ — the heaviest single piece of work this session. Two different DB-level mechanisms (not app-code checks, so they hold even against a bug or a direct DB client): <br>• **IMS**: restricted Postgres role `srota_app` with column-level `REVOKE UPDATE/DELETE`, per-table allowlist of "follow-on" columns still writable (`_IMMUTABLE_TABLES` in `api/core/seed.py`). <br>• **RMS**: `BEFORE UPDATE/DELETE` Postgres triggers (`restro_orders_immutability()`, `restro_order_lines_immutability()`, `api/core/seed.py`) — freezes a row once `status` becomes `paid`/`cancelled`, needed because RMS legitimately rewrites the same columns many times while `status='draft'`. Verified adversarially, including as the Postgres superuser. |

### ६.४ — System interoperability & producer liability

| Clause | Requirement | Status |
|---|---|---|
| ६.४क | Real-time Web-API integration with CBMS | ✅ **RMS**: `_enqueue_cbms_sync()` (`restro/router.py`) enqueues via RQ with real retry (`job_queue.enqueue(sync_document_job, ..., retry=Retry(max=3, interval=[60,300,900]))`), called from both `mark-paid` and `credit-note` endpoints, gated on VAT-registration + `OrgTaxSettings` credentials being present. Sync-status UI exists in `SettingsView.tsx` (imports `cbmsApi`/`CbmsSyncLogEntry`, renders a sync log table). IMS: not re-verified this pass — re-check before relying on this row for IMS. Still open regardless of app: exact CBMS base URL, payload date-format, sandbox existence (see §6). |
| ६.४ख/ग | Producer/distributor liability continuity on contract termination or ownership change | Contractual/paperwork, not code. |

---

## 4. Annexure ५ — Standard View (the DB "spec")

Legally mandated field list for the software's Standard View, one row per
bill, resettable sequential numbering per fiscal year:

```
Fiscal Year · Bill_no. · Customer_name · Customer_PAN · Bill_Date · Amount ·
Discount · Taxable_Amount · Tax_Amount · Total_Amount · Sync_with_IRD ·
Is_Bill_Printed · Is_bill_Active · Printed_Time · Entered_By · Printed_by ·
Is_realtime · Payment_Method · VAT_Refund_Amount (if any) · Transaction_Id (if any)
```

Cross-reference to the actual models:

| Annexure ५ field | `IMSInvoice` | `RestroOrder` |
|---|---|---|
| Fiscal Year | `fiscal_year_id` → FK | `fiscal_year` (string, e.g. `"2081-82"`) |
| Bill_no. | `number` (full formatted string) | `bill_number` (int) + `bill_code` (formatted string) |
| Customer_name | `buyer_name` | `buyer_name` |
| Customer_PAN | `buyer_pan` | `buyer_pan` |
| Bill_Date | `date` / `date_bs` | `placed_at` / `placed_at_bs`, `paid_at` / `paid_at_bs` |
| Amount | `gross_amount` | `subtotal_amount` |
| Discount | `discount_amount` | `discount_amount` |
| Taxable_Amount | `taxable_amount` | `taxable_amount` |
| Tax_Amount | `vat_amount` | `vat_amount` |
| Total_Amount | `total_amount` | `total_amount` |
| Sync_with_IRD | `cbms_synced` / `cbms_synced_at` | `cbms_synced` / `cbms_synced_at` |
| Is_Bill_Printed | `is_bill_printed` | `is_bill_printed` |
| Is_bill_Active | *(implicit: absence of a linked credit note)* | *(same)* |
| Printed_Time | `printed_time` | `printed_time` |
| Entered_By | `user_id` | `entered_by_name` / `entered_by_cred_id` |
| Printed_by | `printed_by` | `printed_by` / `printed_by_name` |
| Is_realtime | *(not a distinct column — implied by `cbms_synced_at` timing)* | `is_realtime` (explicit column) |
| Payment_Method | `payment_method` | `payment_method` |
| VAT_Refund_Amount | *(not modeled — see note)* | `vat_refund_amount` (§8ख: 60% of VAT, capped Rs 5,000, electronic payment only) |
| Transaction_Id | *(not modeled)* | `transaction_id` (electronic payment reference) |

**Open item**: IMS has no explicit `Is_realtime`/`VAT_Refund_Amount`/
`Transaction_Id` columns the way RMS does — RMS is ahead on this specific
subset (added later, more recently). Not yet ported back to IMS. Doesn't
block anything (IMS doesn't currently support QR/electronic-refund payment
flows the same way), but note the asymmetry if IMS gains that flow later.

**RMS: report-layer gap closed** — `GET /restro/reports/standard-view/export`
now exists and emits all 20 Annex-5 fields (`api/features/restro/router.py`),
with a frontend button in `ReportsView.tsx`'s "IRD Reports" card. Excise/HST/
ESF/Export-Sales columns (concepts RMS has none of) print `"N/A"` rather than
a silent `0`. `Is_realtime`/`VAT_Refund_Amount`/`Transaction_Id` are now
threaded all the way through — `OrderDto` → `Order` type → `toOrder()`
mapper → `ThermalPrint.tsx`'s "VAT refund eligible" line (this was
previously dead: the fields existed on the backend model/schema but were
never wired into the frontend types, so the receipt line could never render).
**Still unconfirmed**: whether the column *naming/order* in the export
exactly matches what CBMS's Excel-upload expects — cross-check before real
submission. IMS: not re-verified this pass.

---

## 5. Annexure ६ — Bill & report formats

Five bill layouts (see §2 table) plus Sales Register and Purchase Register
column layouts (दफा ६.३क references these). The register layouts specify:

**Sales Register (धिक्री खाता)** columns: करदाता दर्ता नं., मिति, बिजक नम्बर,
खरिदकर्ताको नाम, खरिदकर्ताको स्थायी लेखा नम्बर, जम्मा बिक्री/निर्यात मूल्य, स्थानीय
करयोग्य बिक्री (मूल्य + कर), कर छुटको बिक्री मूल्य, निर्यात गरेको वस्तु/सेवाको मूल्य,
निर्यात गरेको देश, निर्यात प्रज्ञापनपत्र नम्बर+मिति.

**Purchase Register (खरिद खाता)** columns: करदाता दर्ता नं., मिति, बिजक/प्रज्ञापनपत्र
नम्बर, आपूर्तिकर्ताको नाम+PAN, जम्मा खरिद मूल्य, कर छुट हुने खरिद/पैठारी मूल्य, करयोग्य
खरिद (पुँजीगत बाहेक), करयोग्य पैठारी (पुँजीगत बाहेक), पुँजीगत करयोग्य खरिद/पैठारी.

**Status — RMS**: Sales Register export exists and is UI-reachable
(`ReportsView.tsx`'s "IRD Reports" card). Purchase Register is correctly
N/A (RMS has no purchasing). **Column layout now matches the PDF Annexure ６
template exactly** (2026-09-04 pass): Date, Bill No., Buyer, Buyer PAN,
Total Amount, Taxable Value, VAT, Tax-exempt Amount, Export Value, Export
Country, Export Customs No., Export Customs Date — 12 columns, PDF rendered
in landscape A4 (`wide=True`). Credit notes excluded from Sales Register
(they appear only in the Credit Notes register). IMS: same column structure
applied to both Sales Register (VAT register endpoint) and Purchase Register
(which includes all 12 IRD columns including import/capital columns — filled
with 0 for domestic-only businesses).

**HS Code**: every Annexure ६ bill template has an एच.एस. कोड (HS Code)
column per line item. Now implemented as a **branch-level default**
(`RestroBranchSettings.default_hs_code`, e.g. `"2106.90"` for prepared
restaurant food) rather than a true per-menu-item code — a reasonable
simplification for a restaurant (narrow, largely uniform product category)
but should be revisited if Srota ever serves a retailer with genuinely
mixed HS-code inventory (IMS's use case is closer to that — **confirm
whether IMS has the equivalent field**, not verified in this pass).

---

## 6. CBMS — Central Billing Monitoring System

**Endpoints** (per `api/features/cbms/submit.py` and
`docs/Srota_IRD_Compliance_Checklist.md`):
- `POST /api/bill` — every invoice/bill
- `POST /api/billreturn` — every credit note / sales return

Response codes and the retry/no-retry decision table are documented in the
checklist (`docs/Srota_IRD_Compliance_Checklist.md`) — `200` success,
`100` auth/credential problem (surface to human, don't blind-retry), `101`
already-exists-or-doesn't (treat as handled), `102`/`103` transient
(auto-retry with backoff), `104`/`105` data problem (surface to human).

**Data model** (built this session/recent work, confirmed present in code):
- `OrgTaxSettings` (`org_tax_settings` table) — **one row per tenant**,
  shared by both apps (not duplicated per-app). Holds `pan` (mirrors
  `tenants.pan`), `ird_username`, `ird_password` (encrypted at rest via
  `core/crypto.py`), `cbms_sync_enabled` (off by default), `consent_acknowledged_at`
  (required before credentials can be saved — enforces दफा ६.४'s spirit of
  informed producer/business responsibility), `credentials_updated_at`.
- `CbmsSyncLog` (`cbms_sync_log` table) — one row per document (invoice or
  credit note), reused across retries (`attempt_count` increments, not a
  fresh row each time). Fields: `tenant_id`, `source_app` (`ims`|`restro`),
  `document_type`, `document_id`, `document_number`, `status`
  (`pending`|`synced`|`failed`), `cbms_response_code`, `cbms_response_body`,
  `attempt_count`, `last_attempted_at`, `synced_at`.
- `TaxSettingsRepository`/`CbmsSyncLogRepository` — CRUD + `summary_for_tenant()`
  (pending/failed counts, last-synced timestamp) for an admin-facing status
  view.

**CONFIRMED against IRD's own official CBMS API Documentation** (PDF dated
"Updated on October 14, 2022 (2079 Ashoj 28)", supplied directly by the
business owner — this is IRD's own developer documentation, not third-party
research, and settles every item this section previously flagged as
unconfirmed):
- **Base URLs — exact match, byte-for-byte**: `POST https://cbapi.ird.gov.np/api/bill`
  (bill) and `POST https://cbapi.ird.gov.np/api/billreturn` (credit note) —
  identical to what `core/configs.py`'s `IRD_CBMS_URL`/`IRD_CBMS_RETURN_URL`
  defaults already use. The old `202.166.207.75:9050` lead was wrong/stale;
  discard it.
- **Fiscal year format — confirmed**: `"2081.082"` — dot-separated, 4-digit
  start year + `.` + 3-digit zero-padded end year (PDF's own sample:
  `fiscal_year = "2073.074"`). Matches `_fy_to_ird_format()` in both
  `restro/cbms_service.py` and `ims/cbms_service.py` exactly — no code
  change needed, this was already built correctly.
- **Date format — confirmed**: `YYYY.MM.DD`, dot-separated (PDF's sample:
  `invoice_date="2074.07.06"`). Matches `date_ad.strftime("%Y.%m.%d")` in
  both apps' payload builders exactly.
- **Every payload field name — confirmed, all 21 (bill) / 23 (credit note)
  fields match exactly**, including casing (`isrealtime` lowercase,
  `datetimeClient` camelCase) — cross-checked field-by-field against
  `build_cbms_payload()`/`build_credit_note_payload()` in both apps.
- **Response codes 100–105 — confirmed, all six match exactly**, including
  the subtlety that code 101 means opposite things on the two endpoints
  ("bill already exists" on `/api/bill` vs. "bill does not exist" on
  `/api/billreturn`) — `classify_response()` in `api/features/cbms/submit.py`
  already handles this correctly via its `is_credit_note` branch.

**LIVE-TESTED, 2026-09-04 — a real sandbox exists and our integration works
end-to-end.** Posted real requests to the actual production CBMS endpoints
using the `Test_CBMS`/`test@321` credentials from IRD's own PDF:
- `POST /api/bill` with a fresh `invoice_number` → **HTTP 200, body `200`
  (Success)** — a genuine first-time accepted submission.
- Re-posting the same `invoice_number` → **HTTP 200, body `101`** (already
  exists), correctly classified `synced` by our code (idempotent, not a
  fresh failure) — confirms both the sandbox's duplicate-detection and our
  classification logic.
- `POST /api/billreturn` referencing that invoice, unique
  `credit_note_number` → **HTTP 200, body `200`** — a genuine credit note
  accepted, closing the full bill→credit-note lifecycle.
- All three ran through the app's own `post_to_cbms()` in the live `api`
  container, not standalone curl — this exercises our real request/response
  code, not just the network path.
- **A wrong password against the sandbox still returned `200` (success)**,
  not code `100` (auth mismatch) — observed fact, not a rule: the sandbox
  may not validate the password field for the `Test_CBMS` account, or `100`
  triggers on a different failure than a bad password specifically.
  Untested: what a genuinely bad *username* does.
- Buyer PAN/name being optional (blank accepted) is still only a lead, not
  directly re-tested this pass — the PDF's own sample already sends
  `buyer_name=""` and IRD's docs don't state it's optional as a rule.

**A real bug was found and fixed during this test**: `_parse_ird_response()`
in `api/features/cbms/submit.py` assumed IRD's response body was always a
JSON *object* with a `code`/`status`/`data` field (several guessed shapes,
since the real one was unconfirmed) — the live test crashed immediately
with `AttributeError: 'int' object has no attribute 'get'`. IRD's real
response body is a **bare JSON integer** (`200`, `101`, ...), nothing else.
Fixed: the bare-int/bare-numeric-string case is now checked first (the
confirmed, primary path); the old object-shaped guesses are kept only as a
defensive fallback in case the format ever changes. Re-tested after the fix
— all cases above now parse and classify correctly. **This means the CBMS
integration was silently broken for any real submission before this fix** —
every live sync would have thrown an unhandled exception rather than
succeeding, misclassifying, or even hitting the retry path.

**Confirmed built for RMS** (re-verified against live code, not just the
plan): RQ-based retry engine (`_enqueue_cbms_sync()`, `restro/router.py`,
`Retry(max=3, interval=[60,300,900])`) and the sync-status UI in
`SettingsView.tsx`. IMS's equivalent has not been re-verified in this pass —
check before assuming parity.

**A second real bug was found and fixed, 2026-09-04 — the RQ worker itself
crashed on every job.** Built a real RMS order through `OrderService`
end-to-end (not a hand-built payload) and manually enqueued its
`sync_document_job`. The actual `srota-worker` container crashed processing
it:
```
ImportError: cannot import name 'get_current_user' from partially
initialized module 'core.deps' (most likely due to a circular import)
```
Root cause: `api/worker.py` never imported `main` (or anything that forces
the app's full module graph to resolve first) before starting `Worker.work()`
— unlike every other entrypoint in this codebase. `sync_document_job`
deliberately lazy-imports `features.restro`/`features.ims` submodules inside
the function body (`jobs/cbms_jobs.py`'s `_load_document`), so the *first*
time those modules were ever touched inside the worker process was mid-job,
which hits the `features.auth` ↔ `core.deps` circular-import ordering that
only resolves safely when `main.py`'s own import sequence runs first.
**This meant the CBMS RQ pipeline could not execute a single sync job
successfully in production** — every job would crash the moment it tried to
load a document, regardless of the `_parse_ird_response` fix above.

Fixed: `api/worker.py` now does `import main` before starting the worker
loop (safe — `main.py` only *defines* the FastAPI app at import time; the
lifespan/schema-seeding functions only run when uvicorn actually serves
requests, not on plain import). Rebuilt the **`worker` service specifically**
(it has its own image, `dream-worker` — rebuilding `api` alone does not
rebuild it, a real gotcha hit during this fix) and confirmed via
`docker exec srota-worker cat /app/worker.py` that the new code was actually
in the running container before retesting.

Re-verified end-to-end after the fix, real network calls to the live IRD
sandbox, real orders through the real service layer:
- A fresh order with `seller_pan` snapshotted to the sandbox's `999999999`
  test PAN → job executed cleanly, reached `post_to_cbms`, got back a real
  `103` (unknown error) → correctly classified `retry` → correctly **raised**
  so RQ's `Retry(max=3, interval=[60,300,900])` policy requeued it (confirmed
  in `ScheduledJobRegistry`, not `FailedJobRegistry` — retries remaining).
- A second attempt with the test tenant's synthetic PAN (`600000001`, not the
  sandbox's expected `999999999`) → real `100` (auth mismatch) — confirms the
  sandbox validates `seller_pan` against the account, not just
  username/password; a mismatched seller PAN alone is enough to trigger 100.
- `CbmsSyncLog` rows written correctly for both attempts with the right
  `cbms_response_code` and incrementing `attempt_count`.
- Confirmed the correct default-off gate independently: with
  `RMS_CBMS_CERTIFIED` unset (default `false`, as in the real `.env`), the
  same job short-circuits before any network call and logs
  `"not yet IRD-certified"` — verified by temporarily running a second,
  disposable worker container with the flag overridden just for this test,
  never touching the shared `.env`/real worker's config.
- **Repeated the same full test on IMS** (real Tenant → User → Branch →
  IMSCredential → OrgTaxSettings → IMSParty → real Product/Variant with
  stock → real Invoice via `IMSInvoiceService.create()`), independently of
  the RMS run: `sync_document_job('ims', ...)` picked up cleanly by the
  regular (uncertified) worker, logged `"ims not yet IRD-certified"`,
  completed without crashing — confirms the worker fix isn't RMS-specific,
  since `_load_document`'s lazy import branches on `source_app` and IMS's
  branch (`features.ims.invoice_repository`) goes through a different, but
  equally circular, import chain. With `IMS_CBMS_CERTIFIED` overridden on a
  disposable worker, the real invoice reached IRD's sandbox and got back a
  real `102`, correctly classified and raised for retry, `CbmsSyncLog`
  written correctly (`ims`/`invoice`/`102`/`attempt_count=2`).

**Retry/requeue resilience for genuinely unexpected failures, live-tested
2026-09-04.** The question this answers: if `sync_document_job` fails for a
reason nobody anticipated (a transient DB error, a bug — not the designed
CBMS response-code path), does RQ still catch and retry it, or does it get
silently lost?
- Confirmed RQ's `Retry()` policy is **exception-type-agnostic** — it does
  not special-case `sync_document_job`'s deliberate `RuntimeError`. Injected
  an unrelated `TypeError` (simulating a genuine bug) into a throwaway probe
  job with `Retry(max=3, interval=[3,5,8])`: failed twice, succeeded on the
  3rd attempt, backoff timing matched the policy exactly.
- Confirmed a job whose retries are permanently exhausted lands correctly in
  RQ's `FailedJobRegistry` with the full traceback preserved — nothing is
  silently dropped.
- **Gap found (not a data-loss bug, a visibility gap)**: `sync_document_job`
  has no `except` block — only `finally: db.close()`. An exception raised
  before the first `CbmsSyncLogRepository.record_attempt()` call (e.g. a DB
  error inside `get_or_create_pending` itself — reproduced live with a
  malformed `tenant_id`, a real `IntegrityError`) propagates uncaught,
  retries per RQ's policy exactly as expected, but if it exhausts, the job
  sits in RQ's `FailedJobRegistry` with **zero corresponding `CbmsSyncLog`
  row**. Confirmed live: `cbms_sync_log` had 0 rows for the failing
  tenant/document while `FailedJobRegistry` correctly held the job. Neither
  app's sync-status UI reads RQ's registry directly (only `CbmsSyncLog`), so
  this class of failure is currently invisible there — recoverable (RQ kept
  it, `rq requeue`/a registry read would surface it), but not surfaced
  automatically. Not fixed this pass — flagged for a follow-up: either wrap
  the job body in a broad `except Exception` that still writes a `failed`
  `CbmsSyncLog` row before re-raising, or add a periodic check of
  `FailedJobRegistry` into the sync-status view.

**Load/concurrency, live-tested 2026-09-04** — the question: is the current
single-`api`-process, single-`worker`-process deployment resilient at
~100-user scale?
- **API HTTP layer**: fired 100 concurrent real logins (`POST
  /restro/auth/login`, real argon2 password verify + DB query) at the live
  `srota-api` container. All 100 succeeded (zero errors, zero non-200s) —
  correctness held. But latency degraded badly under load: p50 5.8s, p99
  8.7s for what's normally a sub-second call. Root cause confirmed, not
  guessed: `uvicorn` runs as a **single process** (no `--workers` flag in
  the Dockerfile `CMD`), and argon2's password verification is synchronous
  CPU work that blocks the single event loop — so 100 concurrent logins
  serialize almost entirely onto one core, even though the container has 4
  available (`docker exec srota-api nproc` → 4, 0% CPU limit set). Postgres
  itself was never close to its ceiling (peaked at 17 connections against a
  100-connection server limit; the api's own pool is `pool_size=5 +
  max_overflow=10 = 15`, which is what actually capped concurrent DB work).
  **This is a real scaling gap for ~100 concurrent users** — not a
  correctness bug, a throughput one. Fix would be adding `--workers N` (or
  running multiple `api` replicas behind a load balancer) — not done this
  pass, flagged for before real-scale rollout.
- **RQ/worker pipeline**: enqueued 100 real `sync_document_job` calls
  against real orders. A single worker process drained all 100 in ~9.6s
  when each job short-circuits at the certification gate (the realistic
  today-state, since `RMS_CBMS_CERTIFIED`/`IMS_CBMS_CERTIFIED` are correctly
  `false`); a real synced job involves an actual ~1-2s network round-trip to
  IRD (measured earlier in this section), so **100 simultaneous real
  submissions would take roughly 100-200s to fully drain** through the
  single worker, strictly serial (RQ's default worker processes one job at
  a time). Nothing is lost or fails under this load — it's a queue-depth/
  latency characteristic, not a correctness one — but if "100 users" means
  100 near-simultaneous real bill submissions, expect a multi-minute drain
  tail, not sub-second sync. Scaling the worker (`docker-compose up -d
  --scale worker=N`, RQ workers are safely horizontally scalable since jobs
  are atomically claimed) would directly address this if it becomes a real
  bottleneck.

---

## 7. Server standard (दफा ७)

- **७.१ own server**: must sit within the business's own premises in Nepal;
  IRD/office must be pre-notified of its location. — *Deployment/infra
  concern, not app code. Confirm with the user where the production Postgres
  actually runs.*
- **७.२ cloud server**: cloud provider must itself be Nepal-registered, the
  server must be physically in Nepal, multi-tenant architecture with
  data segregation between tenants, a written agreement (Annexure ७ format)
  between software producer/distributor, server operator, and the billing
  business, filed with IRD/office. Falls back to a temporary server (with
  office approval) if the main one is unreachable, without breaking the
  bill-number sequence.
- **७.३ multinational companies**: may run the software on a server outside
  Nepal, but all billing data must be mirrored into a Nepal-premises server
  at issue time, and IRD/office pre-notified of the foreign server's
  location too.

Srota's current architecture (Postgres, `Base.metadata.create_all`,
multi-tenant via `tenant_id` FKs everywhere) already satisfies the
**multi-tenancy-with-segregation** shape of ७.२ग structurally — but *where
the server physically is* and *whether the Annexure-७ tripartite agreement
has been filed* are deployment/business facts, not something this codebase
audit can confirm. Flag to the user directly before submission.

---

## 8. Listing & permit process (Chapters 3 & 5) — non-code, for the submission packet

This is the paperwork side — included here because it's asked-for context,
not because it's implemented in code:

1. **Software listing** (दफा ३, Annexure १): the *producer* (Srota's team)
   submits equipment/software details + a security test report to IRD's
   करदाता पोर्टल (Annexure १ format). One-time per software version; a
   Front-End-or-Back-End tech/version change requires re-listing.
2. **Per-business permit** (दफा ४, Annexures २/३/४): each *business* that
   wants to bill using Srota applies to their local tax office (Annexure ३),
   attaching the producer's listing confirmation + a मञ्जुरीनामा (consent
   letter, Annexure २) from Srota. Office inspects, issues a permit
   (Annexure ४). Required docs per Annexure ३: PAN certificate, company/firm
   registration certificate, mançuriname, sample bills (original + two
   reprint watermark samples), Sales Report sample, credit/debit note
   sample, reverse-entry sample, Activity Log Report sample, CBMS test-sync
   Standard View report, and (if cloud) the Annexure ७ agreement.
3. **Device/software change** (दफा ९): requires office approval before
   switching, prior data must be preserved and migrated into the new
   system, must re-sync to CBMS before issuing new bills on it.
4. **Closing/delisting** (दफा १०, Annexures ८/९): business-side closure via
   Annexure ८ request → office issues Annexure ९ closure permit. Separately,
   a producer can ask IRD to delist a software version (own request, no
   fixed annexure format specified for this one).

This maps to `docs/Srota_IRD_Compliance_Checklist.md`'s "Documentation to
have ready for the application itself" sections for both apps — that
checklist is the actionable version of this chapter; this doc is the legal
grounding for why each item is required.

---

## 9. Backups, hosting, and things still genuinely open

Carried forward from earlier session notes, not yet resolved:

- **Log archiving + DB backup to an external device** (दफा ६.१ग, ८च): no
  formalized process confirmed in this pass — needs an actual ops answer
  (what backs up the production Postgres, how often, where the backup
  physically lives, is it truly on a separate device from the primary
  server). This is an infra/ops task, not an app-code one.
- **Nepal server hosting + Annexure ७ tripartite agreement**: not
  confirmed — see §7 above.
- **Cancellation vs. genuine sales-return distinction** (दफा ६.२ज): **RMS
  resolved** — `cancel()` (draft-only, reverse entry) and
  `issue_credit_note()` (paid-only, sales return) are separately gated with
  distinct audit-log actions, see §3's ६.२ज row. IMS: not re-verified this
  pass — check `order_service`-equivalent in `ims/invoice_service.py` before
  assuming the same split exists there.
- **User Manual** (दफा ६.१ख) and **System Architecture document**
  (Annexure ३'s own checklist) for the actual IRD submission packet: not
  written yet — needed regardless of code state.

---

## Quick index — clause → code

| Clause | Where in code |
|---|---|
| ६.२ख/ग bill numbering + branch code | `api/utils/bikram_sambat.py::format_invoice_number`, `Branch.code`, `api/features/branches/service.py::derive_unique_code` |
| ६.२घ Order Slip (RMS) | `shared_models/restro_order_slip.py` (or equivalent), `restro/order_service.py::send_to_kitchen` |
| ६.२ङ Dynamic QR | `rms/src/lib/ird-qr.ts`, `rms/src/components/pos/IrdQrCode.tsx` (+ IMS equivalents) |
| ६.२च reprint watermark | RMS: `restro_orders.print_count`, `registerPrint()`. IMS: `is_reprint`/`reprint_of`/`reprint_number` |
| ६.३ख/ग audit log | `shared_models/audit_log.py`, `features/*/audit_repository.py`, both apps' Settings → Activity Log tab |
| ६.१छ/६.३क Standard View + VAT registers export (RMS) | `api/features/restro/router.py::export_restro_standard_view`, `export_restro_credit_notes`, `.../sales-register`, `.../annexure-13`, `.../monthly-vat-summary` (all `/reports/*/export`); `rms/src/lib/reports-api.ts::irdExportsApi`; `ReportsView.tsx`'s `IrdExportsCard` |
| ६.३घ immutability | `api/core/seed.py::_IMMUTABLE_TABLES` (IMS), `ensure_restro_immutability_trigger()` (RMS) |
| ६.४क CBMS integration | `api/features/cbms/`, `api/features/tax_settings/`, `shared_models/org_tax_settings.py`, `shared_models/cbms_sync_log.py` |
| Rs 10,000 abbreviated cap | `api/features/ims/invoice_service.py:274-285,536-549`, `api/features/restro/order_service.py:623-633` |
| HS code | `shared_models/restro_branch_settings.py::default_hs_code` |
| PAN vs VAT distinction | `shared_models/tenant.py::pan`, `is_vat_registered` |

---

## Related docs in this repo

- `docs/Srota_IRD_Compliance_Checklist.md` — actionable pre-submission audit
  checklist (checkboxes), plus the exact CBMS JSON request/response schema.
  Treat that file as the "what's left to do" list; this file as the "why,
  per the actual law" reference.
- Plan `velvet-rolling-hare.md` (if still active — check with the user) —
  the phased implementation plan closing the remaining CBMS/reports/RMS-parity
  gaps identified against the checklist above.
