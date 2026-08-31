# Getting Billing Software IRD-Verified in Nepal — Research Notes

*Compiled 31 August 2026. This covers what's needed to get a billing/invoicing software product (like the Hotel PMS) certified by Nepal's Inland Revenue Department (IRD) so it can legally issue VAT bills.*

A quick caveat up front: IRD's own website is thin on public procedural detail (several official pages are notice landing pages without the actual document text, and one PDF link returned a 404 during this research). The picture below is assembled from IRD's published PDFs/pages that did load, plus multiple Nepali software vendors (Tigg, BusySoftwareNepal, OneFlow, eBillingNepal, Pioneer IT) who have already gone through this and law-firm summaries. Where sources disagree (mainly on thresholds, fees, and timeline), that's flagged — confirm those specific numbers with IRD directly before relying on them.

---

## 1. Legal basis

The governing document is **"विद्युतीय बिजक सम्बन्धी कार्यविधि, २०७४" — the Electronic Billing Procedure, 2074 (BS)**, now in its 4th amendment (updated 2 Bhadra 2077 / 19 Aug 2020). It sits under IRD's "कार्यविधि" (Procedures) section: [ird.gov.np/category/electronic-invoice](https://ird.gov.np/category/electronic-invoice/). This is the directive that requires businesses over certain thresholds to issue VAT bills only through IRD-listed electronic billing software, and it's what any software vendor's product has to comply with to get listed.

IRD also runs the **Central Billing Monitoring System (CBMS)** — the real-time system that approved software syncs invoice data to. There's a separate technical spec for this: *"CBMS API Technical Document For Software Developers"* (dated 16 June 2023 / 2080).

## 2. Two different things people mean by "IRD-verified"

Worth separating these, since they involve different applicants:

- **A business getting approval to use e-billing** — a hotel/restaurant/shop registers to use an already-IRD-listed software product for its own billing.
- **A software vendor getting their product listed/certified by IRD** — this is what applies to building the Hotel PMS itself. The product has to be evaluated and added to IRD's registry of certified billing software before any business can legally bill VAT through it.

Since Forgenest is building the product (not just using one), the relevant path is the second one.

## 3. Who is required to use IRD-approved software (thresholds)

Sources gave inconsistent numbers here — treat these as directional, not exact, and verify with IRD:

- Businesses with annual transactions exceeding **NPR 10 crore** must use IRD-approved e-billing software; hospitality-sector businesses (hotels, restaurants, canteens) have a lower threshold of **NPR 5 crore**.
- Separately, for real-time CBMS sync specifically, one vendor (Tigg) cites a **NPR 25 crore** turnover threshold for *mandatory* real-time invoice sync — smaller businesses only sync if IRD requests it.

These may both be true for different aspects (who must bill electronically vs. who must sync in real time), or the numbers may have moved since the sources were written. Given this is central to product requirements (does the PMS need CBMS sync always-on, or only above a threshold, or on demand), this is worth confirming directly with IRD before finalizing the architecture.

## 4. What the software itself must support (technical requirements)

Recurring requirements across sources:

- Sequential/unique invoice numbering
- PAN/VAT identification captured for both seller and buyer
- Itemized tax breakdown, support for multiple tax rates on one invoice, auto-calculated VAT
- A "संक्षिप्त कर बिजक" (simplified tax invoice) format option alongside the full VAT invoice
- Credit note / sales-return handling
- Complete digital audit trail of invoices, credit notes, and tax transactions
- Data security and backup functionality; if cloud-hosted, a documented hosting/datacenter arrangement
- Standard IRD reports generated from the system: purchase/sales registers, Annexure 13 (अनुसूची १३), मास्केवारी (summary) returns, TDS reports
- Real-time (or on-request) synchronization of sales invoices and credit notes to CBMS

### CBMS API specifics (from IRD's developer technical document)

- Live endpoints: `POST https://cbapi.ird.gov.np/api/bill` (invoice posting) and `POST https://cbapi.ird.gov.np/api/billreturn` (credit note / sales return posting)
- Authentication is via the **taxpayer's own portal credentials** — `seller_pan`, `username`, and `password` (the taxpayer's Taxpayer Portal login), not a separate API key issued to the vendor. Credentials need to be kept in sync if the taxpayer changes their portal password.
- Payload includes seller/buyer PAN, fiscal year, invoice number/date, and a tax breakdown (`total_sales`, `taxable_sales_vat`, `vat`, `excise`, HST, ESF, etc.) — roughly 21 fields per the doc.
- Response codes: `200` success, `100` auth mismatch, `101` bill already exists / doesn't exist, `102` processing exception, `103` unknown error, `104` invalid payload structure, `105` bill doesn't exist (for returns).
- IRD's own sample implementation is in C#; no official SDK for other stacks was found (a Frappe/ERPNext community thread shows people building their own PHP/Python integrations against this spec).

## 5. Documents typically required to apply

Compiled from the step-by-step guides multiple vendors describe going through:

- Company PAN/VAT registration certificate
- Business registration certificate
- Latest tax clearance certificate
- Cover letter to IRD
- Full software documentation — modules, reports, invoice formats
- Sample invoices in both print and digital format
- Demonstration material (screenshots or a walkthrough video)
- Software user manual
- Cloud hosting/datacenter agreement, if the product is cloud-hosted
- Source code or system access, if IRD requests it during evaluation

