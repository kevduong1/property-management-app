/**
 * Tenant-portal data layer.
 *
 * All queries are scoped to (organizationId, tenantId). This file is the
 * single source of truth for everything a logged-in tenant can read.
 */
import "server-only";
import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import {
  childSeries,
  documents,
  leases,
  maintenanceRequests,
  properties,
  rentCharges,
  rentPayments,
  securityDeposits,
  tenants,
  units,
  type ChildSeries,
  type DocumentRow,
  type Lease,
  type MaintenanceRequest,
  type Property,
  type RentCharge,
  type RentPayment,
  type SecurityDeposit,
  type Tenant,
  type Unit,
} from "@/db/schema";
import {
  balanceCents,
  computeRentStatus,
  chargeTotalDueCents,
} from "@/lib/rent";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface EnrichedCharge extends RentCharge {
  paidCents: number;
  balanceCents: number;
  computedStatus: RentCharge["status"];
}

export interface TenantOverview {
  tenant: Tenant | null;
  leases: Array<
    Lease & {
      unit: Unit & { property: Property & { series: ChildSeries } };
    }
  >;
  /** Primary (most recent active, or most recent) lease shortcut. */
  primaryLease:
    | (Lease & {
        unit: Unit & { property: Property & { series: ChildSeries } };
      })
    | null;
  charges: EnrichedCharge[];
  payments: RentPayment[];
  /** Sum of outstanding balance across all charges. */
  totalBalanceCents: number;
  /** Count of charges whose computedStatus is 'late'. */
  lateCount: number;
  deposits: SecurityDeposit[];
  documents: DocumentRow[];
  maintenanceRequests: MaintenanceRequest[];
}

/* -------------------------------------------------------------------------- */
/* Main loader                                                                 */
/* -------------------------------------------------------------------------- */

