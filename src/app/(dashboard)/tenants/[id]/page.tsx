import Link from "next/link";
import { notFound } from "next/navigation";
import { User } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { db } from "@/db";
import { leases, properties, tenants, units } from "@/db/schema";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/date";
import { leaseStatusLabels, leaseStatusTones } from "@/lib/labels";
import { PageHeader } from "@/components/shared/page-header";
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
import { EditTenantButton } from "../tenant-form";

export const dynamic = "force-dynamic";

export default async function TenantDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const [session, { id }] = await Promise.all([
    requireSession(),
    props.params,
  ]);

  const [tenant] = await db
    .select()
    .from(tenants)
    .where(
      and(
        eq(tenants.id, id),
        eq(tenants.organizationId, session.organizationId),
      ),
    )
    .limit(1);

  if (!tenant) notFound();

  const canEdit = can(session.role, "tenant", "edit");

  // Load tenant's leases with unit and property info.
  const tenantLeases = await db
    .select({
      id: leases.id,
      status: leases.status,
      startDate: leases.startDate,
      endDate: leases.endDate,
      monthlyRentCents: leases.monthlyRentCents,
      securityDepositCents: leases.securityDepositCents,
      unitLabel: units.label,
      propertyName: properties.name,
    })
    .from(leases)
    .innerJoin(units, eq(units.id, leases.unitId))
    .innerJoin(properties, eq(properties.id, units.propertyId))
    .where(
      and(
        eq(leases.tenantId, id),
        eq(leases.organizationId, session.organizationId),
      ),
    )
    .orderBy(leases.startDate);

  const totalDeposit = tenantLeases.reduce(
    (acc, l) => acc + l.securityDepositCents,
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={tenant.fullName}
        description="Tenant contact information and lease history."
      >
        {canEdit ? <EditTenantButton tenant={tenant} /> : null}
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Contact info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow label="Email" value={tenant.email} />
            <InfoRow label="Phone" value={tenant.phone} />
            <InfoRow
              label="Emergency contact"
              value={
                tenant.emergencyContactName
                  ? `${tenant.emergencyContactName}${tenant.emergencyContactPhone ? ` · ${tenant.emergencyContactPhone}` : ""}`
                  : null
              }
            />
            {tenant.notes ? (
              <div>
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="mt-0.5 whitespace-pre-wrap">{tenant.notes}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Balance summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow label="Total leases" value={String(tenantLeases.length)} />
            <InfoRow
              label="Active leases"
              value={String(
                tenantLeases.filter((l) => l.status === "active").length,
              )}
            />
            <InfoRow
              label="Security deposits on file"
              value={formatCents(totalDeposit)}
            />
          </CardContent>
        </Card>
      </div>

      {/* Leases table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Leases</span>
            <Link
              href={`/leases?tenant=${id}`}
              className="text-xs font-normal text-muted-foreground hover:underline"
            >
              View all
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {tenantLeases.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <User className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No leases on record.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Rent</TableHead>
                  <TableHead>Deposit</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenantLeases.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/leases?tenant=${id}`}
                        className="hover:underline"
                      >
                        {l.propertyName} — {l.unitLabel}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {l.endDate
                        ? `${formatDate(l.startDate)} – ${formatDate(l.endDate)}`
                        : `${formatDate(l.startDate)} – Month-to-month`}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatCents(l.monthlyRentCents)}/mo
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatCents(l.securityDepositCents)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        tone={leaseStatusTones[l.status] ?? "muted"}
                      >
                        {leaseStatusLabels[l.status] ?? l.status}
                      </Badge>
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

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5">{value ?? "—"}</p>
    </div>
  );
}
