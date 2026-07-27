# Auth Module — Implementation Plan

Covers the `features/auth/` slice: data model, file responsibilities, and every flow (register, manual login, Google OAuth, `/auth/me`, staff invites, SuperAdmin). This is the plan to build against — write the migration and code from this, not the other way around.

## Phase 1 scope (build this first)
- `tenants`, `users` (minimal fields only — see below), `platform_admins`
- Superadmin seeding from environment variables at startup
- `POST /auth/register`, `POST /auth/login` only

**Deferred to later phases, on purpose:** `user_module_access`, `role`, `google_id`, Google OAuth flow, `/auth/me`, `/auth/refresh`, staff invites. These are documented below so the eventual design is already thought through, but none of it gets built until the phase that actually needs it. Don't reserve empty columns for these now — add them when the feature lands.

---

## 1. Data models involved

These live in `shared_models/`, not inside `features/auth/` (per the dir-structure discussion) — auth is one of several features that use them.

### `users` (tenant-side accounts — Owner + all staff)

**Build note:** this is Phase 1 scope. Only the fields below are being built right now — `role`, `google_id`, and any subscription/module fields are deferred until the roles/modules feature is actually built, added then rather than reserved now.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `tenant_id` | UUID FK → tenants | every user belongs to exactly one tenant |
| `full_name` | string | |
| `email` | string | **globally unique**, not per-tenant — see note below |
| `password_hash` | string, nullable | nullable because a Google-only user may never set one |
| `is_owner` | boolean, default false | bypasses per-module role checks entirely — see role model below |
| `is_active` | boolean, default true | soft-disable a staff account without deleting it |
| `created_at` | timestamp | |

**Why email is globally unique, not per-tenant:** per-tenant uniqueness makes login ambiguous — if the same email had accounts at two different hotels, a plain email+password login couldn't tell which tenant to enter without an extra "pick your business" step. Global uniqueness keeps login a single unambiguous lookup. The tradeoff: a person can't be invited to a second, unrelated tenant using the same email address — they'd need a different email for that second account. Revisit only if multi-tenant-per-email turns out to matter in practice.

**Not yet built, deferred to a later phase:** `phone`, `google_id`, `last_login_at`, `role`/`user_module_access`. These get added exactly when the feature that needs them gets built — not reserved as empty columns now.

### `user_module_access` — DEFERRED, not built in Phase 1

Replaces the old fixed `role` enum column, but is **not being built yet** — Phase 1 ships with just `users.is_owner` as the only access distinction (Owner vs. everyone else doesn't exist yet, since staff accounts aren't being built this phase either). This table's design is kept here for when that phase starts:

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → users | |
| `module_id` | UUID FK → modules | which app (hotel_pms, restaurant_pos, ...) |
| `property_id` | UUID FK → properties, nullable | null if module scope = tenant-wide |
| `role` | string | validated against a per-module allowed-role list in application code, **not** a Postgres ENUM |
| `granted_by` | UUID FK → users | audit — who invited/granted this access |
| `created_at` | timestamp | |

Owner does **not** need rows here — `is_owner = true` on `users` grants access to every module the tenant subscribes to, automatically, including future modules. This table is only for staff with scoped, specific access.

### `platform_admins` (SuperAdmin — completely separate from tenant users)
| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `email` | string, unique globally | |
| `password_hash` | string | always required, no Google login for SuperAdmin — keep this account type simple and hard to phish |
| `is_active` | boolean | |
| `created_at` | timestamp | |

No `tenant_id` column at all — this is deliberate, discussed previously. Seeded once at startup from `.env` (`SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`), hashed on seed, never stored plain.

---

## 2. Directory structure & layer responsibilities

```
features/auth/
├── router.py       # HTTP layer only — no business logic
├── service.py       # business logic — the actual brain of this module
├── repository.py     # DB queries only — no decisions, no validation
├── schemas.py       # Pydantic request/response models
├── oauth.py         # Google OAuth-specific client/token-exchange logic
└── security.py       # (or in core/) password hashing, JWT encode/decode helpers
```

**`schemas.py`** — defines what goes over the wire. Never expose ORM models directly.
- `RegisterRequest` (full_name, email, password, business_name)
- `LoginRequest` (email, password)
- `TokenResponse` (access_token, refresh_token, token_type)
- `UserMeResponse` (id, full_name, email, is_owner, tenant_id, apps: list of module access summaries)

**`repository.py`** — pure data access, no logic or decisions.
- `get_user_by_email(db, tenant_id, email)`
- `get_user_by_google_id(db, google_id)`
- `create_user(db, ...)`
- `create_tenant(db, ...)`
- `get_module_subscriptions_for_tenant(db, tenant_id)`
- `get_module_access_for_user(db, user_id)`
- Every method that touches tenant data takes `tenant_id` explicitly as a parameter — never a method that silently queries across tenants.

