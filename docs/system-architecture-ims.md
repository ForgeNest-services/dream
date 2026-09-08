# System Architecture Document

**Software Name:** Srota IMS — Inventory Management System  
**Developed by:** Forgenest Services Pvt. Ltd.  
**Version:** 1.0  
**Date:** [DATE]  
**Prepared by:** Nishant Chaudhary, Technical Director

---

## 1. Overview

Srota IMS is a web-based inventory and billing management system. It is accessed through a standard web browser and communicates with a central server hosted in Nepal. The system issues tax invoices and abbreviated bills, submits them to IRD's Central Billing Management System (CBMS), and generates VAT and purchase reports in the formats specified under Electronic Billing Procedure 2082.

---

## 2. System Components

### 2.1 Frontend (Client)

| Item | Detail |
|---|---|
| Type | Web application (Single Page Application) |
| Technology | React 19, TypeScript, Vite |
| Served by | Nginx (inside Docker container) |
| Access | Via web browser over HTTPS |
| Supported browsers | Chrome, Firefox, Edge, mobile browsers |

The frontend runs entirely in the user's browser. It communicates with the API server using HTTPS requests (JSON over REST). No business logic, tax calculation, or data storage happens on the client side — all calculations are performed and all data is persisted on the server.

### 2.2 API Server

| Item | Detail |
|---|---|
| Technology | Python 3.14, FastAPI |
| Container | `srota-api` (Docker) |
| Port | 8000 (internal), exposed via reverse proxy |
| Database connection | Restricted role `srota_app` for all request traffic |
| Authentication | JWT (HS256), 30-minute access tokens |

The API server handles all business logic: invoice creation, stock movement, purchase recording, report generation, credit note issuance, and CBMS payload construction. It connects to the database using a restricted database role that has UPDATE/DELETE revoked on transaction tables (see Section 5).

### 2.3 Database

| Item | Detail |
|---|---|
| Technology | PostgreSQL |
| Container | `srota-postgres` (Docker) |
| WAL Archiving | Enabled (`archive_mode=on`, 30-minute timeout) |
| Backups | Automated via `srota-postgres-backup` container |

All application data is stored in PostgreSQL. The database enforces immutability on issued invoices through column-level privilege revocation and row-level triggers (see Section 5).

### 2.4 Background Worker

| Item | Detail |
|---|---|
| Technology | Python, RQ (Redis Queue) |
| Container | `srota-worker` (Docker) |
| Queue backend | Redis 7 |
| Purpose | Asynchronous CBMS submission to IRD |

When an invoice is finalized, the API server enqueues a CBMS sync job. The background worker picks up the job from the Redis queue and submits the invoice payload to IRD's CBMS endpoint (`cbapi.ird.gov.np`). This ensures that a slow or temporarily unavailable CBMS connection does not block the billing counter. Failed jobs are retried automatically per RQ's retry policy. Sync status (`cbms_synced`, `cbms_synced_at`) is recorded on each invoice row after a successful response.

### 2.5 Object Storage

| Item | Detail |
|---|---|
| Technology | MinIO (S3-compatible) |
| Container | `srota-minio` (Docker) |
| Purpose | Product images, barcode label assets |
| Backup | Automated via `srota-minio-backup` container |

### 2.6 Reverse Proxy

| Item | Detail |
|---|---|
| Technology | Nginx Proxy + ACME Companion |
| Purpose | SSL termination (Let's Encrypt), routing to containers |
| Protocol | HTTPS only in production |

---

## 3. Deployment

All components run as Docker containers on a single Nepal-hosted server within a private Docker network (`srota-network`). Containers communicate with each other over this internal network. Only the reverse proxy exposes ports 80 and 443 to the public internet.

```
Internet
   │ HTTPS (443)
   ▼
Nginx Proxy (SSL termination)
   │
   ├──► srota-ims (frontend, port 80 internal)
   │
   └──► srota-api (API server, port 8000 internal)
              │
              ├──► srota-postgres (PostgreSQL)
              ├──► srota-redis (Redis)
              └──► srota-minio (object storage)

srota-worker ──► srota-redis (job queue)
srota-worker ──► cbapi.ird.gov.np (CBMS, HTTPS)
```

---

## 4. Data Flow — Invoice Issuance

1. Staff logs into Srota IMS via browser over HTTPS.
2. Staff adds products to the invoice and clicks **Finalize Invoice**.
3. Browser sends a `POST /ims/invoices` request to the API server over HTTPS.
4. API server validates the request, calculates VAT, assigns a sequential invoice number, snapshots seller/buyer/product details, and writes the invoice to PostgreSQL — all within a single database transaction.
5. Stock is deducted from the branch's inventory in the same transaction.
6. API returns the finalized invoice to the browser. Staff prints the bill.
7. Simultaneously, the API enqueues a CBMS sync job in the Redis queue.
8. The background worker picks up the job, builds the IRD CBMS payload, and sends it to `cbapi.ird.gov.np` via HTTPS.
9. IRD's response code is recorded in the `cbms_sync_log` table and the invoice's sync status is updated.

---

## 5. Data Immutability

Per Electronic Billing Procedure 2082, clause 6.3(घ), issued transaction data cannot be modified or deleted. This is enforced at multiple layers:

- **No edit API endpoint** — there is no `PATCH` or `PUT` route for finalized invoices.
- **Column-level privilege revocation** — the application's database role has `UPDATE` and `DELETE` revoked on `ims_invoices` and `ims_invoice_lines`. Only specific operational columns (print tracking, CBMS sync status) retain a narrow UPDATE grant.
- **Delete trigger** — `trg_ims_invoices_delete_guard` (a PostgreSQL `BEFORE DELETE` trigger) rejects deletion of any invoice where `kind != 'quotation'`. This trigger fires regardless of the database connection used, including the admin connection.
- **Credit note only** — the only permitted correction mechanism is issuing a credit note, which creates a new document with its own sequential number and never modifies the original invoice.

---

## 6. Security

| Area | Implementation |
|---|---|
| Transport | HTTPS (TLS via Let's Encrypt) for all browser-to-server and server-to-CBMS traffic |
| Authentication | JWT, HS256, 30-minute expiry, refresh tokens (7 days) |
| Password storage | Argon2 hashing (via passlib) |
| Role-based access | Three roles — Owner, Manager, Storekeeper — with distinct module and permission scopes enforced server-side on every request |
| Database role | Application connects as restricted role `srota_app`; superuser connection used only at server startup for schema migrations |
| CBMS credentials | Encrypted at rest using `CBMS_ENCRYPTION_KEY` |

---

## 7. Backup

| Data | Backup Method |
|---|---|
| PostgreSQL | WAL archiving (continuous) + scheduled full backup via `srota-postgres-backup` to offsite S3 storage |
| MinIO (media) | Scheduled backup via `srota-minio-backup` to offsite S3 storage |

---

&nbsp;

**Authorized Signature:** &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;

**Name:** Nishant Chaudhary

**Designation:** Technical Director, Forgenest Services Pvt. Ltd.

**Date:**

**Company Stamp:**
