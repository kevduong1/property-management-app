import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  Banknote,
  Building2,
  CircleDollarSign,
  Home,
  PiggyBank,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { and, desc, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { db } from "@/db";
import {
  childSeries,
  expenses,
  notes,
  properties,
  units,
} from "@/db/schema";
import { getDashboardMetrics } from "@/lib/metrics";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/date";
import {
  expenseCategoryLabels,
  seriesStatusTones,
  titleCase,
} from "@/lib/labels";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function SeriesDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const session = await requireSession();
  const orgId = session.organizationId;

  // Load the series row — org-scoped.
  const [series] = await db
    .select()
    .from(childSeries)
    .where(
      and(
        eq(childSeries.id, id),
        eq(childSeries.organizationId, orgId),
      ),
    )
    .limit(1);

  if (!series) notFound();

  const [metrics, seriesProperties, recentExpenses, seriesNotes] =
    await Promise.all([
      getDashboardMetrics(orgId, { seriesId: id }),

      // Properties belonging to this series with unit counts.
      db
        .select({
          id: properties.id,
          name: properties.name,
          addressLine1: properties.addressLine1,
          city: properties.city,
          state: properties.state,
          status: properties.status,
        })
        .from(properties)
        .where(
          and(
            eq(properties.organizationId, orgId),
            eq(properties.childSeriesId, id),
          ),
        )
        .orderBy(properties.name),

      // Recent expenses for this series (latest 10).
      db
        .select()
        .from(expenses)
        .where(
          and(
            eq(expenses.organizationId, orgId),
            eq(expenses.childSeriesId, id),
          ),
        )
        .orderBy(desc(expenses.incurredDate))
        .limit(10),

      // Notes attached to this series entity.
      db
        .select()
        .from(notes)
        .where(
          and(
            eq(notes.organizationId, orgId),
            eq(notes.entityType, "child_series"),
            eq(notes.entityId, id),
          ),
        )
        .orderBy(desc(notes.createdAt))
        .limit(20),
    ]);

  // Unit counts per property.
  const propertyIds = seriesProperties.map((p) => p.id);
  const allUnits =
    propertyIds.length > 0
      ? await db
          .select({ propertyId: units.propertyId })
          .from(units)
          .where(
            and(
              eq(units.organizationId, orgId),
              eq(units.childSeriesId, id),
            ),
          )
      : [];

  const unitsByProperty = new Map<string, number>();
  for (const u of allUnits) {
    unitsByProperty.set(
      u.propertyId,
      (unitsByProperty.get(u.propertyId) ?? 0) + 1,
    );
  }

  const collectionRate =
    metrics.rentDueCents > 0
      ? Math.round((metrics.rentCollectedCents / metrics.rentDueCents) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={series.name}
        description={series.description ?? undefined}
      >
        <Badge tone={seriesStatusTones[series.status] ?? "muted"}>
          {titleCase(series.status)}
        </Badge>
      </PageHeader>

      {/* Series metadata */}
      <Card>
        <CardContent className="pt-5">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            {series.ein ? (
              <>
                <dt className="text-muted-foreground">EIN</dt>
                <dd className="font-mono sm:col-span-2">{series.ein}</dd>
              </>
            ) : null}
            {series.bankAccountNickname ? (
              <>
                <dt className="text-muted-foreground">Bank account</dt>
                <dd className="sm:col-span-2">{series.bankAccountNickname}</dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">Created</dt>
            <dd className="sm:col-span-2">{formatDate(series.createdAt)}</dd>
          </dl>
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Rent collected"
          value={formatCents(metrics.rentCollectedCents)}
          sublabel={`${collectionRate}% of rent due`}
          icon={Banknote}
          tone="success"
        />
        <StatCard
          label="Outstanding rent"
          value={formatCents(metrics.outstandingCents)}
          icon={CircleDollarSign}
          tone="warning"
        />
        <StatCard
          label="Total expenses"
          value={formatCents(metrics.expensesCents)}
          icon={Receipt}
        />
        <StatCard
          label="Net income"
          value={formatCents(metrics.netIncomeCents)}
          sublabel="Collected − expenses"
          icon={TrendingUp}
          tone={metrics.netIncomeCents >= 0 ? "success" : "danger"}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Occupancy rate"
          value={`${Math.round(metrics.occupancyRate * 100)}%`}
          sublabel={`${metrics.occupiedUnits} of ${metrics.totalUnits} units`}
          icon={Home}
        />
        <StatCard
          label="Security deposits held"
          value={formatCents(metrics.depositsHeldCents)}
          icon={PiggyBank}
          tone="info"
        />
        <StatCard
          label="Late rent"
          value={formatCents(metrics.lateCents)}
          icon={AlertTriangle}
          tone="danger"
        />
        <StatCard
          label="Properties"
          value={String(seriesProperties.length)}
          icon={Building2}
        />
      </div>

      {/* Properties table */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Properties
          </CardTitle>
          <Link
            href={`/properties?series=${id}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Manage properties →
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {seriesProperties.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No properties in this series yet.{" "}
              <Link href="/properties" className="underline">
                Add one
              </Link>
              .
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {seriesProperties.map((p) => {
                  const location = [p.city, p.state]
                    .filter(Boolean)
                    .join(", ");
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/properties/${p.id}`}
                          className="hover:underline"
                        >
                          {p.name}
                        </Link>
                        {p.addressLine1 ? (
                          <p className="text-xs text-muted-foreground">
                            {p.addressLine1}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {location || "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {unitsByProperty.get(p.id) ?? 0}
                      </TableCell>
                      <TableCell>
                        <Badge
                          tone={
                            p.status === "active"
                              ? "success"
                              : p.status === "sold"
                                ? "info"
                                : "muted"
                          }
                        >
                          {p.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent expenses */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4" /> Recent Expenses
          </CardTitle>
          <Link
            href={`/expenses?series=${id}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            View all expenses →
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recentExpenses.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No expenses recorded for this series yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentExpenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="tabular-nums text-muted-foreground whitespace-nowrap">
                      {formatDate(e.incurredDate)}
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate">
                      {e.description || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge tone="muted">
                        {expenseCategoryLabels[e.categoryKind]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCents(e.amountCents)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          {seriesNotes.length === 0 ? (
            <EmptyState
              title="No notes"
              description="Notes attached to this series will appear here."
            />
          ) : (
            <div className="space-y-3">
              {seriesNotes.map((n) => (
                <div
                  key={n.id}
                  className="rounded-lg border bg-muted/30 px-4 py-3"
                >
                  <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {formatDate(n.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
