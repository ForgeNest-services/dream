# SaaS Platform Design — Subscriptions, Roles & Tenant Lifecycle

This document covers the **platform layer** — how the product is sold, billed, and administered as a SaaS business. It's separate from `hospitality-saas-database-design.md`, which covers the internal PMS schema (rooms, bookings, folios) that each tenant uses once they're signed up.

---

## 1. Overview

Two distinct groups of people interact with this system, and they must never be confused in the design:

- **Platform side (you / Forgenest)** — the vendor. Manages tenants, subscriptions, and platform health.
- **Tenant side (hotels)** — the customers. Each tenant is one hotel business, which may have multiple branches (properties) and multiple staff members with different roles.

Everything in this document is about the relationship between these two sides — signup, trial, payment, access control at the platform level, and what happens when a subscription lapses.

---

## 2. Tenant Lifecycle

```
  signup → trial (30 days) → [converts] → active (monthly/yearly)
                            ↘ [doesn't convert] → trial_expired (feature-gated)
  active → [renews on time] → active (extended)
  active → [misses renewal] → grace_period → suspended → [pays] → active
                                                          ↘ [never pays] → cancelled
```

| Status | Meaning | Access level |
|---|---|---|
| `trial` | First 30 days after signup | Full feature access |
| `trial_expired` | Trial ended, never converted | Core operations still work (bookings, check-in/out); reports export, invoice PDF download, VAT summary export disabled — see Feature Gating below |
| `active` | Paying (monthly or yearly) | Full access |
| `grace_period` | Payment due, short buffer window (recommend 3–5 days) before hard restriction | Full access, with a visible renewal reminder banner |
| `suspended` | Grace period passed, no payment | Same restrictions as `trial_expired` — data preserved, not deleted |
| `cancelled` | Tenant explicitly cancels | Read-only access to historical data for a defined retention window, then data export offered before deletion |

**Why data is never deleted on suspension:** this is deliberate leverage, discussed earlier — a hotel with three months of booking history, guest records, and invoices sitting in the system has a real reason to pay rather than switch providers and start from zero.

---

## 3. Subscription Plans & Pricing

| Plan | Price | Billing cycle | Notes |
|---|---|---|---|
| Trial | Free | 30 days, one-time per tenant | Full features, one trial per business (guard against re-signup abuse using PAN/VAT or phone number matching) |
| Monthly | NPR 2,999/month | Recurring monthly | No feature difference from Yearly — same product, different cycle |
| Yearly | NPR 11,999/year | Recurring yearly | Effectively ~33% cheaper than monthly × 12 — deliberately structured to push yearly commitments, which also matches local B2B norms better than monthly auto-billing |
| Branch add-on | Flat fee per additional branch/month (e.g. NPR 1,500) | Same cycle as base plan | Applies from the 2nd branch onward; 1st branch is included in the base plan price |

**No room-count tiers, no per-feature upsells** — every paying tenant gets every feature. Simplicity is the differentiator against IMS/eZee's quote-based, module-by-module pricing.

---

## 4. Feature Gating Rules

Applies to `trial_expired` and `suspended` states:

**Stays available** (so the hotel isn't forced to stop operating):
- Bookings, check-in/check-out, folio management
- Viewing existing data

**Disabled until payment:**
- Report exports (occupancy, revenue)
- Invoice PDF downloads
- VAT summary exports

This creates real pressure to convert without ever locking a hotel out of running their front desk mid-stay — that would be an unacceptable business risk for them and a support nightmare for you.

---

## 5. Roles & Access

### 5.1 Platform-side roles (Forgenest / you)
Not customer-facing — this is your own internal admin console.

| Role | Access |
|---|---|
| Platform Admin | Full access: all tenants, subscription overrides, billing records, impersonation/support access into any tenant for troubleshooting |
| Support Staff (future, once you're not the only person) | View tenant status, assist with onboarding, cannot modify billing or delete tenants |

Kept minimal deliberately — at your current scale, "Platform Admin" is just you. Design the role table now so adding a Support Staff role later doesn't require a schema change.

### 5.2 Tenant-side roles (hotel staff)
Hardcoded, portal-per-role, not a permissions engine — decided earlier and detailed fully in the database design doc. Repeated here because it's core to the platform's access model:

- **Owner** — spans all branches of their business, full access
- **Manager** — under Owner, branch-scoped, most day-to-day operations
- **Front Desk** — bookings, check-in/out, folio, payments
- **Accountant** — invoices, reports, VAT summaries; no booking/room edit access
- **Chef** *(future, ships with restaurant module)* — kitchen order display
- **Waiter** *(future, ships with restaurant module)* — mobile order-taking

Multiple staff can share a role. Same role, multiple branches, multiple people — this is a category label, not a unique seat.

---

## 6. Billing & Payment Handling (tenant → you)

Nepal's payment gateways don't support true auto-recurring billing (no Stripe-style silent auto-charge) — this was confirmed earlier when researching FonePay/eSewa/Khalti. Practical handling:

1. System generates an invoice/reminder a few days before the renewal date (monthly or yearly).
2. Tenant pays via QR (your own FonePay/eSewa/Khalti merchant account) or manual bank transfer.
3. Platform Admin (you, for now) or an automated webhook confirms payment and extends the tenant's `active` period.
4. If unpaid past the renewal date, tenant enters `grace_period`, then `suspended` per the lifecycle above.

This is manual-assisted, not fully automatic, at your current scale — automating the reminder emails/SMS is worth doing early since it's low-effort and removes the biggest manual workload as you scale past a handful of tenants.

---

## 7. Admin Console Requirements (your internal dashboard)

Minimum viable for MVP:
- List of all tenants: name, plan, status, trial/renewal dates, branch count
- Manual "mark as paid" action (for bank transfer / manual QR payments you confirm yourself)
- Ability to extend a trial or override a subscription status manually (for support/goodwill cases)
- Basic usage visibility: last login, number of active staff, number of bookings this month — useful both for support and for spotting which tenants are actually engaged vs. dormant

Not needed for MVP: usage analytics dashboards, cohort/churn reporting, automated dunning sequences — these are v2 admin-console improvements once you have enough tenants for them to matter.