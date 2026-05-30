# Build conventions (read before writing any page)

This app is a Next.js 15 App Router + TypeScript + Drizzle (Postgres/PGlite) +
Tailwind + shadcn-style UI. The reference implementation to copy is the
**Child Series** vertical:

- `src/app/(dashboard)/series/page.tsx` — list page (server component)
- `src/app/(dashboard)/series/actions.ts` — server actions (`"use server"`)
- `src/app/(dashboard)/series/series-form.tsx` — client create/edit dialogs

## Hard rules

1. **Do NOT modify shared files.** Only create the files in your assignment.
   Shared files already exist and are stable:
   - UI primitives: `src/components/ui/*` (button, card, badge, input, label,
     textarea, select, table, dialog, tabs, dropdown-menu, separator)
   - Shared components: `src/components/shared/*`
     - `PageHeader`, `StatCard`, `EmptyState`
     - `FormDialog` — `<FormDialog trigger title description action submitLabel>`;
       `action: (FormData) => Promise<ActionResult>`; closes + refreshes on ok.
     - `ConfirmDelete` — `<ConfirmDelete action={(id)=>Promise<ActionResult>} id title description />`
     - `FilterBar` — `<FilterBar filters={FilterDef[]} showDateRange showSearch />`,
       URL-param driven; read values from `searchParams` in the page.
     - fields: `Field, TextField, MoneyField, TextareaField, SelectField`
       (native inputs that submit inside a plain form).
   - Helpers:
     - `@/lib/money`: `formatCents(cents)`, `parseDollarsToCents(str)`, `centsToDollars`
     - `@/lib/date`: `formatDate(value)`, `todayISO()`, `startOfMonthISO()`, `isPast()`
     - `@/lib/labels`: label maps + tone maps for every enum (e.g.
       `rentStatusLabels`, `rentStatusTones`, `leaseStatusLabels`,
       `occupancyTones`, `expenseCategoryLabels`, `maintenanceStatusTones`,
       `paymentMethodLabels`, `documentTypeLabels`, `titleCase`).
     - `@/lib/rbac`: `can(role, resource, action)`, `isStaff(role)`.
     - `@/lib/guards`: `requirePermission(resource, action)` → returns Session,
       throws if not allowed. **Call this first in every mutating action.**
     - `@/lib/action-result`: `ActionResult`, `runAction(async () => {...})`.
     - `@/lib/lookups`: option loaders — `seriesOptions(orgId)`,
       `propertyOptions(orgId, seriesId?)`, `unitOptions(orgId, seriesId?)`,
       `tenantOptions(orgId)`, `vendorOptions(orgId)`, `categoryOptions(orgId)`,
       `getPrimaryParentLlc(orgId)`. Each Option is `{value,label,meta?}`.
     - `@/lib/metrics`: `getDashboardMetrics`, `getSeriesSummaries`,
       `getExpenseByCategory`, `getEnrichedCharges(orgId, filter)` (returns
       charges enriched with `paidCents`, `balanceCents`, `computedStatus`).
     - `@/lib/rent`: `computeRentStatus(totals)`, `balanceCents(totals)`,
       `chargeTotalDueCents`.
     - `@/lib/series-context`: `getSeriesContext(orgId)` → `{currentSeriesId,
       current, list}`. Use `currentSeriesId` to scope list pages to the active
       child series chosen in the top bar.
     - `@/lib/storage`: `storeFile(file)` → `{storageKey,fileName,mimeType,sizeBytes}`.
   - DB: `import { db } from "@/db"` and tables/types from `@/db/schema`.
   - Auth: `import { requireSession } from "@/lib/auth"` in pages.

2. **Money is integer cents.** Form money fields submit dollars; convert with
   `parseDollarsToCents` in the action. Display with `formatCents`.

3. **Every row is org-scoped.** Insert with `organizationId: session.organizationId`
   and filter every query by it (`eq(table.organizationId, session.organizationId)`).

4. **Denormalized series.** When inserting properties/units/leases/rent_charges/
   rent_payments/expenses/maintenance/deposits, set `childSeriesId` correctly.
   For units, also derive it from the chosen property. For rent charges, fill
   `childSeriesId`, `propertyId`, `unitId`, `tenantId` (look up from the unit/lease).

5. **Server actions** live in `actions.ts` with `"use server"`. Pattern:
   ```ts
   export async function createX(formData: FormData): Promise<ActionResult> {
     return runAction(async () => {
       const session = await requirePermission("resource", "create");
       const data = schema.parse(Object.fromEntries(formData));
       await db.insert(table).values({ organizationId: session.organizationId, ... });
       revalidatePath("/route"); revalidatePath("/dashboard");
       return { ok: true };
     });
   }
   ```
   Use `zod` for validation. For optional FK selects, treat `""` as null.

6. **List pages** are server components: `const session = await requireSession();`
   then read `searchParams` (a `Promise` in Next 15 — `await props.searchParams`)
   and `getSeriesContext` for the active series. Show a `PageHeader` with a
   create button (gated by `can(...)`), a `FilterBar`, and a `Table`. Use
   `Badge` with the tone maps for statuses. Show `EmptyState` when no rows.

7. **Permissions in UI**: gate create/edit/delete buttons with
   `can(session.role, resource, action)`.

8. **Do not run `npm run build` or `next dev`** (the orchestrator validates
   centrally to avoid `.next` collisions). Write correct, type-safe code.

9. Page components that read cookies/db are dynamic automatically. Add
   `export const dynamic = "force-dynamic";` to list pages to be safe.

## Resource names for RBAC (`can(role, resource, action)`)
`series | property | unit | tenant | lease | rent | expense | deposit |
document | note | maintenance | report | settings`

## searchParams in Next 15
```ts
export default async function Page(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await props.searchParams;
  const seriesId = sp.series ?? null;
}
```
