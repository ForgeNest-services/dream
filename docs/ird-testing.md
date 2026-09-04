# IRD Compliance — Testing Guide

Primary law: **विद्युतीय बीजक सम्बन्धी कार्यविधि, २०८२** (Electronic Billing Procedure 2082).  
Effective: 2082/12/01. Re-listing deadline: 2083 Ashar end.  
Reference: `docs/compliance.md` (clause-by-clause), `docs/Srota_IRD_Compliance_Checklist.md` (CBMS contract).

This document is a hands-on test checklist. Each section maps to a specific IRD requirement and tells you exactly how to verify it in the running application. Work through it top to bottom before the IRD listing inspection.

---

## 1. Pre-conditions

Before running any test:

- At least one VAT-registered tenant with a real PAN (or a test PAN) is set up in the admin app.
- At least one PAN-only tenant is set up (for PAN-only bill template tests).
- Both RMS and IMS have at least one branch with products/menu items.
- The API container is running (`docker-compose ps` shows healthy).
- You have owner-level credentials for both apps.

---

## 2. Bill templates — visual comparison (Annexure 6)

**Source**: Annexure 6, pages 19–23 of the IRD PDF.  
**Method**: Print each bill type, hold it next to the corresponding Annexure 6 template page.

### 2.1 Full tax invoice — `1.क.अ` (VAT, taxable value ≥ Rs 10,000)

**How to trigger (RMS)**: Create an order whose taxable total is ≥ Rs 10,000 for a VAT-registered tenant. Mark as paid.  
**How to trigger (IMS)**: Create an invoice (kind = tax) with taxable amount ≥ Rs 10,000.

| # | What to check | Pass |
|---|---|---|
| 1 | Seller PAN/VAT number shown at top | ☐ |
| 2 | Bill number shown (format: `SERIES-BRANCH-FY-NNNNN`) | ☐ |
| 3 | Transaction date and bill issue date shown | ☐ |
| 4 | Buyer name + buyer PAN field present (can be blank for walk-in) | ☐ |
| 5 | Payment method shown (Cash / QR / Credit) | ☐ |
| 6 | Line-item table has columns: SN \| HS Code \| Description \| Qty \| Unit Price \| Total | ☐ |
| 7 | HS code populated on every line (e.g. `2106.90`) | ☐ |
| 8 | Discount line shown if applicable | ☐ |
| 9 | Taxable amount line with VAT % | ☐ |
| 10 | VAT amount line | ☐ |
| 11 | Grand total line | ☐ |
| 12 | VAT refund line present for electronic payments (`विद्युतीय माध्यमबाट...`) | ☐ |
| 13 | QR code present and scannable (see §6) | ☐ |
| 14 | Issuer name + date + time at bottom | ☐ |

### 2.2 Abbreviated tax invoice — `1.क.ई` (VAT, taxable value < Rs 10,000)

**How to trigger**: Same as 2.1 but taxable total < Rs 10,000.

| # | What to check | Pass |
|---|---|---|
| 1 | Bill number, seller PAN, date shown | ☐ |
| 2 | VAT rate shown as a percentage (not a full breakdown) | ☐ |
| 3 | Line-item table has columns: SN \| HS Code \| Description \| Qty \| Unit Price \| Total | ☐ |
| 4 | HS code on every line | ☐ |
| 5 | Footer note: *"दश हजार रुपैयाँभन्दा बढी कर लाग्ने मूल्यको वस्तु वा सेवाको बिक्रीमा यो बीजक जारी गरिने छैन"* | ☐ |
| 6 | QR code present | ☐ |
| 7 | No full VAT breakdown (just rate + total) | ☐ |

### 2.3 PAN-only invoice — `1.ख.अ`

**How to trigger**: Use a PAN-only tenant (not VAT-registered). Issue any bill.

| # | What to check | Pass |
|---|---|---|
| 1 | Seller PAN shown (not VAT number) | ☐ |
| 2 | No VAT columns anywhere on the bill | ☐ |
| 3 | Line-item table has columns: SN \| HS Code \| Description \| Qty \| Unit Price \| Total | ☐ |
| 4 | HS code present on every line | ☐ |
| 5 | Payment method shown | ☐ |
| 6 | QR code present | ☐ |
| 7 | IRD / CBMS tab hidden in Settings for this tenant | ☐ |

### 2.4 Reprint — `"Copy of Original"` watermark (दफा ६.२च)

**How to trigger**: Print a paid bill a second time.

