import { Wallet, AlertTriangle, CheckCircle2 } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getTenantOverview } from "@/lib/tenant-portal";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/date";
import {
  rentStatusLabels,
  rentStatusTones,
  paymentMethodLabels,
} from "@/lib/labels";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function RentPage() {
  const session = await requireSession();
  const overview = await getTenantOverview(
    session.tenantId!,
    session.organizationId,
  );

  const { charges, payments, totalBalanceCents, lateCount } = overview;

  const totalPaidCents = charges.reduce((s, c) => s + c.paidCents, 0);
  const totalDueCents = charges.reduce(
    (s, c) => s + c.rentAmountCents + c.lateFeeCents,
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rent & Balance"
        description="Your rent charges, payment history, and current outstanding balance."
      />

      {/* Summary stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Outstanding balance"
          value={formatCents(totalBalanceCents)}
          tone={totalBalanceCents > 0 ? "danger" : "success"}
          icon={totalBalanceCents > 0 ? AlertTriangle : CheckCircle2}
          sublabel={
            totalBalanceCents === 0
              ? "Nothing owed — great job!"
              : "Amount still owed"
          }
        />
        <StatCard
          label="Late charges"
          value={String(lateCount)}
          tone={lateCount > 0 ? "danger" : "success"}
          icon={Wallet}
          sublabel={
            lateCount === 0 ? "No overdue charges" : `${lateCount} overdue`
          }
        />
        <StatCard
          label="Total paid (all time)"
          value={formatCents(totalPaidCents)}
          tone="success"
          icon={CheckCircle2}
          sublabel={`of ${formatCents(totalDueCents)} total charged`}
        />
      </div>

      {/* Rent charges table */}
      <Card>
        <CardHeader>
          <CardTitle>Rent Charges</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {charges.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Wallet}
                title="No rent charges yet"
                description="Your rent charges will appear here once they are posted by your property manager."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Due date</TableHead>
                  <TableHead>Rent</TableHead>
                  <TableHead>Late fee</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {charges.map((charge) => (
                  <TableRow key={charge.id}>
                    <TableCell>{formatDate(charge.dueDate)}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatCents(charge.rentAmountCents)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {charge.lateFeeCents > 0
                        ? formatCents(charge.lateFeeCents)
                        : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatCents(charge.paidCents)}
                    </TableCell>
                    <TableCell className="tabular-nums font-medium">
                      {charge.balanceCents > 0
                        ? formatCents(charge.balanceCents)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge tone={rentStatusTones[charge.computedStatus]}>
                        {rentStatusLabels[charge.computedStatus]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payment history table */}
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {payments.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={CheckCircle2}
                title="No payments recorded"
                description="Payments posted by your property manager will appear here."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date received</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...payments]
                  .sort((a, b) =>
                    b.receivedDate.localeCompare(a.receivedDate),
                  )
                  .map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{formatDate(payment.receivedDate)}</TableCell>
                      <TableCell className="tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                        {formatCents(payment.amountCents)}
                      </TableCell>
                      <TableCell>
                        {paymentMethodLabels[payment.method] ?? payment.method}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {payment.reference ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
