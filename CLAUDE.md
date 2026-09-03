# CLAUDE.md

## 2026-09-03 — IRD Compliance session (RMS / Zestro)

Verified RMS against **विद्युतीय बीजक सम्बन्धी कार्यविधि, २०८२** (IRD Electronic Billing Procedure 2082).

### What was checked
- Annex-5 Standard View (20 mandatory DB fields) — all present on `restro_orders` model
- Dynamic QR code — already fully implemented (`IrdQrCode.tsx`, `ird-qr.ts`, wired in `ThermalPrint.tsx`)
- User Activity Log in DB — already built (`shared_models/audit_log.py`, `audit_repository.py`, `GET /restro/audit-log` endpoint)
- Audit Trail Report from frontend — was missing; added as "Activity Log" tab in `ReportsView.tsx`

### Changes made today

**`rms/src/lib/reports-export.ts`**
- Fixed `→` arrow in PDF range header — replaced with `to` (jsPDF built-in helvetica doesn't support Unicode U+2192, rendered as `!'`)

**`rms/src/routes/_app.reports.tsx`**
- Added `"activity"` to `ReportsSearch["tab"]` union type and `TABS` array

**`rms/src/components/pos/ReportsView.tsx`**
- Added `ActivityLogTab` component — filterable table of all audit log entries, Owner/Manager only, with entity type + action filters, text search, and pagination

**`rms/src/components/pos/SettingsView.tsx`**
- Fixed "Document / Entity" column: now shows `after_state.bill_code` (e.g. `RMS-FSP-83/84-00003`) instead of `Bill #3`. Falls back to `Bill #<number>` for older entries that predate the fix.

**`api/features/restro/order_service.py`**
- Added `"bill_code": order.bill_code` to `after_state` in `AuditRepository.write` for `mark_paid`, `cancel`, and `credit_note` actions so the activity log shows the full formatted code going forward.

### Still to verify (IRD PDF — partial, interrupted)
- Annex-5 Standard View report export (does the exported file include all 20 fields exactly as IRD requires?)
- HS code on printed bills — Annex-6 bill formats (both full and abbreviated) show an HS code column. RMS currently has no HS code on `restro_order_lines` or on the printed bill. Needs decision: add a branch-level default HS code (e.g. `2106.90` for food service) shown on the bill, or leave for later.
- Sales Register export format — cross-check `GET /reports/sales-register/export` columns against Annex-6 खण्ड-२ exact layout before real IRD submission.

### Working notes
- IRD PDF is at `c:\Users\Nishant\Downloads\4c8d5c28-_______________________________________ab3ktjz.pdf`
- RMS frontend: `d:\FORGENEST\dream\rms`
- Backend: `d:\FORGENEST\dream\api`
- Current git branch: `benchmark`
- Do NOT rely on anything else in this file for project state — read the actual code.
