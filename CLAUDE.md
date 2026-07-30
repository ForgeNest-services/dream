# CLAUDE.md — Dream Multi-App Hospitality SaaS

> **Read this file first.** It contains all architectural decisions, current build state, cleanup tasks, and forward plan. Reference `docs/mvp.md`, `docs/db.md`, `docs/diagram.md`, and `docs/auth.md` for deeper detail — but some of what's in those docs has been **superseded** by the decisions below. When they conflict, **this file wins.**

---

## 1. What This Project Is

Forgenest is building a **multi-app hospitality SaaS platform**. The core product is **Hotel PMS**. Over time, additional apps get layered on: **Restaurant POS, Gym Management, Inventory, Swimming Pool Management**, etc. All apps center on hospitality, but each app can also be used standalone by non-hotel businesses (e.g., a standalone restaurant using just POS).

**Business model:**
- 30-day free trial per app (each app trial is independent)
- Monthly NPR 2,999 / Yearly NPR 11,999 per app (Hotel PMS pricing)
- Bundle pricing planned (e.g., 15k/year for all apps)
- Free tier = one app only
- Nepal market: no true auto-recurring billing (FonePay/eSewa/Khalti) — payment is manually confirmed

**Tech stack:**
- Backend: FastAPI + SQLAlchemy + PostgreSQL
- Frontend: Next.js 16 (App Router, Turbopack) + TypeScript + Zustand + Axios + Sonner (toasts) + react-icons
- Auth: JWT (platform tier), Google OAuth via `@react-oauth/google`
- Deploy: Docker Compose

---

## 2. Architecture — Final Decisions (LOCKED, don't relitigate)

### 2.1 Two-tier auth system

**Tier 1 — Platform auth (already built).**
- For: **Superadmin, Owner, Manager** (and later Accountant)
- Login: Google OAuth + email/password
- Deployed at: `app.dream.com`
- Frontend: `admin/` (current Next.js project)
- Backend: `api/features/auth/`

**Tier 2 — Per-app auth (not built yet).**
- For: staff of that specific app (receptionist, chef, waiter, etc.)
- Login: simple username + password (or PIN for POS in future)
- Deployed at: each app's own subdomain (pms.dream.com, restro.dream.com, etc.)
- Frontend: separate Next.js project per app (user will create these)
- Backend: lives inside each app's feature slice (e.g., `api/features/hotel_pms/auth/`)

### 2.2 Frontend: separate Next.js projects per app on subdomains

```
admin/     → app.dream.com     (Owner/Manager/Superadmin dashboard)  ✓ built
pms/       → pms.dream.com     (Hotel PMS)                            not built
restro/    → restro.dream.com  (Restaurant POS)                       not built
gym/       → gym.dream.com     (Gym Management)                       not built
```

- Each app frontend is a **completely separate Next.js project**.
- User will create the new frontend projects themselves. Backend just builds the API.
- The `admin/` app has "Open Hotel PMS" buttons that simply **link out** to `pms.dream.com` — no embedding, no auto-login. Staff log in fresh with their role's shared credential.
- **Each app's root URL (`/`) IS the login page.** No `/login` path. After login, redirect to role-based dashboard route.

### 2.3 Backend: single `api/` codebase, feature slices per app

```
api/features/
├── auth/           # Platform auth (Owner/Manager/Superadmin)     ✓ built
├── modules/        # Subscription catalog                          ~ partial (repo only)
├── hotel_pms/      # Hotel PMS backend (staff auth + features)    not built
├── restro/         # Restaurant POS (later)                        not built
└── gym/            # Gym Management (later)                        not built
```

All apps hit the same API, just different route prefixes. Each slice follows the existing pattern: `router.py` / `service.py` / `repository.py` / `schemas.py`.

### 2.4 Roles model — final, dead simple

**Platform roles** (stored in `users.role` column, only these three values allowed):
- `superadmin` — Forgenest staff (but actually stored in separate `platform_admins` table)
- `owner` — business owner who signed up. `is_owner=true`. Has access to everything.
- `manager` — someone the Owner delegates platform-level management to. Can create staff credentials, view reports, but shouldn't do billing changes.

