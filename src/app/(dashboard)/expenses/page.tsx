import { Receipt, TrendingDown, Tag } from "lucide-react";
import { and, eq, gte, lte } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { db } from "@/db";
import {
  childSeries,
  expenses,
  expenseCategories,
  properties,
  vendors,
  type ExpenseCategoryKind,
} from "@/db/schema";
import {
  expenseCategoryLabels,
} from "@/lib/labels";
import { formatCents } from "@/lib/money";
import { formatDate, todayISO } from "@/lib/date";
import {
  seriesOptions,
  propertyOptions,
  unitOptions,
  vendorOptions,
} from "@/lib/lookups";
import { getSeriesContext } from "@/lib/series-context";
import { getExpenseByCategory } from "@/lib/metrics";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar } from "@/components/shared/filter-bar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { CreateExpenseButton, EditExpenseButton } from "./expense-form";
import { deleteExpense } from "./actions";

export const dynamic = "force-dynamic";

const CATEGORY_FILTER_OPTIONS = (
  Object.keys(expenseCategoryLabels) as ExpenseCategoryKind[]
).map((kind) => ({ value: kind, label: expenseCategoryLabels[kind] }));

// Tone mapping for category badges
const CATEGORY_TONES: Record<ExpenseCategoryKind, "default" | "info" | "warning" | "danger" | "success" | "muted"> = {
  repairs: "warning",
  utilities: "info",
  insurance: "info",
  property_taxes: "danger",
  mortgage: "danger",
  legal: "muted",
  accounting: "muted",
  supplies: "default",
  capital_improvements: "success",
  other: "muted",
};

