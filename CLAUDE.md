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
admin/  → app.dream.com    (Owner/Manager/Superadmin dashboard)     ✓ built (Next.js), redesigned 2026-08-08
pms/    → pms.dream.com    (Hotel PMS)                              ✓ backend-wired through Phase 5
restro/ → restro.dream.com (Zestro — Restaurant POS)                ✓ real login + branches + categories +
                                                                      menu items wired; rest still mock
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
├── branches/       # Shared tenant-level branches (all apps)    ✓ built
├── uploads/        # Generic S3/MinIO file upload                ✓ built
├── hotel_pms/      # Hotel PMS backend (staff auth + Phases
│                   # 1-5 built; folios/invoices/payments not)   ~ partial
├── restro/         # Zestro backend (staff auth + credentials +
│                   # categories + menu items built)             ~ partial
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
- **Zestro / Restaurant POS** (built): `owner`, `manager`, `waiter`, `chef` — note the tenant-wide role is named `owner` here, not `app_owner` like Hotel PMS. Different apps, different naming, by design (see below). `cashier` from the original plan was dropped — not in the actual frontend role set.
- **Gym** (future): `manager`, `trainer`, `receptionist`

Each app defines its own role list. The role string is stored in that app's credentials table. **Never** cross-referenced across apps. Same word ("manager") can mean different things in different apps — permission logic is per-app.

**No `user_module_access` table.** That idea from `docs/auth.md` §1 is dead. Per-app credentials are shared per role (see 2.5).

### 2.5 Credentials model — one credential per role per tenant, shared

`hotel_pms_credentials` / `restro_credentials` tables (both built, same shape):
```
id             UUID PK
tenant_id      FK → tenants (indexed)
branch_id      FK → branches, NULLABLE (indexed)
role           string (validated against the app's Role enum)
username       string, UNIQUE globally
password_hash  string (Argon2)
created_by     FK → users
created_at, updated_at
UNIQUE(tenant_id, branch_id, role)   -- one cred per role per branch per tenant
```