## 6. Process, as described by vendors who've done it

1. Set up/configure the software and run it through internal testing against IRD's format and reporting requirements.
2. Register on the IRD Taxpayer Portal — under Electronic Billing → Electronic Billing Software Listing — and submit the application with the documents above.
3. IRD's technical team evaluates the software: features, invoice formats, reporting, and CBMS integration capability. They may request live system access or additional testing.
4. On approval, the software is added to IRD's public list of certified billing software (the list currently runs into the hundreds of entries — see §7) and issued a certificate/enrollment number.
5. Ongoing obligation: keep using the certified version, report changes, and stay compliant as the procedure gets amended.

Two secondary (unverified against an official IRD page) figures worth flagging rather than trusting outright: one legal-services source quoted a **processing time of 30–60 working days** and a **certification fee of NPR 10,000–25,000** depending on complexity. Confirm both directly with IRD — an official fee schedule/timeline wasn't found on ird.gov.np itself during this research.

## 7. Existing registry

IRD publishes a running list of already-certified software (PAN, product name, version, tech stack, enrollment number) — as of the most recent copy found, it runs to 550+ entries (Tally, SAP HANA, Microsoft Dynamics NAV, and many Nepali-built POS/ERP/hotel systems among them). A mirrored copy is up at [Pioneer IT's list of IRD-verified accounting softwares](https://pioneerit.com.np/list-of-ird-verified-accounting-softwares/); the official source is IRD's own PDF (linked from the electronic-invoice procedures page) but the direct PDF URL surfaced in search returned a 404 when fetched today, so it's worth pulling the current link from the IRD site directly.

## 8. Non-compliance

Guides describing this cite fines, equipment seizure, temporary business closure, and potential action under the Revenue Leakage (Control) Act for businesses billing without approved software once they're over threshold.

## 9. Contacts

- IRD toll-free helpdesk: **1660-01-33333**
- Email: **info@ird.gov.np** / **serviceird@ird.gov.np**
- Office line: **01-5970081**
- Office: IRD, Lazimpat, Kathmandu
- Website: [ird.gov.np](https://ird.gov.np) — Electronic Invoice procedures under कार्यविधि → विद्युतीय विजक

## 10. Gaps worth closing directly with IRD

- The exact current turnover thresholds (§3) — sources disagree.
- Current certification fee and processing timeline — only found via a secondary legal-services summary, not an official IRD fee schedule.
- Whether a *new* software product from a Nepal-based developer (as opposed to an existing accounting package adding Nepal support) goes through a different or additional review than what's described above.
- Whether CBMS API access requires anything beyond a live taxpayer's own portal credentials — e.g., a separate vendor/developer sandbox or test environment for building and testing the integration before a client is live. Not documented in what surfaced.

---

### Sources

- [A Complete Guide to Registering Your Electronic Billing Software with Nepal's IRD — Nepalese Express](https://nepalesexpress.com/@bhaktaraz-bhatta/a-complete-guide-to-registering-your-electronic-billing-software-with-nepals-inland-revenue-department-ird)
- [IRD Verified Computer Billing Software Nepal | CBMS & VAT — BusySoftwareNepal](https://busysoftwarenepal.com/ird-verified-computer-billing-software/)
- [E-Billing in Nepal: Process, Benefits & Legal Guidelines — eStartupNepal](https://estartupnepal.com/article/e-billing-in-nepal)
- [Central Billing Monitoring System API Documentation For Nepal — Frappe Forum](https://discuss.frappe.io/t/central-billing-monitoring-system-api-documentation-for-nepal/34814)
- [IRD Nepal — Electronic Invoice procedures category](https://ird.gov.np/category/electronic-invoice/)
- [IRD Nepal — CBMS Information notice](https://ird.gov.np/content/13496/cbms-information-/)
- [IRD Nepal — SOP for taxpayers using CBMS](https://ird.gov.np/content/8978/sopofcbmsfortaxpayers/)
- [IRD Nepal — e-Billing issuance notice](https://ird.gov.np/content/8070/notice-16542603731/)
- [IRD Nepal — CBMS API Technical Document for Software Developers (PDF)](https://ird.gov.np/public/pdf/976029276.pdf)
- [List of IRD Verified Accounting Softwares — Pioneer IT](https://pioneerit.com.np/list-of-ird-verified-accounting-softwares/)
- [IRD Certified Computerized Billing Solution — Tigg](https://tiggapp.com/ird)
- [Your Ultimate Guide to E-Billing in Nepal — Tigg](https://tiggapp.com/blog-posts/your-ultimate-guide-to-e-billing-in-nepal)
- [OneFlow — Nepal's IRD Approved E-Billing & Accounting Software](https://www.oneflow.pro/blog/ird-approved-electronic-billing-software-in-nepal)
- [IRD Approval Process in Nepal — Corporate Biz Legal](https://corporatebizlegal.com/ird-approval-process-nepal-pan-vat/)
- [Free IRD-Verified E-Billing System — eBillingNepal](https://ebillingnepal.com/en)