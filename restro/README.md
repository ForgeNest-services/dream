# Srota RMS — Restaurant POS

Srota RMS is the restaurant point-of-sale app in the Srota hospitality SaaS suite (codebase referenced as **restro**). It runs on tablets (waiter order-taking) and desktops (kitchen display, owner dashboard).

Stack: Vite + TanStack Start + TanStack Router + React 19 + Tailwind v4 + shadcn/ui + Bun.

Backend-wired: login, branches, categories, menu items + image upload. See `../CLAUDE.md` for current build state.

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
