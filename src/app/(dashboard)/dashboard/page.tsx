import {
  AlertTriangle,
  Banknote,
  Building2,
  CircleDollarSign,
  Home,
  PiggyBank,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getSeriesContext } from "@/lib/series-context";
import {
  getDashboardMetrics,
  getExpenseByCategory,
  getSeriesSummaries,
} from "@/lib/metrics";
import { formatCents } from "@/lib/money";
import { expenseCategoryLabels, seriesStatusTones } from "@/lib/labels";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await requireSession();
  const { currentSeriesId, current } = await getSeriesContext(
    session.organizationId,
  );
  const filter = { seriesId: currentSeriesId };

  const [metrics, seriesSummaries, byCategory] = await Promise.all([
    getDashboardMetrics(session.organizationId, filter),
    getSeriesSummaries(session.organizationId),
    getExpenseByCategory(session.organizationId, filter),
  ]);

  const collectionRate =
    metrics.rentDueCents > 0
      ? Math.round((metrics.rentCollectedCents / metrics.rentDueCents) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={
          current
            ? `Financial snapshot for ${current.name}.`
            : "Financial snapshot across all child series."
        }
      />

      {/* Primary financial cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total rent due"
          value={formatCents(metrics.rentDueCents)}
          icon={Wallet}
        />
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
          label="Late rent"
          value={formatCents(metrics.lateCents)}
          icon={AlertTriangle}
          tone="danger"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Series breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Child series performance
            </CardTitle>
            <Link
              href="/parent-llc"
              className="text-sm font-medium text-primary hover:underline"
            >
              Parent LLC overview →
            </Link>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Series</TableHead>
                  <TableHead className="text-right">Income</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {seriesSummaries.map((s) => (
                  <TableRow key={s.seriesId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/series/${s.seriesId}`}
                          className="font-medium hover:underline"
                        >
                          {s.name}
                        </Link>
                        <Badge tone={seriesStatusTones[s.status] ?? "muted"}>
                          {s.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {s.propertyCount} properties · {s.unitCount} units
                      </p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCents(s.incomeCents)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCents(s.expensesCents)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium tabular-nums ${
                        s.netCents >= 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {formatCents(s.netCents)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCents(s.outstandingCents)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Expense breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4" /> Expenses by category
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {byCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expenses yet.</p>
            ) : (
              byCategory.map((c) => {
                const pct =
                  metrics.expensesCents > 0
                    ? Math.round((c.totalCents / metrics.expensesCents) * 100)
                    : 0;
                return (
                  <div key={c.kind} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{expenseCategoryLabels[c.kind]}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatCents(c.totalCents)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
