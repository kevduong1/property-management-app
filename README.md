# SeriesBooks — Property Management & Bookkeeping for Series LLCs

A bookkeeping-first property management dashboard for family-owned rental
businesses organized as a **Series LLC**. The core value is **clean financial
separation by child series**: every property, lease, rent charge, payment, and
expense is traceable to the correct child series, so the owner always knows
which series owns what, who has paid, who's late, and whether each series is
profitable.

> MVP scope. Payments (Stripe/ACH), bank sync, OCR, e-signature, and QuickBooks
> export are **designed for but intentionally not implemented** — see
> [Future-ready architecture](#future-ready-architecture).

## Tech stack

| Concern        | Choice |
| -------------- | ------ |
| Framework      | Next.js 15 (App Router, Server Components, Server Actions) |
| Language       | TypeScript (strict) |
| Database       | PostgreSQL via **Drizzle ORM** |
| Local/demo DB  | **PGlite** (embedded WASM Postgres — zero infra) |
| Auth           | Supabase Auth (with a dev-mode role switcher for demos) |
| UI             | Tailwind CSS + shadcn/ui-style components |
| Validation     | Zod |

### One schema, two drivers

The app uses the **same Drizzle schema and the same SQL migrations** whether it
runs on a real Postgres or on embedded PGlite:

- `DATABASE_URL` set → `postgres-js` against your Postgres (Supabase/Neon/RDS).
- `DATABASE_URL` unset → PGlite, persisted to `./.pglite`.

This makes the project runnable with **no external services** while remaining
production-ready.

## Quick start

```bash
npm install
npm run db:migrate     # create tables (PGlite by default)
npm run db:seed        # load a realistic Series-LLC demo dataset
npm run dev            # http://localhost:3000
```

On the login screen (dev auth mode), pick a role to explore:

| Account                  | Role        | Sees |
| ------------------------ | ----------- | ---- |
| `owner@example.com`      | Owner/Admin | Everything + settings |
| `manager@example.com`    | Manager     | Properties, tenants, rent, expenses, maintenance |
| `bookkeeper@example.com` | Bookkeeper  | Read-all + manage financial records & reports |
| `tenant@example.com`     | Tenant      | Self-service portal only |

You can also switch roles from the avatar menu (top-right) in dev mode.

### Useful scripts

```bash
npm run db:generate   # regenerate SQL migration from schema changes
npm run db:migrate    # apply migrations
npm run db:seed       # (re)seed demo data
npm run db:reset      # drop schema, re-migrate, re-seed
npm run build         # production build
npm run typecheck     # tsc --noEmit
```

## Data model

```
Organization (tenant boundary, multi-user)
 └─ Parent LLC
     └─ Child Series  ◀── the financial-separation unit
         ├─ Properties
         │   └─ Units
         │       ├─ Leases (Tenant ↔ Unit)
         │       │   └─ Rent Charges ─ Rent Payments
         │       └─ Security Deposits
         ├─ Expenses (→ category, vendor, optional property/unit)
         ├─ Maintenance Requests
         ├─ Documents (polymorphic attachment)
         └─ Notes (polymorphic attachment)
```

Tables (see `src/db/schema.ts`): `users`, `organizations`, `user_roles`,
`parent_llcs`, `child_series`, `properties`, `units`, `tenants`,
`tenant_user_links`, `leases`, `rent_charges`, `rent_payments`,
`security_deposits`, `expenses`, `expense_categories`, `vendors`, `documents`,
`notes`, `maintenance_requests`.

**Design notes**

- **Money is integer cents** everywhere (`*_cents`) — no float drift. Format via
  `src/lib/money.ts`.
- **Denormalized `child_series_id`** on properties, units, leases, rent charges,
  payments, expenses, deposits, and maintenance, so series-scoped queries and
  reports are cheap and integrity is enforced at write time.
- **Polymorphic documents & notes** attach to any entity via
  `(entity_type, entity_id)`.
- Postgres **enums** enforce valid statuses (rent, lease, occupancy, etc.).
- Rent-charge status (`unpaid | partial | paid | late`) is **derived** from
  payments + due date in one place (`src/lib/rent.ts`) and persisted for fast
  filtering.

## Routes & pages

Staff dashboard (`src/app/(dashboard)`):

`/dashboard` · `/parent-llc` · `/series` + `/series/[id]` · `/properties` +
`/properties/[id]` · `/units` · `/tenants` + `/tenants/[id]` · `/leases` ·
`/rent` · `/expenses` · `/maintenance` · `/documents` · `/reports` ·
`/settings`

Tenant portal (`src/app/(portal)`):

`/portal` (home) · `/portal/lease` · `/portal/rent` · `/portal/documents` ·
`/portal/maintenance`

CSV export API: `/api/reports/export?report=...&series=...&from=...&to=...`

The **active child series** is selected in the top bar and stored in a cookie;
every major page scopes to it, and a banner always shows which series you're
viewing.

## Roles & access control

Single source of truth: `src/lib/rbac.ts` (`can(role, resource, action)`),
enforced in every server action via `requirePermission` (`src/lib/guards.ts`)
and reflected in the UI (buttons are gated by `can(...)`).

- **Owner/Admin** — full access incl. settings.
- **Manager** — manage properties, units, tenants, leases, rent, expenses,
  documents, notes, maintenance (read-only on series & settings).
- **Bookkeeper** — view everything; manage financial records (rent, payments,
  expenses, deposits) and reports.
- **Tenant** — ownership-scoped portal only (their lease, balance, rent &
  payment history, shared documents, maintenance requests).

## Reports

Parent-LLC overview, P&L by child series, income/expense summary by series,
expense breakdown by category, rent roll, tenant balance, security-deposit
report, and property-level income & expense — each with **CSV export** and
filters for date range, series, property, unit, tenant, and category.

Dashboard cards: total rent due, rent collected, outstanding, late, total
expenses, net income, occupancy rate, and security deposits held.

## Authentication

`AUTH_MODE=dev` (default) uses a cookie-based role switcher backed by the seeded
`users` table — no Supabase project needed. Set `AUTH_MODE=supabase` plus the
`NEXT_PUBLIC_SUPABASE_*` env vars to use real Supabase Auth; the rest of the app
depends only on the normalized `getSession()` (`src/lib/auth.ts`), so swapping
providers never touches feature code. See `.env.example`.

## Future-ready architecture

Deliberately designed for, but not built in this MVP:

- **Stripe / ACH rent payments** — `rent_payments.method` enum + a clean
  charge→payment model; add a `payment_intents` table and webhook.
- **Bank sync / receipt OCR** — expenses already separate category/vendor; add
  ingestion that writes expense rows.
- **QuickBooks / accountant export** — the CSV export route is the seam.
- **Automated monthly rent generation** — `rent_charges` are first-class; add a
  scheduled job to materialize them per lease.
- **Email/SMS reminders, lease e-signature, multi-parent LLC, investor
  reporting** — schema is normalized and org-scoped to accommodate these.
- **File storage** — `src/lib/storage.ts` abstracts local vs. Supabase Storage.

## Project layout

```
src/
  app/
    (dashboard)/      staff pages + per-entity actions.ts & form components
    (portal)/         tenant portal
    api/reports/      CSV export
    login/            dev/supabase login
    actions/          shared context actions (series switch, auth)
  components/
    ui/               shadcn-style primitives
    shared/           StatCard, PageHeader, FormDialog, FilterBar, …
    layout/           sidebar, top bar, nav config
  db/                 schema, client (driver switch), migrate/seed/reset
  lib/                auth, rbac, guards, metrics, rent logic, money/date,
                      lookups, series-context, storage, labels
drizzle/              generated SQL migrations
docs/CONVENTIONS.md   build conventions
```
