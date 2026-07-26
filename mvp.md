# Hospitality SaaS — MVP Scope & System Foundation

## Part 1: MVP Feature Set

### 1. Core PMS (Property Management)
- Property/branch setup: rooms, room types, base rates (multi-branch supported from day one, see Part 2)
- Availability calendar (visual, day/week/month view)
- Booking creation: walk-in + advance booking, edit, cancel
- Check-in / check-out workflow
- Guest profile: name, contact, ID document, stay history (basic)
- Folio: itemized running bill per booking (room charge + any extras)

### 2. Billing & Compliance
- Invoice generation with VAT calculation
- Fiscal-year-based invoice numbering (Bikram Sambat aware)
- Immutable audit trail: every edit logs user, timestamp, reason — no hard deletes
- Invoice/report structure built **IRD-compliance-ready** (CBMS sync itself deferred — see Part 3)
- Basic reports: daily revenue, occupancy %, VAT summary export

### 3. Payments — dual mode, hotel's choice
Each hotel chooses per-branch how they want to collect guest payments:
- **Automated mode:** hotel enters real FonePay/eSewa/Khalti Merchant ID + Secret Key (encrypted at rest). System generates dynamic QR per folio, receives webhook confirmation, auto-marks folio paid.
- **Manual mode:** hotel uploads their own static QR image (whatever they already use). Staff shows this QR to the guest, then manually marks the folio as "paid" after confirming payment themselves. No API integration required — this is the on-ramp for hotels that don't have merchant API access yet, or don't want to deal with it initially.
- Cash/bank transfer: manual entry, always available regardless of mode above.

This dual-mode design matters: automated mode requires the hotel to already have bank merchant credentials, which many small properties won't have on day one. Manual mode removes that barrier to onboarding entirely while still giving you the QR-in-the-system UX.

### 4. Roles — hardcoded, not permission-based
Deliberately **not** building a configurable permissions system — hardcoded roles, each with its own portal/view. Simpler to build, simpler for hotel owners to understand and manage (no confusing permission matrices), and matches how hotel staff structures actually work.

- **Owner** — top-level, sees everything across all branches, full access
- **Manager** — under Owner, does most day-to-day operations, typically branch-scoped
- **Front Desk** — bookings, check-in/out, folio, payments
- **Accountant** — invoices, reports, VAT summaries — no booking/room edit access
- *(designed into the role enum now, portals built later as the restaurant module ships)* **Chef** — kitchen order display
- *(same)* **Waiter** — mobile-friendly order-taking interface

Multiple staff can hold the same role (e.g., 3 front desk staff at one branch) — role is a category, not a unique seat. Each branch can have its own Manager/Front Desk/Accountant; Owner sits above all branches and monitors everything.

### 5. Trial & Subscription Enforcement
- **30-day free trial**, full feature access during trial — this is deliberate: let them get genuinely dependent on the data (bookings, guest history, a month of invoices) before the trial ends.
- **Post-trial, pre-purchase:** core operational features (bookings, check-in/out, folio) stay usable so the hotel isn't forced to stop operating overnight, but **reports export, invoice PDF download, and VAT summary export are disabled** until they subscribe. This creates real pressure to convert — they can see their month of data sitting there, but can't pull it out or use it for compliance/accounting without paying.
- Monthly NPR 2,999 / Yearly NPR 11,999 — flat, no room-count tiers, no per-branch base price (branches are a separate add-on, see Part 2).

