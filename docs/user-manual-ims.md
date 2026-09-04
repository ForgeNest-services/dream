# User Manual
## Srota IMS — Inventory Management System
### Electronic Billing Software

**Software Name**: Srota IMS  
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
5. [Business and Branch Setup](#5-business-and-branch-setup)
6. [Product Management](#6-product-management)
7. [Supplier Management](#7-supplier-management)
8. [Customer Management](#8-customer-management)
9. [Creating a Sales Invoice](#9-creating-a-sales-invoice)
10. [Quotations](#10-quotations)
11. [Purchase Entry](#11-purchase-entry)
12. [Credit Notes](#12-credit-notes)
13. [Reports](#13-reports)
14. [CBMS Integration](#14-cbms-integration)
15. [Data Integrity and Security](#15-data-integrity-and-security)
16. [Data Backup and Recovery](#16-data-backup-and-recovery)
17. [Activity Log and Audit Trail](#17-activity-log-and-audit-trail)

---

## 1. System Overview

Srota IMS is a cloud-based Inventory Management System designed for retail, wholesale, and distribution businesses operating in Nepal. It enables:

- Product and inventory tracking across multiple branches
- IRD-compliant electronic invoice generation (Tax Invoice and PAN-only bills)
- Quotation management and quotation-to-invoice conversion
- Purchase entry and purchase register reporting
- Real-time synchronization of billing data with IRD's Central Billing Monitoring System (CBMS)
- Standard View, Sales Register, Purchase Register, Annexure 13, VAT Summary, and TDS reports as required under the Electronic Billing Procedure 2082

The software complies with **विद्युतीय बीजक सम्बन्धी कार्यविधि, २०८२** (Electronic Billing Procedure 2082).

### 1.1 Architecture Overview

Srota IMS operates as a web application:

- **Frontend**: Browser-based interface accessible from any device
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

Navigate to the Srota IMS URL provided by your system administrator.

[SCREENSHOT: Login page — showing username and password fields, Login button]

Enter your assigned **Username** and **Password**, then click **Login**.

[SCREENSHOT: Successful login — IMS dashboard/home screen showing summary cards: today's sales, pending invoices, low stock alerts]

### 3.2 Forgot Password

Contact your branch manager or system administrator to reset your credentials.

---

## 4. User Roles and Access Control

Srota IMS implements role-based access control. Each user is assigned one of the following roles:

| Role | Description | Key Permissions |
|---|---|---|
| **Owner** | Business owner or top-level admin | Full access to all branches, reports, settings, credentials |
| **Manager** | Branch manager | Invoice management, purchases, reports for assigned branch |
| **Cashier** | Billing staff | Create and finalize invoices, process payments, print bills |
| **Staff** | General staff | View inventory, create quotations; cannot finalize invoices |

### 4.1 Managing Users

[SCREENSHOT: Settings → Users list — showing user list with name, role, branch, email columns]

[SCREENSHOT: Add User form — name, email, phone, username, role, branch fields]

Each credential stores the user's **full name**, **email**, and **phone number**. The name is snapshotted onto every invoice they issue as the issuer name, and onto every bill they print as the printer name.

---

## 5. Business and Branch Setup

### 5.1 Business (Tenant) Settings

[SCREENSHOT: Settings → Business Details — showing business name, PAN, VAT number, address, phone, email fields]

Key fields required for IRD compliance:

| Field | Purpose |
|---|---|
| Business Name | Printed on every invoice header |
| PAN / VAT Number | Printed on every invoice; used in CBMS submission as `seller_pan` |
| Address | Printed on every invoice |
| Phone / Email | Printed on every invoice |

### 5.2 Branch Settings

Each physical location or warehouse operates as a separate branch with independent invoice numbering.

[SCREENSHOT: Branch settings — branch name, address, invoice series prefix]

| Field | Purpose |
|---|---|
| Branch Name | Included in invoice header |
| Invoice Series Prefix | Used in invoice number format (`SERIES-BRANCH-FY-NNNNN`) |

### 5.3 Tax Settings

[SCREENSHOT: Tax Settings screen — VAT registration toggle, PAN/VAT fields]

For **VAT-registered** businesses: full tax invoices with 13% VAT breakdown are issued.

For **PAN-only** businesses: CBMS settings are hidden. A simplified PAN-only invoice template is used.

---

## 6. Product Management

### 6.1 Product List

[SCREENSHOT: Products list — showing product name, SKU, category, price, stock, HS code columns]

### 6.2 Adding a Product

[SCREENSHOT: Add Product form — highlighting: Name, SKU, Category, Unit, Sale Price, Purchase Price, HS Code field]

The **HS Code** (हार्मोनाइज्ड सिस्टम कोड) is entered per product. It is printed on every invoice line item as required under Annexure 6 of the Electronic Billing Procedure 2082. Different products can have different HS codes — IMS supports this at the per-product level for businesses with mixed product categories.

The HS code is **snapshotted** onto each invoice line at the time of sale, so historical invoices always reflect the HS code that was current when the sale occurred.

[SCREENSHOT: Product edit form — HS Code field with an example value like "2106.90"]

### 6.3 Stock Management

[SCREENSHOT: Stock movement history — showing product, date, movement type (purchase/sale/adjustment), quantity change, balance]

---

## 7. Supplier Management

### 7.1 Supplier List

[SCREENSHOT: Suppliers list — showing supplier name, PAN, phone, email, address columns]

### 7.2 Adding a Supplier

[SCREENSHOT: Add Supplier form — name, PAN/VAT, phone, email, address fields]

Supplier PAN is used in the Purchase Register report to record the supplier's tax identification on each purchase entry.

---

## 8. Customer Management

### 8.1 Customer List

[SCREENSHOT: Customers list — showing customer name, PAN, phone, email columns]

### 8.2 Adding a Customer

[SCREENSHOT: Add Customer form — name, PAN/VAT, phone, email, address fields]

Customer PAN is pre-filled at invoice creation when the customer is selected, so regular business customers do not need their PAN re-entered each time.

---

## 9. Creating a Sales Invoice

### 9.1 New Invoice

Navigate to **Sales → New Invoice**.

[SCREENSHOT: New Invoice screen — showing customer search field, invoice date, invoice number (auto-generated)]

Select a customer from the list or leave blank for a walk-in customer. The invoice number is assigned automatically in sequential order.

### 9.2 Adding Line Items

[SCREENSHOT: Invoice line item entry — product search field, quantity, unit price, discount, line total, HS code shown per line]

Search for a product by name or SKU. The unit price and HS code are pre-filled from the product record. Adjust quantity and apply a line-level discount if applicable.

[SCREENSHOT: Invoice with multiple line items — showing item table with columns: SN, HS Code, Description, Qty, Unit, Unit Price, Discount, Total]

### 9.3 Applying Invoice-level Discount

[SCREENSHOT: Invoice footer — showing subtotal, invoice-level discount field, taxable amount, VAT, grand total]

### 9.4 Payment and Finalization

[SCREENSHOT: Payment section — payment method selector (Cash / QR / Bank Transfer / Credit), buyer PAN field, Finalize button]

Select the payment method. If the customer is VAT-registered and requests a tax invoice with their PAN, enter it in the **Buyer PAN** field.

Click **Finalize Invoice** to issue the invoice. Once finalized, the invoice cannot be modified.

### 9.5 Printing the Invoice

[SCREENSHOT: Invoice print preview — full invoice layout showing all required fields]

[SCREENSHOT: Printed invoice — annotated to show: seller PAN/VAT, invoice number, date (BS and AD), buyer name and PAN, line items with HS codes, taxable amount, VAT, grand total, issuer name, QR code]

Tap **Print** to send to the printer. The system records:
- `Is_Bill_Printed = Yes`
- `Printed_Time` = timestamp of first print
- `Entered_By` = name of user who created the invoice
- `Printed_By` = name of user who triggered the print

Reprinted invoices display a **"Copy of Original"** watermark.

### 9.6 Invoice Number Format

Invoices are numbered using the format: `[SERIES]-[BRANCH]-[FY]-[NNNNN]`

Example: `INV-KTM-8182-00001`

- Numbers start at 1 at the beginning of each fiscal year (Shrawan 1)
- Strictly sequential with no gaps
- Database-enforced uniqueness

---

## 10. Quotations

A quotation is a non-binding price estimate. It is not a tax document and is not submitted to CBMS.

### 10.1 Creating a Quotation

Navigate to **Sales → New Quotation**.

[SCREENSHOT: New Quotation form — similar to invoice form, with "Quotation" label in header]

The process is identical to creating an invoice. The quotation is saved with status `quotation` and does not trigger CBMS sync or invoice numbering.

### 10.2 Converting a Quotation to Invoice

When the customer confirms, open the quotation and click **Convert to Invoice**.

[SCREENSHOT: Quotation detail — showing "Convert to Invoice" button]

[SCREENSHOT: Conversion confirmation — warning that this will assign an invoice number and cannot be reversed]

The quotation becomes a finalized invoice with a sequential invoice number. All line items, prices, and HS codes are carried over.

### 10.3 Voiding a Quotation

If a quotation is no longer needed, click **Void Quotation** to delete it.

[SCREENSHOT: Quotation detail — showing "Void Quotation" button]

Only quotations can be voided/deleted. Finalized invoices cannot be deleted — a credit note must be issued instead.

---

## 11. Purchase Entry

Purchase entries record goods received from suppliers. They populate the Purchase Register report.

### 11.1 New Purchase

Navigate to **Purchases → New Purchase**.

[SCREENSHOT: New Purchase form — supplier search, purchase date, supplier bill number, line items]

### 11.2 Adding Purchase Lines

[SCREENSHOT: Purchase line entry — product, quantity, unit cost, total]

### 11.3 Saving the Purchase

[SCREENSHOT: Purchase saved — showing purchase record with total, supplier PAN, date]

Purchase data flows automatically into:
- Inventory stock levels (stock increased by purchased quantities)
- Purchase Register report (for IRD submission)

---

## 12. Credit Notes

A credit note reverses a finalized invoice (full or partial sales return).

### 12.1 Issuing a Credit Note

Navigate to **Sales → Invoices**. Locate the invoice. Click **Issue Credit Note**.

[SCREENSHOT: Invoice list — showing a finalized invoice with "Issue Credit Note" button]

[SCREENSHOT: Credit Note form — original invoice reference (pre-filled), return line items, reason for return field]

Select which line items are being returned and enter the reason.

[SCREENSHOT: Credit note printout — "Credit Note" header, original invoice number, return items, amounts, reason, issuer name]

The credit note:
- Gets its own sequential document number
- Is automatically submitted to CBMS via `/api/billreturn`
- Appears only in the Credit Notes register, never in the Sales Register
- Restores stock for returned items

---

## 13. Reports

All reports are accessed from **Reports**.

[SCREENSHOT: Reports navigation — showing report options: Standard View, Sales Register, Purchase Register, Credit Notes, Annexure 13, VAT Summary, TDS]

### 13.1 Standard View (Annexure 5)

Lists all issued invoices with the 20 fields mandated by Annexure 5 of the Electronic Billing Procedure 2082.

[SCREENSHOT: Standard View — date range picker, tabular results showing invoice number, date, buyer, PAN, total, VAT, sync status columns]

Export formats: XLSX and PDF.

[SCREENSHOT: Standard View XLSX export — showing column headers and sample rows]

### 13.2 Sales Register (धिक्री खाता) — Annexure 6

Lists all paid invoices (credit notes excluded) with the 12 columns required by IRD's Annexure 6 Sales Register template.

[SCREENSHOT: Sales Register export — landscape/wide format, 12 columns: Date (BS), Invoice No., Buyer, Buyer PAN, Total Amount, Taxable Value, VAT, Tax-exempt Amount, Export Value, Export Country, Export Customs No., Export Customs Date]

### 13.3 Purchase Register (खरिद खाता) — Annexure 6

Lists all purchase entries with the 12 columns required by IRD's Annexure 6 Purchase Register template.

[SCREENSHOT: Purchase Register export — landscape/wide format, 12 columns: Date (BS), Bill/Customs No., Supplier, Supplier PAN, Total Purchase, Taxable Purchase Value, VAT, Tax-exempt Purchase, Taxable Import Value, Import VAT, Capital Purchase/Import, Capital VAT]

### 13.4 Credit Notes Register

[SCREENSHOT: Credit Notes register — showing credit note entries with original invoice reference, return amounts, reason]

### 13.5 Annexure 13

[SCREENSHOT: Annexure 13 report — date range selector, tabular output]

### 13.6 Monthly VAT Summary

[SCREENSHOT: VAT Summary report — month selector, output showing total taxable sales, total VAT collected, total purchases, input VAT, net VAT payable]

### 13.7 TDS Report

[SCREENSHOT: TDS report — showing supplier-wise TDS deducted]

---

## 14. CBMS Integration

### 14.1 Enabling CBMS

CBMS is available only for VAT-registered tenants. Navigate to **Settings → IRD / CBMS**.

[SCREENSHOT: CBMS settings — username, password fields, enable toggle, Save button]

Enter the business's **IRD Taxpayer Portal username and password**. Credentials are stored encrypted (AES-256) and never appear in plaintext in any log or API response.

[SCREENSHOT: CBMS settings — after saving, showing "CBMS Enabled" status indicator]

### 14.2 How Synchronization Works

Every time an invoice is finalized or a credit note is issued:
1. The system queues a CBMS submission job
2. The job posts the payload to `https://cbapi.ird.gov.np/api/bill` (or `/api/billreturn` for credit notes)
3. IRD's response code is recorded in the sync log

CBMS sync runs independently of the invoice transaction — a sync failure does not affect the invoice itself.

### 14.3 CBMS Sync Log

[SCREENSHOT: Settings → CBMS Sync Log — table with: Invoice No., Date, Status (synced/failed/pending), IRD Response Code, Attempts, Last Attempted]

| IRD Response Code | Meaning | System Action |
|---|---|---|
| 200 | Success | Marked synced |
| 100 | Auth mismatch | Flagged — credentials need updating |
| 101 | Already submitted | Treated as synced |
| 102 / 103 | Transient error | Auto-retried with backoff |
| 104 | Invalid payload | Flagged for investigation |
| 105 | Invoice not found (returns) | Flagged for investigation |

### 14.4 Manual Resync

[SCREENSHOT: Sync log — Retry button on a failed entry]

---

## 15. Data Integrity and Security

### 15.1 Immutability of Issued Invoices

Once an invoice is **finalized**, its financial data cannot be modified. This is enforced at the database level via a PostgreSQL trigger (`ims_invoices_delete_guard`) — not just at the application layer. Even a direct database connection cannot delete or alter a finalized invoice.

Permitted post-issue actions:
- **Reprint** — prints a "Copy of Original"; original record unchanged
- **Credit Note** — creates a new reversing document; original unchanged

[SCREENSHOT: Finalized invoice detail — showing that no Edit or Delete option is present; only Print and Issue Credit Note are available]

### 15.2 Quotation Deletion Guard

Only quotations (`kind = 'quotation'`) can be deleted. The database trigger explicitly blocks deletion of any finalized invoice regardless of user role or connection type.

### 15.3 Audit Log

All system events are logged:

[SCREENSHOT: Activity Log — showing entries with user, timestamp, action type, entity]

[SCREENSHOT: Activity Log — expanded entry showing before/after state for a product price change]

### 15.4 Access Control

User passwords are stored as bcrypt hashes. IRD CBMS credentials are stored AES-256 encrypted. No plaintext credentials appear in any log, API response, or database column.

---

## 16. Data Backup and Recovery

### 16.1 Automated Backups

| Property | Value |
|---|---|
| Frequency | [DAILY / AS CONFIGURED] |
| Retention | [NUMBER] days |
| Storage | [S3-compatible object storage / specify destination] |
| Encryption | AES-256 at rest |

### 16.2 Point-in-Time Recovery

PostgreSQL Write-Ahead Logging (WAL) is enabled, allowing restoration to any point in time within the retention window.

### 16.3 Recovery Process

1. System administrator contacts ForgeNest support
2. Target restoration point is identified
3. Database is restored from backup + WAL replay
4. Recovery Time Objective (RTO): [SPECIFY]
5. Recovery Point Objective (RPO): [SPECIFY]

[SCREENSHOT: Backup confirmation or monitoring dashboard — if available]

---

## 17. Activity Log and Audit Trail

The activity log records every action in the system permanently. It cannot be modified or deleted by any user, including administrators.

[SCREENSHOT: Activity Log — full view with date range filter, entity type filter, user filter]

[SCREENSHOT: Activity Log — example entries showing: invoice finalized, credit note issued, product price updated, user created, settings changed]

Log entries can be exported to XLSX for audit or regulatory submission.

[SCREENSHOT: Activity Log — Export button and downloaded file preview]

---

*This manual is prepared for submission to the Inland Revenue Department of Nepal as part of the Electronic Billing Software registration process under Electronic Billing Procedure 2082.*

*Authorized Signature: _______________________*  
*Name: _______________________*  
*Designation: _______________________*  
*Date: _______________________*  
*Company Stamp:*
