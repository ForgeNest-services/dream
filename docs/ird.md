# IRD Compliance & Verification Checklist (Nepal)

This checklist outlines the absolute technical requirements and verification steps mandated by the Inland Revenue Department (IRD) of Nepal under the **Electronic Billing Procedure, 2074** (including recent fiscal amendments). 

---

## 🛠️ Part 1: Core Code & Feature Requirements

### 1. Database Architecture & Data Integrity
- [ ] **No Hard Deletes:** Ensure SQL `DELETE` operations are completely blocked or absent in the code for `invoices`, `bill_items`, and `payment_transactions`.
- [ ] **No Hard Edits:** Ensure SQL `UPDATE` operations are blocked on critical financial rows after an invoice status changes to `Issued`.
- [ ] **Credit/Debit Note Architecture:** Implement a dedicated workflow for invoice corrections.
  - [ ] Canceling or modifying an invoice must generate a separate `Credit Note` or `Debit Note` entry.
  - [ ] Credit/Debit notes must maintain their own distinct, consecutive serial numbering sequence.
  - [ ] Adjustments must automatically recalculate inventory levels and tax headers without touching the original bill data.

### 2. Multi-Tenant System Audit Trail (Immutable Logs)
- [ ] **Dedicated Logs Table:** Create a tamper-proof database schema specifically for logging system changes (e.g., `system_logs` or `audit_trails`).
- [ ] **Mandatory Log Schema Fields:** Ensure every write log captures:
  - [ ] `User_ID` (Identifier of the logged-in system user)
  - [ ] `Timestamp` (System clock date and time)
  - [ ] `Action_Type` (e.g., `CREATE_INVOICE`, `CANCEL_INVOICE`, `USER_LOGIN`)
  - [ ] `Terminal_IP` / `MAC_Address` (Machine metadata)
  - [ ] `Old_Value` & `New_Value` (To track any configuration or customer record edits)

### 3. Invoice Numbering & Fiscal Logic
- [ ] **Strict Consecutive Logic:** Auto-incrementing numbers must have zero programmatic gaps.
- [ ] **Fiscal Year Extension:** Invoice prefixes or suffixes must contain the active Nepali Fiscal Year (e.g., `INV-82/83-00001`).
- [ ] **Automated Reset:** Implement programmatic logic that automatically resets invoice suffixes back to `1` exactly at midnight on Shrawan 1st (Nepali New Year reset).

### 4. UI/UX Printing Layout (Annex 5 Compliance)
- [ ] **Document Title:** The printed header must explicitly read **"Tax Invoice"** (or **"कर बिजक"**).
- [ ] **Seller Meta:** The seller's Name, Physical Address, and **9-digit PAN/VAT Number** must be displayed prominently at the top.
- [ ] **Buyer Meta:** The system must capture and print the Buyer's Name, Address, and **PAN/VAT Number** (Strictly mandatory for B2B/VAT bills).
- [ ] **Reprint Watermarking:** If a bill is re-generated or re-printed, the system must dynamically update a subtitle label to read: `"Copy of Original - Reprint #[Count]"` (e.g., `Reprint #1`).
- [ ] **Calculation Block Details:** The invoice footer must mathematically isolate and display:
  - [ ] Total Tax-Exempt / Non-Taxable Amount
  - [ ] Total Taxable Amount
  - [ ] **13% VAT Amount** (Calculated accurately to two decimal places)
  - [ ] Grand Total

### 5. Infrastructure & Localization
- [ ] **Local Data Sovereignty:** For web/SaaS platforms, verify that your active production database server—or a real-time synchronous backup node—is physically hosted within a data center in Nepal.
- [ ] **JSON Payload Readiness:** Build a schema transformer that can instantly map invoice data tables into clean JSON objects, preparing your system backend for real-time API syncing with the IRD Central Billing Monitoring System (CBMS).

---

## 📋 Part 2: Step-by-Step IRD Verification Steps

### Phase 1: Documentation Gathering
- [ ] Secure a digital copy of your software company’s **Company Registration**, **PAN/VAT Certificate**, and latest **Tax Clearance Certificate**.
- [ ] Compile a comprehensive **Software User Manual (PDF)** explicitly detailing how users issue bills, view inventory ledger data, and process returns.
- [ ] Draft a **Technical Architecture Document** outlining the application stack, hosting environment in Nepal, data backup policies, and security layers.
- [ ] Export template layout files (PDF/Prints) of a standard **Tax Invoice**, a **Credit Note**, and a **Sales Register Report**.

### Phase 2: Electronic Submission
- [ ] Log into the [Official IRD Taxpayer Portal](https://ird.gov.np).
- [ ] Navigate to the **Electronic Billing** registration section.
- [ ] Fill out the system application parameters, upload the compiled documents from Phase 1, and formally submit for review.

### Phase 3: Live Verification Demo
- [ ] Schedule the official technical inspection with the designated IRD technical committee.
- [ ] Execute a live end-to-end software simulation showcasing invoice generation, stock updates, and invoice printing.
- [ ] **Pass the "Stress Test":** Demonstrate to inspectors that attempting a direct database or UI-level edit/deletion on a completed invoice triggers a system failure message while writing an immutable record to your audit log.

### Phase 4: Listing Execution
- [ ] Obtain the official **Electronic Invoicing System Certificate** from the IRD office.
- [ ] Confirm your software product name and IT firm details have been publicly uploaded to the **Authorized Software Vendors List** on the [Inland Revenue Department Website](https://ird.gov.np).
