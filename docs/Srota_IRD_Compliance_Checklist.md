# Srota — IRD Compliance Checklist (IMS & RMS)

*Working checklist for testing IRD/CBMS compliance in Srota IMS and Srota RMS. Each app is a separate IRD submission/certification — checklists kept fully separate below so either team can work from its own list without cross-referencing the other.*

---

## How the pieces fit together (recap)

1. **Software certification** — done once per app, separately for IMS and separately for RMS. This is what makes it *legal* for that app to issue computer-generated VAT bills at all.
2. **Org-level tax settings** — one shared settings location (top-level admin, not per-app) where a business enters its PAN and IRD Taxpayer Portal username/password.
3. **Auto-sync** — a background job that fires per invoice, only for orgs that have entered credentials, reporting that invoice to CBMS in real time.

**Important:** once an app is IRD-verified, issuing VAT bills through it already works — full stop. Entering CBMS credentials in tax settings only switches on the *optional* auto-sync reporting layer on top of that. A business that never enters credentials can still bill VAT normally; their invoices just don't get reported to CBMS in real time.

---

## Why auto-sync runs as a background job, not inside the HTTP request

When an invoice is created (checkout in RMS, a sale in IMS), the request that creates the invoice should return immediately — it must not wait on a call to IRD's CBMS API. Instead, invoice creation should enqueue a job (RQ, since that's what you're already using) that:

- Picks up the invoice, builds the CBMS payload, and POSTs it to the bill/billreturn endpoint using that org's stored credentials
- Retries with backoff on failure (network issues, IRD downtime, credential errors) instead of failing the sale
- Logs the result (synced / pending / failed) against the invoice for a "sync status" view in settings

This matches how the one real vendor implementation we found (Tigg) actually works — invoices are created and printed immediately; sync happens after, asynchronously, with a manual "resync" option for anything that failed. RQ is the right tool for this: enqueue on invoice creation, worker processes it, failures go to a retry queue instead of blocking billing.

---

## Admin Settings — Tax Settings (shared, org-level, not per-app)