**App-level roles** (hardcoded in each app's own code, NOT in a shared enum):
- Hotel PMS: `manager`, `receptionist`, `housekeeper`
- Restaurant POS: `manager`, `waiter`, `chef`, `cashier`
- Gym: `manager`, `trainer`, `receptionist` (future)

Each app defines its own role list as a Python enum in `api/features/<app>/roles.py`. The role string is stored in that app's credentials table. **Never** cross-referenced across apps.

**No `user_module_access` table.** That idea from `docs/auth.md` §1 is dead — we use per-app credential tables instead. See 2.5.

### 2.5 Credentials model — one credential per role per tenant, shared

Each app has its own credentials table:

```
hotel_pms_credentials
├── id: UUID PK
├── tenant_id: FK → tenants
├── role: string (validated against Hotel PMS roles enum)
├── username: string
├── password_hash: string
├── created_by: FK → users (the Owner who created it)
├── created_at, updated_at: timestamp
└── UNIQUE(tenant_id, role)
```

- **One credential per role per tenant.** All receptionists at Sunset Hotel use the same "receptionist" username+password.
- **Multiple staff log in with the same cred concurrently.** That's fine and intended.
- Owner creates/updates/resets credentials from the admin dashboard.
- **Password reset does NOT force-log-out active sessions.** Staff currently logged in keep working until their JWT expires (natural JWT behavior). Next login requires new password. This matches the "don't disrupt mid-shift" UX we agreed on.

### 2.6 Session TTLs

- **Platform JWTs** (existing): 30 min access, 7 days refresh
- **App staff JWTs** (to build): ~8 hours access, no refresh (matches one work shift)
- App JWTs signed with same `JWT_SECRET` but shaped differently: `{tenant_id, role, cred_id, module: 'hotel_pms'}` (no `user_id` field distinguishes them from platform tokens)

### 2.7 Subscription bridge

Every request to an app's routes checks that the tenant has an **active subscription** for that module:
- Check `module_subscriptions` row for `(tenant_id, module_id)` where `status IN ('trial', 'active', 'grace_period')`
- If missing/expired → 403 `MODULE_NOT_ACCESSIBLE`
- Implement as a FastAPI dependency: `require_module_access("hotel_pms")` (to be added in `core/deps.py`)

### 2.8 Owner's cross-app monitoring

The admin dashboard shows live data from every app the tenant subscribes to, **without the Owner having to log into each app**. Each app exposes summary endpoints:

```
GET /hotel-pms/live-summary   → today's bookings, occupancy, revenue
GET /restro/live-summary      → today's orders, revenue, top items
```

Admin dashboard calls these with the Owner's platform JWT. Backend is unified so no cross-service calls needed — just proper route protection: these summary endpoints require platform Owner/Manager auth + active subscription for that module.

---

## 3. What's Built Today (as of last session)

### 3.1 Backend (`api/`)

**Auth (`features/auth/`) — COMPLETE**
- `POST /auth/register` (email/password → OTP verification flow)
- `POST /auth/verify-otp`
- `POST /auth/resend-verification-otp`
- `POST /auth/login` (unified: platform_admin OR user, returns appropriate token shape)
- `POST /auth/google/callback` (Google ID token → checks if user exists, returns user or Google profile)
- `POST /auth/google/complete` (creates new user + tenant + auto-trial for new Google signups)
- `POST /auth/business-register` (adds tenant details for manual-registered users, also auto-creates trial)
- `GET /auth/me` (returns current user info)
- Error handling: differentiates `USER_NOT_FOUND` (404) vs `INVALID_CREDENTIALS` (401) vs `EMAIL_NOT_VERIFIED` (403)

**Modules (`features/modules/`) — PARTIAL**
- Only `repository.py` exists with:
  - `ModuleRepository.get_by_code(code)`
  - `ModuleSubscriptionRepository.get(tenant_id, module_id)`
  - `ModuleSubscriptionRepository.start_trial(tenant_id, module_code)` — creates 30-day trial subscription, idempotent
- **No router, no service, no schemas yet.** Not needed until second app or public launch.

**Seeding (`core/seed.py` + `main.py` lifespan)**
- `seed_superadmin()` — from `SUPERADMIN_EMAIL/PASSWORD` env vars
- `seed_modules()` — inserts `hotel_pms` module row if missing (idempotent). Catalog defined in `MODULE_CATALOG` list — add rows there when new apps launch.

**Auto-trial wiring**
- `AuthService.google_complete` → creates tenant → auto-starts Hotel PMS 30-day trial
- `AuthService.add_business_info` (called by `/auth/business-register`) → same
- Every new tenant gets a Hotel PMS trial automatically until we launch app #2

### 3.2 Database tables (existing, all in `public` schema)

| Table | Purpose | Notes |
|---|---|---|
| `platform_admins` | Superadmin accounts | Seeded from env |
| `tenants` | Business/hotel entities | Created on `google_complete` or `business_register` |
| `users` | Platform-level users (Owner, later Manager) | `role` col holds superadmin/owner/manager only |
| `modules` | App catalog | Seeded: `hotel_pms` (is_core=true, 2999/mo, 11999/yr) |
| `module_subscriptions` | Per-tenant per-app subscriptions | UNIQUE(tenant_id, module_id) |

### 3.3 Frontend (`admin/`) — COMPLETE for MVP scope

- Split-layout login/register page (gradient sidebar left, form right)
- Google OAuth "Continue with Google" button (using `@react-oauth/google` GoogleLogin component with `text="continue_with"`, `shape="pill"`)
- Email/password login + registration with OTP verification
- Business registration form (for manual signups after OTP)
- Dashboard with sidebar navigation (Dashboard, Team Members, Settings)
- **Sidebar shows user avatar** (Google picture or initials fallback) + name + role
- Toast notifications (Sonner) for all success/error/warning messages
- Route guards: `/dashboard/*` requires auth
- Design system:
  - Background: `#E8EDF2` (light blue-gray)
  - Primary: `#0A2947` (dark navy) with color scale in `src/lib/design-tokens.ts`
  - All buttons + inputs use 24px border-radius (pill shape)
  - Playfair Display font for headers
- Zustand auth store with persist middleware, hydrates by calling `/auth/me` on load

### 3.4 Environment

`.env` at project root contains:
- `DATABASE_URL`, `POSTGRES_*`, `REDIS_*`
- `JWT_SECRET`, `JWT_ALGORITHM=HS256`, `ACCESS_TOKEN_EXPIRE_MINUTES=30`, `REFRESH_TOKEN_EXPIRE_DAYS=7`
- `SUPERADMIN_EMAIL=nishantchy1234@gmail.com`, `SUPERADMIN_PASSWORD=nishant2`
- `GOOGLE_CLIENT_ID=457510785422-qsjus5rhihc7597i8hrfe8v81jtsam03.apps.googleusercontent.com`
- `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback`
- `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, `BREVO_FROM_NAME` (email/OTP)
- `NEXT_PUBLIC_API_URL=http://localhost:8000/api`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID=<same as GOOGLE_CLIENT_ID>`

Google Cloud Console OAuth setup:
- Authorized JavaScript origins: `http://localhost:3001`
- Authorized redirect URIs: `http://localhost:8000/auth/google/callback`

Docker services (per `docker-compose.yml`): `api` (8000), `admin` (3001), `postgres` (5432), `redis` (6379), `worker`, `ui` (3000)

---

## 4. Cleanup Needed BEFORE Any New Work

### 4.1 Simplify `api/core/roles.py`

Current state:
```python
class UserRole(str, Enum):
    SUPERADMIN = "superadmin"
    OWNER = "owner"
    MANAGER = "manager"
    STAFF = "staff"        # ← DELETE
    ACCOUNTANT = "accountant"  # ← DELETE
```

Change to:
```python
class UserRole(str, Enum):
    SUPERADMIN = "superadmin"
    OWNER = "owner"
    MANAGER = "manager"
```

Reason: `STAFF` and `ACCOUNTANT` were placeholders for app-specific roles. Those now live in each app's own `roles.py` (see 2.4). Platform-level users are only superadmin/owner/manager.

### 4.2 Update `UserRole.get_roles_below()`

Currently references STAFF and ACCOUNTANT. Simplify to:
```python
@classmethod
def get_roles_below(cls, role: str) -> list:
    if role == cls.OWNER:
        return [cls.MANAGER]
    return []
```

Owner can create Manager (for delegation). Manager creates nothing at platform level — creating app staff credentials happens through app-specific endpoints, not through the platform user table.

### 4.3 No table changes needed

- `users.role` column stays (still holds one of the 3 remaining enum values)
- Default `owner` in the User model is still correct
- No data migration needed (no existing users have `staff`/`accountant` roles since those were never actually used)

### 4.4 Nothing else

The `user_module_access` idea was never built, so nothing to strip there. `role` column on users is fine as-is.

---

## 5. Plan Going Forward

### Phase 0: Cleanup (10 min)
Do section 4 above before starting anything new.

### Phase 1: Hotel PMS staff auth + credential management (backend)

**Location:** `api/features/hotel_pms/`

**Files to create:**
```
api/features/hotel_pms/
├── __init__.py
├── router.py          # endpoints (both staff-facing + Owner-facing)
├── service.py         # business logic
├── repository.py      # DB queries
├── schemas.py         # Pydantic
├── roles.py           # HotelPMSRole enum: MANAGER, RECEPTIONIST, HOUSEKEEPER
└── (later: auth.py for JWT + password helpers specific to app staff)
```

**New model:** `api/shared_models/hotel_pms_credential.py`
```python
class HotelPMSCredential(Base):
    __tablename__ = "hotel_pms_credentials"
    id = UUID PK
    tenant_id = FK → tenants (indexed)
    role = String (validated against HotelPMSRole)
    username = String
    password_hash = String
    created_by = FK → users
    created_at, updated_at = timestamps
    UniqueConstraint(tenant_id, role)
```
Register in `shared_models/__init__.py`.

**Endpoints to build:**

*Staff-facing (called from pms.dream.com):*
- `POST /hotel-pms/auth/login` — body: `{username, password}`. Returns `{token, role, tenant_id}`. Token TTL 8h.
- `POST /hotel-pms/auth/logout` — invalidates client-side (JWT stateless; just docs it)
- Gate: also verify tenant has active `module_subscriptions` for `hotel_pms`.

*Owner-facing (called from admin dashboard, requires platform JWT + Owner/Manager role):*
- `GET /hotel-pms/credentials` — list all creds for Owner's tenant (returns username + role + created_at, NEVER password)
- `POST /hotel-pms/credentials` — body: `{role, username, password}`. Creates cred. Fails if role already has cred (409).
- `PATCH /hotel-pms/credentials/{role}` — update username and/or password.
- `DELETE /hotel-pms/credentials/{role}` — remove cred (deactivates all staff logins for that role).
- All gated by `require_module_access("hotel_pms")` + `require_owner_or_manager()`.

**New dependency:** `core/deps.py`
- `require_hotel_pms_staff(role: str | None = None)` — decodes app-level JWT, verifies module still active, optionally restricts to a specific role.

### Phase 2: Hotel PMS features (backend build order)

Follow this order strictly (each depends on the previous):

1. **Properties** — branches (`api/features/hotel_pms/properties/`)
2. **Room types** — Deluxe/Standard/Suite with base rate + max occupancy
3. **Rooms** — physical rooms with number, floor, status
4. **Guests** — profiles with contact + ID doc
5. **Bookings** — guest + room + dates + status + rate snapshot (rate is a snapshot column, not a live FK lookup — see `docs/db.md`)
6. **Folios** — per-booking running bill + line items (line items are soft-voided, never deleted — audit requirement)
7. **Invoices** — immutable, fiscal-year numbered (Bikram Sambat), VAT breakdown JSON, self-referencing for reprints
8. **Payments** — dual mode: automated (FonePay/eSewa/Khalti API webhook) OR manual (upload QR image, staff marks paid)
9. **Audit log** — append-only, DB-level `INSERT+SELECT` grant only. Every booking/folio/invoice/payment change writes here.
10. **Reports** — daily revenue, occupancy %, VAT summary. Gated by subscription (report export disabled on `trial_expired`/`suspended` per `mvp.md` §4).

**Every endpoint MUST:**
- Filter by `tenant_id` from the caller's JWT — never trust a `tenant_id` in request body
- Never allow cross-tenant queries even by accident (defense in depth: repository methods take `tenant_id` explicitly)
- For staff endpoints: gate with `require_hotel_pms_staff` + module subscription check
- For Owner endpoints: gate with platform auth + module subscription check

### Phase 3: Owner cross-app dashboard endpoints

Once basic PMS features work:
- `GET /hotel-pms/live-summary` — today's bookings, occupancy %, revenue
- Called by admin dashboard with Owner's platform JWT
- Aggregate data server-side, return small JSON

### Phase 4: Hotel PMS frontend (`pms/` — user will create)

- New Next.js project alongside `admin/`
- Deployed at `pms.dream.com`
- **Root URL (`/`) = login form** (no `/login` path)
- On successful login → redirect based on role:
  - `manager` → `/manager` (or `/manager/dashboard`)
  - `receptionist` → `/receptionist`
  - `housekeeper` → `/housekeeper`
- Each role has its own set of views (manager sees everything, receptionist sees booking/check-in, housekeeper sees room-status)
- Share design tokens with admin: `#E8EDF2` bg, `#0A2947` primary, 24px border-radius
- Uses Sonner for toasts (same as admin)

### Phase 5: `features/modules/` full slice (defer until app #2 or public launch)

- `GET /modules` — catalog
- `GET /modules/subscribed`
- `POST /modules/{code}/start-trial` (for adding NEW modules to an existing tenant beyond the auto-Hotel-PMS trial)
- `POST /modules/{code}/subscribe` (trial → paid conversion)
- Support bundle pricing (`plan_type='bundle_yearly'` — one row per module but same payment reference)

### Phase 6: Restaurant POS

Copy the Hotel PMS blueprint:
- `api/features/restro/` slice with own roles + own credentials table
- New model: `RestroCredential` (same shape as `HotelPMSCredential`, different role enum)
- Add `restro` row to `MODULE_CATALOG` in `core/seed.py`
- Separate `restro/` Next.js project, deployed at `restro.dream.com`

### Phase 7+: Gym, Inventory, Swimming Pool, etc.

Same blueprint. Each new app = new slice + new frontend + new module catalog entry.

---

## 6. Key Files Map (for fast navigation)

### Backend
```
api/main.py                                    App entry + lifespan (seed_superadmin, seed_modules)
api/core/database.py                           SQLAlchemy engine + Base
api/core/configs.py                            Env var settings
api/core/security.py                           JWT helpers, password hash, Google token verify
api/core/seed.py                               seed_superadmin, seed_modules, MODULE_CATALOG list
api/core/roles.py                              *** NEEDS CLEANUP *** (strip to superadmin/owner/manager)
api/shared_models/tenant.py                    Tenant model
api/shared_models/user.py                      User model (role, is_owner, picture_url)
api/shared_models/platform_admin.py            PlatformAdmin model
api/shared_models/module.py                    Module catalog model
api/shared_models/module_subscription.py       ModuleSubscription model
api/features/auth/router.py                    Platform auth endpoints
api/features/auth/service.py                   AuthService (register/login/google_complete/business_register/OTP)
api/features/auth/repository.py                TenantRepository, UserRepository, PlatformAdminRepository
api/features/auth/schemas.py                   Request/response Pydantic models
api/features/modules/repository.py             ModuleRepository, ModuleSubscriptionRepository (only file here for now)
api/utils/helpers.py                           success_response, error_response
api/utils/logger.py                            Logger
api/utils/otp.py                               OTP generate/store/verify (Redis-backed)
api/jobs/email_jobs.py                         Brevo email jobs (OTP verification, team invites)
```

### Frontend (admin/)
```
admin/src/app/layout.tsx                       Root layout with AuthProvider + Toaster
admin/src/app/page.tsx                         / route (login/register/OTP flow)
admin/src/app/dashboard/                       Dashboard routes
admin/src/app/business-register/               Business setup after email register
admin/src/components/auth/AuthProvider.tsx     Wraps GoogleOAuthProvider + hydrates auth store
admin/src/components/auth/AuthPage.tsx         Login/register/OTP UI switcher
admin/src/components/auth/forms/LoginForm.tsx  Email login + Google login button
admin/src/components/auth/forms/RegisterForm.tsx  Email register + Google button
admin/src/components/auth/forms/OtpVerificationForm.tsx  OTP entry
admin/src/components/dashboard/DashboardContent.tsx  Dashboard body
admin/src/components/layout/Sidebar.tsx        Nav sidebar with avatar
admin/src/components/ui/Button.tsx             Primary/secondary/outline button
admin/src/components/ui/FormInput.tsx          Input with icon + password toggle
admin/src/components/ui/Avatar.tsx             User avatar (image or initials)
admin/src/components/shared/Spinner.tsx        Loading spinner
admin/src/hooks/useAuth.ts                     Auth store selector hook
admin/src/hooks/useLogin.ts                    Login mutation + toast
admin/src/hooks/useRegister.ts                 Register mutation + toast
admin/src/store/auth-store.ts                  Zustand store (user, tenant, tokens, isAuthenticated)
admin/src/services/auth-api.ts                 authApi (register/login/google/verifyOtp/etc.)
admin/src/lib/axios-client.ts                  Axios instance + interceptors (401 refresh, skip auth endpoints)
admin/src/lib/auth-storage.ts                  localStorage token helpers
admin/src/lib/design-tokens.ts                 colors, spacing, typography, radius
admin/src/lib/logger.ts                        Frontend logger
admin/src/types/api.ts                         API request/response types
admin/src/types/auth.ts                        User, Tenant, PlatformAdmin, AuthState types
```

### Config
```
docker-compose.yml                             All services + build args
.env                                           All secrets/config
admin/Dockerfile                               Multi-stage Next.js build with NEXT_PUBLIC_* build args
api/Dockerfile                                 FastAPI build
```

### Docs (read for background, but this file supersedes conflicts)
```
docs/mvp.md         Business scope, tenant lifecycle, gating rules, pricing
docs/db.md          Full Hotel PMS DB schema (properties → rooms → bookings → folios → invoices → payments)
docs/diagram.md     ER diagram
docs/auth.md        Original auth plan (partially superseded — the user_module_access table is NOT being built)
```

---

## 7. Working Style / Conventions

- **Minimal changes.** Don't refactor unrelated code. Don't add features beyond what was asked.
- **No unnecessary comments in code.** Only comment WHY when it's non-obvious. Never explain WHAT.
- **No inline error boxes on forms.** Use Sonner toasts for all user-facing messages.
- **Terse responses.** State results directly. Don't recap.
- **Confirm before destructive actions.** Never `git reset --hard`, force push, or drop tables without explicit approval.
- **Never skip git hooks** (`--no-verify`) unless explicitly requested.
- **Follow existing slice pattern:** `router.py` / `service.py` / `repository.py` / `schemas.py`. Each feature is a folder.
- **Repository methods always take `tenant_id` explicitly.** No silent cross-tenant queries. Defense in depth against multi-tenant bugs.
- **Test UI in browser before claiming success.** Type-check and tests verify code correctness, not feature correctness. If UI can't be tested in the current environment, say so explicitly.
- **Prefer editing over creating.** Don't spawn new files when an existing file fits.
- **Follow the design tokens.** Don't hardcode colors — use `colors.primary[800]` etc.
- **All new frontend routes must respect auth state.** Check `useAuth().isAuthenticated` before rendering protected content.

---

## 8. Recent Context Log

*User adds notes here about work done from other machines so future Claude sessions can pick up context.*

### 2026-07-29 — Handoff created
Everything above reflects the state as of this handoff. Auth is complete, modules seeded, auto-trial working. User is leaving for a few days and will continue on laptop. Cleanup + Hotel PMS staff auth slice is the next work when they return.

### (add new dated entries below as work progresses)

---

## 9. Quick Command Reference

```bash
# Rebuild admin frontend after changes
docker-compose build admin && docker-compose up -d admin

# Rebuild API
docker-compose build api && docker-compose up -d api

# Full stack
docker-compose up -d

# Check running services
docker-compose ps

# Tail API logs
docker-compose logs -f api

# Postgres shell
docker exec -it postgres psql -U postgres -d dream_app

# Check module subscriptions
docker exec postgres psql -U postgres -d dream_app -c "select t.name, m.code, ms.status, ms.trial_expires_at from module_subscriptions ms join modules m on m.id = ms.module_id join tenants t on t.id = ms.tenant_id;"
```
