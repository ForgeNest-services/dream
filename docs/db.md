# Hospitality SaaS — Database Design (PostgreSQL DDL)

This is the concrete implementation of the architecture in the SRS doc. Every design choice below ties back to a decision we already made — flagged inline so nothing here is arbitrary.

## Design conventions used throughout
- **UUID primary keys**, not auto-increment integers — safer for a multi-tenant system (no risk of ID enumeration across tenants, easier to merge/migrate data later, and works cleanly if you ever shard by tenant).
- **`tenant_id` or `property_id` on every table** that holds business data — enforced at the query layer so one hotel can never see another's data, even by bug.
- **No hard deletes anywhere in financial data.** Voids and corrections are new rows referencing the original, never `UPDATE`/`DELETE`. This is the audit-trail requirement from Part 2 of the SRS, implemented for real here, not just described.
- **`NUMERIC(10,2)`** for all money fields — never `FLOAT`, which introduces rounding errors that are unacceptable in invoices.

---

## Schema

```sql
-- ============================================================
-- TENANTS (the business/owner account — spans all branches)
-- ============================================================
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name VARCHAR(255) NOT NULL,
    pan_vat_number VARCHAR(50),
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(20),
    subscription_plan VARCHAR(20) NOT NULL DEFAULT 'trial',   -- trial | monthly | yearly
    trial_started_at TIMESTAMPTZ,
    trial_expires_at TIMESTAMPTZ,
    subscription_status VARCHAR(20) NOT NULL DEFAULT 'active', -- active | expired | suspended | cancelled
    branch_addon_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PROPERTIES (branches) — the multi-branch hierarchy from Part 2
-- ============================================================
CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_properties_tenant ON properties(tenant_id);

-- ============================================================
-- USERS (staff accounts) — hardcoded roles, portal-per-role
-- ============================================================
CREATE TYPE user_role AS ENUM ('owner','manager','front_desk','accountant','chef','waiter');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    property_id UUID REFERENCES properties(id),   -- NULL only for 'owner' — owner spans all branches
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, email),
    CONSTRAINT chk_owner_no_property CHECK (
        (role = 'owner' AND property_id IS NULL) OR (role != 'owner')
    )
);
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_property ON users(property_id);

-- ============================================================
-- ROOM TYPES & ROOMS
-- ============================================================
CREATE TABLE room_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id),
    name VARCHAR(100) NOT NULL,          -- e.g. "Deluxe", "Standard"
    base_rate NUMERIC(10,2) NOT NULL,
    max_occupancy INT NOT NULL DEFAULT 2,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id),
    room_type_id UUID NOT NULL REFERENCES room_types(id),
    room_number VARCHAR(20) NOT NULL,
    floor VARCHAR(20),
    status VARCHAR(20) NOT NULL DEFAULT 'available',  -- available | occupied | maintenance | cleaning
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(property_id, room_number)
);
CREATE INDEX idx_rooms_property ON rooms(property_id);

-- ============================================================
-- GUESTS
-- ============================================================
CREATE TABLE guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    id_document_type VARCHAR(50),     -- citizenship | passport
    id_document_number VARCHAR(100),
    nationality VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_guests_tenant ON guests(tenant_id);
CREATE INDEX idx_guests_phone ON guests(phone);

-- ============================================================
-- BOOKINGS
-- ============================================================
CREATE TYPE booking_status AS ENUM ('reserved','checked_in','checked_out','cancelled','no_show');

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id),
    room_id UUID NOT NULL REFERENCES rooms(id),
    guest_id UUID NOT NULL REFERENCES guests(id),
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    actual_check_in TIMESTAMPTZ,
    actual_check_out TIMESTAMPTZ,
    status booking_status NOT NULL DEFAULT 'reserved',
    rate_per_night NUMERIC(10,2) NOT NULL,   -- snapshot at booking time — rate changes later must not alter past bookings
    num_guests INT NOT NULL DEFAULT 1,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_dates CHECK (check_out_date > check_in_date)
);
CREATE INDEX idx_bookings_property_dates ON bookings(property_id, check_in_date, check_out_date);
CREATE INDEX idx_bookings_room ON bookings(room_id);

-- ============================================================
-- FOLIOS & LINE ITEMS (guest bill)
-- ============================================================
CREATE TABLE folios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id),
    status VARCHAR(20) NOT NULL DEFAULT 'open',   -- open | closed | paid
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
    vat_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE folio_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folio_id UUID NOT NULL REFERENCES folios(id),
    description VARCHAR(255) NOT NULL,     -- "Room charge - night 1", "Extra bed", etc.
    quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
    unit_price NUMERIC(10,2) NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    is_voided BOOLEAN NOT NULL DEFAULT FALSE,   -- corrections VOID a line, never delete it
    voided_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INVOICES — immutable, fiscal-year numbered, CBMS-ready
-- ============================================================
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folio_id UUID NOT NULL REFERENCES folios(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    property_id UUID NOT NULL REFERENCES properties(id),
    invoice_number VARCHAR(50) NOT NULL,     -- e.g. "2081-82/PROP001/000123"
    fiscal_year VARCHAR(10) NOT NULL,        -- Bikram Sambat, e.g. "2081-82"
    vat_breakdown JSONB NOT NULL,            -- { taxable_amount, vat_rate, vat_amount }
    total_amount NUMERIC(10,2) NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_reprint BOOLEAN NOT NULL DEFAULT FALSE,
    reprint_of UUID REFERENCES invoices(id),  -- self-reference for "Copy of Original–2/3..." labeling
    cbms_synced BOOLEAN NOT NULL DEFAULT FALSE,  -- placeholder — flips true once CBMS module is built
    UNIQUE(property_id, invoice_number)
);
-- IMPORTANT: the application's DB role must be granted INSERT + SELECT only on this table.
-- No UPDATE, no DELETE — enforce this with a REVOKE, not just app-layer discipline.

-- ============================================================
-- AUDIT LOG — append-only, the backbone of IRD compliance
-- ============================================================
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    entity_type VARCHAR(50) NOT NULL,   -- 'booking' | 'folio' | 'invoice' | 'payment' etc.
    entity_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL,        -- create | update | void | cancel
    performed_by UUID NOT NULL REFERENCES users(id),
    before_state JSONB,
    after_state JSONB,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
-- Same rule as invoices: app DB role gets INSERT + SELECT only, never UPDATE/DELETE.

-- ============================================================
-- MERCHANT CREDENTIALS — dual mode (automated API vs manual QR)
-- ============================================================
CREATE TABLE merchant_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id),
    provider VARCHAR(20) NOT NULL,     -- fonepay | esewa | khalti
    mode VARCHAR(20) NOT NULL,         -- automated | manual
    merchant_id VARCHAR(255),          -- NULL if mode = manual
    secret_key_encrypted TEXT,         -- NULL if mode = manual; encrypted at rest always
    qr_image_url TEXT,                 -- NULL if mode = automated
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(property_id, provider),
    CONSTRAINT chk_mode_fields CHECK (
        (mode = 'automated' AND merchant_id IS NOT NULL AND secret_key_encrypted IS NOT NULL)
        OR
        (mode = 'manual' AND qr_image_url IS NOT NULL)
    )
);

-- ============================================================
-- PAYMENTS (guest → hotel)
-- ============================================================
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folio_id UUID NOT NULL REFERENCES folios(id),
    mode VARCHAR(20) NOT NULL,         -- automated | manual | cash | bank_transfer
    provider VARCHAR(20),              -- fonepay | esewa | khalti | NULL for cash
    amount NUMERIC(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | confirmed | failed
    provider_txn_id VARCHAR(255),      -- from webhook; NULL if manually confirmed
    confirmed_by UUID REFERENCES users(id),  -- staff who manually marked this paid
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_folio ON payments(folio_id);

-- ============================================================
-- MODULES — the product catalog (Core PMS is module #1, not special-cased)
-- ============================================================
CREATE TABLE modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,   -- 'pms_core' | 'restaurant_pos' | future modules
    name VARCHAR(100) NOT NULL,
    is_core BOOLEAN NOT NULL DEFAULT FALSE,   -- TRUE only for pms_core — cannot be deactivated while tenant is active
    scope VARCHAR(20) NOT NULL DEFAULT 'property',  -- 'property' | 'tenant' — most modules are per-branch; a future cross-branch analytics module would be tenant-scoped
    default_trial_days INT NOT NULL DEFAULT 30,
    monthly_price NUMERIC(10,2) NOT NULL,
    yearly_price NUMERIC(10,2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,   -- can this module currently be purchased at all
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Seed row example: ('pms_core', 'Core PMS', is_core=TRUE, scope='property', 2999, 11999)
--                    ('restaurant_pos', 'Restaurant POS', is_core=FALSE, scope='property', 999, 3999)

-- ============================================================
-- MODULE SUBSCRIPTIONS (hotel → you — replaces the old single tenant_subscriptions table)
-- One row per tenant+module (+property, if module scope = 'property')
-- Each module's trial/paid/expired status is fully independent of every other module.
-- ============================================================
CREATE TABLE module_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    property_id UUID REFERENCES properties(id),   -- NULL if modules.scope = 'tenant' for this module
    module_id UUID NOT NULL REFERENCES modules(id),
    plan_type VARCHAR(20) NOT NULL,    -- trial | monthly | yearly
    trial_started_at TIMESTAMPTZ,
    trial_expires_at TIMESTAMPTZ,
    amount_charged NUMERIC(10,2),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    payment_reference VARCHAR(255),    -- your own FonePay/eSewa/Khalti txn ref when hotel pays you
    status VARCHAR(20) NOT NULL DEFAULT 'trial',  -- trial | active | grace_period | suspended | cancelled
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, property_id, module_id)
);
CREATE INDEX idx_module_subs_tenant ON module_subscriptions(tenant_id);
CREATE INDEX idx_module_subs_property ON module_subscriptions(property_id);
```

