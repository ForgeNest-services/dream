# CLAUDE.md — Dream Multi-App Hospitality SaaS

> **Read this file first.** It contains all architectural decisions, current build state, cleanup tasks, and forward plan. Reference `docs/mvp.md`, `docs/db.md`, `docs/diagram.md`, and `docs/auth.md` for deeper detail — but some of what's in those docs has been **superseded** by the decisions below. When they conflict, **this file wins.**

---

## 1. What This Project Is

Forgenest is building a **multi-app hospitality SaaS platform**. The core product is **Hotel PMS**. Over time, additional apps get layered on: **Restaurant POS, Gym Management, Inventory, Swimming Pool Management**, etc. All apps center on hospitality, but each app can also be used standalone by non-hotel businesses (e.g., a standalone restaurant using just POS).

**Business model:**
- 30-day free trial per app (each app trial is independent) — **planned, not yet enforced**
- Monthly NPR 2,999 / Yearly NPR 11,999 per app (Hotel PMS pricing)
- Bundle pricing planned (e.g., 15k/year for all apps)
- Nepal market: no true auto-recurring billing (FonePay/eSewa/Khalti) — payment is manually confirmed

**Tech stack:**
- Backend: FastAPI + SQLAlchemy + PostgreSQL + Redis (OTP cache) + Brevo (email)
- `admin/` frontend: **Next.js 16** (App Router, Turbopack) + TypeScript + Zustand + Axios + Sonner + react-icons
- `pms/` frontend: **Vite + TanStack Start + TanStack Router** + TypeScript + shadcn/ui (Radix) + Sonner + Bun (Lovable-generated, cleaned up)
- Auth: JWT (platform + app tiers), Google OAuth via `@react-oauth/google`
- Deploy: Docker Compose

---

## 2. Architecture — Final Decisions (LOCKED, don't relitigate)

### 2.1 Two-tier auth system

**Tier 1 — Platform auth (BUILT).**
- For: **Superadmin, Owner, Manager**
- Login: Google OAuth + email/password with OTP verification
- Deployed at: `app.dream.com`
- Frontend: `admin/` (Next.js)
- Backend: `api/features/auth/`

**Tier 2 — Per-app auth (BUILT for Hotel PMS).**
- For: staff of that specific app (Manager, Front Desk, App Owner)
- Login: username + password. **Username is globally unique** across all hotel_pms_credentials so login is a single lookup.
- Deployed at: each app's own subdomain (pms.dream.com, restro.dream.com, etc.)
- Frontend: **separate frontend project per app** (`pms/` is built)
- Backend: `api/features/hotel_pms/` (staff auth + credentials CRUD)
- JWT shape: `{tenant_id, role, cred_id, module: 'hotel_pms', exp}` — no `user_id` (distinguishes from platform tokens)
- TTL: 8 hours (~one work shift), no refresh

### 2.2 Frontend: separate projects per app on subdomains

```
admin/  → app.dream.com    (Owner/Manager/Superadmin dashboard)     ✓ built (Next.js)
pms/    → pms.dream.com    (Hotel PMS)                              ✓ built (Vite + TanStack, mock-data UI)
restro/ → restro.dream.com (Restaurant POS)                         not built
gym/    → gym.dream.com    (Gym Management)                         not built
```

- Each app is a **completely separate frontend project**. Different stacks are OK — pick what fits.
- Admin has "Open" buttons that link out to the app URL (no embedding, no SSO — staff log in fresh with their shared role credential).
- **Each app's root URL (`/`) IS the login page.** No `/login` path. After login, redirect to role-based dashboard route.

### 2.3 Backend: single `api/` codebase, feature slices per app

```
api/features/
├── auth/           # Platform auth (Owner/Manager/Superadmin)   ✓ built
├── apps/           # App catalog                                ✓ built
├── hotel_pms/      # Hotel PMS backend (staff auth built;
│                   # bookings/rooms/etc. NOT built yet)         ~ partial
├── restro/         # Restaurant POS (later)                     not built
└── gym/            # Gym Management (later)                     not built
```

All apps hit the same API, just different route prefixes. Each slice follows the same pattern: `router.py` / `service.py` / `repository.py` / `schemas.py`.

**No subscription slice.** Subscription/billing/trials will be built as a **separate independent system later**. Currently every registered tenant has full access to every app in the catalog. See §2.7.

### 2.4 Roles model — final

**Platform roles** (`users.role` column, only these three values):
- `superadmin` — Forgenest staff (stored in separate `platform_admins` table)
- `owner` — business owner who signed up. `is_owner=true`. Full access.
- `manager` — someone the Owner delegates platform-level management to (create staff credentials, view reports; not billing).

**App-level roles** (hardcoded per app in `features/<app>/roles.py`):
- **Hotel PMS**: `app_owner`, `manager`, `front_desk`
  - `housekeeper` deliberately **NOT** added yet — shared credential doesn't fit person-specific task tracking. Add when housekeeping features (per-person task boards) are built.
- **Restaurant POS** (future): `manager`, `waiter`, `chef`, `cashier`
- **Gym** (future): `manager`, `trainer`, `receptionist`

Each app defines its own role list. The role string is stored in that app's credentials table. **Never** cross-referenced across apps. Same word ("manager") can mean different things in different apps — permission logic is per-app.

