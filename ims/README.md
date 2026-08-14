# Srota IMS — Inventory Management System

Srota IMS is the inventory + POS app in the Srota hospitality/retail SaaS suite (codebase referenced as **ims**). Tracks suppliers, tree-structured categories, products with variants, stock adjustments/restocks, customers, quotations, invoicing (PAN/VAT-aware), and multi-branch reporting for businesses selling any kind of product (not hospitality-specific).

Stack: Vite + TanStack Start + TanStack Router + React 19 + Tailwind v4 + shadcn/ui + Bun.

Currently: Lovable-generated UI, cleaned up, mock data only. Backend wiring will land under `api/features/ims/` when the slice is built (see `../CLAUDE.md`).

## Development

Runs in Docker as part of the whole stack:

```sh
docker-compose up -d ims
```

Standalone:

```sh
bun install
bun run dev   # http://localhost:3004
```