| # | What to check | Pass |
|---|---|---|
| 1 | First print: no watermark, print count = 1 | ☐ |
| 2 | Second print: `"Copy of Original"` clearly visible | ☐ |
| 3 | Print count increments on every reprint | ☐ |
| 4 | Reprint watermark visible in PDF export (not just thermal) | ☐ |

### 2.5 Credit note (बिक्री फिर्ता — दफा ६.२ज)

**How to trigger (RMS)**: On a paid order → Bills tab → Credit Note button.  
**How to trigger (IMS)**: Invoice detail page → Issue Credit Note.

| # | What to check | Pass |
|---|---|---|
| 1 | Credit note has its own sequential bill number | ☐ |
| 2 | Original bill number referenced on the credit note | ☐ |
| 3 | All amounts are negative / reversed | ☐ |
| 4 | Reason for return captured and printed | ☐ |
| 5 | Credit note appears in Credit Notes register (not in Sales Register) | ☐ |
| 6 | Original bill's `Is_bill_Active` becomes `No` in Standard View | ☐ |

### 2.6 Void / reverse entry (rriberverse इन्ट्री — दफा ६.२ज)

**How to trigger (RMS)**: On a draft (unpaid) order → void/cancel before payment.  
**How to trigger (IMS)**: Quotations page → void an open quotation.

| # | What to check | Pass |
|---|---|---|
| 1 | Only draft / quotation orders can be voided (paid orders blocked at UI + API) | ☐ |
| 2 | Voided order disappears from active list | ☐ |
| 3 | Audit log records the cancellation action | ☐ |

---

## 3. Standard View — Annexure 5 (दफा ६.१छ)

**Export path (RMS)**: Settings → IRD Reports → Standard View → Download XLSX or PDF.  
**Export path (IMS)**: Reports → Standard View → Download.

Open the XLSX export and verify:

### 3.1 Column headers (exact, in order)

| Column | Present | Data populated |
|---|---|---|
| Fiscal Year | ☐ | ☐ |
| Bill_no. | ☐ | ☐ |
| Customer_name | ☐ | ☐ |
| Customer PAN | ☐ | ☐ |
| Bill_Date | ☐ | ☐ |
| Amount (gross/subtotal) | ☐ | ☐ |
| Discount | ☐ | ☐ |
| Taxable_Amount | ☐ | ☐ |
| Tax_Amount (VAT) | ☐ | ☐ |
| Total_Amount | ☐ | ☐ |
| Sync with IRD | ☐ | ☐ |
| Is_Bill_Printed | ☐ | ☐ |
| Is_bill_Active | ☐ | ☐ |
| Printed_Time | ☐ | ☐ |
| Entered_By | ☐ | ☐ |
| Printed_by | ☐ | ☐ |
| Is_realtime | ☐ | ☐ |
| Payment_Method | ☐ | ☐ |
| VAT_Refund_Amount | ☐ | ☐ |
| Transaction Id | ☐ | ☐ |

### 3.2 Data accuracy spot checks

| # | Scenario | Expected value | Pass |
|---|---|---|---|
| 1 | Bill with credit note issued against it | `Is_bill_Active = No` | ☐ |
| 2 | Bill printed once | `Is_Bill_Printed = Yes`, `Printed_Time` populated | ☐ |
| 3 | Bill not yet printed | `Is_Bill_Printed = No`, `Printed_Time` blank | ☐ |
| 4 | CBMS-synced bill | `Sync with IRD = Yes` | ☐ |
| 5 | Unsynced bill | `Sync with IRD = No` | ☐ |
| 6 | Credit notes | Credit notes do NOT appear in Standard View (own register) | ☐ |

---

## 4. Sales Register — Annexure 6 page 24 (दफा ६.३क)

**Export path (RMS)**: Settings → IRD Reports → Sales Register → Download.  
**Export path (IMS)**: Reports → VAT sales register → Download.

### 4.1 Column headers (12 columns, in order)

| Column | Present |
|---|---|
| Date (BS) | ☐ |
| Bill No. | ☐ |
| Buyer | ☐ |
| Buyer PAN | ☐ |
| Total Amount (जम्मा बिक्री/निर्यात मूल्य) | ☐ |
| Taxable Value (स्थानीय करयोग्य बिक्री — मूल्य) | ☐ |
| VAT (स्थानीय करयोग्य बिक्री — कर) | ☐ |
| Tax-exempt Amount (कर छुटको बिक्री मूल्य) | ☐ |
| Export Value | ☐ |
| Export Country | ☐ |
| Export Customs No. | ☐ |
| Export Customs Date | ☐ |

### 4.2 Data checks