**No `user_module_access` table.** That idea from `docs/auth.md` §1 is dead. Per-app credentials are shared per role (see 2.5).

### 2.5 Credentials model — one credential per role per tenant, shared

`hotel_pms_credentials` table (built):
```
id             UUID PK
tenant_id      FK → tenants (indexed)
role           string (validated against HotelPMSRole enum)
username       string, UNIQUE globally
password_hash  string (Argon2)
created_by     FK → users
created_at, updated_at
UNIQUE(tenant_id, role)   -- one cred per role per tenant
```

- **One credential per role per tenant.** All front desk staff at Sunset Hotel share the same "front_desk" username+password.
- **Multiple staff log in simultaneously** with the same cred — fine and intended.
- Owner creates/updates/resets credentials from `admin/`.
- **Password reset does NOT force-logout active sessions.** Existing 8h JWTs stay valid until expiry; new logins require new password. Don't disrupt mid-shift.
- **Username is globally unique** in the DB. Owner must pick unique usernames like `manager-sunset` (backend returns `USERNAME_TAKEN` if collision). This keeps login a single lookup — no need for workspace slug/tenant selector.

### 2.6 Session TTLs

- **Platform JWTs**: 30 min access, 7 days refresh
- **App staff JWTs**: 8 hours, no refresh (matches one shift)
- Same `JWT_SECRET`, different payload shape distinguishes them.

### 2.7 Subscription — DEFERRED

Every tenant currently gets access to every registered app. **No subscription check anywhere in the code.** When we're ready to charge:

- Design a fresh subscription/billing system (own tables, own service, own gate)
- Add a single dep like `require_module_access("hotel_pms")` in `core/deps.py`
- Attach it to the `hotel_pms` router (one line) — protects every route
- Same pattern for every future app

No existing app code needs to change to add subscription later. That's the point of the decoupling — subscription is a **filtering layer added on top**, not baked into auth or app slices.

### 2.8 Owner's cross-app monitoring

Owner never needs to log into `pms.dream.com` to see what's happening. Each app exposes a summary endpoint:

```
GET /hotel-pms/live-summary   → today's bookings, occupancy, revenue
GET /restro/live-summary      → today's orders, revenue, top items (future)
```

Admin dashboard calls these with the Owner's platform JWT. Backend is unified — no cross-service calls, just role-gated endpoints.

### 2.9 Business / Branch / Data model

- **1 user = 1 tenant = 1 business** (with 1 PAN). Multi-workspace per user deferred.
- **Business info** (name, PAN, address, phone, email) lives on `tenants` table — inherited by every app the tenant uses.
- **Branches** (physical locations, e.g. multiple hotels in a chain) belong to individual apps. Hotel PMS will have `hotel_pms_branches` table (not yet built).
  - Shared PAN from tenant. Branch-specific address, phone.
  - Auto-provision: on first `GET /branches` for a tenant, if empty → create one default branch from tenant name.
  - Multi-branch is opt-in: Owner adds more via a `+` in the branch dropdown. Owner-only.
- **Downstream** (rooms, bookings, folios, invoices) all belong to a `branch_id`.
- **Invoices** use `tenant.pan` (business) + `branch.address` (which location issued it).
- Uniqueness on `tenants`: `pan`, `business_email`, `business_phone` all UNIQUE (nullable — multiple NULLs allowed). Enforced in DB, normalization done in repo (PAN uppercase, email lowercase, phone trimmed). Collisions return specific error codes (`PAN_ALREADY_REGISTERED`, etc.). Transfer / lost-access requests handled manually via support until a superadmin UI exists.

---

## 3. What's Built Today

### 3.1 Backend (`api/`)

**Platform Auth (`features/auth/`) — COMPLETE**
- `POST /auth/register` — email/password + OTP flow. **Re-register allowed** on unverified accounts (updates password, sends fresh OTP). Verified accounts return `EMAIL_ALREADY_EXISTS`.
- `POST /auth/verify-otp` — 6-digit code, Redis-backed, 5-minute TTL
- `POST /auth/resend-verification-otp` — returns `otp_expires_in: 300`
- `POST /auth/login` — unified endpoint for platform_admin OR user. **Returns tenant object** if user has one (fixes UI state consistency).
- `POST /auth/google/callback` — verifies Google ID token (clock skew tolerance = 10s). Existing user → login + return tenant. **Unverified accounts get promoted to verified** since Google proved email ownership.
- `POST /auth/google/complete` — creates NEW user (no tenant), auto-verified, returns tokens. User then completes business setup via modal.
- `POST /auth/business-register` — creates tenant, links to user. Handles PAN/email/phone unique conflicts with specific error codes.
- `GET /auth/me` — full user + tenant details for hydration
- Error handling: `USER_NOT_FOUND` (404) / `INVALID_CREDENTIALS` (401) / `EMAIL_NOT_VERIFIED` (403) / `ACCOUNT_INACTIVE` (403) — all with clean toast messages

**Apps catalog (`features/apps/`) — COMPLETE**
- `App` model: `code`, `slug`, `name`, `tagline`, `description`, `icon`, `url`, `screenshots` (JSON), `features` (JSON), `display_order`, `is_active`, `is_public`
- `GET /apps` — list active + public apps (no auth required — public catalog endpoint)
- `GET /apps/{slug}` — single app detail (public)
- Seeded at startup: `hotel_pms` row via `_app_catalog()` in `core/seed.py`
- Future superadmin CRUD endpoints deferred — for now, add apps via `_app_catalog()` list