export default async function ExpensesPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await props.searchParams;
  const session = await requireSession();

  const canCreate = can(session.role, "expense", "create");
  const canEdit = can(session.role, "expense", "edit");
  const canDelete = can(session.role, "expense", "delete");

  const seriesCtx = await getSeriesContext(session.organizationId);
  const seriesFilter = sp.series ?? seriesCtx.currentSeriesId ?? null;
  const propertyFilter = sp.property ?? null;
  const categoryFilter = (sp.category as ExpenseCategoryKind) ?? null;
  const fromFilter = sp.from ?? null;
  const toFilter = sp.to ?? null;

  const [seriesOpts, propOpts, unitOpts, vendorOpts] = await Promise.all([
    seriesOptions(session.organizationId),
    propertyOptions(session.organizationId, seriesFilter),
    unitOptions(session.organizationId, seriesFilter),
    vendorOptions(session.organizationId),
  ]);

  // Build query conditions
  const conds = [eq(expenses.organizationId, session.organizationId)];
  if (seriesFilter) conds.push(eq(expenses.childSeriesId, seriesFilter));
  if (propertyFilter) conds.push(eq(expenses.propertyId, propertyFilter));
  if (categoryFilter) conds.push(eq(expenses.categoryKind, categoryFilter));
  if (fromFilter) conds.push(gte(expenses.incurredDate, fromFilter));
  if (toFilter) conds.push(lte(expenses.incurredDate, toFilter));

  const rows = await db
    .select({
      id: expenses.id,
      organizationId: expenses.organizationId,
      childSeriesId: expenses.childSeriesId,
      propertyId: expenses.propertyId,
      unitId: expenses.unitId,
      vendorId: expenses.vendorId,
      categoryId: expenses.categoryId,
      categoryKind: expenses.categoryKind,
      amountCents: expenses.amountCents,
      incurredDate: expenses.incurredDate,
      description: expenses.description,
      notes: expenses.notes,
      createdAt: expenses.createdAt,
      updatedAt: expenses.updatedAt,
      seriesName: childSeries.name,
      propertyName: properties.name,
      vendorName: vendors.name,
    })
    .from(expenses)
    .leftJoin(childSeries, eq(childSeries.id, expenses.childSeriesId))
    .leftJoin(properties, eq(properties.id, expenses.propertyId))
    .leftJoin(vendors, eq(vendors.id, expenses.vendorId))
    .where(and(...conds))
    .orderBy(expenses.incurredDate);

  // Metrics
  const totalCents = rows.reduce((s, e) => s + e.amountCents, 0);
  const count = rows.length;

  // Category breakdown using the metrics helper
  const metricsFilter = {
    seriesId: seriesFilter,
    propertyId: propertyFilter,
    categoryKind: categoryFilter,
    from: fromFilter,
    to: toFilter,
  };
  const byCategory = await getExpenseByCategory(
    session.organizationId,
    metricsFilter,
  );
  const biggestCategory = byCategory[0] ?? null;

  const filters = [
    {
      key: "series",
      label: "Series",
      options: seriesOpts,
      allLabel: "All series",
    },
    {
      key: "property",
      label: "Property",
      options: propOpts,
      allLabel: "All properties",
    },
    {
      key: "category",
      label: "Category",
      options: CATEGORY_FILTER_OPTIONS,
      allLabel: "All categories",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Track and categorize expenses across your child series."
      >
        {canCreate ? (
          <CreateExpenseButton
            seriesOptions={seriesOpts}
            propertyOptions={propOpts}
            unitOptions={unitOpts}
            vendorOptions={vendorOpts}
            defaultDate={todayISO()}
          />
        ) : null}
      </PageHeader>

      <FilterBar filters={filters} showDateRange />

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total expenses"
          value={formatCents(totalCents)}
          icon={TrendingDown}
          tone="danger"
        />
        <StatCard
          label="Number of expenses"
          value={String(count)}
          icon={Receipt}
          tone="default"
        />
        <StatCard
          label="Biggest category"
          value={
            biggestCategory
              ? expenseCategoryLabels[biggestCategory.kind]
              : "—"
          }
          sublabel={
            biggestCategory ? formatCents(biggestCategory.totalCents) : undefined
          }
          icon={Tag}
          tone="info"
        />
      </div>

      {/* Category breakdown */}
      {byCategory.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">By category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {byCategory.map((cat) => {
                const pct = totalCents > 0 ? (cat.totalCents / totalCents) * 100 : 0;
                return (
                  <div key={cat.kind} className="flex items-center gap-3">
                    <div className="w-36 shrink-0">
                      <Badge tone={CATEGORY_TONES[cat.kind] ?? "muted"}>
                        {expenseCategoryLabels[cat.kind]}
                      </Badge>
                    </div>
                    <div className="flex-1">
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${pct.toFixed(1)}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-24 text-right text-sm tabular-nums text-muted-foreground">
                      {formatCents(cat.totalCents)}
                    </div>
                    <div className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                      {cat.count}x
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Table */}
      {rows.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No expenses found"
          description="Record your first expense or adjust the filters above."
          action={
            canCreate ? (
              <CreateExpenseButton
                seriesOptions={seriesOpts}
                propertyOptions={propOpts}
                unitOptions={unitOpts}
                vendorOptions={vendorOpts}
                defaultDate={todayISO()}
              />
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Series</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                {canEdit || canDelete ? (
                  <TableHead className="w-[100px]" />
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="tabular-nums text-muted-foreground whitespace-nowrap">
                    {formatDate(row.incurredDate)}
                  </TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {row.description || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge tone={CATEGORY_TONES[row.categoryKind] ?? "muted"}>
                      {expenseCategoryLabels[row.categoryKind]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.seriesName ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.propertyName ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.vendorName ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatCents(row.amountCents)}
                  </TableCell>
                  {canEdit || canDelete ? (
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {canEdit ? (
                          <EditExpenseButton
                            expense={row}
                            seriesOptions={seriesOpts}
                            propertyOptions={propOpts}
                            unitOptions={unitOpts}
                            vendorOptions={vendorOpts}
                            defaultDate={todayISO()}
                          />
                        ) : null}
                        {canDelete ? (
                          <ConfirmDelete
                            action={deleteExpense}
                            id={row.id}
                            title="Delete this expense?"
                            description="This action cannot be undone."
                          />
                        ) : null}
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
