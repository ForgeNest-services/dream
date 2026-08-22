# IMS/POS Pricing & Tax Architecture — Nepal (PAN vs VAT)

## Core principle

Never store a single "price" field that sometimes includes VAT and sometimes doesn't. Store the **tax-exclusive base price** always, and compute VAT at invoice time based on the business's registration type. One schema serves both PAN and VAT businesses — no branching logic across the codebase, just config flags.

Nepal's VAT is a **flat single rate — 13%**, unchanged since VAT was introduced, with no multi-tier rate structure. This means you only need one `vat_rate` value system-wide, not a rate-per-category table.

---

## Schema

### Business / Store settings

_(one row per business, or per branch if multi-branch)_

```
is_vat_registered   : boolean
vat_number           : string (nullable, required if vat_registered)
default_vat_rate     : decimal (default 13.00) -- configurable, not hardcoded
prices_entered_as    : "inclusive" | "exclusive"  -- see note below
```

### Product

```
cost_price          : decimal   -- what you paid, exclusive of VAT
selling_price        : decimal   -- your base selling price, exclusive of VAT
is_vat_applicable    : boolean   -- default true; false for VAT-exempt goods
hs_code               : string    -- min. first 4 digits, mandatory per 46th Amendment
```

`is_vat_applicable` matters even for VAT-registered businesses — certain goods are VAT-exempt under Schedule 1 (basic unprocessed agricultural produce, books, certain medicines, educational materials, etc.).

### Invoice

```
subtotal             : decimal  -- sum of line taxable amounts
vat_amount            : decimal  -- sum of line VAT
grand_total           : decimal
buyer_pan_vat          : string (nullable, required if invoice amount >= 1,00,000)
```

### Invoice Line

```
quantity
unit_price            : decimal  -- snapshot of selling_price at time of sale
line_subtotal          = quantity * unit_price
vat_rate_applied       : decimal  -- snapshot — protects against future rate changes
vat_amount             = line_subtotal * vat_rate_applied  (0 if not vat_applicable)
line_total              = line_subtotal + vat_amount
hs_code                : string   -- snapshot from product at time of sale
```

---

## How it plays out per business type

**PAN-registered**
`is_vat_registered = false`. Invoice generation skips VAT entirely — `vat_amount` stays 0, `grand_total = subtotal`.

**VAT-registered**
For each line: if `is_vat_registered` AND `product.is_vat_applicable` → apply VAT. Sum line subtotals → `subtotal`, sum line VAT → `vat_amount`, add for `grand_total`. IRD requires taxable amount and VAT amount to be shown **separately** on the invoice, not just a lump total — this is a compliance requirement, not a style choice.

---

## "Add 13% on total" vs per-line VAT

Because the rate is flat, per-line and on-total math produce the _same number_ **only when every line item is VAT-applicable**. They diverge the moment an invoice mixes taxable and exempt items — which is why the system computes per-line by default, then sums. Never hardcode "add 13% to the total" as the calculation method; always compute it as a rollup of line-level VAT.

---

## Inclusive vs exclusive entry at POS

Decide whether clerks type prices as tag/MRP (VAT-inclusive) or exclusive, and set `prices_entered_as` accordingly.

- If **inclusive**: `base_price = tag_price / (1 + vat_rate)` — store the exclusive base internally.
- Never store the inclusive number directly as `selling_price`, or cost-margin and reporting figures will be wrong.

---

## Compliance fields to not skip

1. **HS Code** — mandatory per line item since the 46th Amendment to the VAT Rules (2081/82); include the item's model and brand alongside it.
2. **Buyer PAN/VAT number** — required on the invoice when the buyer is a registered firm, or when an individual purchase is ≥ NPR 1,00,000. Validate this at invoice-creation time rather than leaving it as free text.
3. **VAT invoice format** — must follow Rule 17 (Schedule 5 standard format / Schedule 5A simplified format) and show seller's VAT number, invoice date (BS), sequential invoice numbering, taxable amount, VAT amount, and grand total as distinct fields.

---

## Summary

| Concern                        | Solution                                                              |
| ------------------------------ | --------------------------------------------------------------------- |
| PAN vs VAT business            | `is_vat_registered` flag on business/store                            |
| VAT-exempt items               | `is_vat_applicable` flag on product                                   |
| Rate changes over time         | `vat_rate_applied` snapshotted per invoice line                       |
| Inclusive vs exclusive pricing | `prices_entered_as` setting + conversion at entry                     |
| Mixed taxable/exempt invoices  | Always compute VAT per-line, then sum                                 |
| IRD compliance                 | `hs_code` per line, `buyer_pan_vat` conditional field, Rule 17 format |
