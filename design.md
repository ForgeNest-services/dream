# Entity-Relationship Diagram — Hospitality SaaS

Complete schema reference. This is the source of truth for the backend build — every table, attribute, and relationship from `hospitality-saas-database-design.md`, rendered as one diagram.

```mermaid
erDiagram
    TENANTS ||--o{ PROPERTIES : owns
    TENANTS ||--o{ USERS : employs
    PROPERTIES ||--o{ USERS : "staffed by"
    PROPERTIES ||--o{ ROOM_TYPES : defines
    ROOM_TYPES ||--o{ ROOMS : categorizes
    PROPERTIES ||--o{ ROOMS : has
    TENANTS ||--o{ GUESTS : hosts
    PROPERTIES ||--o{ BOOKINGS : hosts
    ROOMS ||--o{ BOOKINGS : "booked as"
    GUESTS ||--o{ BOOKINGS : makes
    USERS ||--o{ BOOKINGS : "created by"
    BOOKINGS ||--|| FOLIOS : generates
    FOLIOS ||--o{ FOLIO_LINE_ITEMS : contains
    FOLIOS ||--o{ INVOICES : produces
    TENANTS ||--o{ INVOICES : issues
    PROPERTIES ||--o{ INVOICES : issues
    INVOICES ||--o{ INVOICES : "reprint of"
    TENANTS ||--o{ AUDIT_LOG : logs
    USERS ||--o{ AUDIT_LOG : performs
    PROPERTIES ||--o{ MERCHANT_CREDENTIALS : configures
    FOLIOS ||--o{ PAYMENTS : "settled by"
    USERS ||--o{ PAYMENTS : confirms
    TENANTS ||--o{ TENANT_SUBSCRIPTIONS : subscribes

    TENANTS {
        uuid id PK
        string business_name
        string pan_vat_number
        string contact_email
        string contact_phone
        string subscription_plan "trial | monthly | yearly"
        timestamp trial_started_at
        timestamp trial_expires_at
        string subscription_status "active | expired | suspended | cancelled"
        int branch_addon_count
        timestamp created_at
        timestamp updated_at
    }

    PROPERTIES {
        uuid id PK
        uuid tenant_id FK
        string name
        text address
        string city
        boolean is_active
        timestamp created_at
    }

    USERS {
        uuid id PK
        uuid tenant_id FK
        uuid property_id FK "nullable — NULL only for role=owner"
        string full_name
        string email
        string phone
        string password_hash
        enum role "owner | manager | front_desk | accountant | chef | waiter"
        boolean is_active
        timestamp last_login_at
        timestamp created_at
    }

    ROOM_TYPES {
        uuid id PK
        uuid property_id FK
        string name
        numeric base_rate
        int max_occupancy
        timestamp created_at
    }

    ROOMS {
        uuid id PK
        uuid property_id FK
        uuid room_type_id FK
        string room_number
        string floor
        string status "available | occupied | maintenance | cleaning"
        boolean is_active
    }

    GUESTS {
        uuid id PK
        uuid tenant_id FK
        string full_name
        string phone
        string email
        string id_document_type "citizenship | passport"
        string id_document_number
        string nationality
        timestamp created_at
    }

    BOOKINGS {
        uuid id PK
        uuid property_id FK
        uuid room_id FK
        uuid guest_id FK
        date check_in_date
        date check_out_date
        timestamp actual_check_in
        timestamp actual_check_out
        enum status "reserved | checked_in | checked_out | cancelled | no_show"
        numeric rate_per_night "snapshot at booking time"
        int num_guests
        uuid created_by FK
        timestamp created_at
    }

    FOLIOS {
        uuid id PK
        uuid booking_id FK
        string status "open | closed | paid"
        numeric subtotal
        numeric vat_amount
        numeric total_amount
        timestamp created_at
        timestamp updated_at
    }

    FOLIO_LINE_ITEMS {
        uuid id PK
        uuid folio_id FK
        string description
        numeric quantity
        numeric unit_price
        numeric amount
        boolean is_voided
        text voided_reason
        timestamp created_at
    }

    INVOICES {
        uuid id PK
        uuid folio_id FK
        uuid tenant_id FK
        uuid property_id FK
        string invoice_number UK "fiscal-year based, unique per property"
        string fiscal_year "Bikram Sambat, e.g. 2081-82"
        json vat_breakdown
        numeric total_amount
        timestamp generated_at
        boolean is_reprint
        uuid reprint_of FK "self-reference to original invoice"
        boolean cbms_synced
    }

    AUDIT_LOG {
        uuid id PK
        uuid tenant_id FK
        string entity_type "booking | folio | invoice | payment etc"
        uuid entity_id
        string action "create | update | void | cancel"
        uuid performed_by FK
        json before_state
        json after_state
        text reason
        timestamp created_at
    }

    MERCHANT_CREDENTIALS {
        uuid id PK
        uuid property_id FK
        string provider "fonepay | esewa | khalti"
        string mode "automated | manual"
        string merchant_id "NULL if mode = manual"
        string secret_key_encrypted "NULL if mode = manual"
        string qr_image_url "NULL if mode = automated"
        boolean is_active
        timestamp created_at
    }

    PAYMENTS {
        uuid id PK
        uuid folio_id FK
        string mode "automated | manual | cash | bank_transfer"
        string provider "fonepay | esewa | khalti | null"
        numeric amount
        string status "pending | confirmed | failed"
        string provider_txn_id
        uuid confirmed_by FK
        timestamp confirmed_at
        timestamp created_at
    }

    TENANT_SUBSCRIPTIONS {
        uuid id PK
        uuid tenant_id FK
        string plan_type "trial | monthly | yearly"
        int branch_addon_count
        numeric amount_charged
        timestamp starts_at
        timestamp ends_at
        string payment_reference
        string status "active | expired | cancelled"
        timestamp created_at
    }
```