- **Branch-scoped by role, not uniformly.** The tenant-wide role (`app_owner` in Hotel PMS, `owner` in Zestro) has `branch_id = NULL` and can see/switch between every branch. All other roles (`manager`, `front_desk`, `waiter`, `chef`, and Hotel PMS's `manager` too) **require** a `branch_id` — a chain with 3 branches needs 3 separate Front Desk logins, one per branch. Enforced server-side in each app's `*CredentialService.create` (`BRANCH_SCOPED_ROLES` set).
  - This was a retrofit on Hotel PMS (originally tenant-wide only, branch_id added + backfilled nullable); Zestro was built branch-scoped from day one using the same pattern.
- **Multiple staff log in simultaneously** with the same cred — fine and intended.
- Owner creates/updates/resets credentials from `admin/`'s per-app detail page (`CredentialsSection.tsx`) — shows one row/slot per (role × branch) combination for branch-scoped roles.
- **Password reset does NOT force-logout active sessions.** Existing 8h JWTs stay valid until expiry; new logins require new password. Don't disrupt mid-shift.
- **Username is globally unique** in the DB. Owner must pick unique usernames like `manager-sunset` (backend returns `USERNAME_TAKEN` if collision). This keeps login a single lookup — no need for workspace slug/tenant selector.
- Staff JWT payload: `{tenant_id, role, cred_id, branch_id, module, exp}` — `module` distinguishes which app issued it (`"hotel_pms"` vs `"restro"`), so a Zestro token can never authenticate against a Hotel PMS endpoint or vice versa. `core/deps.py`'s `_make_staff_dep(decode_fn)` factory builds both apps' `require_<app>_staff` deps from one shared implementation, parameterized by each app's own `decode_staff_token`.

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
- **Branches are tenant-level, shared across all apps.** Single `branches` table (not per-app). A physical location — e.g. "Kathmandu HQ" — is entered once and used by every app the tenant runs there (Hotel PMS + Zestro + future apps). See `api/features/branches/` for the shared slice.
  - Shared PAN from tenant. Branch-specific address, phone.
  - Auto-provision: on first `GET /branches` for a tenant, if empty → create one default branch, inheriting name/address/phone from the tenant (the business itself is branch #1 — not a blank placeholder the Owner has to fill in).
  - Multi-branch is opt-in: Owner adds more via a `+` in the branch dropdown or the `/dashboard/branches` page in `admin/`. Owner-only for create/delete.
  - App-specific per-branch settings (e.g. VAT rate for POS) go in app-specific link tables like `restro_branch_settings (branch_id FK)` when needed; the base branch record stays shared.
- **Downstream** (rooms, bookings, folios, invoices, restro categories/menu items) all belong to a `branch_id`.
- **Invoices** use `tenant.pan` (business) + `branch.address` (which location issued it).
- Uniqueness on `tenants`: `pan`, `business_email`, `business_phone` all UNIQUE (nullable — multiple NULLs allowed). Enforced in DB, normalization done in repo (PAN uppercase, email lowercase, phone trimmed). Collisions return specific error codes (`PAN_ALREADY_REGISTERED`, etc.). Transfer / lost-access requests handled manually via support until a superadmin UI exists.

### 2.10 Tax registration — PAN vs VAT (tenant-level, editable)

- **One field on `tenants`, not per-app.** `tenants.is_vat_registered` (boolean, default `false`) — tax registration status is a fact about the *business*, not a per-app preference. A restaurant and a hotel run by the same legal entity can't disagree about whether they charge VAT.
- **Conditional on PAN, not independent.** The question only makes sense once a PAN exists. No PAN → `is_vat_registered` is forced `false` (enforced in `TenantRepository.update_tax_info` — clears the flag automatically if PAN is removed). PAN present → Owner picks "PAN only" (no VAT) or "VAT registered" (13% VAT) via a segmented control, defaulting to PAN-only.
- **Editable anytime** via `PATCH /auth/business-tax-info` (platform JWT, `require_tenant_user`) — businesses cross the VAT threshold or get deregistered; this is standard ERP practice (Tally, Zoho Books, QuickBooks all model it as one mutable org-level flag).
- **Snapshot at invoice time, not live-lookup.** When Hotel PMS Phase 7 (Invoices) is built, `vat_breakdown` gets computed from `tenant.is_vat_registered` *at the moment the invoice is generated* and stored on the invoice row — changing the tenant flag later must never alter historical invoices. Same snapshot principle as booking `rate_per_night`.
- Set during business registration (`BusinessRegisterForm`) and editable later from `admin/`'s Settings page (`/dashboard/settings`).

### 2.11 Object storage — MinIO now, S3-compatible for later

- **Self-hosted MinIO in dev**, speaks the real S3 API, so switching to AWS S3 later is just changing env vars (`S3_ENDPOINT`, credentials) — application code never changes. Wrapper lives in `api/core/storage.py` (`boto3` client).
- **`minio/minio` on Docker Hub is broken for pulls** (community edition Docker Hub images were discontinued Oct 2025 — maintainers moved to source-only / licensed AIStor). Using **`cgr.dev/chainguard/minio:latest`** instead — actively maintained, drop-in compatible. If this ever needs re-pulling and fails, don't waste time retrying `minio/minio` — go straight to the Chainguard image.
- Chainguard's image has **no shell utilities at all** (minimal by design) — no `curl`, no `wget`, no `mc`. The `minio` service in `docker-compose.yml` has **no healthcheck**; `api`'s `depends_on` uses `condition: service_started`, not `service_healthy`. MinIO itself starts in ~1s so this is a non-issue in practice.
- **One shared bucket (`dream-uploads`), not one per app/tenant.** Isolation is via key prefix: `{app}/{tenant_id}/{branch_id}/{category}/{uuid}-{filename}` (branch_id segment omitted for tenant-wide uploads like a business logo). New apps/entities need zero infra changes — just a new prefix segment. Bucket is public-read (set via policy in `ensure_bucket()`, called on every API startup — idempotent) so uploaded URLs are fetchable directly, no signing, no domain config needed. Revisit with presigned URLs if genuinely sensitive files (guest ID documents, invoices) need uploading later.
- **Generic upload endpoint**, not per-app: `POST /uploads` (`features/uploads/`) takes `app`, `category`, optional `branch_id` (form fields) + `file`, validated against the caller's *actual* tenant/branch from their JWT via `require_tenant_scope` (never trust client-supplied IDs beyond that check). 5MB limit, image MIME types only for now. Returns `{url}`.
- Env vars: `MINIO_ROOT_USER/PASSWORD`, `S3_ENDPOINT` (container-internal, `http://minio:9000`), `S3_PUBLIC_URL` (browser-facing, `http://localhost:9000` in dev), `S3_ACCESS_KEY/SECRET_KEY`, `S3_BUCKET`, `S3_REGION`.

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
- `POST /auth/business-register` — creates tenant, links to user. Handles PAN/email/phone unique conflicts with specific error codes. Now also accepts `is_vat_registered` (see §2.10).
- `PATCH /auth/business-tax-info` — update PAN and/or VAT registration status later (platform JWT, `require_tenant_user`).
- `GET /auth/me` — full user + tenant details for hydration (includes `is_vat_registered`)
- Error handling: `USER_NOT_FOUND` (404) / `INVALID_CREDENTIALS` (401) / `EMAIL_NOT_VERIFIED` (403) / `ACCOUNT_INACTIVE` (403) — all with clean toast messages
- **Team members (Owner → Manager invites):** `POST /auth/team-members` exists (create only — email invite queued via `job_queue`). **No list/update/remove endpoints yet.** The `admin/` Team Members page (`/dashboard/team`) currently runs on **dummy in-memory data** via `useTeamMembers()` — table UI (avatar/role/status/active-toggle/edit/delete via a portal-based dropdown menu) is fully built and intentionally structured to match the eventual real API shape, but nothing persists. Wiring the real backend is a separate future task.

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
  - `require_hotel_pms_staff(role?)` / `require_restro_staff(role?)` — both built on a shared `_make_staff_dep(decode_fn)` factory (same logic, each app supplies its own `decode_staff_token` so the module check stays a real per-app boundary, not just shared string comparison)
  - `require_tenant_scope` — accepts EITHER a platform JWT OR any app-staff JWT, normalizes to `{tenant_id, role, branch_id?, source: "platform"|"staff"}`. Used by `/branches` and `/uploads` — anything any authenticated tenant member should be able to hit.
  - **Bug fixed 2026-08-08:** `get_current_user` used to return `{"type": "user", "user": None}` when a token had no `user_id` claim (e.g. a staff token passed to a platform-only endpoint) instead of `None` — this caused a 500 crash (`'NoneType' object has no attribute 'tenant_id'`) instead of a clean 401 on every `require_role`-gated endpoint. Now returns `None` early if `user_id` is missing or the user lookup fails.

**Hotel PMS operational slices — BUILT through Phase 5** (branches / room types / rooms / guests / bookings; see §5 for the phase table).
- Backend: repo/service/router/schemas per entity, all under `api/features/hotel_pms/`, all endpoints filter by `tenant_id` from JWT, use `require_hotel_pms_staff` for staff endpoints (branch-scoped via `_assert_branch_scope`).
- Booking snapshots `rate_per_night` at create (never live-lookup). Overlap check on `(room_id, active_statuses)`. Transitions (`check_in`/`check_out`/`cancel`/`no_show`) enforce state-machine + room-status side effects.
- List endpoints are **paginated on the backend**: accept `q`, entity-specific filters, `page`, `per_page`; return `data` + `meta` via `success_response(data=..., meta=build_meta(...))` from `utils/paging.py`.

**Hotel PMS Phase 6+ (folios / invoices / payments / audit / reports / owner monitoring) — NOT built.** All planned in §5.

New shared model tables live in `shared_models/`: `PMSBranch`, `PMSRoomType`, `PMSRoom` (partial unique index on `(branch_id, room_number) WHERE is_active`), `PMSGuest`, `PMSBooking` (CHECK `check_out_date > check_in_date`, indexes on `(room_id, dates)` + `(tenant_id, status)`).

**Zestro / Restaurant POS backend (`features/restro/`) — staff auth + credentials + categories + menu items COMPLETE**
- Roles enum: `RestroRole.OWNER | MANAGER | WAITER | CHEF` (see §2.4 for the naming difference vs Hotel PMS's `app_owner`)
- `RestroCredential` model — same shape as `HotelPMSCredential` (§2.5), branch-scoped by role from day one
- `POST /restro/auth/login` — `{username, password}` → `{token, role, tenant_id, branch_id, expires_at}`. 8h JWT, `module: "restro"`.
- Owner endpoints (platform JWT): `GET/POST /restro/credentials`, `PATCH/DELETE /restro/credentials/{cred_id}` — same pattern as Hotel PMS's credential CRUD (keyed by `cred_id`, not role, since branch-scoping means multiple creds can share a role).
- **Categories** (`features/restro/category_repository.py` + `category_service.py`): `RestroCategory` — `id`, `tenant_id`, `branch_id`, `name`, `display_order`, `is_active`, timestamps. Partial unique `(branch_id, name) WHERE is_active`.
  - `GET/POST /restro/branches/{branch_id}/categories`, `PATCH/DELETE /restro/branches/{branch_id}/categories/{category_id}`.
  - **Auto-provisions 7 default categories** on first list call for a branch with none: Hot Beverages, Cold Beverages / Refreshers, Hookah, Fast Food, Momo, Thakali Set, Newari Khaja (matches the original Lovable mock data — a real, editable starting menu structure for a new tenant, not a demo placeholder). Owner/Manager can rename/delete/add freely after.
  - Soft-delete (`is_active=false`). `update`/`delete` explicitly check `is_active` before acting — a second delete on an already-deleted row returns `404`, not a silent `200` (repository's `get_by_id` doesn't filter on `is_active` by itself, so this check lives in the service layer).
- **Menu items** (`features/restro/menu_item_repository.py` + `menu_item_service.py`): `RestroMenuItem` + child table `RestroMenuItemVariant` (not a JSON column — queryable/pricable independently). Partial unique `(branch_id, name) WHERE is_active` on items.
  - `GET/POST /restro/branches/{branch_id}/menu-items` (list accepts `?category_id=`), `PATCH /restro/branches/{branch_id}/menu-items/{id}`, `PATCH .../menu-items/{id}/sold-out` (any staff role — floor decision, not menu-editing), `DELETE .../menu-items/{id}`.
  - **Server-side pricing validation**: `has_variants=false` → `price` required, no variants allowed. `has_variants=true` → `price` must be null, ≥1 variant required, every variant needs a name. `category_id` must belong to the same branch. Update does a **full variant replace**, not per-variant PATCH (matches the frontend editing the whole item as one unit).
  - Same soft-delete idempotency fix as categories.
- Menu hierarchy is **3 levels**: Category → MenuItem → Variant (e.g. category "Momo" → items "Steam Momo"/"Jhol Momo"/"C Momo" → each item's variants are the protein choice: Veg/Chicken/Buff/Pork). Not flattened to Category → Item.

**Generic uploads (`features/uploads/`) — COMPLETE.** See §2.11 for the storage architecture. `POST /uploads` is the only endpoint; consumed today by Zestro's menu item image picker.

**Seeding (`core/seed.py` + `main.py` lifespan)**
- `seed_superadmin()` — from `SUPERADMIN_EMAIL/PASSWORD` env
- `seed_apps()` — inserts `hotel_pms` row if missing (idempotent). Add more apps by appending to `_app_catalog()`.

### 3.2 Database tables (all in `public` schema)

| Table | Purpose | Notes |
|---|---|---|
| `platform_admins` | Superadmin accounts | Seeded from env |
| `tenants` | Business/hotel entities | `pan`/`business_email`/`business_phone` UNIQUE (nullable); `is_vat_registered` bool (§2.10) |
| `users` | Platform-level users (Owner + eventual Manager) | `role`: superadmin/owner/manager |
| `apps` | App catalog | Seeded: `hotel_pms`, `restro` |
| `hotel_pms_credentials` | Per-role staff logins (Hotel PMS) | UNIQUE(tenant_id, branch_id, role); UNIQUE(username) global; `branch_id` nullable (NULL = `app_owner`) |
| `restro_credentials` | Per-role staff logins (Zestro) | Same shape as above; `branch_id` NULL = `owner` role |
| `branches` | Physical business locations (shared across all apps) | Auto-provisioned on first `GET /branches`, inherits tenant name/address/phone |
| `pms_room_types` | Room type templates per branch | Partial unique `(branch_id, name) WHERE is_active` |
| `pms_rooms` | Individual rooms | Optional `rate_override`; partial unique `(branch_id, room_number) WHERE is_active` |
| `pms_guests` | Guests (tenant-scoped, not branch-scoped) | Searchable by phone/name/email/ID number |
| `pms_bookings` | Reservations | `rate_per_night` snapshot; CHECK dates; overlap-guarded |
| `restro_categories` | Menu categories per branch | Partial unique `(branch_id, name) WHERE is_active`; auto-provisions 7 defaults |
| `restro_menu_items` | Menu items per branch | Partial unique `(branch_id, name) WHERE is_active`; `price` nullable (null when `has_variants`) |
| `restro_menu_item_variants` | Variant child rows | FK → `restro_menu_items`, cascade delete via ORM relationship |

Deleted (never used): `modules`, `module_subscriptions` — subscription is a separate future system.

### 3.3 Frontend (`admin/`) — Next.js

- **Split-layout login/register page** — dark navy gradient sidebar + form
- **Google OAuth** — GoogleLogin component with `text="continue_with"`, `shape="pill"`
- **Email/password register** → OTP verification with:
  - `input-otp` library — 6-slot boxes with blinking caret and active-slot highlight
  - Countdown timer: "Code expires in 4:32" (turns red near expiry, then "Code expired")
  - Resend cooldown separate from expiry (30s)
  - Manual "Verify & Continue" click (no auto-submit on paste)
- **Business setup as non-dismissible modal** on `/dashboard` when `!tenant` — no page redirect, no ESC/click-outside/close button. `/business-register` route redirects to `/dashboard`. Form now includes the PAN/VAT segmented control (§2.10) — only appears once a PAN is typed, with a live summary line ("VAT-registered — invoices will show 13% VAT.").
- **Apps grid** on dashboard from `GET /api/apps` — redesigned cards: per-app identity color (deterministic hash of `app.code`, 4-color palette), code badge, tighter hierarchy. Also a dedicated `/dashboard/apps` index page (was previously only inline on `/dashboard`).
- **App detail page** at `/dashboard/apps/[slug]` (dynamic route)
  - Fetches `GET /api/apps/{slug}`
  - Shows app header + credentials management section (Branches section **removed** from here — moved to global `/dashboard/branches`, since branches are tenant-wide per §2.9, having them nested under one app's page was confusing)
  - Credentials: **one row/slot per (role × branch)** for branch-scoped roles (Manager/Front Desk/Waiter/Chef), single slot for the tenant-wide role (App Owner/Owner) — see §2.5. Branch selector shown in the create modal for scoped roles.
  - `APP_CODE_TO_API_PREFIX` + `APP_CODE_TO_ROLES` + `BRANCH_SCOPED_ROLES` in `types/apps.ts` — adding a new app = a few lines here
- **Global `/dashboard/branches` page** — full CRUD (create/edit/delete with confirm dialogs), replaces the old per-app-page branch section. Shared `useBranches()` hook (no `appCode` param anymore, hits `/branches` directly) — lifted to `AppDetailContent`'s parent so `BranchesContent` and `CredentialsSection` see the same data without a stale-cache bug (creating a branch used to not show up in the credentials branch-picker until reload; fixed by sharing one hook instance).
- **`/dashboard/team` — Team Members page.** Table (avatar/name/email/role/status/active-toggle/row-actions dropdown), invite modal, edit modal, delete confirm. **Backend not wired** — runs on dummy data via `useTeamMembers()`, structured to match the real API shape for an easy swap later (see §3.1's note on `/auth/team-members`).
- **`/dashboard/settings`** — tax registration editor (PAN + VAT segmented control, same UI as the business-setup form) via `useUpdateTaxInfo()`.
- **Full navigation/layout redesign (2026-08-08):** Topbar (avatar/name/role/logout, moved out of sidebar) + collapsible icon-rail Sidebar (persisted via localStorage, real `matchMedia`-based responsive breakpoint — not a one-time `window.innerWidth` read like before) + `SidebarContext` sharing collapse/mobile state between them. New nav items: Apps, Branches, Team (Settings/Admin Panel unchanged).
- **Typography**: Plus Jakarta Sans added as the UI workhorse face (`next/font/google`, var `--font-sans`) — replaces the plain system-sans fallback everywhere. Playfair Display stays for display headings only (was the Gilroy substitute — Gilroy isn't open-source/on Google Fonts).
- **Signature graphic**: `HospitalityMark` (inline SVG, key/door line-art motif) reused across the empty-apps dashboard state and the business setup dialog header.
- **Toasts (Sonner)** for all user-facing messages — no inline error boxes on forms
- **Route guards**: `/dashboard/*` requires auth
- **Login/OTP/Google responses set `tenant`** in Zustand store — dialog state stays consistent across sessions (bug fix)
- Design tokens: `#E8EDF2` bg, `#0A2947` primary (50-800 scale) + new `colors.accent` (warm orange, 50/200/500/700) for hospitality-flavored highlights, 24px pill border-radius, Playfair Display headings + Plus Jakarta Sans body/UI. New `layout` token (`sidebarWidth`, `sidebarCollapsedWidth`, `topbarHeight`).
- Zustand auth store with `persist` middleware; hydrates via `GET /auth/me` on load; `logout` clears tenant + tokens
- **Gotcha:** `Button` component applies its variant/size styles via a hardcoded `style={{...}}` prop, then spreads `...props` *after* it in JSX — so passing a caller-supplied `style` prop silently **overwrites** (not merges) all of Button's own styling. Never pass `style` to `Button`; wrap it in a sized `<div>` instead if you need width control.

### 3.4 Frontend (`pms/`) — Vite + TanStack Start

Built with Lovable, then cleaned up (Lovable tracking removed, config rewritten). Deployed on port 3002 via Docker.

- Stack: **Vite 8 + TanStack Start (SSR) + TanStack Router + React 19 + Tailwind v4 + shadcn/ui + Bun + Sonner + TanStack Query**
- **Real login form** at `/` — username + password, calls `POST /hotel-pms/auth/login`, stores JWT in localStorage
- Post-login auth check in `_app.tsx` — redirects to `/` if not authed, waits for hydration
- **Role-based navigation** in sidebar — filtered by role (App Owner sees all, Manager sees ops+finance, Front Desk sees ops)
- **"View as" preview dropdown** — only visible for `app_owner`. Preview banner at top when previewing another role: "Previewing as Manager — you still have Owner permissions." Backend authorization always uses real role from JWT — preview is UI-only.
- **Real username + role badge** in header
- **Property switcher** is real — driven by `useBranches()` / `branchesApi.listMine()`. `+ Add branch` opens a modal (Owner only). Currency switcher still local-only.
- **Backend-wired pages**: `/rooms` (rooms + room types tabs), `/guests`, `/bookings` — all use the paginated pattern (URL-synced `q`/filters/`page`/`perPage` + `useDebouncedValue(300ms)` + server `meta` fed into `TablePagination`). Bookings dialog has guest picker with inline quick-add and availability-filtered room picker.
- **Still mock-only** (Phase 6+): dashboard widgets, folio, invoices, payments, housekeeping.
- `_app.staff.tsx` legacy shim still present (delete when touched).
- Toaster wired in `__root.tsx` (top-right, richColors, closeButton).
- API base URL: `VITE_API_URL` env var, falls back to `http://localhost:8000/api`.

### 3.4b Frontend (`restro/`) — Zestro (Vite + TanStack Start)

Restaurant POS UI scaffolded by Lovable, cleaned up the same way as `pms/` (removed `@lovable.dev/vite-tanstack-config`, deleted `.lovable/`/`AGENTS.md`/lovable-error-reporting, Zestro branding in `__root.tsx`). Dockerized at `restro/Dockerfile`, port **3003**, source volume mounts for hot reload. Stack matches `pms/` (Vite + TanStack Start + React 19 + Tailwind v4 + shadcn/ui + Bun + Sonner + TanStack Query).

**Backend-wired (2026-08-08): login, branches, categories, menu items + image upload.**
- **Real login** at `/` — `POST /restro/auth/login`, real `StoredSession` (was a fake `{username, role}`-only mock — see `lib/pos/auth-storage.ts`, bumped storage key to `zestro_session_v2`).
- **`lib/pos/store.tsx`** (`PosProvider`/`usePos()`) is the single giant context for this app — same role as `pms/`'s `app-state.tsx`. Session, branches, categories, and menu items are now real (fetched via `lib/auth-api.ts`, `lib/branches-api.ts`, `lib/categories-api.ts`, `lib/menu-items-api.ts`); **zones/tables/orders/inventory/employees/expenses are still mock local state** — wire these as their backend slices get built, following the exact same pattern (replace the `useState(MOCK_DATA)` seed with a `useEffect` fetch keyed on `[session, branchId]`, make the mutator functions `async` and call the real API).
- **Branches**: same `useBranches()`-equivalent pattern as `pms/` — Owner (branch_id=null on token) sees all + can switch; Manager/Waiter/Chef locked to their token's branch.
- **"View as" preview** — same pattern as `pms/` (`actualRole`/`viewAsRole`/`effectiveRole`), but restro's chef/waiter don't get a filtered dashboard like hotel_pms's front_desk does — they get **one locked screen** (`/orders` or `/kitchen`, no nav bar at all). So previewing as Waiter/Chef **navigates** to that landing route (`_app.tsx`'s effect keys off `effectiveRole`, not `session.role`, for both the nav-visibility check and the redirect).
- **Categories** (`MenuView.tsx`): rename via `window.prompt` (kept from the Lovable original), add/delete now hit the real API. Delete opens a confirm `AlertDialog` (shared `ConfirmDeleteDialog` component in `MenuView.tsx`) — was previously instant, no confirmation.
- **Menu items** (`MenuView.tsx` + `MenuItemDialog`): full CRUD wired. Cards redesigned smaller/denser (2→3→4→5 responsive columns, was capped at 3). Image picker uploads via `uploadsApi.uploadMenuItemImage()` — shows an instant local blob-URL preview, spinner overlay while the real upload runs in the background, swaps to the real MinIO URL on success, blocks Save until it resolves. `MenuItemDialog`'s `patch()`/`setVariant()` use functional `setState` (not a closure over stale `item`) specifically because of this async gap.
- **Known bug fixed:** the "from Rs. X" lowest-variant-price display used `Math.min(...prices, 0)` — that trailing `0` is an extra *candidate* to `Math.min`, not a fallback default, so it always won and showed "from Rs. 0". Fixed with a `lowestVariantPrice()` helper that only defaults to `0` when the variants array is actually empty.
- **Still mock-only**: Dashboard, Orders, Kitchen, Delivery, Inventory, Employees, Expenses, Daily Sales, Reports, Settings' non-tax fields, Table Grid/Order Screen, the public `/menu/$branchId` QR-code menu page (reads straight from `lib/pos/data.ts`'s `BRANCHES`/`CATEGORIES`/`MENU_ITEMS` constants — not wired, deliberately left for later since it needs its own public/unauthenticated read endpoints).
- No "popular items" category — if built, must be **derived from real order data** (order-frequency), not manually seeded or curated. Depends on Orders existing first.

### 3.5 Environment

`.env` at project root:
- `DATABASE_URL`, `POSTGRES_*`, `REDIS_*`
- `JWT_SECRET`, `JWT_ALGORITHM=HS256`, `ACCESS_TOKEN_EXPIRE_MINUTES=30`, `REFRESH_TOKEN_EXPIRE_DAYS=7`
- `SUPERADMIN_EMAIL=nishantchy1234@gmail.com`, `SUPERADMIN_PASSWORD=nishant2`
- `GOOGLE_CLIENT_ID=457510785422-qsjus5rhihc7597i8hrfe8v81jtsam03.apps.googleusercontent.com`
- `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback`
- `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `BREVO_FROM_NAME` (OTP + transactional emails)
- `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `S3_ENDPOINT` (`http://minio:9000`, container-internal), `S3_PUBLIC_URL` (`http://localhost:9000`, browser-facing), `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET=dream-uploads`, `S3_REGION` (§2.11)
- `NEXT_PUBLIC_API_URL=http://localhost:8000/api`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID=<same as GOOGLE_CLIENT_ID>`

**No `HOTEL_PMS_URL` or per-app env vars.** App URLs live in DB (`apps.url`) — superadmin can update via SQL/API.

Google Cloud Console:
- Authorized JavaScript origins: `http://localhost:3001`, `http://localhost:3002`
- Authorized redirect URIs: `http://localhost:8000/auth/google/callback`

Docker services (`docker-compose.yml`):
- `api` (8000) — has `/etc/localtime:/etc/localtime:ro` mount to prevent Google-OAuth clock skew; depends on `minio` via `condition: service_started` (not `service_healthy` — see §2.11)
- `admin` (3001) — Next.js production build with `NEXT_PUBLIC_*` build args
- `pms` (3002) — Bun + Vite dev server with hot-reload (via source volume mounts)
- `restro` (3003) — Bun + Vite dev server (Zestro POS), same hot-reload volume pattern as pms
- `minio` (9000 API / 9001 console) — `cgr.dev/chainguard/minio:latest`, **no healthcheck** (image has no shell utilities)
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
- **`get_current_user` 500-crashed on non-platform tokens** instead of returning `None` → 401. See §3.1's Hotel PMS deps note. Was a shared/platform bug, not app-specific — fixed once in `core/deps.py`, protects every `require_role`-gated endpoint across all apps.
- **`minio/minio` Docker Hub image is broken** (discontinued Oct 2025) — use `cgr.dev/chainguard/minio:latest`. See §2.11.
- **Soft-delete idempotency**: a second `DELETE` (or `PATCH`) on an already-soft-deleted row must return `404`, not silently succeed again. `RestroCategory`/`RestroMenuItem`/`HotelPMSCredential` (branch-scoped) services all check `is_active` explicitly before acting, not just row existence — copy this pattern for any new soft-deletable entity.
- **`Button` (admin/) silently drops all styling if you pass it a `style` prop** — see §3.3's gotcha note. Wrap in a sized container instead.

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
- Endpoints (shared, `/branches`):
  - `GET /branches` — list for tenant. Auth: `require_tenant_scope` (accepts either platform user JWT or any app-staff JWT). Auto-provisions one default branch if empty.
  - `POST /branches` — Owner only (platform JWT + role check)
  - `PATCH /branches/{id}` — Owner/Manager (platform JWT)
  - `DELETE /branches/{id}` — Owner only (soft-delete via `is_active=false`)
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

| # | Phase | Status | Notes |
|---|---|---|---|
| 1 | Branches | ✅ done | Foundation |
| 2 | Room Types | ✅ done | Partial unique on `(branch_id, name) WHERE is_active` |
| 3 | Rooms | ✅ done | Per-room `rate_override` supported; partial unique on room_number |
| 4 | Guests | ✅ done | Search covers name/phone/email/ID |
| 5 | **Bookings + Check-in/out** | ✅ done | Rate snapshot, overlap check, state machine, availability endpoint; frontend has picker with inline guest quick-add |
| — | Backend pagination (bookings / rooms / guests) | ✅ done | `utils/paging.py`, `success_response(data, meta)`, URL-synced client-side |
| 6 | Folios | 🟡 next | Bills roll off bookings |
| 7 | Invoices | ⏳ | Bikram Sambat + append-only DB grants |
| 8 | Payments (manual) | ⏳ | Ship manual first; automated later |
| 9 | Audit Log | ⏳ | Plumbing during 6–8 |
| 10 | Reports | ⏳ | Needs data |
| 11 | Owner monitoring | ⏳ | Ties admin to pms via `/hotel-pms/live-summary` |
| — | Automated payments | later | FonePay/eSewa/Khalti integrations |
| — | Subscription/billing | later | Separate independent system |
| — | Housekeeper role + task board | later | Needs person-specific model |

**Hotel PMS is on pause as of 2026-08-06** — work shifted to Zestro/Restro (see §5b). Resume at Phase 6 (Folios) when picked back up.

---

## 5b. Plan Going Forward — Zestro / Restaurant POS Features

Same slice pattern as Hotel PMS: `api/features/restro/<entity>_repository.py` + `<entity>_service.py`, endpoints appended to the single `restro/router.py`, schemas appended to `restro/schemas.py`. Universal rules from §5 apply here too (tenant_id from JWT, repository methods take tenant_id explicitly, branch-scope enforcement via `_assert_branch_scope`).

| # | Phase | Status | Notes |
|---|---|---|---|
| 1 | Staff auth + credentials | ✅ done | `RestroRole.OWNER\|MANAGER\|WAITER\|CHEF`; branch-scoped by role from day one (unlike Hotel PMS, no retrofit needed) |
| 2 | Categories | ✅ done | Auto-provisions 7 real defaults (Hot Beverages, Cold Beverages/Refreshers, Hookah, Fast Food, Momo, Thakali Set, Newari Khaja) |
| 3 | Menu items + variants | ✅ done | 3-level hierarchy Category→Item→Variant; server-side pricing validation; image upload via generic `/uploads` |
| — | Object storage (MinIO) | ✅ done | See §2.11 — built as infra for menu item images, reusable by every future app/entity |
| 4 | Zones + Tables (floor management) | ⏳ next | Mock exists in `lib/pos/data.ts` (`Zone`, `RestaurantTable`, merge/reservation logic) — same wiring pattern as categories |
| 5 | Orders + Kitchen display | ⏳ | The core of the product, same role Bookings plays for Hotel PMS. Mock has full order/line-item/kitchen-status/discount/payment-method model already (`Order`, `OrderLine` types in `data.ts`) — a real spec to build against, not a blank slate |
| 6 | Inventory | ⏳ | Mock has `InventoryItem` + `StockMovement` (restock/adjust) already modeled |
| 7 | Employees | ⏳ | Branch-scoped staff records — separate from login credentials (Phase 1) |
| 8 | Expenses | ⏳ | Simple CRUD, category + amount + note |
| 9 | Settings (VAT rate, restaurant name) | ⏳ | May reuse tenant-level `is_vat_registered` (§2.10) rather than a separate per-branch flag — decide when built |
| — | "Popular items" category | later | Must be derived from real order data (frequency), not manually curated — needs Orders first |
| — | Reports | later | Sales/category/staff performance — needs Orders + Inventory data |

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
                                               require_hotel_pms_staff, require_restro_staff (both built on
                                               shared _make_staff_dep factory), require_tenant_scope,
                                               get_current_user (fixed: returns None on bad/staff token,
                                               was crashing with 500 — see §4)
api/core/storage.py                            S3/MinIO wrapper: upload_file, delete_file, build_public_url,
                                               ensure_bucket (public-read policy, called on every startup)
api/shared_models/tenant.py                    Tenant model — pan/email/phone UNIQUE nullable; is_vat_registered bool
api/shared_models/user.py                      User model (role, is_owner, picture_url)
api/shared_models/platform_admin.py            PlatformAdmin model
api/shared_models/app.py                       App catalog model
api/shared_models/hotel_pms_credential.py      HotelPMSCredential (UNIQUE username, UNIQUE tenant+branch+role)
api/shared_models/restro_credential.py         RestroCredential — same shape, branch-scoped from day one
api/shared_models/restro_category.py           RestroCategory — partial unique (branch_id,name) WHERE is_active
api/shared_models/restro_menu_item.py          RestroMenuItem — has_variants/price mutually exclusive
api/shared_models/restro_menu_item_variant.py  RestroMenuItemVariant — child table, cascade delete via ORM

api/features/auth/router.py                    Platform auth endpoints + business-tax-info PATCH + team-members POST
api/features/auth/service.py                   AuthService (register/login/google/business/OTP/tax-info)
api/features/auth/repository.py                TenantRepository (with _normalize helper + update_tax_info), UserRepository, PlatformAdminRepository
api/features/auth/schemas.py                   Pydantic request/response

api/features/apps/router.py                    GET /apps, GET /apps/{slug}
api/features/apps/service|repository|schemas  Apps catalog logic
api/features/apps/__init__.py

api/features/branches/router.py                Shared /branches endpoints (tenant-level, all apps)
api/features/branches/service.py               BranchService (auto-provision from tenant name/address/phone, CRUD)
api/features/branches/repository.py            BranchRepository
api/features/branches/schemas.py               BranchData, CreateBranchRequest, UpdateBranchRequest
api/shared_models/branch.py                    Branch model — table `branches`

api/features/uploads/router.py                 POST /uploads (generic, app/tenant/branch-prefix-validated)
api/features/uploads/__init__.py

api/features/hotel_pms/roles.py                HotelPMSRole enum: APP_OWNER, MANAGER, FRONT_DESK
api/features/hotel_pms/router.py               Staff login + Owner credential CRUD
api/features/hotel_pms/service.py              HotelPMSCredentialService, HotelPMSAuthService
api/features/hotel_pms/repository.py           HotelPMSCredentialRepository
api/features/hotel_pms/auth.py                 App-JWT create/decode (module="hotel_pms", 8h TTL)
api/features/hotel_pms/schemas.py              Pydantic

api/features/restro/roles.py                   RestroRole enum: OWNER, MANAGER, WAITER, CHEF
api/features/restro/router.py                  Staff login + Owner credential CRUD + category + menu-item endpoints
api/features/restro/service.py                 RestroCredentialService, RestroAuthService
api/features/restro/repository.py              RestroCredentialRepository
api/features/restro/auth.py                    App-JWT create/decode (module="restro", 8h TTL)
api/features/restro/category_repository.py     CategoryRepository
api/features/restro/category_service.py        CategoryService (DEFAULT_CATEGORIES auto-provision list here)
api/features/restro/menu_item_repository.py    MenuItemRepository (variant replace-on-update via ORM relationship)
api/features/restro/menu_item_service.py       MenuItemService (_validate_pricing rules, category-branch check)
api/features/restro/schemas.py                 Pydantic — CredentialData, CategoryData, MenuItemData, VariantData/Input

api/utils/helpers.py                           success_response, error_response, format_validation_errors
api/utils/logger.py                            Logger
api/utils/otp.py                               generate_otp, store_otp (300s TTL default), verify_otp, get_otp_expiry
api/jobs/email_jobs.py                         Brevo OTP verification, team invitation emails
```

### Frontend admin (Next.js)
```
admin/src/app/layout.tsx                                    Root layout + AuthProvider + Sonner Toaster + Plus Jakarta Sans font
admin/src/app/page.tsx                                      / route (login/register/OTP flow via AuthPage)
admin/src/app/dashboard/layout.tsx                          SidebarProvider + Sidebar + Topbar shell + auth guard
admin/src/app/dashboard/page.tsx                            DashboardContent
admin/src/app/dashboard/apps/page.tsx                        Apps index page (new — full AppsGrid, was dashboard-only)
admin/src/app/dashboard/apps/[slug]/page.tsx                Dynamic app detail (AppDetailContent)
admin/src/app/dashboard/branches/page.tsx                   Global branches page (new)
admin/src/app/dashboard/team/page.tsx                       Team Members page (new, dummy data)
admin/src/app/dashboard/settings/page.tsx                   Settings page (tax registration editor)
admin/src/app/business-register/page.tsx                    Redirects to /dashboard (dialog handles it)

admin/src/components/auth/AuthProvider.tsx                  Wraps GoogleOAuthProvider + hydrates store
admin/src/components/auth/AuthPage.tsx                      Login/register/OTP switcher + expiry-plumbing
admin/src/components/auth/BusinessRegisterContent.tsx       (legacy, unused; safe to delete)
admin/src/components/auth/forms/LoginForm.tsx               Email login + Google (sets tenant from response)
admin/src/components/auth/forms/RegisterForm.tsx            Email register + Google (sets tenant)
admin/src/components/auth/forms/OtpVerificationForm.tsx     OtpInput + resend + expiry timer, manual submit
admin/src/components/auth/forms/BusinessRegisterForm.tsx    Business info form (used inside modal)

admin/src/components/dashboard/DashboardContent.tsx         Apps grid preview + BusinessSetupDialog trigger + HospitalityMark empty state
admin/src/components/dashboard/AppsGrid.tsx                 Redesigned tiles (per-app color, code badge) from GET /apps
admin/src/components/dashboard/AppsPageContent.tsx          Full apps index (new, backs /dashboard/apps)
admin/src/components/dashboard/AppDetailContent.tsx         Single app page (header + CredentialsSection; Branches moved out)
admin/src/components/dashboard/CredentialsSection.tsx       CRUD modals, one slot per (role×branch) for scoped roles
admin/src/components/dashboard/BranchesContent.tsx          Global branches CRUD (new, backs /dashboard/branches)
admin/src/components/dashboard/TeamMembersContent.tsx       Team table + invite/edit/delete (new, dummy data)
admin/src/components/dashboard/SettingsContent.tsx          Tax registration editor (new)
admin/src/components/dashboard/BusinessSetupDialog.tsx      Non-dismissible modal (renders BusinessRegisterForm, HospitalityMark)

admin/src/components/layout/Sidebar.tsx                     Collapsible icon-rail nav (Dashboard/Apps/Branches/Team/Settings)
admin/src/components/layout/Topbar.tsx                      Avatar/name/role/logout dropdown (new, moved out of Sidebar)
admin/src/components/layout/SidebarContext.tsx              Collapse/mobile-open state shared between Sidebar+Topbar+layout (new)
admin/src/components/shared/HospitalityMark.tsx             Signature inline-SVG key/door motif (new)
admin/src/components/ui/Button.tsx                          Primary/secondary/outline — DO NOT pass a style prop, see §4
admin/src/components/ui/FormInput.tsx                       Input with icon + password toggle
admin/src/components/ui/Avatar.tsx                          Image or initials
admin/src/components/ui/OtpInput.tsx                        Custom OTP slots (input-otp library)
admin/src/components/ui/Switch.tsx                          Toggle switch (new, used in Team Members)
admin/src/components/ui/DropdownMenu.tsx                    Portal-based row-actions menu (new — escapes overflow:hidden ancestors,
                                                             e.g. a horizontally-scrollable table wrapper; position:absolute can't)
admin/src/components/shared/Spinner.tsx                     Loading spinner

admin/src/hooks/useAuth.ts                                  Auth store selector
admin/src/hooks/useLogin.ts                                 Login → toasts + navigate
admin/src/hooks/useRegister.ts                              Register → returns {ok, otpExpiresIn}
admin/src/hooks/useVerifyOtp.ts                             OTP verify → toasts + navigate
admin/src/hooks/useResendOtp.ts                             Resend → returns {ok, expiresIn}
admin/src/hooks/useBusinessRegister.ts                      Business register (handles PAN/email/phone conflicts + is_vat_registered)
admin/src/hooks/useUpdateTaxInfo.ts                          PATCH /auth/business-tax-info (new)
admin/src/hooks/useApps.ts                                  useApps() + useAppDetail(slug)
admin/src/hooks/useCredentials.ts                            Credentials CRUD hook — keyed by cred_id, not role (branch-scoping)
admin/src/hooks/useBranches.ts                               Branches CRUD hook, no appCode param (global endpoint)
admin/src/hooks/useTeamMembers.ts                            Dummy in-memory CRUD (new — TODO(team-api) marks the swap point)

admin/src/store/auth-store.ts                               Zustand store (user, tenant, tokens, hydrate, logout)
admin/src/services/auth-api.ts                               Auth endpoints client (+ updateTaxInfo)
admin/src/services/apps-api.ts                               Apps + credentials + branches endpoints client

admin/src/lib/axios-client.ts                               Axios + 401 refresh (skips auth endpoints)
admin/src/lib/auth-storage.ts                               localStorage token helpers
admin/src/lib/mock-team.ts                                   Dummy TeamMember seed data (new)
admin/src/lib/design-tokens.ts                               colors (+ new accent scale) / spacing / typography (font.secondary
                                                              now points at --font-sans) / radius / layout (new — sidebar/topbar sizes)
admin/src/lib/logger.ts                                     Frontend logger

admin/src/types/api.ts                                       Request/response types (+ UpdateTaxInfoRequest)
admin/src/types/auth.ts                                      User/Tenant (+ is_vat_registered)/PlatformAdmin/AuthState/ApiError
admin/src/types/apps.ts                                      App, AppCredential (+branch_id), Branch, HOTEL_PMS_ROLES, RESTRO_ROLES,
                                                              BRANCH_SCOPED_ROLES, APP_CODE_TO_API_PREFIX, APP_CODE_TO_ROLES
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
pms/src/lib/branches-api.ts                    Branches API client
pms/src/lib/room-types-api.ts                  Room types API client
pms/src/lib/rooms-api.ts                       Rooms API client (paginated `list(branchId, params)`)
pms/src/lib/guests-api.ts                      Guests API client (paginated)
pms/src/lib/bookings-api.ts                    Bookings API client (paginated + availability)
pms/src/hooks/useBranches.ts                   Branches hook
pms/src/hooks/useRoomTypes.ts                  Room types hook
pms/src/hooks/useRooms.ts                      Rooms hook (accepts query params, returns `meta`)
pms/src/hooks/useGuests.ts                     Guests hook (accepts query params)
pms/src/hooks/useBookings.ts                   Bookings hook (accepts query params + transitions)
pms/src/hooks/useTableQuery.ts                 `normalizeTableSearch` + PER_PAGE_OPTIONS
pms/src/hooks/useDebouncedValue.ts             300ms debounce for search inputs
pms/src/components/table-pagination.tsx        Shared paginator fed from server meta
```

### Frontend restro / Zestro (Vite + TanStack Start)
```
restro/vite.config.ts                          Plain TanStack Start + tsconfig-paths + Tailwind v4 (no Lovable)
restro/Dockerfile                              oven/bun:1-alpine + `bun run dev` on port 3003
restro/src/router.tsx                          Router entry
restro/src/routes/__root.tsx                   Root shell + Toaster (Lovable error hook removed)
restro/src/routes/index.tsx                    Login screen (real — POST /restro/auth/login)
restro/src/routes/_app.tsx                     Auth guard; nav-visibility + landing-route redirect key off
                                               effectiveRole (view-as-aware), not session.role
restro/src/routes/menu.$branchId.tsx           Public QR-code menu page — still mock, reads data.ts directly,
                                               deliberately not wired (needs its own public endpoints later)
restro/src/components/pos/Header.tsx           Branch switcher (Owner only) + "Preview as" role dropdown
                                               (owner-only, navigates to waiter/chef's locked landing route)
restro/src/components/pos/Login.tsx            Real async login, error state, disabled-while-submitting
restro/src/components/pos/MenuView.tsx         Categories (real) + menu items (real) + image upload +
                                               ConfirmDeleteDialog (AlertDialog-based) for both
restro/src/components/pos/*                    Other POS-specific UI blocks — still mock (Orders, Kitchen,
                                               Delivery, Inventory, Employees, Expenses, Daily Sales, Reports,
                                               TableGrid, OrderScreen, Settings non-tax fields)
restro/src/components/ui/*                     shadcn/ui components (added: alert-dialog for delete confirms)
restro/src/lib/pos/store.tsx                   PosProvider/usePos() — session/branches/categories/menu real;
                                               zones/tables/orders/inventory/employees/expenses still mock
restro/src/lib/pos/auth-storage.ts             Real StoredSession (token/role/tenantId/branchId/username/
                                               expiresAt) — storage key bumped to zestro_session_v2
restro/src/lib/pos/data.ts                     Mock types + seed data for still-unwired entities; also the
                                               source for the public menu.$branchId page
restro/src/lib/api-client.ts                   Fetch wrapper (Bearer token; FormData-aware — skips forcing
                                               JSON content-type so multipart uploads work)
restro/src/lib/auth-api.ts                     authApi.login(username, password)
restro/src/lib/branches-api.ts                 branchesApi.listMine() — GET /branches (shared endpoint)
restro/src/lib/categories-api.ts               categoriesApi CRUD, branch-scoped
restro/src/lib/menu-items-api.ts               menuItemsApi CRUD, branch-scoped, variant-aware payloads
restro/src/lib/uploads-api.ts                  uploadsApi.uploadMenuItemImage(branchId, file)
restro/src/lib/error-capture.ts                h3 SSR error capture (kept)
restro/src/lib/error-page.ts                   HTML error page (kept)
```

### Config
```
docker-compose.yml       All services (api, admin, pms, restro, minio, postgres, redis, worker, ui)
                          — api has /etc/localtime mount to prevent OAuth clock skew
                          — pms (3002) and restro (3003) are dev-mode with source volumes for hot reload
                          — minio (9000/9001) uses cgr.dev/chainguard/minio, NOT minio/minio (broken on
                            Docker Hub — see §2.11/§4); no healthcheck, api depends on service_started
.env                     Root secrets (DATABASE_URL, JWT_SECRET, Google OAuth, Brevo, MinIO/S3, NEXT_PUBLIC_*)
admin/Dockerfile         Multi-stage Next.js production build
pms/Dockerfile           oven/bun:1-alpine + `bun run dev` (dev-mode)
restro/Dockerfile        oven/bun:1-alpine + `bun run dev` (dev-mode)
api/Dockerfile           FastAPI + uvicorn (now includes boto3)
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
- **Owner endpoints use `require_tenant_user` + role check.** Staff endpoints use `require_hotel_pms_staff` / `require_restro_staff`.
- **New apps register by**: adding a row to `_app_catalog()` in `core/seed.py` + one line in `APP_CODE_TO_API_PREFIX` (frontend) + one entry in `APP_CODE_TO_ROLES` (frontend). Superadmin CRUD UI is future work.
- **Every list table in `pms/` MUST have**: URL-synced search, filters, and pagination **driven by the backend** from day one. Route uses `validateSearch` + `normalizeTableSearch`. Hook accepts a `params` object (`q`, filters, `page`, `perPage`) and calls the paginated endpoint. Debounce search input with `useDebouncedValue(300ms)` before passing it in. Backend endpoint accepts the same params, returns `data` + `meta: {total, page, per_page, total_pages}` via `success_response(data=..., meta=build_meta(...))` from `utils/paging.py`. Render the returned items directly — never filter/paginate client-side, that breaks pagination correctness. Use the shared `TablePagination` component fed from `meta`. Pagination: min 10 / max 100 rows per page (options 10/25/50/100).
- **Soft-delete services must check `is_active` before acting, not just row existence.** A second `DELETE`/`PATCH` on an already-inactive row returns `404`, never a silent re-success. Bit us once (categories, menu items) — copy the pattern for every new soft-deletable entity.
- **Branch-scoped app roles**: the tenant-wide role (App Owner / Owner) has `branch_id = NULL` on its credential and JWT; every other role requires a real `branch_id`, enforced server-side via a `BRANCH_SCOPED_ROLES` set in each app's credential service. Don't assume "one credential per role per tenant" anymore — it's "one credential per role per branch per tenant," with the tenant-wide role as the single exception.
- **New per-app staff-auth deps** should go through `core/deps.py`'s `_make_staff_dep(decode_fn)` factory, not a hand-copied duplicate of `require_hotel_pms_staff`. Each app still gets its own named `require_<app>_staff` wrapper (keeps the module boundary a real check, not just a shared string comparison) — only the internals are shared.
- **Object storage uploads** go through the generic `POST /uploads` (`features/uploads/`), never a per-app upload endpoint — add the app to `APP_PREFIXES` in `uploads/router.py` if it needs branch-scoping, that's the whole integration.
- **`admin/`'s `Button` component**: never pass it a `style` prop — it overwrites (not merges) the component's own styling since `{...props}` spreads after the hardcoded `style` in JSX. Wrap in a sized `<div>` if you need width control.
- **`Math.min(...arr, fallback)` bug pattern**: the fallback becomes an extra *candidate* to `Math.min`, not a default for an empty array — it silently wins whenever it's the smallest value. Guard empty arrays explicitly before calling `Math.min`/`Math.max`.

---

## 8. Recent Context Log

*User adds notes here about work done from other machines so future Claude sessions can pick up context.*

### 2026-07-29 — Initial handoff
Auth complete, apps catalog and hotel_pms staff auth built.

### 2026-08-04 — Big update session
Wired PMS frontend login end-to-end. Added: apps catalog, hotel_pms credentials, business setup as dialog on dashboard, `input-otp` component with expiry countdown + resend, non-dismissible business modal, PAN/email/phone unique constraints with specific error handling, Google OAuth clock skew tolerance, re-register while unverified, Google promotes unverified accounts, `/etc/localtime` volume for api container, tenant object plumbed through all login/OTP/google response paths. **Deleted** the `modules`/`module_subscriptions` tables + code entirely — subscription will be a separate independent future system.

Ready to start Phase 1 (Branches) next.

### 2026-08-06 — Hotel PMS Phases 1–5 shipped; Zestro (restro) scaffolded
- Backend: `pms_branches` (auto-provisioned), `pms_room_types`, `pms_rooms` (with `rate_override` + partial unique on `is_active`), `pms_guests`, `pms_bookings` (rate snapshot, overlap check, state machine with room-status side effects, availability endpoint). All under `api/features/hotel_pms/` following the standard slice pattern.
- Backend pagination unified: added `api/utils/paging.py` (`parse_paging` + `build_meta`). Bookings, rooms, and guests list endpoints all accept `q` + entity-specific filters + `page`/`per_page` and return `data` + `meta`.
- Frontend (`pms/`): `/rooms`, `/guests`, `/bookings` all backend-wired with URL-synced search / filters / pagination driven by `useDebouncedValue(300ms)` + server `meta`. Booking creation modal has guest picker with inline quick-add and availability-filtered room picker (rate auto-fills from room, overrideable). Property switcher now real (branches). CLAUDE.md convention updated to require backend-driven paging.
- Cancelled/checked-out/no-show bookings: kept as-is (no delete, no auto-hide) per user preference — records must persist for audit.
- **Hotel PMS on pause.** Next Hotel PMS work: Phase 6 (Folios).
- **Zestro (`restro/`) added.** Lovable-generated Restaurant POS UI cleaned up the same way as `pms/`: removed `@lovable.dev/vite-tanstack-config` (plain vite.config), deleted `.lovable/` + `AGENTS.md` + `src/lib/lovable-error-reporting.ts`, scrubbed `bunfig.toml` allowlist, rebranded `__root.tsx` head + wired Sonner Toaster. Dockerized on port 3003; docker-compose service added with source volume mounts. Backend slice not started.

### 2026-08-06 (later) — Branches promoted to tenant-level, shared across apps
- New shared feature slice `api/features/branches/` and new model `shared_models/branch.py` → table `branches` (was `hotel_pms_branches`).
- Rationale: same physical location often runs multiple apps (Hotel PMS + Zestro at one hotel-restaurant). Per-app branches meant duplicate data entry and drift risk.
- New unified endpoint `GET/POST/PATCH/DELETE /branches` — no `/hotel-pms/` prefix.
- `GET /branches` gated by new `require_tenant_scope` dep that accepts either platform JWT (admin) or any app-staff JWT (pms/restro/future). Writes still require platform JWT + owner role.
- All FKs updated: `pms_rooms.branch_id`, `pms_room_types.branch_id`, `pms_bookings.branch_id`, `hotel_pms_credentials.branch_id` now → `branches.id`.
- Deleted `features/hotel_pms/branch_repository.py`, `branch_service.py`, and the branch routes from `hotel_pms/router.py`; deleted `shared_models/hotel_pms_branch.py`.
- Frontend: `pms/src/lib/branches-api.ts` calls `/branches` (was `/hotel-pms/branches/me`); admin's `apps-api.ts` branches helpers hit `/branches` (appCode arg preserved but ignored).
- Dev DB needs a rebuild: `docker-compose down -v && docker-compose up -d` — the rename is not a Postgres-level rename, it's a fresh table.
- **This supersedes the earlier "branches belong to individual apps" line in §2.9.** CLAUDE.md updated accordingly.

### 2026-08-08 — Tax registration, admin redesign, team members (dummy), Restro backend + frontend, MinIO
Big session. In rough chronological order:

- **PAN vs VAT registration** (§2.10): added `tenants.is_vat_registered`, `PATCH /auth/business-tax-info`, wired into both the business-setup dialog and a new `admin/` Settings page. Modeled as one editable tenant-level flag (matches Tally/Zoho Books/QuickBooks convention) — conditional on PAN existing, snapshotted at invoice-generation time once invoices are built (never live-lookup).
- **`admin/` full dashboard redesign**: Topbar + collapsible icon-rail Sidebar (real `matchMedia` responsive, localStorage-persisted collapse — replaces a one-time `window.innerWidth` read), Plus Jakarta Sans added as the UI type face (Playfair stays for display headings), new `HospitalityMark` signature SVG, redesigned app cards (per-app color), new `/dashboard/apps`, `/dashboard/branches` (global, moved out of per-app pages), `/dashboard/team` pages. Branch data now shared via one lifted `useBranches()` call instead of two independent instances (fixed a stale-cache bug where a new branch didn't appear in the credentials picker without a reload).
- **Team Members page** (`/dashboard/team`): full table UI (avatar/role/status/active-toggle/portal-based row-actions dropdown), invite/edit/delete modals — **explicitly dummy data**, no backend wired (`POST /auth/team-members` exists from before but has no list/update/delete counterparts yet). `useTeamMembers()` is shaped to match the eventual real API for an easy swap.
- **Branch-scoped credentials retrofit**: `hotel_pms_credentials`/`restro_credentials` gained `branch_id` (nullable — NULL means the tenant-wide role: `app_owner`/`owner`). Every other role (`manager`, `front_desk`, `waiter`, `chef`) now requires a branch. This was a real gap caught mid-session — the original hotel_pms credentials model was tenant-wide only.
- **Zestro (`restro/`) backend built from scratch**: staff auth (`RestroRole.OWNER|MANAGER|WAITER|CHEF`), credential CRUD, categories (auto-provisions 7 real defaults from the original Lovable mock menu, not generic placeholders), menu items + variants (3-level Category→Item→Variant hierarchy, server-side pricing validation, full curl-verified test matrix including soft-delete idempotency). See §5b for the full phase plan.
- **MinIO / object storage** (§2.11): `cgr.dev/chainguard/minio` (the official `minio/minio` Docker Hub image is broken/discontinued as of Oct 2025 — don't waste time re-pulling it). One shared bucket, prefix-based isolation (`{app}/{tenant}/{branch}/{category}/...`), public-read policy, generic `POST /uploads` endpoint reusable by every app. First consumer: Zestro's menu item image picker.
- **`restro/` frontend wired end-to-end** against all of the above: real login (was a fake mock session), real branches, real categories, real menu items with image upload. `zones`/`tables`/`orders`/`inventory`/`employees`/`expenses` remain mock — same wiring pattern is ready to copy per entity as those backend slices get built.
- **Bug fixed**: `get_current_user` 500-crashed instead of 401'ing when handed a non-platform token (e.g. a Zestro staff token hitting a `require_role`-gated endpoint) — shared platform bug, not Restro-specific, now fixed for every app.
- **UI polish pass on Zestro menu**: delete confirmations (was instant, no confirm) for both categories and menu items; fixed a "from Rs. 0" display bug (`Math.min(...prices, 0)` — the `0` was an extra candidate, not a fallback); menu item cards made smaller/more responsive (2→3→4→5 columns).
- **Not done, explicitly deferred**: Restro's "popular items" category (needs real order-frequency data, Orders isn't built yet), the public `/menu/$branchId` QR page (still mock, needs its own unauthenticated endpoints), Team Members backend, Hotel PMS Phase 6+ (still paused, resume there when Zestro's core loop — Orders — is further along or when explicitly redirected back).

---

## 9. Quick Command Reference

```bash
# Rebuild single service after changes
docker-compose build admin  && docker-compose up -d admin
docker-compose build api    && docker-compose up -d api
docker-compose build pms    && docker-compose up -d pms
docker-compose build restro && docker-compose up -d restro

# Full stack
docker-compose up -d

# Check running services
docker-compose ps

# Tail logs
docker-compose logs -f api
docker-compose logs -f admin
docker-compose logs -f pms
docker-compose logs -f restro

# Postgres shell
docker exec -it postgres psql -U postgres -d dream_app

# Common queries
docker exec postgres psql -U postgres -d dream_app -c "select id, name, pan, is_vat_registered from tenants;"
docker exec postgres psql -U postgres -d dream_app -c "select tenant_id, branch_id, role, username from hotel_pms_credentials;"
docker exec postgres psql -U postgres -d dream_app -c "select tenant_id, branch_id, role, username from restro_credentials;"
docker exec postgres psql -U postgres -d dream_app -c "select code, name, url from apps;"

# MinIO — no shell in the container (Chainguard image), so no `docker exec` debugging.
# Console UI: http://localhost:9001 (login = MINIO_ROOT_USER/PASSWORD from .env)
# If `docker pull minio/minio` fails, don't retry it — use cgr.dev/chainguard/minio (see §2.11)

# Nuke test data (dev only!)
docker exec postgres psql -U postgres -d dream_app -c "delete from hotel_pms_credentials; delete from restro_credentials; delete from users where role != 'superadmin'; delete from tenants;"

# Verify container clocks match (Google OAuth debugging)
docker exec api date -u
date -u

# Verify running services
docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
```
