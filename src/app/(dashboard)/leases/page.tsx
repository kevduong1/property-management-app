import { FileText } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { db } from "@/db";
import { leases, tenants, units, properties } from "@/db/schema";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/date";
import { leaseStatusLabels, leaseStatusTones } from "@/lib/labels";
import {
  seriesOptions,
  tenantOptions,
  unitOptions,
} from "@/lib/lookups";
import { getSeriesContext } from "@/lib/series-context";
import { PageHeader } from "@/components/shared/page-header";
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
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { CreateLeaseButton, EditLeaseButton } from "./lease-form";
import { deleteLease } from "./actions";
import type { LeaseStatus } from "@/db/schema";

export const dynamic = "force-dynamic";

const LEASE_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "upcoming", label: "Upcoming" },
  { value: "month_to_month", label: "Month-to-month" },
  { value: "expired", label: "Expired" },
  { value: "terminated", label: "Terminated" },
];

export default async function LeasesPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [session, sp] = await Promise.all([requireSession(), props.searchParams]);

  const canCreate = can(session.role, "lease", "create");
  const canEdit = can(session.role, "lease", "edit");
  const canDelete = can(session.role, "lease", "delete");

  const seriesCtx = await getSeriesContext(session.organizationId);
  const seriesFilter = sp.series ?? seriesCtx.currentSeriesId ?? null;
  const statusFilter = (sp.status as LeaseStatus | undefined) ?? null;
  const tenantFilter = sp.tenant ?? null;

  const [seriesOpts, tenantOpts, unitOpts] = await Promise.all([
    seriesOptions(session.organizationId),
    tenantOptions(session.organizationId),
    unitOptions(session.organizationId, seriesFilter),
  ]);

  // Build query conditions.
  const conds = [eq(leases.organizationId, session.organizationId)];
  if (seriesFilter) conds.push(eq(leases.childSeriesId, seriesFilter));
  if (statusFilter) conds.push(eq(leases.status, statusFilter));
  if (tenantFilter) conds.push(eq(leases.tenantId, tenantFilter));

  const rows = await db
    .select({
      id: leases.id,
      status: leases.status,
      startDate: leases.startDate,
      endDate: leases.endDate,
      monthlyRentCents: leases.monthlyRentCents,
      securityDepositCents: leases.securityDepositCents,
      tenantId: leases.tenantId,
      unitId: leases.unitId,
      childSeriesId: leases.childSeriesId,
      notes: leases.notes,
      organizationId: leases.organizationId,
      createdAt: leases.createdAt,
      updatedAt: leases.updatedAt,
      documentId: leases.documentId,
      tenantName: tenants.fullName,
      unitLabel: units.label,
      propertyName: properties.name,
    })
    .from(leases)
    .innerJoin(tenants, eq(tenants.id, leases.tenantId))
    .innerJoin(units, eq(units.id, leases.unitId))
    .innerJoin(properties, eq(properties.id, units.propertyId))
    .where(and(...conds))
    .orderBy(leases.startDate);

  const filters = [
    {
      key: "series",
      label: "Series",
      options: seriesOpts,
      allLabel: "All series",
    },
    {
      key: "status",
      label: "Status",
      options: LEASE_STATUS_OPTIONS,
      allLabel: "All statuses",
    },
    {
      key: "tenant",
      label: "Tenant",
      options: tenantOpts,
      allLabel: "All tenants",
    },
  ];

  function termLabel(startDate: string, endDate: string | null): string {
    if (!endDate) return `${formatDate(startDate)} – Month-to-month`;
    return `${formatDate(startDate)} – ${formatDate(endDate)}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leases"
        description="All leases linking tenants to units."
      >
        {canCreate ? (
          <CreateLeaseButton
            tenantOptions={tenantOpts}
            unitOptions={unitOpts}
          />
        ) : null}
      </PageHeader>

      <FilterBar filters={filters} />

      {rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No leases found"
          description="Create a lease to link a tenant to a unit, or adjust the filters above."
          action={
            canCreate ? (
              <CreateLeaseButton
                tenantOptions={tenantOpts}
                unitOptions={unitOpts}
              />
            ) : undefined
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead className="text-right">Rent/mo</TableHead>
                  <TableHead className="text-right">Deposit</TableHead>
                  <TableHead>Status</TableHead>
                  {canEdit || canDelete ? (
                    <TableHead className="w-24" />
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {row.tenantName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.propertyName} — {row.unitLabel}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {termLabel(row.startDate, row.endDate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCents(row.monthlyRentCents)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCents(row.securityDepositCents)}
                    </TableCell>
                    <TableCell>
                      <Badge tone={leaseStatusTones[row.status] ?? "muted"}>
                        {leaseStatusLabels[row.status] ?? row.status}
                      </Badge>
                    </TableCell>
                    {canEdit || canDelete ? (
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {canEdit ? (
                            <EditLeaseButton
                              lease={row}
                              tenantOptions={tenantOpts}
                              unitOptions={unitOpts}
                            />
                          ) : null}
                          {canDelete ? (
                            <ConfirmDelete
                              action={deleteLease}
                              id={row.id}
                              title={`Delete lease for ${row.tenantName}?`}
                              description="The lease will be removed. Any associated rent charges will be retained but unlinked."
                            />
                          ) : null}
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