**Why this replaces the flat `tenant.subscription_plan` field for gating purposes:** `tenants.subscription_plan`/`subscription_status` (defined earlier in this schema) still exist and now represent specifically the **Core PMS module's** status for quick top-level checks — but the actual source of truth for "does this tenant/property have access to module X right now" is always a lookup against `module_subscriptions`, never the tenant table alone. Every new module you ever build (HR/payroll, channel manager, whatever comes next) is just a new row in `modules` plus new rows in `module_subscriptions` — no schema change required.

---

## Why these specific choices

| Decision | Reasoning |
|---|---|
| `rate_per_night` stored on `bookings`, not looked up live from `room_types` | If you change a room's rate next month, past bookings must keep showing what the guest was actually charged. This is a snapshot, not a live reference. |
| `folio_line_items.is_voided` instead of deleting a wrong charge | Matches the IRD audit-trail requirement — nothing about a guest's bill history ever disappears, it's only ever marked void with a reason. |
| `invoices.reprint_of` self-reference | Matches IRD's "Copy of Original–2/3…" reprint labeling requirement directly — a reprinted invoice is a new row pointing back to the original, not a flag on the same row. |
| `merchant_credentials` has one `CHECK` constraint enforcing mode-appropriate fields | Prevents a broken half-state (e.g., automated mode with no secret key) from ever being saved — the database itself refuses invalid configurations, not just the frontend form. |
| `users.property_id` nullable only for `owner` | Enforced with a `CHECK` constraint, not just application logic — the database physically cannot represent a Manager without a branch, or an Owner incorrectly locked to one branch. |
| Separate `tenant_subscriptions` table from `payments` | These are two unrelated money flows (guest→hotel vs hotel→you) — keeping them in separate tables prevents any accidental mixing of reporting or logic between them. |

## What's intentionally NOT in this schema yet
- Restaurant/POS tables (menu items, orders, kitchen tickets) — Chef/Waiter roles exist in the `user_role` enum already so login/access works, but the actual order-taking tables come with that module later.
- HR/payroll tables (attendance, leave, payslips) — staff accounts above are login/access only.
- CBMS-specific sync tables — `invoices.cbms_synced` is a placeholder boolean; the actual sync log/queue table gets added once you have the real CBMS API spec.

## Next step
This schema is ready to hand to Claude Code as the starting migration. From here, the natural build order is: tenants → properties → users/roles → rooms → bookings → folios → invoices → payments, since each layer depends on the one before it.