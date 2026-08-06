# Zestro — Restaurant POS

Zestro is the restaurant point-of-sale app in the Forgenest hospitality SaaS suite (globally referenced as **restro**). It runs on tablets (waiter order-taking) and desktops (kitchen display, owner dashboard).

Stack: Vite + TanStack Start + TanStack Router + React 19 + Tailwind v4 + shadcn/ui + Bun.

Currently: Lovable-generated UI, cleaned up, mock data only. Backend wiring will land under `api/features/restro/` when the slice is built (see `../CLAUDE.md`).

## Development

Runs in Docker as part of the whole stack:

```sh
docker-compose up -d restro
```

Standalone:

```sh
bun install
bun run dev   # http://localhost:3003
```