**Hotel PMS staff auth + credentials (`features/hotel_pms/`) — COMPLETE**
- Model: `HotelPMSCredential` (see 2.5)
- Roles enum: `HotelPMSRole.APP_OWNER | MANAGER | FRONT_DESK`
- Owner endpoints (platform JWT + `require_tenant_user`):
  - `GET /hotel-pms/credentials` — list creds (no password_hash returned)
  - `POST /hotel-pms/credentials` — create cred (409 if role already has one or username taken)
  - `PATCH /hotel-pms/credentials/{role}` — update username and/or password
  - `DELETE /hotel-pms/credentials/{role}` — remove
- Staff endpoint (public):
  - `POST /hotel-pms/auth/login` — `{username, password}` → `{token, role, tenant_id, expires_at}`. 8h JWT.
- Deps in `core/deps.py`:
  - `require_platform_user` — has valid platform JWT + is a user (not superadmin)
  - `require_tenant_user` — above + has tenant_id
  - `require_hotel_pms_staff(role?)` — decodes app JWT, optionally restricts to a specific role

**Hotel PMS features (bookings, rooms, folios, etc.) — NOT built.** All planned in §5.

**Seeding (`core/seed.py` + `main.py` lifespan)**
- `seed_superadmin()` — from `SUPERADMIN_EMAIL/PASSWORD` env
- `seed_apps()` — inserts `hotel_pms` row if missing (idempotent). Add more apps by appending to `_app_catalog()`.

### 3.2 Database tables (all in `public` schema)

| Table | Purpose | Notes |
|---|---|---|
| `platform_admins` | Superadmin accounts | Seeded from env |
| `tenants` | Business/hotel entities | `pan`/`business_email`/`business_phone` UNIQUE (nullable) |
| `users` | Platform-level users (Owner + eventual Manager) | `role`: superadmin/owner/manager |
| `apps` | App catalog | Seeded: `hotel_pms` |
| `hotel_pms_credentials` | Per-role staff logins | UNIQUE(tenant_id, role); UNIQUE(username) global |

Deleted (never used): `modules`, `module_subscriptions` — subscription is a separate future system.

### 3.3 Frontend (`admin/`) — Next.js

- **Split-layout login/register page** — dark navy gradient sidebar + form
- **Google OAuth** — GoogleLogin component with `text="continue_with"`, `shape="pill"`
- **Email/password register** → OTP verification with:
  - `input-otp` library — 6-slot boxes with blinking caret and active-slot highlight
  - Countdown timer: "Code expires in 4:32" (turns red near expiry, then "Code expired")
  - Resend cooldown separate from expiry (30s)
  - Manual "Verify & Continue" click (no auto-submit on paste)
- **Business setup as non-dismissible modal** on `/dashboard` when `!tenant` — no page redirect, no ESC/click-outside/close button. `/business-register` route redirects to `/dashboard`.
- **Apps grid** on dashboard from `GET /api/apps` — tiles with icon, name, description, **Manage** + **Open** buttons
- **App detail page** at `/dashboard/apps/[slug]` (dynamic route)
  - Fetches `GET /api/apps/{slug}`
  - Shows app header + credentials management section
  - Credentials: list per role, create/edit/delete modals per role (App Owner, Manager, Front Desk)
  - `APP_CODE_TO_API_PREFIX` map in `types/apps.ts` — adding a new app = one line
- **Sidebar** with user avatar (Google picture or initials), name, role
- **Toasts (Sonner)** for all user-facing messages — no inline error boxes on forms
- **Route guards**: `/dashboard/*` requires auth
- **Login/OTP/Google responses set `tenant`** in Zustand store — dialog state stays consistent across sessions (bug fix)
- Design tokens: `#E8EDF2` bg, `#0A2947` primary (with 50-800 scale), 24px pill border-radius, Playfair Display headings
- Zustand auth store with `persist` middleware; hydrates via `GET /auth/me` on load; `logout` clears tenant + tokens

### 3.4 Frontend (`pms/`) — Vite + TanStack Start

Built with Lovable, then cleaned up (Lovable tracking removed, config rewritten). Deployed on port 3002 via Docker.

- Stack: **Vite 8 + TanStack Start (SSR) + TanStack Router + React 19 + Tailwind v4 + shadcn/ui + Bun + Sonner + TanStack Query**
- **Real login form** at `/` — username + password, calls `POST /hotel-pms/auth/login`, stores JWT in localStorage
- Post-login auth check in `_app.tsx` — redirects to `/` if not authed, waits for hydration
- **Role-based navigation** in sidebar — filtered by role (App Owner sees all, Manager sees ops+finance, Front Desk sees ops)
- **"View as" preview dropdown** — only visible for `app_owner`. Preview banner at top when previewing another role: "Previewing as Manager — you still have Owner permissions." Backend authorization always uses real role from JWT — preview is UI-only.
- **Real username + role badge** in header
- **Property switcher + currency switcher** — still mock data (marked `TODO(branches)`, will wire when branches slice is built)
- **All operational pages** (dashboard, bookings, rooms, housekeeping, guests, folio, invoices, payments, staff, settings) — **UI scaffolding only, mock data.** Real backend wiring is the main upcoming work.
- `_app.staff.tsx` still exists with a legacy shim (will be deleted since staff management lives in admin, not pms).
- Toaster wired in `__root.tsx` (top-right, richColors, closeButton)
- API base URL: `VITE_API_URL` env var, falls back to `http://localhost:8000/api`

