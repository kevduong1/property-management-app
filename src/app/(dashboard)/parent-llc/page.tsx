import Link from "next/link";
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
import { requireSession } from "@/lib/auth";
import { getPrimaryParentLlc } from "@/lib/lookups";
import { getDashboardMetrics, getSeriesSummaries } from "@/lib/metrics";
import { formatCents } from "@/lib/money";
import { seriesStatusTones } from "@/lib/labels";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
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

export default async function ParentLlcPage() {
  const session = await requireSession();
  const orgId = session.organizationId;

  const [parentLlc, metrics, seriesSummaries] = await Promise.all([
    getPrimaryParentLlc(orgId),
    getDashboardMetrics(orgId),
    getSeriesSummaries(orgId),
  ]);

  const collectionRate =
    metrics.rentDueCents > 0
      ? Math.round((metrics.rentCollectedCents / metrics.rentDueCents) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parent LLC Overview"
        description="Org-wide financial snapshot across all child series."
      />

      {/* Parent LLC info card */}
      {parentLlc ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {parentLlc.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              {parentLlc.ein ? (
                <>
                  <dt className="text-muted-foreground">EIN</dt>
                  <dd className="font-mono sm:col-span-2">{parentLlc.ein}</dd>
                </>
              ) : null}
              {parentLlc.stateOfFormation ? (
                <>
                  <dt className="text-muted-foreground">State of formation</dt>
                  <dd className="sm:col-span-2">{parentLlc.stateOfFormation}</dd>
                </>
              ) : null}
              {parentLlc.notes ? (
                <>
                  <dt className="text-muted-foreground">Notes</dt>
                  <dd className="sm:col-span-2 whitespace-pre-line">{parentLlc.notes}</dd>
                </>
              ) : null}
            </dl>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No parent LLC found. Create one first.
          </CardContent>
        </Card>
      )}

      {/* Org-wide stat cards */}
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
          label="Child series"
          value={String(seriesSummaries.length)}
          icon={Building2}
        />
      </div>

      {/* All child series table */}
      <Card>
        <CardHeader>
          <CardTitle>Child Series</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {seriesSummaries.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No child series yet.{" "}
              <Link href="/series" className="underline">
                Create one
              </Link>
              .
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Series</TableHead>
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
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-600">
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
                {/* Totals row */}
                <TableRow className="font-semibold bg-muted/40">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-600">
                    {formatCents(
                      seriesSummaries.reduce((s, r) => s + r.incomeCents, 0),
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCents(
                      seriesSummaries.reduce((s, r) => s + r.expensesCents, 0),
                    )}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${
                      seriesSummaries.reduce((s, r) => s + r.netCents, 0) >= 0
                        ? "text-emerald-600"
                        : "text-red-600"
                    }`}
                  >
                    {formatCents(
                      seriesSummaries.reduce((s, r) => s + r.netCents, 0),
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-amber-600">
                    {formatCents(
                      seriesSummaries.reduce((s, r) => s + r.outstandingCents, 0),
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {seriesSummaries.reduce((s, r) => s + r.propertyCount, 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {seriesSummaries.reduce((s, r) => s + r.unitCount, 0)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