| # | Check | Pass |
|---|---|---|
| 1 | Credit notes absent from this report (they go to Credit Notes register) | ☐ |
| 2 | Export columns all show `—` for domestic transactions | ☐ |
| 3 | `Total Amount = Taxable Value + VAT + Tax-exempt Amount` for every row | ☐ |
| 4 | PDF renders in landscape (not portrait) — all 12 columns visible without truncation | ☐ |

---

## 5. Purchase Register — Annexure 6 page 24 (IMS only, दफा ६.३क)

**Export path (IMS)**: Reports → Purchase report → Download.

### 5.1 Column headers (12 columns, in order)

| Column | Present |
|---|---|
| Date (BS) | ☐ |
| Bill/Customs No. | ☐ |
| Supplier | ☐ |
| Supplier PAN | ☐ |
| Total Purchase (जम्मा खरिद मूल्य) | ☐ |
| Taxable Purchase Value (करयोग्य खरिद — मूल्य) | ☐ |
| VAT (करयोग्य खरिद — कर) | ☐ |
| Tax-exempt Purchase (कर छुट हुने खरिद मूल्य) | ☐ |
| Taxable Import Value | ☐ |
| Import VAT | ☐ |
| Capital Purchase/Import | ☐ |
| Capital VAT | ☐ |

### 5.2 Data checks

| # | Check | Pass |
|---|---|---|
| 1 | Import and Capital columns all `0` for domestic purchases | ☐ |
| 2 | PDF renders in landscape | ☐ |

---

## 6. QR code verification (दफा ६.२ङ)

**Method**: Print any paid bill. Scan the QR code with a phone camera or QR scanner app.

### 6.1 Offline scan (no CBMS link required)

The QR must be decodable offline and contain:

| Field | Expected value | Pass |
|---|---|---|
| Business PAN / VAT number | Matches the tenant's PAN | ☐ |
| Bill number | Matches the printed bill number | ☐ |
| Bill date | Matches the transaction date | ☐ |
| Buyer PAN | Present if buyer PAN was entered; blank/absent otherwise | ☐ |
| Total amount | Matches the bill total | ☐ |
| Tax amount (VAT) | Matches the VAT amount | ☐ |

### 6.2 What is NOT expected yet

- A verification URL — this only appears once the business is CBMS-registered and IRD has assigned a verification URL. Do not add a guessed URL.

---

## 7. CBMS payload inspection (दफा ६.४क)

IRD's CBMS API PDF documents test credentials for integration testing:
- `username`: `Test_CBMS` · `password`: `test@321` · `seller_pan`: `999999999`

Use these in the admin app's CBMS settings to test live submission without real business credentials. The confirmed endpoints are `POST https://cbapi.ird.gov.np/api/bill` and `/api/billreturn`.

**To verify payload structure without a live call**, pay an order and inspect via:

```
GET /api/restro/cbms/{branch_id}/orders/{order_id}/payload
```

Or check the sync log entry's stored payload in `cbms_sync_log.cbms_response_body` after a manual resync attempt.

| Field | Expected | Pass |
|---|---|---|
| `pan` / `vatNumber` | Seller's PAN | ☐ |
| `fiscalYear` | Format `"2081.082"` (dot-separated, confirmed) | ☐ |
| `billDate` / `date` | BS date of the bill | ☐ |
| `billNumber` | Full formatted bill number | ☐ |
| `billType` | `"tax"` / `"abbreviated"` / `"credit_note"` | ☐ |
| `buyerPan` | Buyer PAN if entered, else null/absent | ☐ |
| `totalAmount` | Grand total | ☐ |
| `taxableAmount` | Taxable portion | ☐ |
| `taxAmount` | VAT amount | ☐ |
| `paymentMethod` | `"cash"` / `"qr"` / `"credit"` | ☐ |

See `docs/Srota_IRD_Compliance_Checklist.md` for the full CBMS JSON contract and response code handling.

---

## 8. Bill numbering and branch code (दफा ६.२ख/ग)

| # | Check | Pass |
|---|---|---|
| 1 | Bill numbers start at 1 for each new fiscal year | ☐ |
| 2 | Bill numbers are sequential with no gaps (pay 5 bills → numbers 1, 2, 3, 4, 5) | ☐ |
| 3 | Bill number includes branch code: `SERIES-BRANCH-FY-NNNNN` format | ☐ |
| 4 | Two concurrent orders cannot get the same bill number (DB unique constraint) | ☐ |

---

## 9. Order slip — Hotel/Restaurant (दफा ६.२घ, RMS only)

| # | Check | Pass |
|---|---|---|
| 1 | Sending an order to the kitchen creates an order slip with a sequential slip number | ☐ |
| 2 | Slip number appears on the final paid bill | ☐ |
| 3 | Slip numbers are sequential per branch per fiscal year, never reused | ☐ |

