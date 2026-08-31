# Guidelines for Inland Revenue Department (IRD) Billing Software Verification

This comprehensive technical guide outlines the regulatory rules, architectural designs, deployment conditions, and API integrations necessary to achieve official software approval by the **Inland Revenue Department (IRD) of Nepal** under the **Electronic Billing Procedure, 2074**.

---

## 1. Core Architectural Requirements

To pass the technical verification phase, your Point of Sale (POS) and Inventory Management System (IMS) modules must hardcode the following core data rules into the foundation of your platform:

*   **Immutable Database Design:** Implement logical structures ensuring that hard `DELETE` or structural SQL `UPDATE` operations on active transaction tables are completely locked down. Changes or cancellations are strictly handled via standard **Credit Notes**.
*   **Audit Trail Compliance:** Every single transaction action must save to an un-editable historical log capturing:
    *   Unique User Identity
    *   System Timestamp
    *   Client Machine IP Address
    *   Action Triggered (e.g., invoice generated, copy printed).
*   **Sequential Number Tracking:** Software must enforce unbroken invoice numbering assigned uniquely per Nepali Fiscal Year (e.g., `INV-083/84-00001`). Manual sequence shifts or field alterations by cashiers must be programmatically blocked.
*   **Re-print Protection:** Re-printing any finalized invoice must automatically append a prominent background watermark or clear structural text reading **"Copy of Original" (प्रतिलिपि)**.

---

## 2. Dynamic Billing Structure (PAN vs. VAT Management)

Your SaaS application must dynamically adjust parameters based on the registration profiles configured by separate business tenants:

### For VAT Registered Businesses
*   Compute automated **13% Value Added Tax (VAT)** rules sequentially following line-item adjustments and applied promotional discounts.
*   Clearly segment and itemize Taxable Sales, Non-Taxable/Exempt items, and Export lines within identical checkout baskets.

### For PAN-Only (Non-VAT) Businesses
*   The billing interface must bypass active 13% tax applications.
*   Set payload tax parameters (`taxable_sales_vat`, `vat`) strictly to `0.00` and map total invoice valuations entirely inside tax-exempt fields.

---

## 3. Server Deployment & Data Localization

Compliance policies mandate strict structural guidelines regarding hosting infrastructure:

*   **Development and Testing Phase:** Integration pipelines and Sandbox debugging requests can run flexibly across local environments or international cloud layers (AWS, Azure, DigitalOcean).
*   **Production Deployment Mandate:** Upon formal verification clearance for real market clients, your live service instance database clusters and application endpoints must physically operate from a verified cloud data center situated **within geographic Nepal**, managed by an enterprise entity officially registered under national business law.

---

## 4. Central Billing Monitoring System (CBMS) API Schema

### Troubleshooting Offline Endpoints
If public endpoint links like `http://202.166.207.75:9050/api/bill` return connection timeouts, server drops, or routing issues, this typically points to temporary government server maintenance, updated port assignments, or strict IP-range firewalls enforced by the department. Ensure you interface with the IRD technical desk or local Inland Revenue Office (IRO) to obtain current sandbox endpoints and valid system routing paths.

### Official JSON Payload Reference (`/api/bill`)
The following JSON structure outlines the exact parameters expected by the CBMS backend API when submitting structural customer receipts:

```json
{
  "username": "YOUR_DEVELOPER_OR_TENANT_USERNAME",
  "password": "YOUR_ASSIGNED_API_PASSWORD",
  "seller_pan": "987654321",
  "buyer_pan": "123456789",
  "fiscal_year": "2083/084",
  "buyer_name": "John Doe Enterprises",
  "invoice_number": "INV-083/84-00001",
  "invoice_date": "2026.05.15",
  "total_sales": 11300.00,
  "taxable_sales_vat": 10000.00,
  "vat": 1300.00,
  "excisable_amount": 0.00,
  "excise": 0.00,
  "taxable_sales_hst": 0.00,
  "hst": 0.00,
  "amount_for_esf": 0.00,
  "esf": 0.00,
  "export_sales": 0.00,
  "tax_exempted_sales": 0.00,
  "isrealtime": true,
  "datetimeClient": "2026-05-15T15:30:00"
}
```

---

## 5. Required Document Attachments for Verification

When completing the registration step on the IRD portal, prepare and upload the following documentation:

1.  **Technical Manual & System Architecture:** Comprehensive descriptions detailing the underlying stack, operational data flows, and data security standards.
2.  **User Operational Guide:** Plain language documentation outlining setup procedures, multi-tenant workspace isolation, and invoice creation steps.
3.  **Sample Layout Models:** Formatted visual layouts showing standard compliant printed bills alongside your live dynamic QR-code blocks.
4.  **Corporate Compliance Documentation:** Upload valid copies of your software organization's Registration Certificate, PAN/VAT Documents, and current Tax Clearance Certificate.
