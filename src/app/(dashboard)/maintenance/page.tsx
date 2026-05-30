import { Wrench, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { db } from "@/db";
import {
  maintenanceRequests,
  properties,
  units,
  tenants,
  type MaintenanceStatus,
  type MaintenancePriority,
} from "@/db/schema";
import {
  maintenanceStatusLabels,
  maintenanceStatusTones,
  maintenancePriorityLabels,
  maintenancePriorityTones,
} from "@/lib/labels";
import { formatDate } from "@/lib/date";
import {
  seriesOptions,
  propertyOptions,
  unitOptions,
  tenantOptions,
} from "@/lib/lookups";
import { getSeriesContext } from "@/lib/series-context";
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
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import {
  CreateMaintenanceButton,
  EditMaintenanceButton,
} from "./maintenance-form";
import { deleteMaintenanceRequest } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_FILTER_OPTIONS = (
  Object.keys(maintenanceStatusLabels) as MaintenanceStatus[]
).map((s) => ({ value: s, label: maintenanceStatusLabels[s] }));

const PRIORITY_FILTER_OPTIONS = (
  Object.keys(maintenancePriorityLabels) as MaintenancePriority[]
).map((p) => ({ value: p, label: maintenancePriorityLabels[p] }));

export default async function MaintenancePage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await props.searchParams;
  const session = await requireSession();

  const canCreate = can(session.role, "maintenance", "create");
  const canEdit = can(session.role, "maintenance", "edit");
  const canDelete = can(session.role, "maintenance", "delete");

  const seriesCtx = await getSeriesContext(session.organizationId);
  const seriesFilter = sp.series ?? seriesCtx.currentSeriesId ?? null;
  const propertyFilter = sp.property ?? null;
  const statusFilter = (sp.status as MaintenanceStatus) ?? null;
  const priorityFilter = (sp.priority as MaintenancePriority) ?? null;

  const [seriesOpts, propOpts, unitOpts, tenantOpts] = await Promise.all([
    seriesOptions(session.organizationId),
    propertyOptions(session.organizationId, seriesFilter),
    unitOptions(session.organizationId, seriesFilter),
    tenantOptions(session.organizationId),
  ]);

  // Build query conditions
  const conds = [
    eq(maintenanceRequests.organizationId, session.organizationId),
  ];
  if (seriesFilter)
    conds.push(eq(maintenanceRequests.childSeriesId, seriesFilter));
  if (propertyFilter)
    conds.push(eq(maintenanceRequests.propertyId, propertyFilter));
  if (statusFilter) conds.push(eq(maintenanceRequests.status, statusFilter));
  if (priorityFilter)
    conds.push(eq(maintenanceRequests.priority, priorityFilter));

  const rows = await db
    .select({
      id: maintenanceRequests.id,
      organizationId: maintenanceRequests.organizationId,
      childSeriesId: maintenanceRequests.childSeriesId,
      propertyId: maintenanceRequests.propertyId,
      unitId: maintenanceRequests.unitId,
      tenantId: maintenanceRequests.tenantId,
      title: maintenanceRequests.title,
      description: maintenanceRequests.description,
      priority: maintenanceRequests.priority,
      status: maintenanceRequests.status,
      resolutionNotes: maintenanceRequests.resolutionNotes,
      createdAt: maintenanceRequests.createdAt,
      updatedAt: maintenanceRequests.updatedAt,
      propertyName: properties.name,
      unitLabel: units.label,
      tenantName: tenants.fullName,
    })
    .from(maintenanceRequests)
    .leftJoin(properties, eq(properties.id, maintenanceRequests.propertyId))
    .leftJoin(units, eq(units.id, maintenanceRequests.unitId))
    .leftJoin(tenants, eq(tenants.id, maintenanceRequests.tenantId))
    .where(and(...conds))
    .orderBy(maintenanceRequests.createdAt);

  // Stat counts by status
  const openCount = rows.filter((r) => r.status === "open").length;
  const inProgressCount = rows.filter((r) => r.status === "in_progress").length;
  const completedCount = rows.filter((r) => r.status === "completed").length;

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
      key: "status",
      label: "Status",
      options: STATUS_FILTER_OPTIONS,
      allLabel: "All statuses",
    },
    {
      key: "priority",
      label: "Priority",
      options: PRIORITY_FILTER_OPTIONS,
      allLabel: "All priorities",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance"
        description="Track and manage maintenance requests across your properties."
      >
        {canCreate ? (
          <CreateMaintenanceButton
            propertyOptions={propOpts}
            unitOptions={unitOpts}
            tenantOptions={tenantOpts}
          />
        ) : null}
      </PageHeader>

      <FilterBar filters={filters} />

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Open"
          value={String(openCount)}
          icon={AlertCircle}
          tone="warning"
        />
        <StatCard
          label="In progress"
          value={String(inProgressCount)}
          icon={Clock}
          tone="info"
        />
        <StatCard
          label="Completed"
          value={String(completedCount)}
          icon={CheckCircle2}
          tone="success"
        />
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No maintenance requests found"
          description="Log your first maintenance request or adjust the filters above."
          action={
            canCreate ? (
              <CreateMaintenanceButton
                propertyOptions={propOpts}
                unitOptions={unitOpts}
                tenantOptions={tenantOpts}
              />
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Property / Unit</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                {canEdit || canDelete ? (
                  <TableHead className="w-[100px]" />
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium max-w-[220px] truncate">
                    {row.title}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {row.propertyName ?? "—"}
                    {row.unitLabel ? ` — ${row.unitLabel}` : ""}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.tenantName ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      tone={
                        maintenancePriorityTones[row.priority] ?? "muted"
                      }
                    >
                      {maintenancePriorityLabels[row.priority]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      tone={maintenanceStatusTones[row.status] ?? "muted"}
                    >
                      {maintenanceStatusLabels[row.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">
                    {formatDate(row.createdAt)}
                  </TableCell>
                  {canEdit || canDelete ? (
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {canEdit ? (
                          <EditMaintenanceButton
                            request={row}
                            propertyOptions={propOpts}
                            unitOptions={unitOpts}
                            tenantOptions={tenantOpts}
                          />
                        ) : null}
                        {canDelete ? (
                          <ConfirmDelete
                            action={deleteMaintenanceRequest}
                            id={row.id}
                            title="Delete this request?"
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