- [ ] Settings location: top-level org admin, not duplicated inside IMS or RMS separately
- [ ] Field: PAN (org's VAT registration number)
- [ ] Field: IRD Taxpayer Portal username
- [ ] Field: IRD Taxpayer Portal password — stored encrypted at rest, never logged, never returned in plaintext to the frontend after save
- [ ] Toggle: "Enable CBMS Auto-Sync" — off by default, only togglable once credentials are saved
- [ ] Consent text shown before saving credentials (they're handing over their actual tax portal login, not a scoped API key — say so plainly)
- [ ] Flow to update/rotate credentials if the org changes their IRD password (sync should fail loudly and flag "needs re-auth," not just silently stop)
- [ ] Sync status view: last synced timestamp, count pending, count failed, manual "resync" action per invoice or in bulk
- [ ] Shared by both apps: if an org uses both IMS and RMS, both read from this same org-level record — credentials entered once

---

## Srota IMS — Compliance Checklist

*IMS covers inventory + purchase + supplier + sales + POS, and issues VAT bills through its sales/POS module — full certification applies.*

### Invoice format / core billing requirements
- [ ] Sequential, unique invoice numbering (per fiscal year)
- [ ] Seller PAN/VAT number printed on every invoice
- [ ] Buyer PAN/VAT capture field on the invoice form
- [ ] Itemized VAT breakdown; supports multiple tax rates on a single invoice
- [ ] Simplified tax invoice format (संक्षिप्त कर बिजक) available alongside the full VAT invoice
- [ ] Credit note / sales return, referencing the original invoice number
- [ ] Invoices and credit notes are append-only — no silent edit/delete of a posted invoice (audit trail requirement)

### Reports IRD expects the software to generate
- [ ] Sales register
- [ ] Purchase register
- [ ] Annexure 13 (अनुसूची १३)
- [ ] मासिक (monthly) VAT summary return
- [ ] TDS report (relevant given IMS's purchase/supplier side)

### Documentation to prepare for the certification application
- [ ] Company PAN/VAT certificate
- [ ] Business registration certificate
- [ ] Tax clearance certificate
- [ ] Cover letter to IRD
- [ ] Full software/module documentation (inventory, purchase, supplier, sales, POS flows)
- [ ] Sample invoices, print and digital
- [ ] User manual
- [ ] System architecture document
- [ ] Guarantee/statement that invoice data cannot be altered or manipulated post-issue
- [ ] Data backup & recovery documentation
- [ ] CBMS API connection details for this app, ready to demonstrate

### CBMS integration (build once, applies when an org enables sync)
- [ ] `POST /api/bill` implemented for invoice posting
- [ ] `POST /api/billreturn` implemented for credit notes / sales returns
- [ ] Payload fields mapped correctly (seller/buyer PAN, fiscal year, invoice no/date, taxable sales, VAT, excise, HST, ESF, total sales, etc.)
- [ ] Response codes handled: 200 (success), 100 (auth mismatch), 101 (already exists / doesn't exist), 102 (processing exception), 103 (unknown error), 104 (invalid payload), 105 (bill doesn't exist — returns only)
- [ ] Runs as an RQ background job, not inline with the sale/checkout request
- [ ] Retry/backoff on failure; failed syncs surfaced in the sync status view, not silently dropped

### Testing phase notes (current status)
- [ ] Feature built and testable behind an internal flag — not yet exposed to real customer orgs
- [ ] Test using your own business PAN/credentials only (no confirmed IRD sandbox exists — see earlier research notes; treat this as testing against production)
- [ ] Gate the "Enable CBMS Auto-Sync" toggle so it can't be turned on for any org until IMS is actually certified

---

## Srota RMS — Compliance Checklist

*RMS bills restaurant/hospitality sales directly — certification applies, and this is the sector with the lower mandatory e-billing threshold (NPR 5 crore vs. 10 crore generally), so RMS customers are more likely to hit the mandatory-compliance line sooner than IMS customers.*

### Invoice format / core billing requirements
- [ ] Sequential, unique invoice numbering (per fiscal year)
- [ ] Seller PAN/VAT number printed on every invoice/bill
- [ ] Buyer PAN/VAT capture field (walk-in guests may not always provide one — confirm optional-vs-required with IRD)
- [ ] Itemized VAT breakdown; supports multiple tax rates on a single bill
- [ ] Simplified tax invoice format (संक्षिप्त कर बिजक) available alongside the full VAT invoice
- [ ] Credit note / void-and-reissue handling, referencing the original bill number
- [ ] Invoices and credit notes are append-only — no silent edit/delete of a posted bill

### Reports IRD expects the software to generate
- [ ] Sales register
- [ ] Purchase register (if RMS tracks any purchasing — otherwise confirm if this applies)
- [ ] Annexure 13 (अनुसूची १३)
- [ ] मासिक (monthly) VAT summary return
- [ ] TDS report, if applicable

### Documentation to prepare for the certification application
- [ ] Company PAN/VAT certificate
- [ ] Business registration certificate
- [ ] Tax clearance certificate
- [ ] Cover letter to IRD
- [ ] Full software/module documentation (order/table flow, billing, POS)
- [ ] Sample invoices, print and digital
- [ ] User manual
- [ ] System architecture document
- [ ] Guarantee/statement that invoice data cannot be altered or manipulated post-issue
- [ ] Data backup & recovery documentation
- [ ] CBMS API connection details for this app, ready to demonstrate

### CBMS integration (build once, applies when an org enables sync)
- [ ] `POST /api/bill` implemented for invoice posting
- [ ] `POST /api/billreturn` implemented for credit notes / sales returns
- [ ] Payload fields mapped correctly (seller/buyer PAN, fiscal year, invoice no/date, taxable sales, VAT, excise, HST, ESF, total sales, etc.)
- [ ] Response codes handled: 200, 100, 101, 102, 103, 104, 105
- [ ] Runs as an RQ background job, not inline with the checkout/bill-print request
- [ ] Retry/backoff on failure; failed syncs surfaced in the sync status view, not silently dropped

### Testing phase notes (current status)
- [ ] Feature built and testable behind an internal flag — not yet exposed to real customer orgs
- [ ] Test using your own business PAN/credentials only (no confirmed IRD sandbox exists)
- [ ] Gate the "Enable CBMS Auto-Sync" toggle so it can't be turned on for any org until RMS is actually certified

---

## Open items to confirm directly with IRD before either app goes live

- [ ] Whether IMS and RMS sharing backend/billing infrastructure affects the second app's review, or each submission is fully independent regardless
- [ ] Current certification fee and processing timeline (secondary sources only, not confirmed from an official IRD page)
- [ ] Whether buyer PAN is mandatory or optional on RMS bills for walk-in restaurant guests without a PAN
- [ ] Whether any sandbox/test credentials exist for CBMS, or testing genuinely has to happen against production with real (low-value) transactions