### 3.5 Environment

`.env` at project root:
- `DATABASE_URL`, `POSTGRES_*`, `REDIS_*`
- `JWT_SECRET`, `JWT_ALGORITHM=HS256`, `ACCESS_TOKEN_EXPIRE_MINUTES=30`, `REFRESH_TOKEN_EXPIRE_DAYS=7`
- `SUPERADMIN_EMAIL=nishantchy1234@gmail.com`, `SUPERADMIN_PASSWORD=nishant2`
- `GOOGLE_CLIENT_ID=457510785422-qsjus5rhihc7597i8hrfe8v81jtsam03.apps.googleusercontent.com`
- `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback`
- `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `BREVO_FROM_NAME` (OTP + transactional emails)
- `NEXT_PUBLIC_API_URL=http://localhost:8000/api`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID=<same as GOOGLE_CLIENT_ID>`

**No `HOTEL_PMS_URL` or per-app env vars.** App URLs live in DB (`apps.url`) — superadmin can update via SQL/API.

Google Cloud Console:
- Authorized JavaScript origins: `http://localhost:3001`, `http://localhost:3002`
- Authorized redirect URIs: `http://localhost:8000/auth/google/callback`

Docker services (`docker-compose.yml`):
- `api` (8000) — has `/etc/localtime:/etc/localtime:ro` mount to prevent Google-OAuth clock skew
- `admin` (3001) — Next.js production build with `NEXT_PUBLIC_*` build args
- `pms` (3002) — Bun + Vite dev server with hot-reload (via source volume mounts)
- `postgres` (5432), `redis` (6379), `worker`, `ui` (3000)

---

## 4. Recent Fixes / Gotchas

- **Google OAuth `Token used too early`** → fixed via `clock_skew_in_seconds=10` in `verify_google_token` + `/etc/localtime` volume mount on api container
- **OTP TTL bumped 60s → 300s** — 60 was too aggressive (users get email 20–30s late). Backend returns `otp_expires_in` so frontend shows a live "Code expires in X:XX" timer
- **Re-register allowed while unverified** — user who abandoned OTP can register again with same email; password updates, fresh OTP sent
- **Google promotes unverified accounts** — if a manual signup abandoned before OTP, "Continue with Google" with same email now marks them verified and logs them in (Google proved email ownership)
- **BusinessSetupDialog false-trigger bug** — was showing on every login for existing tenants. Fixed by including `tenant` object in login/OTP/google responses and calling `setTenant()` in all login flows.
- **`axios-client.ts` skips auth-endpoint 401s** — no more page-refresh on wrong password (fixed earlier)
- **Sonner replaces all inline error boxes** — consistent UX
- **Frontend hooks return `{ok, ...}` result objects** — no more mixed void/boolean/exception patterns
- **PAN/business_email/business_phone unique** — DB constraints + normalization + specific `PAN_ALREADY_REGISTERED` / `BUSINESS_EMAIL_ALREADY_REGISTERED` / `BUSINESS_PHONE_ALREADY_REGISTERED` error codes with dedicated toasts

---

## 5. Plan Going Forward — Hotel PMS Features

Everything below is inside `api/features/hotel_pms/` (backend) and `pms/` (frontend). Standard slice pattern for backend: `<entity>/router.py + service.py + repository.py + schemas.py`.

**Universal rules (from `docs/db.md` and prior decisions):**
- Every endpoint filters by `tenant_id` from JWT — never trust request body
- Repository methods take `tenant_id` explicitly (defense in depth against multi-tenant bugs)
- Owner endpoints: platform JWT via `require_tenant_user`
- Staff endpoints: app JWT via `require_hotel_pms_staff(role?)`
- Snapshot rates on bookings (never live-lookup at report time)
- Line items soft-void (never delete) — audit trail
- Invoices append-only (DB grant: INSERT+SELECT only)

### Phase 1: Branches (foundation)

**Why first:** every other entity needs `branch_id`. Also, PMS header switcher currently uses mock properties.

- Backend: `features/hotel_pms/branches/`
- Model `HotelPMSBranch`: `id`, `tenant_id`, `name`, `address`, `city`, `phone`, `is_active`, timestamps. **No `pan`** — inherited from tenant.
- Endpoints (auth: `require_tenant_user`):
  - `GET /hotel-pms/branches` — list for tenant. **Auto-provision:** if empty, insert one default branch using tenant's name.
  - `POST /hotel-pms/branches` — create (Owner only via role check)
  - `PATCH /hotel-pms/branches/{id}` — update
  - `DELETE /hotel-pms/branches/{id}` — soft-delete via `is_active=false`
- Frontend (`pms/`):
  - `useBranches()` hook replaces mock `PROPERTIES`
  - Header dropdown becomes real, with `+ Add branch` (Owner only) opening a modal
  - Delete mock data from `app-state.tsx`

**Size: 0.5d**

