import { and, eq } from "drizzle-orm";
import {
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Wallet,
  FileText,
} from "lucide-react";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { db } from "@/db";
import {
  properties,
  rentCharges,
  securityDeposits,
  tenants,
  units,
  type RentChargeStatus,
} from "@/db/schema";
import { formatCents } from "@/lib/money";
import { formatDate, todayISO } from "@/lib/date";
import { rentStatusLabels, rentStatusTones } from "@/lib/labels";
import {
  seriesOptions,
  propertyOptions,
  unitOptions,
  tenantOptions,
} from "@/lib/lookups";
import { getSeriesContext } from "@/lib/series-context";
import { getEnrichedCharges } from "@/lib/metrics";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { CreateRentChargeButton, EditRentChargeButton } from "./rent-charge-form";
import { RecordPaymentButton } from "./payment-form";
import { CreateDepositButton, EditDepositButton } from "./deposit-form";
import {
  deleteRentCharge,
  deleteSecurityDeposit,
} from "./actions";

export const dynamic = "force-dynamic";

const RENT_STATUS_OPTIONS: { value: RentChargeStatus; label: string }[] = [
  { value: "unpaid", label: "Unpaid" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
  { value: "late", label: "Late" },
];

export default async function RentPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await props.searchParams;
  const session = await requireSession();

  const canCreateRent = can(session.role, "rent", "create");
  const canEditRent = can(session.role, "rent", "edit");
  const canDeleteRent = can(session.role, "rent", "delete");
  const canCreateDeposit = can(session.role, "deposit", "create");
  const canEditDeposit = can(session.role, "deposit", "edit");
  const canDeleteDeposit = can(session.role, "deposit", "delete");

  const seriesCtx = await getSeriesContext(session.organizationId);
  const seriesFilter = sp.series ?? seriesCtx.currentSeriesId ?? null;
  const propertyFilter = sp.property ?? null;
  const unitFilter = sp.unit ?? null;
  const tenantFilter = sp.tenant ?? null;
  const statusFilter = (sp.status as RentChargeStatus) ?? null;
  const fromFilter = sp.from ?? null;
  const toFilter = sp.to ?? null;
  const activeTab = sp.tab === "deposits" ? "deposits" : "charges";

  const [seriesOpts, propOpts, unitOpts, tenantOpts] = await Promise.all([
    seriesOptions(session.organizationId),
    propertyOptions(session.organizationId, seriesFilter),
    unitOptions(session.organizationId, seriesFilter),
    tenantOptions(session.organizationId),
  ]);

  // Load enriched charges (with paidCents, balanceCents, computedStatus).
  const enrichedCharges = await getEnrichedCharges(session.organizationId, {
    seriesId: seriesFilter,
    propertyId: propertyFilter,
    unitId: unitFilter,
    tenantId: tenantFilter,
    from: fromFilter,
    to: toFilter,
  });

  // Apply status filter in memory (getEnrichedCharges doesn't support it).
  const charges = statusFilter
    ? enrichedCharges.filter((c) => c.computedStatus === statusFilter)
    : enrichedCharges;

  // Build lookup maps for display (unit label, property name, tenant name).
  const [allUnits, allProperties, allTenants] = await Promise.all([
    db
      .select({
        id: units.id,
        label: units.label,
        propertyId: units.propertyId,
      })
      .from(units)
      .where(eq(units.organizationId, session.organizationId)),
    db
      .select({ id: properties.id, name: properties.name })
      .from(properties)
      .where(eq(properties.organizationId, session.organizationId)),
    db
      .select({ id: tenants.id, fullName: tenants.fullName })
      .from(tenants)
      .where(eq(tenants.organizationId, session.organizationId)),
  ]);

  const unitById = new Map(allUnits.map((u) => [u.id, u]));
  const propertyById = new Map(allProperties.map((p) => [p.id, p]));
  const tenantById = new Map(allTenants.map((t) => [t.id, t]));

  // Summary stat card values computed from the in-scope charges.
  const totalDueCents = charges.reduce((s, c) => s + c.totalDueCents, 0);
  const totalCollectedCents = charges.reduce((s, c) => s + c.paidCents, 0);
  const totalOutstandingCents = charges.reduce((s, c) => s + c.balanceCents, 0);
  const totalLateCents = charges
    .filter((c) => c.computedStatus === "late")
    .reduce((s, c) => s + c.balanceCents, 0);

  // Security deposits.
  const depConds = [eq(securityDeposits.organizationId, session.organizationId)];
  if (seriesFilter) depConds.push(eq(securityDeposits.childSeriesId, seriesFilter));
  if (tenantFilter) depConds.push(eq(securityDeposits.tenantId, tenantFilter));
  if (unitFilter) depConds.push(eq(securityDeposits.unitId, unitFilter));

  const deposits = await db
    .select()
    .from(securityDeposits)
    .where(and(...depConds))
    .orderBy(securityDeposits.receivedDate);

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
      key: "unit",
      label: "Unit",
      options: unitOpts,
      allLabel: "All units",
    },
    {
      key: "tenant",
      label: "Tenant",
      options: tenantOpts,
      allLabel: "All tenants",
    },
    {
      key: "status",
      label: "Status",
      options: RENT_STATUS_OPTIONS,
      allLabel: "All statuses",
    },
  ];

  const today = todayISO();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rent"
        description="Track rent charges, payments, and security deposits."
      >
        {canCreateRent ? (
          <CreateRentChargeButton
            unitOptions={unitOpts}
            tenantOptions={tenantOpts}
            defaultDate={today}
          />
        ) : null}
      </PageHeader>

      <FilterBar filters={filters} showDateRange />

      {/* Summary stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total due"
          value={formatCents(totalDueCents)}
          icon={DollarSign}
          tone="default"
        />
        <StatCard
          label="Collected"
          value={formatCents(totalCollectedCents)}
          icon={TrendingUp}
          tone="success"
        />
        <StatCard
          label="Outstanding"
          value={formatCents(totalOutstandingCents)}
          icon={Wallet}
          tone={totalOutstandingCents > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Late"
          value={formatCents(totalLateCents)}
          icon={AlertTriangle}
          tone={totalLateCents > 0 ? "danger" : "default"}
        />
      </div>

      {/* Tabs: Rent roll + Security deposits */}
      <Tabs defaultValue={activeTab}>
        <TabsList>
          <TabsTrigger value="charges">
            Rent roll ({charges.length})
          </TabsTrigger>
          <TabsTrigger value="deposits">
            Security deposits ({deposits.length})
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------------ */}
        {/* Rent roll tab                                                       */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="charges" className="mt-4">
          {charges.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No rent charges found"
              description="Create your first rent charge or adjust the filters above."
              action={
                canCreateRent ? (
                  <CreateRentChargeButton
                    unitOptions={unitOpts}
                    tenantOptions={tenantOpts}
                    defaultDate={today}
                  />
                ) : undefined
              }
            />
          ) : (
            <div className="rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Due date</TableHead>
                    <TableHead className="text-right">Rent</TableHead>
                    <TableHead className="text-right">Late fee</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                    {canCreateRent || canEditRent || canDeleteRent ? (
                      <TableHead className="w-[180px]" />
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {charges.map((charge) => {
                    const unit = unitById.get(charge.unitId);
                    const property = unit
                      ? propertyById.get(unit.propertyId)
                      : null;
                    const tenant = tenantById.get(charge.tenantId);

                    const unitLabel = unit
                      ? property
                        ? `${property.name} — ${unit.label}`
                        : unit.label
                      : "—";
                    const tenantLabel = tenant?.fullName ?? "—";

                    return (
                      <TableRow key={charge.id}>
                        <TableCell className="font-medium">
                          {tenantLabel}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {unitLabel}
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground whitespace-nowrap">
                          {formatDate(charge.dueDate)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCents(charge.rentAmountCents)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {charge.lateFeeCents > 0
                            ? formatCents(charge.lateFeeCents)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-600">
                          {charge.paidCents > 0
                            ? formatCents(charge.paidCents)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {charge.balanceCents > 0
                            ? formatCents(charge.balanceCents)
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            tone={
                              rentStatusTones[charge.computedStatus] ?? "muted"
                            }
                          >
                            {rentStatusLabels[charge.computedStatus]}
                          </Badge>
                        </TableCell>
                        {canCreateRent || canEditRent || canDeleteRent ? (
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {canCreateRent && charge.balanceCents > 0 ? (
                                <RecordPaymentButton
                                  charge={{
                                    id: charge.id,
                                    tenantLabel,
                                    balanceCents: charge.balanceCents,
                                  }}
                                  defaultDate={today}
                                />
                              ) : null}
                              {canEditRent ? (
                                <EditRentChargeButton
                                  charge={charge}
                                  unitOptions={unitOpts}
                                  tenantOptions={tenantOpts}
                                  defaultDate={today}
                                />
                              ) : null}
                              {canDeleteRent ? (
                                <ConfirmDelete
                                  action={deleteRentCharge}
                                  id={charge.id}
                                  title="Delete this rent charge?"
                                  description="All payments against this charge will also be deleted."
                                />
                              ) : null}
                            </div>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ------------------------------------------------------------------ */}
        {/* Security deposits tab                                               */}
        {/* ------------------------------------------------------------------ */}
        <TabsContent value="deposits" className="mt-4">
          <div className="flex justify-end mb-3">
            {canCreateDeposit ? (
              <CreateDepositButton
                seriesOptions={seriesOpts}
                tenantOptions={tenantOpts}
                unitOptions={unitOpts}
                defaultDate={today}
              />
            ) : null}
          </div>
          {deposits.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No security deposits found"
              description="Record a security deposit for a tenant."
              action={
                canCreateDeposit ? (
                  <CreateDepositButton
                    seriesOptions={seriesOpts}
                    tenantOptions={tenantOpts}
                    unitOptions={unitOpts}
                    defaultDate={today}
                  />
                ) : undefined
              }
            />
          ) : (
            <div className="rounded-xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead className="text-right">Refunded</TableHead>
                    <TableHead>Refund date</TableHead>
                    <TableHead className="text-right">Net held</TableHead>
                    {canEditDeposit || canDeleteDeposit ? (
                      <TableHead className="w-[80px]" />
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deposits.map((dep) => {
                    const tenant = tenantById.get(dep.tenantId);
                    const unit = dep.unitId ? unitById.get(dep.unitId) : null;
                    const property = unit
                      ? propertyById.get(unit.propertyId)
                      : null;

                    const unitLabel = unit
                      ? property
                        ? `${property.name} — ${unit.label}`
                        : unit.label
                      : "—";
                    const netHeld = dep.amountCents - dep.refundAmountCents;

                    return (
                      <TableRow key={dep.id}>
                        <TableCell className="font-medium">
                          {tenant?.fullName ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {unitLabel}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCents(dep.amountCents)}
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground whitespace-nowrap">
                          {formatDate(dep.receivedDate)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {dep.refundAmountCents > 0
                            ? formatCents(dep.refundAmountCents)
                            : "—"}
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground whitespace-nowrap">
                          {formatDate(dep.refundDate)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatCents(netHeld)}
                        </TableCell>
                        {canEditDeposit || canDeleteDeposit ? (
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {canEditDeposit ? (
                                <EditDepositButton
                                  deposit={dep}
                                  seriesOptions={seriesOpts}
                                  tenantOptions={tenantOpts}
                                  unitOptions={unitOpts}
                                  defaultDate={today}
                                />
                              ) : null}
                              {canDeleteDeposit ? (
                                <ConfirmDelete
                                  action={deleteSecurityDeposit}
                                  id={dep.id}
                                  title="Delete this deposit?"
                                  description="This action cannot be undone."
                                />
                              ) : null}
                            </div>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
