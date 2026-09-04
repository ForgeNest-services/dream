# User Manual
## Srota RMS — Restaurant Management System
### Electronic Billing Software

**Software Name**: Srota RMS  
**Developed by**: ForgeNest Pvt. Ltd.  
**Version**: [VERSION]  
**Date**: [DATE]  
**Prepared by**: [NAME], [DESIGNATION]  
**Company Stamp**: [STAMP ON EACH PRINTED PAGE]

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [System Requirements](#2-system-requirements)
3. [Accessing the Software](#3-accessing-the-software)
4. [User Roles and Access Control](#4-user-roles-and-access-control)
5. [Branch and Business Setup](#5-branch-and-business-setup)
6. [Menu Management](#6-menu-management)
7. [Table Management](#7-table-management)
8. [Creating an Order](#8-creating-an-order)
9. [Billing and Payment](#9-billing-and-payment)
10. [Bill Templates](#10-bill-templates)
11. [Credit Notes](#11-credit-notes)
12. [Void (Draft) Bills](#12-void-draft-bills)
13. [Reports](#13-reports)
14. [CBMS Integration](#14-cbms-integration)
15. [Data Integrity and Security](#15-data-integrity-and-security)
16. [Data Backup and Recovery](#16-data-backup-and-recovery)
17. [Activity Log and Audit Trail](#17-activity-log-and-audit-trail)

---

## 1. System Overview

Srota RMS is a cloud-based Restaurant Management System designed for hotels, restaurants, and food service businesses operating in Nepal. It enables:

- Digital order management and billing
- IRD-compliant electronic invoice generation (Full Tax Invoice, Abbreviated Tax Invoice, and PAN-only bills)
- Real-time synchronization of billing data with IRD's Central Billing Monitoring System (CBMS)
- Standard View and register-based reports as required under the Electronic Billing Procedure 2082

The software complies with **विद्युतीय बीजक सम्बन्धी कार्यविधि, २०८२** (Electronic Billing Procedure 2082).

### 1.1 Architecture Overview

Srota RMS operates as a web application:

- **Frontend**: Browser-based POS interface accessible from any device
- **Backend**: Centralized API server hosted on Nepal-based infrastructure
- **Database**: PostgreSQL with enforced immutability on issued invoices
- **CBMS**: Automatic bill synchronization to IRD's CBMS API (`https://cbapi.ird.gov.np/api/bill`)

[SCREENSHOT: High-level system architecture diagram — browser → API server → database + CBMS]

---

## 2. System Requirements

| Requirement | Specification |
|---|---|
| Device | PC, laptop, tablet, or smartphone |
| Browser | Google Chrome 110+, Mozilla Firefox 110+, Microsoft Edge 110+ |
| Internet | Minimum 2 Mbps broadband connection |
| Printer | Any network or USB receipt/A4 printer |
| Screen resolution | Minimum 1280 × 720 |

No local software installation is required. The system is fully web-based.

---

## 3. Accessing the Software

### 3.1 Login

Navigate to the Srota RMS URL provided by your system administrator.

[SCREENSHOT: Login page — showing username and password fields, Login button]

Enter your assigned **Username** and **Password**, then click **Login**.

[SCREENSHOT: Successful login — RMS dashboard/home screen]

### 3.2 Forgot Password

If you have forgotten your password, contact your branch manager or system administrator to reset your credentials.

---

## 4. User Roles and Access Control

Srota RMS implements role-based access control. Each user is assigned one of the following roles:

| Role | Description | Key Permissions |
|---|---|---|
| **Owner** | Business owner or top-level admin | Full access to all branches, reports, settings, credentials |
| **Manager** | Branch manager | Order management, billing, reports for assigned branch |
| **Cashier** | Front-desk billing staff | Create orders, process payments, print bills |
| **Waiter** | Service staff | Create and send orders to kitchen; cannot bill |
| **Kitchen** | Kitchen display | View and update order status only |

### 4.1 Managing Users

Only Owner and Manager roles can create or modify user accounts.

[SCREENSHOT: Settings → Users list — showing list of users with their roles and branch assignments]

[SCREENSHOT: Add User form — name, email, phone, role, branch fields]

Each credential stores the user's **full name**, **email**, and **phone number**. The name is snapshotted onto every bill they issue as the issuer name.

---

## 5. Branch and Business Setup

### 5.1 Business (Tenant) Settings

[SCREENSHOT: Admin settings — Business Details screen showing PAN, VAT number, business name, address]

Key fields required for IRD compliance:

| Field | Purpose |
|---|---|
| Business Name | Printed on every bill header |
| PAN / VAT Number | Printed on every bill; used in CBMS submission as `seller_pan` |
| Address | Printed on every bill |
| Phone | Printed on every bill |

### 5.2 Branch Settings

Each physical location operates as a separate branch. Bills are numbered independently per branch.

[SCREENSHOT: Branch settings — showing branch name, address, bill series prefix]

| Field | Purpose |
|---|---|
| Branch Name | Included in bill header |
| Bill Series Prefix | Used in bill number format (`SERIES-BRANCH-FY-NNNNN`) |
| Default HS Code | Applied to all menu items unless overridden at item level |

### 5.3 Tax Settings

[SCREENSHOT: Tax Settings screen — showing VAT registration toggle, PAN/VAT fields]

For **VAT-registered** businesses: VAT registration number is entered here and printed on full tax invoices.

For **PAN-only** businesses: CBMS settings are hidden. A PAN-only bill template is used (no VAT breakdown required).

---

## 6. Menu Management

### 6.1 Categories

[SCREENSHOT: Menu → Categories list]

[SCREENSHOT: Add Category form — name, display order]

### 6.2 Menu Items

[SCREENSHOT: Menu → Items list — showing item name, price, category, HS code column]

[SCREENSHOT: Add/Edit Item form — highlighting the HS Code field]

Each menu item carries an **HS Code** (हार्मोनाइज्ड सिस्टम कोड). This code is printed on every bill line as required under Annexure 6 of the Electronic Billing Procedure 2082.

If a branch-level default HS code is set in Branch Settings, items without an explicit HS code inherit it.

---

## 7. Table Management

### 7.1 Floor and Table Setup

[SCREENSHOT: Table management screen — showing floor layout with tables]

[SCREENSHOT: Add Table form — table name, floor, seating capacity]

### 7.2 Table Status

[SCREENSHOT: POS home — table grid showing Available (green), Occupied (orange), Reserved states]

---

## 8. Creating an Order

### 8.1 Starting a New Order

From the POS home screen, tap an available table.

[SCREENSHOT: Table selection — tapping a table opens the order view]

[SCREENSHOT: Order view — left panel shows menu categories and items; right panel shows current order]

### 8.2 Adding Items

Tap a menu item to add it to the order. Adjust quantity using the + / − controls.

[SCREENSHOT: Order view — items added to the right panel with quantities and line totals]

### 8.3 Applying a Discount

[SCREENSHOT: Discount field on the order view — entering a flat or percentage discount]

### 8.4 Sending to Kitchen

Tap **Send to Kitchen** to transmit the order to the kitchen display. A kitchen order slip is printed with a sequential slip number.

[SCREENSHOT: Kitchen order slip — showing slip number, table, items, timestamp]

The slip number appears on the final bill as required under दफा ६.२घ.

---

## 9. Billing and Payment

### 9.1 Checkout

When the guest is ready to pay, tap **Checkout** on the order.

[SCREENSHOT: Checkout screen — showing order summary, buyer PAN field, payment method selector (Cash / QR / Credit)]

**Buyer PAN** (optional): Enter the buyer's PAN if they request a tax invoice with their PAN recorded. Leave blank for walk-in guests.

**Payment Method**: Select Cash, QR (digital payment), or Credit.

### 9.2 Processing Payment

[SCREENSHOT: Payment confirmation screen — showing total, VAT breakdown, amount tendered, change]

Tap **Confirm Payment** to finalize the bill.

### 9.3 Printing the Bill

[SCREENSHOT: Bill print preview — showing full bill layout before printing]

Tap **Print** to send the bill to the connected printer. The system records:
- `Is_Bill_Printed = Yes`
- `Printed_Time` = timestamp of first print
- `Entered_By` = logged-in cashier's name
- `Printed_By` = name of user who triggered the print

Reprinted bills display a **"Copy of Original"** watermark as required under दफा ६.२च.

---

## 10. Bill Templates

Srota RMS generates three bill types automatically based on the tenant's registration and transaction value.

### 10.1 Full Tax Invoice (पूर्ण कर बीजक) — Annexure 6, Template 1.क.अ

Issued when: VAT-registered tenant AND taxable amount ≥ Rs 10,000.

[SCREENSHOT: Full Tax Invoice printout — annotated to show: seller PAN/VAT, bill number, date, buyer PAN field, line-item table with HS Code column, taxable amount, VAT amount, grand total, VAT refund line, QR code, issuer name]

**Mandatory fields on this template:**

| Field | Requirement |
|---|---|
| Seller PAN / VAT No. | Printed in header |
| Bill Number | Sequential, format `SERIES-BRANCH-FY-NNNNN` |
| Bill Date (BS) | Bikram Sambat date |
| Buyer Name / PAN | Captured at checkout; blank for walk-in |
| HS Code per line | Printed in item table |
| Taxable Amount | Shown before VAT |
| VAT (13%) | Shown separately |
| Grand Total | |
| VAT Refund Amount | Shown for QR/digital payments |
| QR Code | Encodes bill data for offline verification |
| Issuer Name | Staff name snapshotted at billing time |

### 10.2 Abbreviated Tax Invoice (संक्षिप्त कर बीजक) — Template 1.क.ई

Issued when: VAT-registered tenant AND taxable amount < Rs 10,000.

[SCREENSHOT: Abbreviated Tax Invoice printout — similar to full but without mandatory buyer PAN field]

### 10.3 PAN-only Bill — Template 1.ख

Issued when: PAN-only (non-VAT) tenant.

[SCREENSHOT: PAN-only bill printout — showing PAN number, no VAT breakdown, simplified layout]

### 10.4 Bill Number Format

Bills are numbered using the format: `[SERIES]-[BRANCH]-[FY]-[NNNNN]`

Example: `A-KTM-8182-00001`

- Numbers start at 1 at the beginning of each fiscal year (Shrawan 1)
- Numbers are strictly sequential with no gaps
- The database enforces uniqueness — two concurrent orders cannot receive the same number

---

## 11. Credit Notes

A credit note is issued to reverse a paid bill (full or partial return).

### 11.1 Issuing a Credit Note

Navigate to **Bills** tab. Locate the paid bill. Click **Credit Note**.

[SCREENSHOT: Bills tab — showing a paid bill with the Credit Note button visible]

[SCREENSHOT: Credit Note form — showing original bill reference, return amount, reason field]

Enter the **reason for return** and the amount. Confirm to issue.

[SCREENSHOT: Credit note printout — showing "Credit Note" header, original bill number, return amounts, reason]

The credit note is:
- Assigned its own sequential bill number
- Automatically submitted to CBMS via `/api/billreturn`
- Listed separately in the Credit Notes register (never in the Sales Register)

---

## 12. Void (Draft) Bills

A **void** cancels a bill that was printed but not yet paid (draft state).

### 12.1 Voiding a Draft Bill

Navigate to **Bills** tab. Locate the draft bill. Click **Void**.

[SCREENSHOT: Bills tab — showing a draft bill with the Void button visible]

[SCREENSHOT: Void confirmation dialog — "Are you sure you want to void this bill?"]

A voided bill is permanently cancelled. It is not submitted to CBMS. It remains visible in the system for audit purposes with status `void`.

**Note**: Only draft/unpaid bills can be voided. A paid bill cannot be voided — a credit note must be issued instead.

---

## 13. Reports

All reports are accessed from **Reports → IRD Reports**.

[SCREENSHOT: Reports section — showing available report cards: Standard View, Sales Register, Credit Notes, Annexure 13, VAT Summary, TDS]

### 13.1 Standard View (Annexure 5)

The Standard View lists all issued bills with the 20 fields mandated by Annexure 5 of the Electronic Billing Procedure 2082.

[SCREENSHOT: Standard View report — date range filter, showing tabular data with columns: Bill No., Date, Buyer, PAN, Total, VAT, Payment Method, CBMS Sync Status, etc.]

**Export formats**: Excel (XLSX) and PDF.

[SCREENSHOT: Standard View exported XLSX — first few rows visible]

### 13.2 Sales Register (धिक्री खाता) — Annexure 6

The Sales Register lists all paid invoices (credit notes excluded) with the 12 columns required by IRD's Annexure 6 register template.

[SCREENSHOT: Sales Register export — landscape/wide format showing 12 columns: Date (BS), Bill No., Buyer, Buyer PAN, Total Amount, Taxable Value, VAT, Tax-exempt Amount, Export Value, Export Country, Export Customs No., Export Customs Date]

Export is generated in landscape PDF and XLSX format.

### 13.3 Credit Notes Register

[SCREENSHOT: Credit Notes register export — showing credit note entries with original bill reference]

### 13.4 Annexure 13 / VAT Summary / TDS

[SCREENSHOT: Annexure 13 report page — date range selector]

[SCREENSHOT: VAT Summary report]

[SCREENSHOT: TDS report — if applicable]

---

## 14. CBMS Integration

### 14.1 Enabling CBMS

CBMS is available only for VAT-registered tenants. Navigate to **Settings → IRD / CBMS**.

[SCREENSHOT: CBMS settings card — showing username, password fields, enable toggle, "Save" button]

Enter the business's **IRD Taxpayer Portal username and password**. These credentials are encrypted at rest and never stored or logged in plaintext.

[SCREENSHOT: CBMS settings — after saving, showing "CBMS Enabled" status]

### 14.2 How Synchronization Works

Every time a bill is paid or a credit note is issued:
1. The system queues a CBMS submission job
2. The job sends the bill payload to `https://cbapi.ird.gov.np/api/bill` (or `/api/billreturn` for credit notes)
3. IRD's response code is recorded in the sync log

The CBMS sync is a **separate process** from billing — a failed sync does not affect the bill itself or the customer's transaction.

### 14.3 CBMS Sync Log

[SCREENSHOT: Settings → CBMS Sync Log — showing table with columns: Bill No., Date, Status (synced/failed/pending), IRD Response Code, Last Attempted]

| IRD Response Code | Meaning | System Action |
|---|---|---|
| 200 | Success | Marked synced |
| 100 | Auth mismatch | Flagged — credentials need updating |
| 101 | Already submitted | Treated as synced |
| 102 / 103 | Transient error | Auto-retried with backoff |
| 104 | Invalid payload | Flagged for investigation |
| 105 | Bill not found (returns) | Flagged for investigation |

### 14.4 Manual Resync

For failed entries, click **Retry** to resubmit manually.

[SCREENSHOT: Sync log — Retry button on a failed entry]

---

## 15. Data Integrity and Security

### 15.1 Immutability of Issued Invoices

Once a bill is marked as **paid**, its financial data (amounts, items, tax values, bill number) **cannot be modified**. The system enforces this at the database level — no application-layer or direct database update can alter a paid bill's core fields.

Only the following post-issue actions are permitted, as required by IRD:
- **Reprint** (creates a "Copy of Original" watermark copy — original record unchanged)
- **Credit Note** (creates a new reversing document — original record unchanged)

[SCREENSHOT: Paid bill detail — showing that Edit/Modify options are absent; only Print and Credit Note are available]

### 15.2 Audit Log

Every action performed in the system is logged with:
- User identity (name + role)
- Timestamp
- Action type
- Before and after state (for any change)

[SCREENSHOT: Settings → Activity Log — showing log entries with user, timestamp, action columns]

[SCREENSHOT: Activity Log — expanded entry showing before/after state for a settings change]

### 15.3 Access Control

User passwords are stored as cryptographic hashes (bcrypt). IRD CBMS credentials are stored encrypted (AES-256). Plaintext credentials are never stored or logged anywhere in the system.

---

## 16. Data Backup and Recovery

### 16.1 Automated Backups

The database is backed up automatically:
- **Frequency**: [DAILY / AS CONFIGURED]
- **Retention**: [NUMBER] days
- **Storage**: [S3-compatible object storage / describe your backup destination]
- **Encryption**: Backups are encrypted at rest

### 16.2 Point-in-Time Recovery

PostgreSQL Write-Ahead Logging (WAL) is enabled. The system can be restored to any point in time within the retention window in the event of data loss.

### 16.3 Recovery Process

In the event of a system failure:
1. The system administrator contacts ForgeNest support
2. A backup is identified and restored to the target point in time
3. Recovery time objective (RTO): [SPECIFY, e.g. 4 hours]
4. Recovery point objective (RPO): [SPECIFY, e.g. 1 hour]

[SCREENSHOT: Backup monitoring dashboard or confirmation — if available]

---

## 17. Activity Log and Audit Trail

The activity log provides a complete, tamper-evident record of all system events. It cannot be deleted or modified by any user including administrators.

[SCREENSHOT: Activity Log — full view showing date range filter, entity type filter, user filter]

[SCREENSHOT: Activity Log — example entries: "Bill paid", "Credit note issued", "User created", "Settings changed"]

Logs can be exported to XLSX for audit submission.

[SCREENSHOT: Activity Log — Export button and downloaded file]

---

*This manual is prepared for submission to the Inland Revenue Department of Nepal as part of the Electronic Billing Software registration process under Electronic Billing Procedure 2082.*

*Authorized Signature: _______________________*  
*Name: _______________________*  
*Designation: _______________________*  
*Date: _______________________*  
*Company Stamp:*
