# CLAUDE.md

## 2026-09-04 — IRD Compliance session (RMS + IMS)

Full compliance pass against **विद्युतीय बीजक सम्बन्धी कार्यविधि, २०८२** (Electronic
Billing Procedure 2082) for both `rms/` (restaurant POS) and `ims/`
(inventory/sales). Legal reference doc: `docs/compliance.md`. Actionable
checklist + CBMS JSON contract: `docs/Srota_IRD_Compliance_Checklist.md`.

### RMS — audited, fixed, confirmed code-complete

- Standard View + Credit Notes register exports built and UI-wired
  (`api/features/restro/router.py`'s `/reports/standard-view/export` and
  `/reports/credit-notes/export`, `ReportsView.tsx`'s "IRD Reports" card)
- PDF landscape/wide-table fix in `api/utils/reports_export.py`'s `build_pdf`
  (font-size scaling + header wrapping) — fixes any wide export, not RMS-only
- Void (draft) and Credit Note (paid) actions added to `OrdersView.tsx`'s
  Bills tab — backend endpoints existed, had no UI trigger before this
- Multi-user-per-role credentials: `RestroCredential` gained `name`/`email`/
  `phone`, dropped the one-credential-per-role-per-branch constraint;
  `entered_by_name`/`printed_by_name` now real display names, not usernames
- CBMS settings hidden entirely for PAN-only tenants (frontend tab/card +
  backend `NOT_VAT_REGISTERED` guard on `TaxSettingsService`), with a
  "this is voluntary unless IRD notified you" disclosure in `admin/`

### IMS — audited, fixed, confirmed code-complete

- Same multi-user-per-role credential redesign as RMS (`IMSCredential` +
  `name`/`email`/`phone`), plus `IMSInvoice.entered_by_name`/`printed_by_name`
  snapshot columns (IMS never had this — RMS already did)
- Standard View + Credit Notes register exports built (`api/features/ims/
  router.py`'s `/reports/standard-view/export`, `/reports/credit-notes/
  export`) — these did NOT exist before this session, unlike RMS; also
  Annexure 13 / Monthly VAT Summary / TDS backend endpoints existed already
  but had zero frontend routes — all 5 now have real pages under
  `ims/src/routes/_app.reports.*.tsx`
- HS Code (मानक — manual, optional, per-product): `IMSProduct.hs_code`,
  snapshotted onto `IMSInvoiceLine.hs_code` at sale time, product-form input,
  printed-bill column. IMS genuinely needed this (mixed retail categories);
  RMS's simpler branch-level default (`RestroBranchSettings.default_hs_code`)
  is a reasonable simplification for a narrower restaurant menu.
- Quotation void: `DELETE /ims/invoices/{id}/void-quotation` + a real DB
  trigger (`ims_invoices_delete_guard`, `api/core/seed.py`) that permits
  deleting `ims_invoices` ONLY when `kind='quotation'` — a real invoice is
  permanently undeletable, verified even against the superuser connection.
  IMS's restricted DB role had zero DELETE grant on that table before this;
  the grant now exists specifically because the trigger narrows it.
- Fixed: `IMSCredentialService.create/update` no longer mislabels every DB
  integrity error as `USERNAME_TAKEN` (now checks the actual constraint name)
- Fixed: stock-movement history and branch user-counts were resolving names
  against fake mock data (`app.users`, never wired to real credentials) —
  now resolve real names server-side (movements) / via a real fetch (settings)
- Confirmed already-working, not gaps: credit note issuance, quotation→
  invoice conversion — both fully wired end-to-end, found and verified
  during this pass after being initially (wrongly) suspected as missing

### Still open — external only, same for both apps

Nothing left in application code for either app. What remains needs an
answer from IRD, a written document, or an infra decision — not more code:
- Nepal server hosting confirmation + Annexure-७ tripartite agreement (if
  on a cloud/non-owned server)
- Exact CBMS base URL, payload date-format, whether a sandbox exists —
  `docs/Srota_IRD_Compliance_Checklist.md`'s own unresolved caveats
- Submission packet: User Manual, System Architecture document — not written
- Byte-exact verification of the printed bill / exports against IRD's actual
  Annexure-६ template images — built to the described column layout, never
  visually diffed against the source PDF's own template pages
- DB backup / log archiving (दफा ६.१ग, ८च) — explicitly deferred, not
  evaluated this session

### Working notes
- IRD source PDF: `c:\Users\HELIOS\Downloads\विद्युतीय बीजक सम्बन्धी कार्यविधि, २०८२_ab3ktjz.pdf`
- RMS: `rms/` · IMS: `ims/` · Backend: `api/` · Admin: `admin/`
- Do NOT rely on anything else in this file for project state — read the
  actual code, or `docs/compliance.md` for the clause-by-clause reference.