**`service.py`** — where the actual decisions happen. This is what `router.py` calls.
- `register_new_tenant(data)` — creates Tenant + Owner User in one transaction, does *not* create any `module_subscription` yet (that's a separate, explicit step — see flow below)
- `authenticate_user(email, password)` — checks `platform_admins` first, then tenant `users`; verifies password hash
- `login_with_google(google_token)` — verifies Google token, finds-or-creates/links user
- `issue_tokens(user_or_admin)` — builds the JWT payload (shape differs for SuperAdmin vs tenant user), signs access + refresh tokens
- `get_current_user_summary(user)` — builds the `/auth/me` response, including the list of apps this user can access (Owner → all tenant's subscribed modules; staff → only their `user_module_access` rows)
- `invite_staff_member(inviter, email, module_id, role, property_id)` — creates a `users` row (if new) + a `user_module_access` row; enforces that only Owner/Manager can call this (checked here, not in the router)

**`router.py`** — thin. Parses request, calls one service function, returns response. No `if` statements deciding business rules here.

```
POST /auth/register
POST /auth/login
GET  /auth/google/login
GET  /auth/google/callback
GET  /auth/me
POST /auth/refresh
```

(`POST /users/invite` lives in a separate `features/users/` slice, not inside auth — inviting staff is a user-management concern that happens to call into auth's token/service layer, not an auth concern itself.)

**`core/deps.py`** (shared across all features, not just auth) — this is where request-level enforcement lives:
- `get_current_user(token)` — decodes JWT, loads user, **sets the Postgres session variable for RLS** (`SET app.current_tenant_id = ...`) before returning
- `require_owner()` — dependency that 403s if `is_owner` is false
- `require_module_access(module_code)` — dependency factory: checks `is_owner` OR looks up `user_module_access` for that module; 403s otherwise
- `require_superadmin()` — separate dependency, checked against the SuperAdmin JWT shape, and switches the DB connection to the `app_superadmin` role (the one granted `BYPASS RLS`) rather than `app_user`

---

## 3. Core flows

### Register (`POST /auth/register`)
1. `service.register_new_tenant()`: create `Tenant` row, create `User` row with `is_owner = true`, in one DB transaction.
2. **No module_subscription created here.** Registration just creates the account — choosing which app to trial happens as a separate, explicit next step (`POST /modules/{module_code}/start-trial` in the `features/modules/` slice), matching the "user should be able to choose which app they want to trial" requirement.
3. Issue tokens immediately so they land in a logged-in state, then the frontend routes them to "choose your app" screen.

### Manual Login (`POST /auth/login`)
1. `service.authenticate_user(email, password)`:
   - Check `platform_admins` by email first. Found + password matches → issue SuperAdmin JWT, done.
   - Else, check tenant `users` by email. Found + password matches → issue tenant JWT.
   - Neither → 401, generic "invalid credentials" message (never reveal which part failed).
2. Update `last_login_at`.

### Google Login (`GET /auth/google/login` → `GET /auth/google/callback`)
1. `/google/login` redirects to Google's consent screen.
2. Google redirects back to `/google/callback` with an auth code.
3. `oauth.py` exchanges the code for Google's ID token, extracts `email` + `google_id` + `email_verified`.
4. `service.login_with_google()`:
   - If a `users` row already has this `google_id` → log them in directly.
   - Else if a `users` row exists with this `email` (manual signup previously) **and** Google reports `email_verified = true` → link `google_id` onto that existing row, log in.
   - Else → this email has never registered a tenant; Google login alone should **not** silently create a new tenant — redirect to the registration flow instead, pre-filling name/email, so tenant creation always goes through the same deliberate `register_new_tenant()` path.
5. Issue tokens identically to manual login from this point on — everything downstream treats the session the same regardless of login method.

### `/auth/me`
Returns identity + the app list, built differently depending on who's asking:
- SuperAdmin → minimal payload, no tenant/app concept applies
- Owner → `is_owner: true` + every `module_subscription` the tenant currently has (any status, so frontend can show trial/active/expired states per app)
- Staff → only the modules present in their `user_module_access` rows, each with the role they hold in that specific app

### Refresh (`POST /auth/refresh`)
Standard short-lived access token (~15–60 min) + longer-lived refresh token pattern, discussed earlier — this is what keeps subscription/role changes from being stuck inside a long-lived token.

### Invite staff (`POST /users/invite`, separate feature, calls into auth service)
1. Guarded by `require_owner()` or a Manager-level check (Manager can invite within their own module/property; only Owner can invite Managers).
2. Creates `users` row if the email is new to this tenant, or reuses it if the person already has *some* access (e.g., already a Front Desk user being additionally granted Restaurant POS access).
3. Creates the `user_module_access` row: `(user_id, module_id, property_id, role)`.
4. Sends invite email with a set-password link (or, if using Google-only accounts, just notifies them to log in with Google).

---

## 4. JWT payload shapes

**Tenant user:**
```json
{ "user_id": "...", "tenant_id": "...", "is_owner": true, "exp": ... }
```

**SuperAdmin:**
```json
{ "admin_id": "...", "is_superadmin": true, "exp": ... }
```

Deliberately thin — no roles, no module list, no subscription status baked in. Every protected route re-checks current `user_module_access` / `module_subscriptions` state fresh via `deps.py`, so a suspended module or removed staff member loses access the moment their current access token expires (not whenever they next log in).

---

## 5. Security checklist before this ships
- [ ] Passwords hashed with bcrypt/argon2, never reversible, never logged
- [ ] `password_hash` and `google_id` both nullable, application logic never assumes exactly one is set
- [ ] Every `repository.py` method takes `tenant_id` explicitly — no method that can accidentally query cross-tenant
- [ ] RLS policies live on `users`, `user_module_access`, and every tenant-scoped table beyond auth; `app.current_tenant_id` is set in `deps.py` on every request before any query runs
- [ ] SuperAdmin operations run under a distinct `app_superadmin` Postgres role with explicit `BYPASS RLS` — never a flag checked only in application code
- [ ] Generic error messages on failed login (don't reveal whether email exists, whether it's a SuperAdmin vs tenant lookup, etc.)
- [ ] Google `email_verified` is checked before ever auto-linking an account by email match

---

## 6. Environment variables

Phase 1 needs:
```
DATABASE_URL=
JWT_SECRET=
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
SUPERADMIN_EMAIL=
SUPERADMIN_PASSWORD=
```

Reserved for the Google OAuth phase (not used until that flow is actually built, but worth setting up the app registration in Google Cloud Console ahead of time since that step has its own lead time):
```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=       # e.g. https://yourapp.com/auth/google/callback
```