# Dream PMS — Hotel Property Management System

Staff-facing web app for hotel operations: bookings, folios, invoices, housekeeping, and payments. Part of the Dream multi-app hospitality SaaS platform (see the root `CLAUDE.md` for the full architecture).

## Stack

- **Vite** + **TanStack Start** (SSR) + **TanStack Router** (file-based routing)
- **React 19** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (Radix primitives)
- **TanStack Query** for server state
- **Sonner** for toasts
- **Bun** as runtime + package manager

## Roles

The app is designed for hotel staff. Each role sees a different subset of pages:

- **Manager** — full operational access (bookings, rooms, folios, invoices, housekeeping, guests)
- **Front Desk** — bookings, check-in/out, folios, guests, housekeeping
- **Housekeeper** — housekeeping / room status only

(Owner/Superadmin management happens in the separate `admin/` app at app.dream.com — not here.)

## Login

Root URL `/` is the login page. Staff use shared credentials created by the Owner from the admin dashboard (one credential per role, per tenant). On successful login, the app routes to a role-based dashboard.

## Local development

```sh
bun install
bun dev
```

The backend API is expected at `http://localhost:8000/api` (the FastAPI service in `../api`).

## Deployment

Intended for `pms.dream.com`. Backend endpoints live under `/hotel-pms/*` on the shared API.

## Related

- `../CLAUDE.md` — full architecture, feature slice plan, cleanup checklist
- `../admin/` — Owner/Manager platform dashboard
- `../api/` — FastAPI backend (single codebase, feature slices per app)
