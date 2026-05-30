# Series Ledger — Property Management & Bookkeeping for Series LLCs

A bookkeeping-first property management dashboard for family-owned rental
businesses operated under a **Series LLC** structure. The core value is clean
financial separation by **child series** — so a landlord can always answer:

- Which child series owns this property?
- How much rent is due, who has paid, and who is late?
- What expenses belong to each child series?
- Is each child series profitable?
- Can I hand my bookkeeper clean records, separated by series?

Built with **Expo (React Native)** + **Expo Router** + **NativeWind** (Tailwind
for RN) + **Supabase** (Auth / Postgres / Storage) + **Drizzle ORM**.

> **Payments are intentionally not implemented in the MVP.** Rent charges and
> payments are recorded manually. The schema and architecture are designed so
> Stripe/ACH, bank sync, and accounting exports can be added later.

---

## Quick start (demo mode)

No backend required — the app ships with an in-memory dataset.

```bash
npm install
npm start        # then press i / a, or open in Expo Go
```

On the sign-in screen pick a role (Owner/Admin, Manager, Bookkeeper, or Tenant)
to explore the app with sample data and that role's permissions.

Demo mode is on by default. It stays on until you configure Supabase **and** set
`EXPO_PUBLIC_DEMO_MODE=false`.

---

## Going live with Supabase

1. Create a Supabase project.
2. Copy `.env.example` to `.env` and fill in:
   - `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (Project → API)
   - `DATABASE_URL` (Project → Database → Connection string)
   - `EXPO_PUBLIC_DEMO_MODE=false`
3. Apply the database schema + policies. Either:
   - **Drizzle push:** `npm run db:push` (creates tables from `src/db/schema.ts`), then run `supabase/migrations/0002_rls.sql` and `0003_triggers_and_seed.sql` in the Supabase SQL editor; **or**
   - **SQL editor:** run `supabase/migrations/0001_init.sql`, `0002_rls.sql`, `0003_triggers_and_seed.sql` in order.
4. Create users in Supabase Auth, insert a row into `organizations`, set each
   `users.organization_id`, and add `user_roles` rows. For tenants, add a
   `tenant_user_links` row connecting the auth user to a `tenants` record.

The data layer (`src/services/repo.ts`) is written so a Supabase-backed
implementation can replace the in-memory store behind the same async method
signatures. Auth is already wired to Supabase (`src/lib/auth.tsx`).

---

## Architecture

```
app/                          Expo Router routes
  _layout.tsx                 Providers (auth, series context, gesture/safe-area)
  index.tsx                   Entry redirect by auth + role
  (auth)/sign-in.tsx          Demo role picker / Supabase sign-in
  (app)/                      Staff area (Drawer navigation)
    _layout.tsx               Drawer + role guard
    dashboard.tsx             Summary cards, P&L by series, late rent
    parent-llc.tsx            Parent LLC overview + all series summaries
    series/                   Child series list + detail (CRUD)
    properties/               Properties list + detail (CRUD)
    units.tsx                 Units (CRUD, filters)
    tenants/                  Tenants list + detail (CRUD)
    leases.tsx                Leases (CRUD, lease states)
    rent.tsx                  Rent roll, charges, manual payments
    expenses.tsx              Expense tracking (categories, vendors)
    maintenance.tsx           Maintenance requests
    documents.tsx             Document metadata + sharing
    reports.tsx               Bookkeeping reports + tax export (planned)
    settings.tsx              Profile, vendors, categories, sign out
  tenant/                     Tenant portal (Tabs): home, lease, maintenance
src/
  db/schema.ts                Drizzle schema (single source of truth)
  services/store.ts           In-memory demo data (seeded)
  services/repo.ts            Data access + financial computations
  lib/                        supabase, auth, series-context, rbac, rent, format, hooks
  components/ui/              shadcn-style RN primitives (Card, Badge, Button, …)
  components/                 SeriesContextBar, PageHeader, NotesPanel, DrawerContent
  constants/                  Status maps, nav, labels
supabase/migrations/          SQL: schema, RLS policies, triggers + seed
drizzle/                      Generated Drizzle migration
```

### Data hierarchy

```
Organization
  Parent LLC
    Child Series  ── EIN, bank nickname, status
      Properties ── Units ── (Tenants via Leases) ── Rent Charges ── Payments
      Expenses · Documents · Notes · Maintenance · Security Deposits · Reports
```

Every financial record carries its `child_series_id` so income, expenses, and
profitability are always separable by series. Properties **must** belong to a
series; units **must** belong to a property; leases connect a tenant to a unit;
expenses belong to a series (optionally a property/unit).

### Database tables

`organizations`, `users`, `user_roles`, `parent_llcs`, `child_series`,
`properties`, `units`, `tenants`, `tenant_user_links`, `leases`, `rent_charges`,
`rent_payments`, `security_deposits`, `expense_categories`, `vendors`,
`expenses`, `documents` (polymorphic attachment), `notes` (polymorphic),
`maintenance_requests`.

### Roles & access (RBAC)

Enforced both client-side (`src/lib/rbac.ts`, hides actions) and in the database
via Row Level Security (`supabase/migrations/0002_rls.sql`, the real boundary).

| Role         | Access |
|--------------|--------|
| Owner/Admin  | Everything, incl. org/users/roles |
| Manager      | Properties, units, tenants, leases, rent, expenses, docs, notes, maintenance |
| Bookkeeper   | View everything; manage financial records (rent, payments, deposits, expenses, vendors) |
| Tenant       | View own lease/balance/rent history + shared documents; submit maintenance |

Access is scoped by `organization`. Tenants are limited to their own data via
`tenant_user_links` and RLS.

### Rent status

Rent charge status is **derived** from amount paid vs. owed and the due date
(`src/lib/rent.ts`): `paid`, `partially_paid`, `unpaid`, or `late`. Late fees are
added to a charge and flow into tenant balances and the rent roll. Partial
payments are supported.

---

## Reports

Parent LLC overview · P&L by child series · income by series · expense by series
· expense breakdown by category · rent roll · tenant balances · security deposit
report · property income/expense · tax summary export by series (CSV/QuickBooks
export is stubbed as a planned feature). Reports support date range and series
filters.

## Designed-for-later (not implemented)

Stripe rent payments, ACH, bank account sync, receipt OCR, accountant access,
QuickBooks export, automated monthly rent-charge generation, email/SMS
reminders, lease e-signature, advanced owner/investor reporting, multi-parent
LLC support. The schema includes placeholder columns (e.g.
`rent_payments.external_processor`, `expenses.is_reconciled`) to ease these.

## Scripts

```bash
npm start            # Expo dev server
npm run typecheck    # tsc --noEmit
npm run db:generate  # generate SQL migration from schema
npm run db:push      # push schema to the database
npm run db:studio    # Drizzle Studio
```