export async function getTenantOverview(
  tenantId: string,
  orgId: string,
): Promise<TenantOverview> {
  // 1. Tenant record
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(
      and(eq(tenants.id, tenantId), eq(tenants.organizationId, orgId)),
    )
    .limit(1);

  // 2. Leases + joined unit -> property -> series
  const rawLeases = await db
    .select({
      // lease
      leaseId: leases.id,
      leaseOrgId: leases.organizationId,
      leaseTenantId: leases.tenantId,
      leaseUnitId: leases.unitId,
      leaseChildSeriesId: leases.childSeriesId,
      leaseStartDate: leases.startDate,
      leaseEndDate: leases.endDate,
      leaseMonthlyRentCents: leases.monthlyRentCents,
      leaseSecurityDepositCents: leases.securityDepositCents,
      leaseStatus: leases.status,
      leaseDocumentId: leases.documentId,
      leaseNotes: leases.notes,
      leaseCreatedAt: leases.createdAt,
      leaseUpdatedAt: leases.updatedAt,
      // unit
      unitId: units.id,
      unitOrgId: units.organizationId,
      unitPropertyId: units.propertyId,
      unitChildSeriesId: units.childSeriesId,
      unitLabel: units.label,
      unitMonthlyRentCents: units.monthlyRentCents,
      unitOccupancyStatus: units.occupancyStatus,
      unitBedrooms: units.bedrooms,
      unitBathrooms: units.bathrooms,
      unitSquareFeet: units.squareFeet,
      unitNotes: units.notes,
      unitCreatedAt: units.createdAt,
      unitUpdatedAt: units.updatedAt,
      // property
      propertyId: properties.id,
      propertyOrgId: properties.organizationId,
      propertyChildSeriesId: properties.childSeriesId,
      propertyName: properties.name,
      propertyAddressLine1: properties.addressLine1,
      propertyAddressLine2: properties.addressLine2,
      propertyCity: properties.city,
      propertyState: properties.state,
      propertyPostalCode: properties.postalCode,
      propertyStatus: properties.status,
      propertyNotes: properties.notes,
      propertyCreatedAt: properties.createdAt,
      propertyUpdatedAt: properties.updatedAt,
      // series
      seriesId: childSeries.id,
      seriesOrgId: childSeries.organizationId,
      seriesParentLlcId: childSeries.parentLlcId,
      seriesName: childSeries.name,
      seriesDescription: childSeries.description,
      seriesStatus: childSeries.status,
      seriesEin: childSeries.ein,
      seriesBankAccountNickname: childSeries.bankAccountNickname,
      seriesCreatedAt: childSeries.createdAt,
      seriesUpdatedAt: childSeries.updatedAt,
    })
    .from(leases)
    .innerJoin(units, eq(units.id, leases.unitId))
    .innerJoin(properties, eq(properties.id, units.propertyId))
    .innerJoin(childSeries, eq(childSeries.id, leases.childSeriesId))
    .where(
      and(
        eq(leases.organizationId, orgId),
        eq(leases.tenantId, tenantId),
      ),
    )
    .orderBy(leases.startDate);

  // Reshape flat rows into nested objects.
  const enrichedLeases = rawLeases.map((r) => {
    const series: ChildSeries = {
      id: r.seriesId,
      organizationId: r.seriesOrgId,
      parentLlcId: r.seriesParentLlcId,
      name: r.seriesName,
      description: r.seriesDescription,
      status: r.seriesStatus,
      ein: r.seriesEin,
      bankAccountNickname: r.seriesBankAccountNickname,
      createdAt: r.seriesCreatedAt,
      updatedAt: r.seriesUpdatedAt,
    };
    const property: Property & { series: ChildSeries } = {
      id: r.propertyId,
      organizationId: r.propertyOrgId,
      childSeriesId: r.propertyChildSeriesId,
      name: r.propertyName,
      addressLine1: r.propertyAddressLine1,
      addressLine2: r.propertyAddressLine2,
      city: r.propertyCity,
      state: r.propertyState,
      postalCode: r.propertyPostalCode,
      status: r.propertyStatus,
      notes: r.propertyNotes,
      createdAt: r.propertyCreatedAt,
      updatedAt: r.propertyUpdatedAt,
      series,
    };
    const unit: Unit & { property: Property & { series: ChildSeries } } = {
      id: r.unitId,
      organizationId: r.unitOrgId,
      propertyId: r.unitPropertyId,
      childSeriesId: r.unitChildSeriesId,
      label: r.unitLabel,
      monthlyRentCents: r.unitMonthlyRentCents,
      occupancyStatus: r.unitOccupancyStatus,
      bedrooms: r.unitBedrooms,
      bathrooms: r.unitBathrooms,
      squareFeet: r.unitSquareFeet,
      notes: r.unitNotes,
      createdAt: r.unitCreatedAt,
      updatedAt: r.unitUpdatedAt,
      property,
    };
    const lease: Lease & {
      unit: Unit & { property: Property & { series: ChildSeries } };
    } = {
      id: r.leaseId,
      organizationId: r.leaseOrgId,
      tenantId: r.leaseTenantId,
      unitId: r.leaseUnitId,
      childSeriesId: r.leaseChildSeriesId,
      startDate: r.leaseStartDate,
      endDate: r.leaseEndDate,
      monthlyRentCents: r.leaseMonthlyRentCents,
      securityDepositCents: r.leaseSecurityDepositCents,
      status: r.leaseStatus,
      documentId: r.leaseDocumentId,
      notes: r.leaseNotes,
      createdAt: r.leaseCreatedAt,
      updatedAt: r.leaseUpdatedAt,
      unit,
    };
    return lease;
  });

  // Pick primary lease: active first, then most recent by startDate.
  const primaryLease =
    enrichedLeases.find((l) => l.status === "active") ??
    enrichedLeases.find((l) => l.status === "month_to_month") ??
    enrichedLeases[enrichedLeases.length - 1] ??
    null;

  // 3. Rent charges for this tenant.
  const rawCharges = await db
    .select()
    .from(rentCharges)
    .where(
      and(
        eq(rentCharges.organizationId, orgId),
        eq(rentCharges.tenantId, tenantId),
      ),
    )
    .orderBy(rentCharges.dueDate);

  // 4. All payments against those charges.
  const chargeIds = rawCharges.map((c) => c.id);
  const payments: RentPayment[] = chargeIds.length
    ? await db
        .select()
        .from(rentPayments)
        .where(inArray(rentPayments.rentChargeId, chargeIds))
        .orderBy(rentPayments.receivedDate)
    : [];

  // Sum paid per charge.
  const paidByCharge = new Map<string, number>();
  for (const p of payments) {
    paidByCharge.set(
      p.rentChargeId,
      (paidByCharge.get(p.rentChargeId) ?? 0) + p.amountCents,
    );
  }

  const charges: EnrichedCharge[] = rawCharges
    .map((c) => {
      const paidCents = paidByCharge.get(c.id) ?? 0;
      const totals = {
        rentAmountCents: c.rentAmountCents,
        lateFeeCents: c.lateFeeCents,
        dueDate: c.dueDate,
        paidCents,
      };
      return {
        ...c,
        paidCents,
        balanceCents: balanceCents(totals),
        computedStatus: computeRentStatus(totals),
      };
    })
    // Sort descending (most recent first) for display.
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate));

  const totalBalanceCents = charges.reduce((s, c) => s + c.balanceCents, 0);
  const lateCount = charges.filter((c) => c.computedStatus === "late").length;

  // 5. Security deposits.
  const deposits = await db
    .select()
    .from(securityDeposits)
    .where(
      and(
        eq(securityDeposits.organizationId, orgId),
        eq(securityDeposits.tenantId, tenantId),
      ),
    );

  // 6. Documents: shared_with_tenant=true AND attached to their leases/unit/tenant.
  const leaseIds = enrichedLeases.map((l) => l.id);
  const unitIds = [...new Set(enrichedLeases.map((l) => l.unitId))];

  const docConditions = [
    eq(documents.organizationId, orgId),
    eq(documents.sharedWithTenant, true),
  ];

  // Build per-entity filters — use OR across entity types.
  const entityConds = [];
  if (leaseIds.length) {
    entityConds.push(
      and(
        eq(documents.entityType, "lease"),
        inArray(documents.entityId, leaseIds),
      ),
    );
  }
  entityConds.push(
    and(eq(documents.entityType, "tenant"), eq(documents.entityId, tenantId)),
  );
  if (unitIds.length) {
    entityConds.push(
      and(
        eq(documents.entityType, "unit"),
        inArray(documents.entityId, unitIds),
      ),
    );
  }

  const docs: DocumentRow[] =
    entityConds.length > 0
      ? await db
          .select()
          .from(documents)
          .where(
            and(
              ...docConditions,
              or(...entityConds),
            ),
          )
          .orderBy(documents.createdAt)
      : [];

  // 7. Maintenance requests for this tenant.
  const maint: MaintenanceRequest[] = await db
    .select()
    .from(maintenanceRequests)
    .where(
      and(
        eq(maintenanceRequests.organizationId, orgId),
        eq(maintenanceRequests.tenantId, tenantId),
      ),
    )
    .orderBy(maintenanceRequests.createdAt);

  return {
    tenant: tenant ?? null,
    leases: enrichedLeases,
    primaryLease,
    charges,
    payments,
    totalBalanceCents,
    lateCount,
    deposits,
    documents: docs,
    maintenanceRequests: maint,
  };
}

// Re-export the type used by individual charge calculation so pages
// can call chargeTotalDueCents without importing from rent directly.
export { chargeTotalDueCents };
