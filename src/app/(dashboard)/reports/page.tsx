import Link from "next/link";
import { Download } from "lucide-react";
import { requireSession } from "@/lib/auth";
import {
  getDashboardMetrics,
  getEnrichedCharges,
  getExpenseByCategory,
  getSeriesSummaries,
  type FinancialFilter,
} from "@/lib/metrics";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/date";
import {
  expenseCategoryLabels,
  rentStatusLabels,
  rentStatusTones,
  seriesStatusTones,
} from "@/lib/labels";
import {
  seriesOptions,
  propertyOptions,
} from "@/lib/lookups";
import { db } from "@/db";
import {
  childSeries,
  properties,
  securityDeposits,
  tenants,
  units,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { PageHeader } from "@/components/shared/page-header";
import { FilterBar } from "@/components/shared/filter-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const dynamic = "force-dynamic";

export default async function ReportsPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await props.searchParams;
  const session = await requireSession();
  const orgId = session.organizationId;

  const seriesId = sp.series ?? null;
  const propertyId = sp.property ?? null;
  const from = sp.from ?? null;
  const to = sp.to ?? null;
  const activeTab = sp.tab ?? "pl";

  const filter: FinancialFilter = { seriesId, propertyId, from, to };

  // Build CSV export URL preserving current filters
  const exportParams = new URLSearchParams();
  exportParams.set("report", activeTab);
  if (seriesId) exportParams.set("series", seriesId);
  if (propertyId) exportParams.set("property", propertyId);
  if (from) exportParams.set("from", from);
  if (to) exportParams.set("to", to);
  const exportUrl = `/api/reports/export?${exportParams.toString()}`;

  // Load options for FilterBar
  const [seriesOpts, propOpts] = await Promise.all([
    seriesOptions(orgId),
    propertyOptions(orgId, seriesId),
  ]);

  // Load all report data in parallel
  const [
    seriesSummaries,
    byCategory,
    enrichedCharges,
    deposits,
    allSeries,
    allProperties,
    allTenants,
    allUnits,
  ] = await Promise.all([
    getSeriesSummaries(orgId, filter),
    getExpenseByCategory(orgId, filter),
    getEnrichedCharges(orgId, filter),
    (async () => {
      const depConds = [eq(securityDeposits.organizationId, orgId)];
      if (seriesId) depConds.push(eq(securityDeposits.childSeriesId, seriesId));
      return db
        .select()
        .from(securityDeposits)
        .where(and(...depConds));
    })(),
    db
      .select({ id: childSeries.id, name: childSeries.name })
      .from(childSeries)
      .where(eq(childSeries.organizationId, orgId)),
    (async () => {
      const propConds = [eq(properties.organizationId, orgId)];
      if (seriesId) propConds.push(eq(properties.childSeriesId, seriesId));
      if (propertyId) propConds.push(eq(properties.id, propertyId));
      return db
        .select({ id: properties.id, name: properties.name })
        .from(properties)
        .where(and(...propConds));
    })(),
    db
      .select({ id: tenants.id, name: tenants.fullName })
      .from(tenants)
      .where(eq(tenants.organizationId, orgId)),
    db
      .select({ id: units.id, label: units.label, propertyId: units.propertyId })
      .from(units)
      .where(eq(units.organizationId, orgId)),
  ]);

  // Build lookup maps
  const seriesById = new Map(allSeries.map((s) => [s.id, s.name]));
  const propertyById = new Map(allProperties.map((p) => [p.id, p.name]));
  const tenantById = new Map(allTenants.map((t) => [t.id, t.name]));
  const unitById = new Map(
    allUnits.map((u) => [u.id, `${propertyById.get(u.propertyId) ?? ""} — ${u.label}`]),
  );

  // Totals for P&L
  const totalIncome = seriesSummaries.reduce((s, r) => s + r.incomeCents, 0);
  const totalExpenses = seriesSummaries.reduce((s, r) => s + r.expensesCents, 0);
  const totalNet = seriesSummaries.reduce((s, r) => s + r.netCents, 0);
  const totalOutstanding = seriesSummaries.reduce(
    (s, r) => s + r.outstandingCents,
    0,
  );

  // Tenant balance: group enriched charges by tenantId
  const tenantBalanceMap = new Map<
    string,
    { billed: number; paid: number; balance: number }
  >();
  for (const c of enrichedCharges) {
    const cur = tenantBalanceMap.get(c.tenantId) ?? {
      billed: 0,
      paid: 0,
      balance: 0,
    };
    cur.billed += c.totalDueCents;
    cur.paid += c.paidCents;
    cur.balance += c.balanceCents;
    tenantBalanceMap.set(c.tenantId, cur);
  }
  const tenantBalances = [...tenantBalanceMap.entries()].map(
    ([tenantId, data]) => ({
      tenantId,
      tenantName: tenantById.get(tenantId) ?? tenantId,
      ...data,
    }),
  );

  // Security deposit totals
  const totalDepositAmount = deposits.reduce(
    (s, d) => s + d.amountCents,
    0,
  );
  const totalDepositRefund = deposits.reduce(
    (s, d) => s + d.refundAmountCents,
    0,
  );
  const totalDepositHeld = totalDepositAmount - totalDepositRefund;

  // Property-level income & expenses
  const propertyMetrics = await Promise.all(
    allProperties.map(async (p) => {
      const m = await getDashboardMetrics(orgId, {
        ...filter,
        propertyId: p.id,
      });
      return {
        id: p.id,
        name: p.name,
        incomeCents: m.rentCollectedCents,
        expensesCents: m.expensesCents,
        netCents: m.rentCollectedCents - m.expensesCents,
      };
    }),
  );

  // Expense category totals
  const totalExpenseForCategory = byCategory.reduce(
    (s, c) => s + c.totalCents,
    0,
  );

  const filters = [
    { key: "series", label: "Series", options: seriesOpts, allLabel: "All series" },
    {
      key: "property",
      label: "Property",
      options: propOpts,
      allLabel: "All properties",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Financial reports across your portfolio."
      >
        <Link href={exportUrl}>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" /> Download CSV
          </Button>
        </Link>
      </PageHeader>

      <FilterBar filters={filters} showDateRange />

      <Tabs defaultValue={activeTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="pl">P&amp;L by Series</TabsTrigger>
          <TabsTrigger value="income">Income Summary</TabsTrigger>
          <TabsTrigger value="expenses">Expense Summary</TabsTrigger>
          <TabsTrigger value="expense-category">Expense by Category</TabsTrigger>
          <TabsTrigger value="rent-roll">Rent Roll</TabsTrigger>
          <TabsTrigger value="tenant-balance">Tenant Balance</TabsTrigger>
          <TabsTrigger value="deposits">Security Deposits</TabsTrigger>
          <TabsTrigger value="property">Property P&amp;L</TabsTrigger>
        </TabsList>

        {/* 1. P&L by child series */}
        <TabsContent value="pl">
          <Card>
            <CardHeader>
              <CardTitle>Profit &amp; Loss by Child Series</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Series</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Income</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Properties</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {seriesSummaries.map((s) => (
                    <TableRow key={s.seriesId}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/series/${s.seriesId}`}
                          className="hover:underline"
                        >
                          {s.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge tone={seriesStatusTones[s.status] ?? "muted"}>
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600">
                        {formatCents(s.incomeCents)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCents(s.expensesCents)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium tabular-nums ${s.netCents >= 0 ? "text-emerald-600" : "text-red-600"}`}
                      >
                        {formatCents(s.netCents)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-amber-600">
                        {formatCents(s.outstandingCents)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {s.propertyCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {s.unitCount}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold bg-muted/40">
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600">
                      {formatCents(totalIncome)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCents(totalExpenses)}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${totalNet >= 0 ? "text-emerald-600" : "text-red-600"}`}
                    >
                      {formatCents(totalNet)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-amber-600">
                      {formatCents(totalOutstanding)}
                    </TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. Income summary */}
        <TabsContent value="income">
          <Card>
            <CardHeader>
              <CardTitle>Income Summary by Series</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Series</TableHead>
                    <TableHead className="text-right">Rent Collected</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {seriesSummaries.map((s) => (
                    <TableRow key={s.seriesId}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600">
                        {formatCents(s.incomeCents)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-amber-600">
                        {formatCents(s.outstandingCents)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold bg-muted/40">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600">
                      {formatCents(totalIncome)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-amber-600">
                      {formatCents(totalOutstanding)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. Expense summary */}
        <TabsContent value="expenses">
          <Card>
            <CardHeader>
              <CardTitle>Expense Summary by Series</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Series</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="text-right">Net Income</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {seriesSummaries.map((s) => (
                    <TableRow key={s.seriesId}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCents(s.expensesCents)}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums font-medium ${s.netCents >= 0 ? "text-emerald-600" : "text-red-600"}`}
                      >
                        {formatCents(s.netCents)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold bg-muted/40">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCents(totalExpenses)}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${totalNet >= 0 ? "text-emerald-600" : "text-red-600"}`}
                    >
                      {formatCents(totalNet)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. Expense breakdown by category */}
        <TabsContent value="expense-category">
          <Card>
            <CardHeader>
              <CardTitle>Expense Breakdown by Category</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">% of Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byCategory.map((c) => {
                    const pct =
                      totalExpenseForCategory > 0
                        ? (c.totalCents / totalExpenseForCategory) * 100
                        : 0;
                    return (
                      <TableRow key={c.kind}>
                        <TableCell className="font-medium">
                          {expenseCategoryLabels[c.kind]}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {c.count}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCents(c.totalCents)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {pct.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="font-semibold bg-muted/40">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {byCategory.reduce((s, c) => s + c.count, 0)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCents(totalExpenseForCategory)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      100%
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. Rent roll */}
        <TabsContent value="rent-roll">
          <Card>
            <CardHeader>
              <CardTitle>Rent Roll</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Series</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Rent Due</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrichedCharges.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center text-muted-foreground py-8"
                      >
                        No charges found for the selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    enrichedCharges.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          {tenantById.get(c.tenantId) ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {unitById.get(c.unitId) ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {seriesById.get(c.childSeriesId) ?? "—"}
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground whitespace-nowrap">
                          {formatDate(c.dueDate)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCents(c.totalDueCents)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-600">
                          {formatCents(c.paidCents)}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums font-medium ${c.balanceCents > 0 ? "text-red-600" : "text-muted-foreground"}`}
                        >
                          {formatCents(c.balanceCents)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            tone={
                              rentStatusTones[c.computedStatus] ?? "muted"
                            }
                          >
                            {rentStatusLabels[c.computedStatus] ??
                              c.computedStatus}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 6. Tenant balance */}
        <TabsContent value="tenant-balance">
          <Card>
            <CardHeader>
              <CardTitle>Tenant Balance Report</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead className="text-right">Total Billed</TableHead>
                    <TableHead className="text-right">Total Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenantBalances.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground py-8"
                      >
                        No tenant balance data found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    tenantBalances.map((t) => (
                      <TableRow key={t.tenantId}>
                        <TableCell className="font-medium">
                          {t.tenantName}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCents(t.billed)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-600">
                          {formatCents(t.paid)}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums font-medium ${t.balance > 0 ? "text-red-600" : "text-muted-foreground"}`}
                        >
                          {formatCents(t.balance)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  {tenantBalances.length > 0 ? (
                    <TableRow className="font-semibold bg-muted/40">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCents(
                          tenantBalances.reduce((s, t) => s + t.billed, 0),
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600">
                        {formatCents(
                          tenantBalances.reduce((s, t) => s + t.paid, 0),
                        )}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${tenantBalances.reduce((s, t) => s + t.balance, 0) > 0 ? "text-red-600" : "text-muted-foreground"}`}
                      >
                        {formatCents(
                          tenantBalances.reduce((s, t) => s + t.balance, 0),
                        )}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 7. Security deposit report */}
        <TabsContent value="deposits">
          <Card>
            <CardHeader>
              <CardTitle>Security Deposit Report</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Series</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Refunded</TableHead>
                    <TableHead className="text-right">Net Held</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deposits.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground py-8"
                      >
                        No security deposits found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    deposits.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">
                          {tenantById.get(d.tenantId) ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {seriesById.get(d.childSeriesId) ?? "—"}
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground whitespace-nowrap">
                          {formatDate(d.receivedDate)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCents(d.amountCents)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatCents(d.refundAmountCents)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatCents(d.amountCents - d.refundAmountCents)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  {deposits.length > 0 ? (
                    <TableRow className="font-semibold bg-muted/40">
                      <TableCell colSpan={3}>Total</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCents(totalDepositAmount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatCents(totalDepositRefund)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCents(totalDepositHeld)}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 8. Property-level income & expense */}
        <TabsContent value="property">
          <Card>
            <CardHeader>
              <CardTitle>Property-Level Income &amp; Expenses</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead className="text-right">Income</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {propertyMetrics.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center text-muted-foreground py-8"
                      >
                        No properties found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    propertyMetrics.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/properties/${p.id}`}
                            className="hover:underline"
                          >
                            {p.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-600">
                          {formatCents(p.incomeCents)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCents(p.expensesCents)}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums font-medium ${p.netCents >= 0 ? "text-emerald-600" : "text-red-600"}`}
                        >
                          {formatCents(p.netCents)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  {propertyMetrics.length > 0 ? (
                    <TableRow className="font-semibold bg-muted/40">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600">
                        {formatCents(
                          propertyMetrics.reduce(
                            (s, p) => s + p.incomeCents,
                            0,
                          ),
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCents(
                          propertyMetrics.reduce(
                            (s, p) => s + p.expensesCents,
                            0,
                          ),
                        )}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${propertyMetrics.reduce((s, p) => s + p.netCents, 0) >= 0 ? "text-emerald-600" : "text-red-600"}`}
                      >
                        {formatCents(
                          propertyMetrics.reduce(
                            (s, p) => s + p.netCents,
                            0,
                          ),
                        )}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