## Constraints not expressible in ER notation

Mermaid's ERD syntax shows structure and cardinality but can't show `CHECK` constraints or partial uniqueness. These are enforced at the database level per `hospitality-saas-database-design.md` and must not be lost when this gets translated into actual migrations:

| Table | Constraint | Rule |
|---|---|---|
| `USERS` | `chk_owner_no_property` | `property_id` must be NULL if `role = 'owner'`, and NOT NULL for every other role |
| `BOOKINGS` | `chk_dates` | `check_out_date` must be strictly greater than `check_in_date` |
| `MERCHANT_CREDENTIALS` | `chk_mode_fields` | if `mode = 'automated'`: `merchant_id` and `secret_key_encrypted` required; if `mode = 'manual'`: `qr_image_url` required |
| `INVOICES` | uniqueness | `invoice_number` unique per `property_id`, not globally unique |
| `INVOICES`, `AUDIT_LOG` | append-only | application DB role gets `INSERT`+`SELECT` only — no `UPDATE`/`DELETE` grant, enforced at the database permission level, not just application code |

## Relationship notes

- `BOOKINGS ||--|| FOLIOS` is one-to-one: every booking has exactly one folio.
- `INVOICES ||--o{ INVOICES` ("reprint of") is a self-referencing relationship — a reprinted invoice is a new row pointing back to the original via `reprint_of`, never an edit to the original row.
- `USERS.property_id` participates in two different relationships depending on role: for `owner`, it's NULL (no property link); for every other role, it links to exactly one property. This is why the `PROPERTIES ||--o{ USERS` relationship is drawn as optional (`o{`) rather than mandatory.
- Tables intentionally not yet present: restaurant/POS tables (menu items, kitchen orders), HR/payroll tables (attendance, leave, payslips), and a dedicated CBMS sync/queue table. `INVOICES.cbms_synced` is a placeholder boolean until the real CBMS module is scoped.