### Phase 2: Room Types

- Backend: `features/hotel_pms/room_types/`
- Model: `id`, `branch_id`, `name`, `base_rate` (NUMERIC(10,2)), `max_occupancy`, `count` (informational), timestamps
- Endpoints: `GET/POST/PATCH/DELETE /hotel-pms/branches/{branch_id}/room-types`
- Frontend: settings screen — table with add/edit/delete
- Managed by App Owner or Manager

**Size: 0.5d**

### Phase 3: Rooms

- Backend: `features/hotel_pms/rooms/`
- Model: `id`, `branch_id`, `room_type_id`, `room_number`, `floor`, `status` (available/occupied/cleaning/maintenance), `is_active`, UNIQUE(`branch_id`, `room_number`)
- Endpoints: `GET/POST/PATCH /hotel-pms/branches/{branch_id}/rooms`
- Frontend: rooms grid (already scaffolded from Lovable), status color coding, bulk-add helper

**Size: 0.5d**

### Phase 4: Guests

- Backend: `features/hotel_pms/guests/`
- Model: `id`, `tenant_id` (guest is a person; may visit multiple branches), `full_name`, `phone`, `email`, `id_document_type`, `id_document_number`, `nationality`, timestamps
- Endpoints: standard CRUD + search by phone/name
- Frontend: guest directory + guest detail with stay history

**Size: 0.5d**

### Phase 5: Bookings + Check-in/out ⭐

**The core of the product.**

