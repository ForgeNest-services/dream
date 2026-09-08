# User Manual
## Srota IMS — Inventory Management System

**Software Name**: Srota IMS  
**Developed by**: Forgenest Services Pvt. Ltd.  
**Version**: 1.0  
**Date**: [DATE]  
**Prepared by**: Nishant Chaudhary, Technical Director

---

## Table of Contents

1. [Login](#1-login)
2. [User Management](#2-user-management)
3. [Tax Settings](#3-tax-settings)
4. [Products and Inventory](#4-products-and-inventory)
5. [Purchase Entry](#5-purchase-entry)
6. [Sales Invoice](#6-sales-invoice)
7. [Quotation](#7-quotation)
8. [Credit Note](#8-credit-note)
9. [Reports](#9-reports)

---

## 1. Login

Navigate to the Srota IMS URL. Enter your **Username** and **Password** and click **Login**.

[SCREENSHOT: Login page]

[SCREENSHOT: Dashboard after login]

---

## 2. User Management

Go to **Settings → Users**. Click **Add User** and fill in name, email, phone, username, password, role, and branch.

| Role | Access |
|---|---|
| **Owner** | Full access — all branches, settings, reports |
| **Manager** | Inventory, purchases, sales, reports for their branch |
| **Store Keeper** | Inventory and purchases only — no sales or reports |

[SCREENSHOT: Users list]

[SCREENSHOT: Add User form]

---

## 3. Tax Settings

Go to **Settings → Tax**. VAT-registered businesses issue full tax invoices with 13% VAT. PAN-only businesses issue simplified bills without VAT breakdown.

Business name, PAN/VAT number, address, and branch details are configured under **Settings → Business** and **Settings → Branch** — these appear on every printed invoice.

[SCREENSHOT: Tax settings screen]

---

## 4. Products and Inventory

Go to **Products → Add Product**. Fill in name, SKU, category, unit, sale price, purchase price, and **HS Code** (required on every invoice line per IRD Annexure 6). Opening stock can be set at creation.

[SCREENSHOT: Product list]

[SCREENSHOT: Add Product form — HS Code field visible]

To scan a barcode when adding items to an invoice or purchase, tap the barcode icon in the product search field. To print barcode labels, open a product and click **Print Barcode**.

---

## 5. Purchase Entry

Add suppliers first under **Suppliers** if not already added (name, PAN, phone). Then go to **Purchases → New Purchase**:

1. Select the supplier
2. Enter supplier bill number and date
3. Add products by name, SKU, or barcode scan with quantity and cost
4. Click **Save Purchase**

Stock is updated automatically. The purchase appears in the Purchase Register.

[SCREENSHOT: New Purchase form with line items]

---

## 6. Sales Invoice

Add customers under **Customers** if needed (name, PAN, phone). Then go to **Sales → New Invoice**:

1. Select a customer or leave blank for walk-in
2. Add products by name, SKU, or barcode scan
3. Apply discount if needed (line-level or invoice-level)
4. Select payment method — Cash / QR / Bank Transfer / Credit
5. Enter **Buyer PAN** if the customer requests a tax invoice with their PAN
6. Click **Finalize Invoice**

[SCREENSHOT: Invoice with items, payment method, and Finalize button]

Click **Print** to print the invoice. Finalized invoices cannot be modified. Reprints show a **"Copy of Original"** watermark. Invoice numbers are sequential per branch per fiscal year.

[SCREENSHOT: Printed invoice — seller PAN, invoice number, date, HS codes, VAT, total, QR code]

---

## 7. Quotation

Go to **Sales → New Quotation**. The process is identical to creating an invoice. Quotations are not tax documents and are not submitted to IRD.

To confirm and bill the customer, open the quotation and click **Convert to Invoice**.

To cancel, click **Void Quotation**. Only quotations can be deleted — finalized invoices cannot.

[SCREENSHOT: Quotation with Convert to Invoice and Void buttons]

---

## 8. Credit Note

To reverse a finalized invoice, go to **Sales → Invoices**, open the invoice, and click **Issue Credit Note**. Select the items being returned and enter the reason.

[SCREENSHOT: Invoice with Issue Credit Note button]

[SCREENSHOT: Credit note printout]

The credit note gets its own sequential number, is submitted to IRD automatically, and restores stock for returned items.

---

## 9. Reports

Go to **Reports**. Select a report, choose a date range, and export as XLSX or PDF.

| Report | Contents |
|---|---|
| **Standard View** | All invoices — 20 fields per IRD Annexure 5 |
| **Sales Register** | All paid invoices — 12 columns per IRD Annexure 6 |
| **Purchase Register** | All purchases — 12 columns per IRD Annexure 6 |
| **Credit Notes** | All credit notes with original invoice reference |
| **Annexure 13** | VAT return working sheet |
| **VAT Summary** | Monthly VAT collected vs input VAT |
| **TDS** | Tax deducted at source on purchases |

[SCREENSHOT: Reports page]

[SCREENSHOT: Standard View report with results]

---

*This manual is prepared for submission to the Inland Revenue Department of Nepal under Electronic Billing Procedure 2082 (विद्युतीय बीजक सम्बन्धी कार्यविधि, २०८२).*

&nbsp;

**Authorized Signature:** &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;

**Name:** Nishant Chaudhary

**Designation:** Technical Director

**Date:**

**Company Stamp:**