### 6. Your SaaS Management Layer (the Forgenest/product-owner side)
- Tenant onboarding & provisioning
- Plan tracking: trial (30-day) → monthly → yearly, plus branch add-on count
- Renewal reminders, trial-expiry handling, feature-gating logic (see #5)
- Internal admin dashboard: all tenants, plan status, branch count, basic usage visibility

### Explicitly OUT of MVP (build later, once customers ask)
- OTA channel manager (Booking.com/Agoda sync)
- Restaurant/bar POS module (Chef/Waiter roles are designed into the system now, but the actual kitchen/order module ships later)
- Full HR/payroll: attendance, leave, SSF/CIT, payslips — staff *accounts* (login + role + branch) are MVP; staff *HR management* is a separate future module
- Guest CRM / loyalty programs
- Native mobile app (responsive web is enough for v1 — waiter-facing order screens will need this responsiveness later, which is why "API-first" matters now)
- **Live CBMS sync** — build the data structures compliance-ready now, submit for actual IRD certification once the product is stable and used by real pilot hotels. Small hotels below the NPR 5 crore hospitality threshold can legally use the system pre-certification anyway.

---

## Part 2: System Architecture

### Guiding principles
1. **Multi-tenant, multi-branch from day one.** Hierarchy is `tenant (business) → properties (branches) → rooms`, not a flat "tenant = one property" model. Cheap to build correctly now; genuinely painful to retrofit once hotels have real multi-month data in a flat structure.
2. **Pluggable payment & compliance modules.** FonePay/eSewa/Khalti (both automated and manual-QR modes) today, CBMS later — all behind a common adapter interface, not hard-wired into core logic.
3. **Hardcoded roles, portal-per-role.** Not a permissions engine. Each role gets its own view/portal; adding a new role (Chef, Waiter) later means a new portal, not a rearchitecture.
4. **Audit-first data model.** Financial data is append-only. No `UPDATE`/`DELETE` on invoices or audit logs — corrections are new entries that reference what they correct.
5. **API-first.** Backend is a clean REST API; frontend consumes it. This is what makes the future Waiter mobile-friendly ordering screen a frontend addition, not a backend rewrite.

### Tech stack (deliberately reusing your existing patterns)
| Layer | Choice | Why |
|---|---|---|
| Backend | FastAPI + SQLAlchemy + PostgreSQL | Same as ATFlow OS / Finance OS — no new patterns to learn |
| Frontend | Next.js + TypeScript | Matches your TraderNepal dashboard work; responsive by default for future Waiter/mobile views |
| Auth | JWT + hardcoded role claims | Simple role check, not a permissions engine |
| Background jobs | Redis + APScheduler/Celery | Renewal reminders, trial-expiry checks, scheduled reports |
| PDF/invoice generation | Reuse ATFlow's PDF pipeline | Don't rebuild what already works |
| Deployment | Docker Compose + Ansible/Semaphore | Your existing DevOps pattern |
| Hosting | Nepal-based provider, from day one | CBMS certification will require this later — start there now to avoid a migration |

### Core data entities (high-level)

```
tenants          — id, business_name, PAN/VAT, subscription_plan, trial_expiry, status
properties       — id, tenant_id, name, address        [the "branch"]
users            — id, tenant_id, property_id (nullable for Owner), role, credentials
rooms            — id, property_id, room_number, type, base_rate
guests           — id, tenant_id, name, contact, id_document
bookings         — id, property_id, room_id, guest_id, check_in, check_out, status
folios           — id, booking_id, line_items[], status
invoices         — id, folio_id, invoice_number (fiscal-year), vat_breakdown, generated_at
                   [immutable — corrections are new linked records, never edits]
audit_log        — id, tenant_id, entity, action, user_id, timestamp, before, after
                   [append-only, enforced at DB permission level]
payments         — id, folio_id, mode (automated/manual/cash), provider, amount, status, provider_txn_id
merchant_creds   — id, property_id, provider, merchant_id, secret_key (encrypted), qr_image_url, mode
```

Note: `users.property_id` is nullable specifically because **Owner** spans all branches — every other role is scoped to one property.

### Module boundaries
- **Core PMS module** — bookings, rooms, folios, properties
- **Billing/Invoice module** — VAT calc, fiscal numbering, audit trail; exposes a clean interface for a future CBMS adapter
- **Payment module** — adapters per provider AND per mode (automated API vs manual QR-upload); adding a provider or mode means a new adapter, not touching core logic
- **Access module** — hardcoded role definitions, portal routing per role
- **Subscription module** — this is *you* billing *hotels* (trial/monthly/yearly/branch add-ons), entirely separate from hotel-billing-guests logic above
- **Reporting module** — reads from the other modules, writes nothing; export functions gated by subscription status (trial vs paid)

### Security & compliance foundations worth baking in now (cheap now, expensive to retrofit later)
- Encrypt merchant secret keys at rest, not just in transit
- Enforce append-only on `audit_log` and `invoices` at the database permission level, not just application logic
- Build fiscal-year (Bikram Sambat) aware invoice numbering from the very first invoice
- Host in Nepal from day one even though certification comes later
- Build the `tenant → property → room` hierarchy now even though MVP UI may only surface single-branch flows initially — this is the one decision that's truly expensive to reverse later