- Backend: `features/hotel_pms/bookings/`
- Model: `id`, `branch_id`, `room_id`, `guest_id`, `check_in_date`, `check_out_date`, `actual_check_in`, `actual_check_out`, `status` (reserved/checked_in/checked_out/cancelled/no_show), `rate_per_night` (**snapshot**, not live FK), `num_guests`, `created_by`, timestamps. CHECK: `check_out_date > check_in_date`.
- Endpoints:
  - `POST /hotel-pms/bookings` — create with overlap check (a room can't have two active bookings whose dates overlap)
  - `GET /hotel-pms/bookings?branch_id&from&to&status` — filter/paginate
  - `PATCH /hotel-pms/bookings/{id}` — edit
  - `POST /hotel-pms/bookings/{id}/check-in` — sets actual_check_in, status=checked_in, room.status=occupied
  - `POST /hotel-pms/bookings/{id}/check-out` — sets actual_check_out, status=checked_out, room.status=cleaning, triggers folio close
  - `POST /hotel-pms/bookings/{id}/cancel`
- Frontend: calendar view + list view (both scaffolded), "New booking" modal, check-in/out buttons

**Size: 2–3d**

### Phase 6: Folios & Line Items

- Backend: `features/hotel_pms/folios/`
- Folio: `id`, `booking_id`, `status` (open/closed/paid), `subtotal`, `vat_amount`, `total_amount`, timestamps
- Line items: `id`, `folio_id`, `description`, `quantity`, `unit_price`, `amount`, `is_voided`, `voided_reason`, `created_at`
- **Folio auto-created when booking is created.** Room-charge line items auto-added on check-in (one per night).
- Endpoints:
  - `GET /hotel-pms/folios/{id}` — with line items
  - `POST /hotel-pms/folios/{id}/line-items` — add extra (breakfast, laundry, etc.)
  - `POST /hotel-pms/folios/{id}/line-items/{item_id}/void` — soft-void with reason
  - `POST /hotel-pms/folios/{id}/close`
- Frontend: folio page (scaffolded), add-charge modal, void confirmation

**Size: 1–2d**

### Phase 7: Invoices

- Backend: `features/hotel_pms/invoices/`
- Model: `id`, `folio_id`, `tenant_id`, `branch_id`, `invoice_number`, `fiscal_year` (Bikram Sambat, e.g. "2081-82"), `vat_breakdown` (JSON), `total_amount`, `generated_at`, `is_reprint`, `reprint_of` (self FK), `cbms_synced` (placeholder). UNIQUE(`branch_id`, `invoice_number`).
- **DB-level append-only**: application DB role gets INSERT+SELECT grants only (REVOKE UPDATE, DELETE) — enforced at Postgres, not just app code
- Endpoints:
  - `POST /hotel-pms/folios/{id}/generate-invoice` — from closed folio
  - `GET /hotel-pms/invoices/{id}` — with tenant.pan (business) + branch.address (issued from) for header
  - `GET /hotel-pms/invoices/{id}/pdf` — PDF download
  - `POST /hotel-pms/invoices/{id}/reprint` — new row with `reprint_of` pointing to original, labeled "Copy of Original — 2"
- Frontend: invoices list (scaffolded), PDF download, reprint flow

**Size: 2d** (Bikram Sambat + PDF are the tricky parts)

### Phase 8: Payments

- Backend: `features/hotel_pms/payments/`
- Two modes:
  - **Automated**: FonePay/eSewa/Khalti API with webhook confirmation. Deferred — start with manual.
  - **Manual**: staff marks paid after seeing cash/QR/bank transfer. **Ship this first.**
- Merchant credentials table: `hotel_pms_merchant_creds` — `provider`, `mode`, `merchant_id`+`secret_key_encrypted` OR `qr_image_url`, CHECK constraint enforces mode-appropriate fields
- Endpoints:
  - `POST /hotel-pms/folios/{id}/payments` — record a payment
  - `POST /hotel-pms/payments/{id}/mark-paid` — manual confirmation
  - `POST /hotel-pms/payments/webhook/{provider}` — automated (future)
- Frontend: payment modal (scaffolded), settings page for merchant creds

**Size: 1d for manual mode; +2–3d each for FonePay/eSewa/Khalti integrations later**

### Phase 9: Audit Log

- Shared model `audit_log`: `id`, `tenant_id`, `entity_type`, `entity_id`, `action` (create/update/void/cancel), `performed_by`, `before_state` (JSON), `after_state` (JSON), `reason`, `created_at`
- **DB grants: INSERT + SELECT only** (like invoices)
- Wired into every mutating endpoint in Phases 5–8 as you build them (folio voids, booking edits, invoice reprints, payment confirmations)
- Frontend: audit trail page (Owner only) with entity filter

**Size: 1d for infrastructure + small overhead per mutating endpoint**

### Phase 10: Reports

- Backend: `features/hotel_pms/reports/`
- Endpoints:
  - `GET /hotel-pms/reports/daily-revenue?date=X&branch_id=Y`
  - `GET /hotel-pms/reports/occupancy?from=X&to=Y&branch_id=Z`
  - `GET /hotel-pms/reports/vat-summary?fiscal_year=2081-82`
- Frontend: reports page (scaffolded), export CSV/PDF
- **Will be gated by subscription** once that system exists (per `mvp.md` §4, exports disabled on `trial_expired`/`suspended`)

**Size: 1–2d**

### Phase 11: Owner cross-app monitoring

- Backend: `GET /hotel-pms/live-summary` — today's bookings, occupancy %, revenue (aggregate JSON)
- Frontend (`admin/`): new widget on `/dashboard` — "Hotel PMS today" card fetched with Owner's platform JWT
- Also useful in `admin` dashboard app tiles: show a small "3 bookings today" badge on the Hotel PMS tile

**Size: 0.5d**

### Recommended order + rough sizing

| # | Phase | Size | Why |
|---|---|---|---|
| 1 | Branches | 0.5d | Foundation |
| 2 | Room Types | 0.5d | Rooms need types |
| 3 | Rooms | 0.5d | Bookings need rooms |
| 4 | Guests | 0.5d | Bookings need guests |
| 5 | **Bookings + Check-in/out** | 2–3d | Product core |
| 6 | Folios | 1–2d | Bills roll off bookings |
| 7 | Invoices | 2d | Legal requirement |
| 8 | Payments (manual) | 1d | MVP-viable |
| 9 | Audit Log | 1d | Plumbing during 5–8 |
| 10 | Reports | 1–2d | Needs data |
| 11 | Owner monitoring | 0.5d | Ties admin to pms |
| — | Automated payments | later | Nepal gateway integrations |
| — | Subscription/billing | later | Separate independent system |
| — | Housekeeper role + task board | later | Needs person-specific model |
| — | Restaurant POS | later | Full new slice (staff auth + entities) |

---

## 6. Key Files Map

### Backend
```
api/main.py                                    App entry + lifespan (seed_superadmin, seed_apps)
api/core/database.py                           SQLAlchemy engine + Base
api/core/configs.py                            Env var settings
api/core/security.py                           JWT + hash + verify_google_token (clock_skew_in_seconds=10)
api/core/seed.py                               seed_superadmin, seed_apps, _app_catalog list
api/core/roles.py                              UserRole enum: SUPERADMIN, OWNER, MANAGER
api/core/deps.py                               require_platform_user, require_tenant_user, require_role,
                                               require_hotel_pms_staff, get_current_user
api/shared_models/tenant.py                    Tenant model — pan/email/phone UNIQUE nullable
api/shared_models/user.py                      User model (role, is_owner, picture_url)
api/shared_models/platform_admin.py            PlatformAdmin model
api/shared_models/app.py                       App catalog model
api/shared_models/hotel_pms_credential.py      HotelPMSCredential (UNIQUE username, UNIQUE tenant+role)

api/features/auth/router.py                    Platform auth endpoints
api/features/auth/service.py                   AuthService (register/login/google/business/OTP)
api/features/auth/repository.py                TenantRepository (with _normalize helper), UserRepository, PlatformAdminRepository
api/features/auth/schemas.py                   Pydantic request/response

api/features/apps/router.py                    GET /apps, GET /apps/{slug}
api/features/apps/service|repository|schemas  Apps catalog logic
api/features/apps/__init__.py

api/features/hotel_pms/roles.py                HotelPMSRole enum: APP_OWNER, MANAGER, FRONT_DESK
api/features/hotel_pms/router.py               Staff login + Owner credential CRUD
api/features/hotel_pms/service.py              HotelPMSCredentialService, HotelPMSAuthService
api/features/hotel_pms/repository.py           HotelPMSCredentialRepository
api/features/hotel_pms/auth.py                 App-JWT create/decode (module="hotel_pms", 8h TTL)
api/features/hotel_pms/schemas.py              Pydantic

api/utils/helpers.py                           success_response, error_response, format_validation_errors
api/utils/logger.py                            Logger
api/utils/otp.py                               generate_otp, store_otp (300s TTL default), verify_otp, get_otp_expiry
api/jobs/email_jobs.py                         Brevo OTP verification, team invitation emails
```

### Frontend admin (Next.js)
```
admin/src/app/layout.tsx                                    Root layout + AuthProvider + Sonner Toaster
admin/src/app/page.tsx                                      / route (login/register/OTP flow via AuthPage)
admin/src/app/dashboard/layout.tsx                          Sidebar layout + auth guard
admin/src/app/dashboard/page.tsx                            DashboardContent
admin/src/app/dashboard/apps/[slug]/page.tsx                Dynamic app detail (AppDetailContent)
admin/src/app/business-register/page.tsx                    Redirects to /dashboard (dialog handles it)

admin/src/components/auth/AuthProvider.tsx                  Wraps GoogleOAuthProvider + hydrates store
admin/src/components/auth/AuthPage.tsx                      Login/register/OTP switcher + expiry-plumbing
admin/src/components/auth/BusinessRegisterContent.tsx       (legacy, unused; safe to delete)
admin/src/components/auth/forms/LoginForm.tsx               Email login + Google (sets tenant from response)
admin/src/components/auth/forms/RegisterForm.tsx            Email register + Google (sets tenant)
admin/src/components/auth/forms/OtpVerificationForm.tsx     OtpInput + resend + expiry timer, manual submit
admin/src/components/auth/forms/BusinessRegisterForm.tsx    Business info form (used inside modal)

admin/src/components/dashboard/DashboardContent.tsx         Apps grid + BusinessSetupDialog trigger
admin/src/components/dashboard/AppsGrid.tsx                 Tiles from GET /apps
admin/src/components/dashboard/AppDetailContent.tsx         Single app page (header + CredentialsSection)
admin/src/components/dashboard/CredentialsSection.tsx       CRUD modals for role credentials
admin/src/components/dashboard/BusinessSetupDialog.tsx      Non-dismissible modal (renders BusinessRegisterForm)

admin/src/components/layout/Sidebar.tsx                     Nav with avatar
admin/src/components/ui/Button.tsx                          Primary/secondary/outline
admin/src/components/ui/FormInput.tsx                       Input with icon + password toggle
admin/src/components/ui/Avatar.tsx                          Image or initials
admin/src/components/ui/OtpInput.tsx                        Custom OTP slots (input-otp library)
admin/src/components/shared/Spinner.tsx                     Loading spinner

admin/src/hooks/useAuth.ts                                  Auth store selector
admin/src/hooks/useLogin.ts                                 Login → toasts + navigate
admin/src/hooks/useRegister.ts                              Register → returns {ok, otpExpiresIn}
admin/src/hooks/useVerifyOtp.ts                             OTP verify → toasts + navigate
admin/src/hooks/useResendOtp.ts                             Resend → returns {ok, expiresIn}
admin/src/hooks/useBusinessRegister.ts                      Business register (handles PAN/email/phone conflicts)
admin/src/hooks/useApps.ts                                  useApps() + useAppDetail(slug)
admin/src/hooks/useCredentials.ts                           Credentials CRUD hook (all-in-one)

admin/src/store/auth-store.ts                               Zustand store (user, tenant, tokens, hydrate, logout)
admin/src/services/auth-api.ts                              Auth endpoints client
admin/src/services/apps-api.ts                              Apps + credentials endpoints client

admin/src/lib/axios-client.ts                               Axios + 401 refresh (skips auth endpoints)
admin/src/lib/auth-storage.ts                               localStorage token helpers
admin/src/lib/design-tokens.ts                              colors/spacing/typography/radius
admin/src/lib/logger.ts                                     Frontend logger

admin/src/types/api.ts                                      Request/response types (login/register/OTP/google include tenant)
admin/src/types/auth.ts                                     User/Tenant/PlatformAdmin/AuthState/ApiError
admin/src/types/apps.ts                                     App, AppCredential, HOTEL_PMS_ROLES, APP_CODE_TO_API_PREFIX
```

### Frontend pms (Vite + TanStack Start)
```
pms/vite.config.ts                             Plain TanStack Start + tsconfig-paths + Tailwind v4 (no Lovable)
pms/src/router.tsx                             Router entry
pms/src/routes/__root.tsx                      Root shell + Toaster
pms/src/routes/index.tsx                       Login page (real, calls /hotel-pms/auth/login)
pms/src/routes/_app.tsx                        Auth guard for protected routes
pms/src/routes/_app.dashboard.tsx              Dashboard (mock)
pms/src/routes/_app.bookings.tsx               Bookings list (mock)
pms/src/routes/_app.rooms.tsx                  Rooms grid (mock)
pms/src/routes/_app.housekeeping.tsx           Housekeeping (mock)
pms/src/routes/_app.guests.tsx                 Guests (mock)
pms/src/routes/_app.folio.tsx                  Folio (mock)
pms/src/routes/_app.invoices.tsx               Invoices (mock)
pms/src/routes/_app.payments.tsx               Payments (mock)
pms/src/routes/_app.settings.tsx               Settings (mock)
pms/src/routes/_app.staff.tsx                  Staff mgmt — legacy shim, will delete

pms/src/components/app-layout.tsx              Sidebar + header + view-as dropdown for owners
pms/src/components/ui/*                        shadcn/ui components (Radix + Tailwind)

pms/src/lib/app-state.tsx                      AppProvider (auth + role + preview + property/currency)
pms/src/lib/auth-storage.ts                    localStorage helpers
pms/src/lib/api-client.ts                      Fetch wrapper (attaches Bearer token)
pms/src/lib/auth-api.ts                        authApi.login(username, password)
pms/src/lib/roles.ts                           RoleCode = 'app_owner'|'manager'|'front_desk' + labels
pms/src/lib/mock-data.ts                       Mock rooms/bookings/guests/etc — replace as backend arrives
```

### Config
```
docker-compose.yml       All services (api, admin, pms, postgres, redis, worker, ui)
                          — api has /etc/localtime mount to prevent OAuth clock skew
                          — pms is dev-mode with source volumes for hot reload
.env                     Root secrets (DATABASE_URL, JWT_SECRET, Google OAuth, Brevo, NEXT_PUBLIC_*)
admin/Dockerfile         Multi-stage Next.js production build
pms/Dockerfile           oven/bun:1-alpine + `bun run dev` (dev-mode)
api/Dockerfile           FastAPI + uvicorn
```

### Docs (background — this file supersedes conflicts)
```
docs/mvp.md         Business scope, tenant lifecycle, gating rules, pricing (subscription DEFERRED)
docs/db.md          Full Hotel PMS DB schema (properties→rooms→bookings→folios→invoices→payments)
                    NOTE: "properties" in docs = "branches" in our model
docs/diagram.md     ER diagram
docs/auth.md        Original auth plan (partially superseded — user_module_access NOT built,
                    per-app credentials tables instead)
```

---

## 7. Working Style / Conventions

- **Minimal changes.** Don't refactor unrelated code. Don't add features beyond what was asked.
- **No unnecessary comments.** Only WHY when non-obvious. Never explain WHAT.
- **No inline error boxes on forms.** Sonner toasts for all user-facing messages.
- **Terse responses.** State results directly. Don't recap.
- **Confirm before destructive actions.** Never `git reset --hard`, force push, or drop tables without explicit approval.
- **Never skip git hooks** (`--no-verify`) unless explicitly requested.
- **Follow existing slice pattern:** `router.py` / `service.py` / `repository.py` / `schemas.py`.
- **Repository methods always take `tenant_id` explicitly.** No silent cross-tenant queries.
- **Test UI in browser before claiming success.** Type-check and tests verify code correctness, not feature correctness.
- **Prefer editing over creating.** Don't spawn new files when an existing file fits.
- **Follow the design tokens.** Don't hardcode colors — use `colors.primary[800]` etc.
- **Hooks return `{ok, ...}` result objects** — not booleans or thrown exceptions for expected error paths.
- **Backend errors use specific error codes** (`INVALID_CREDENTIALS`, `PAN_ALREADY_REGISTERED`, `MODULE_NOT_ACCESSIBLE`, etc.) with matching HTTP status. Frontend switches on code to show the right toast.
- **Owner endpoints use `require_tenant_user` + role check.** Staff endpoints use `require_hotel_pms_staff`.
- **New apps register by**: adding a row to `_app_catalog()` in `core/seed.py` + one line in `APP_CODE_TO_API_PREFIX` (frontend) + one entry in `APP_CODE_TO_ROLES` (frontend). Superadmin CRUD UI is future work.

---

## 8. Recent Context Log

*User adds notes here about work done from other machines so future Claude sessions can pick up context.*

### 2026-07-29 — Initial handoff
Auth complete, apps catalog and hotel_pms staff auth built.

### 2026-08-04 — Big update session
Wired PMS frontend login end-to-end. Added: apps catalog, hotel_pms credentials, business setup as dialog on dashboard, `input-otp` component with expiry countdown + resend, non-dismissible business modal, PAN/email/phone unique constraints with specific error handling, Google OAuth clock skew tolerance, re-register while unverified, Google promotes unverified accounts, `/etc/localtime` volume for api container, tenant object plumbed through all login/OTP/google response paths. **Deleted** the `modules`/`module_subscriptions` tables + code entirely — subscription will be a separate independent future system.

Ready to start Phase 1 (Branches) next.

### (add new dated entries below as work progresses)

---

## 9. Quick Command Reference

```bash
# Rebuild single service after changes
docker-compose build admin && docker-compose up -d admin
docker-compose build api   && docker-compose up -d api
docker-compose build pms   && docker-compose up -d pms

# Full stack
docker-compose up -d

# Check running services
docker-compose ps

# Tail logs
docker-compose logs -f api
docker-compose logs -f admin
docker-compose logs -f pms

# Postgres shell
docker exec -it postgres psql -U postgres -d dream_app

# Common queries
docker exec postgres psql -U postgres -d dream_app -c "select id, name, pan from tenants;"
docker exec postgres psql -U postgres -d dream_app -c "select tenant_id, role, username from hotel_pms_credentials;"
docker exec postgres psql -U postgres -d dream_app -c "select code, name, url from apps;"

# Nuke test data (dev only!)
docker exec postgres psql -U postgres -d dream_app -c "delete from hotel_pms_credentials; delete from users where role != 'superadmin'; delete from tenants;"

# Verify container clocks match (Google OAuth debugging)
docker exec api date -u
date -u

# Verify running services
docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
```