---

## 10. Audit / activity log (दफा ६.३ख/ग)

**Check path**: Settings → Activity Log (owner/manager only).

| # | Action to perform | Log entry expected | Pass |
|---|---|---|---|
| 1 | Log in as any staff member | `login` entry with username, IP, timestamp | ☐ |
| 2 | Mark an order as paid | `mark_paid` entry with bill number | ☐ |
| 3 | Cancel a draft order | `cancel` entry | ☐ |
| 4 | Issue a credit note | `credit_note` entry with original bill reference | ☐ |
| 5 | Change a discount | `set_discount` entry | ☐ |
| 6 | Filter by entity type or action | Filter works correctly | ☐ |
| 7 | Try to delete or edit an audit log entry from the DB (restricted role) | Rejected — INSERT only | ☐ |

---

## 11. Immutability — DB-level enforcement (दफा ६.३घ)

Connect to the Postgres database **as the app's restricted role** (not superuser). Run:

```sql
-- Should be rejected for paid/cancelled orders (RMS)
UPDATE restro_orders SET total_amount = 0 WHERE status = 'paid';
DELETE FROM restro_orders WHERE status = 'paid';

-- Should be rejected for all real invoices (IMS)
UPDATE ims_invoices SET total_amount = 0;
DELETE FROM ims_invoices WHERE kind IN ('tax', 'abbreviated');

-- Should succeed — quotations are deletable (IMS)
DELETE FROM ims_invoices WHERE kind = 'quotation' LIMIT 1;
```

| # | Statement | Expected result | Pass |
|---|---|---|---|
| 1 | UPDATE paid restro_orders | Rejected by trigger | ☐ |
| 2 | DELETE paid restro_orders | Rejected by trigger | ☐ |
| 3 | UPDATE ims_invoices (real invoice) | Rejected by column grant | ☐ |
| 4 | DELETE ims_invoices (real invoice) | Rejected by DB trigger `ims_invoices_delete_guard` | ☐ |
| 5 | DELETE ims_invoices WHERE kind='quotation' | Succeeds | ☐ |

---

## 12. IRD sample packet — Annexure 3 requirement

The IRD listing application (Annexure 3) requires these sample documents to be submitted with the application. Producing them is the final integration test — if they all look correct, the application is ready for IRD inspection.

Produce and archive one of each:

| Document | From | Filename suggestion | Done |
|---|---|---|---|
| Original VAT bill (full tax invoice, ≥ Rs 10k) | RMS or IMS print | `sample-tax-invoice-original.pdf` | ☐ |
| Reprint of the same bill ("Copy of Original") | RMS or IMS reprint | `sample-tax-invoice-reprint.pdf` | ☐ |
| Abbreviated invoice (VAT, < Rs 10k) | RMS or IMS print | `sample-abbreviated-invoice.pdf` | ☐ |
| PAN-only invoice | PAN-only tenant | `sample-pan-invoice.pdf` | ☐ |
| Credit note with original invoice reference | RMS Bills tab or IMS invoice detail | `sample-credit-note.pdf` | ☐ |
| Void/reverse entry (cancelled draft) | RMS void or IMS void quotation | Screenshot of audit log entry | ☐ |
| Standard View report (XLSX) | IRD Reports → Standard View | `sample-standard-view.xlsx` | ☐ |
| Sales Register report (XLSX) | IRD Reports → Sales Register | `sample-sales-register.xlsx` | ☐ |
| Activity Log export (any period) | Settings → Activity Log | `sample-activity-log.xlsx` | ☐ |
| CBMS test-sync Standard View | After at least one successful CBMS sync | `sample-cbms-standard-view.xlsx` | ☐ |

The CBMS test-sync item can use the publicly documented test credentials (`Test_CBMS` / `test@321`) — see §7. Production credentials are needed only for verifying real business data flows end-to-end.

---

## 13. What still requires IRD to test

| Item | Blocked by |
|---|---|
| CBMS live submission against production (real response codes) | Need real `ird_username` + `ird_password` from IRD registration (test creds in §7 test submission logic only) |
| QR URL verification (online scan → IRD portal) | Business must be registered and live in IRD's system |
| Annexure 3 inspection by tax officer | IRD scheduling after application submission |

---

## Related docs

- `docs/compliance.md` — clause-by-clause legal reference
- `docs/Srota_IRD_Compliance_Checklist.md` — CBMS JSON contract + pre-submission checklist
- IRD PDF: `c:\Users\Nishant\Downloads\4c8d5c28-_______________________________________ab3ktjz.pdf`
