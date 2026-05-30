/**
 * Data access layer. In demo mode (default) this reads/writes the in-memory
 * store. Every method is async so a Supabase-backed implementation can be
 * swapped in later with identical signatures (see README "Going live").
 *
 * The repo also owns the financial computations (rent status, balances,
 * summaries, reports) so screens stay declarative.
 */
import { getStore, genId, type Store } from './store';
import { computeCharge, tenantBalance } from '@/lib/rent';
import { toNumber } from '@/lib/format';
import type {
  ChildSeries,
  ChildSeriesView,
  Document,
  DocumentView,
  Expense,
  ExpenseCategory,
  ExpenseView,
  FinancialSummary,
  Filters,
  Lease,
  LeaseView,
  MaintenanceRequest,
  MaintenanceView,
  Note,
  ParentLlc,
  Property,
  PropertyView,
  RentCharge,
  RentChargeView,
  RentPayment,
  SecurityDeposit,
  Tenant,
  TenantView,
  Unit,
  UnitView,
  Vendor,
} from '@/types';

const ms = () => getStore();
const ts = () => new Date().toISOString();

/* ----------------------------- lookup helpers ---------------------------- */

function seriesName(s: Store, id: string | null | undefined) {
  return s.childSeries.find((x) => x.id === id)?.name ?? '—';
}
function propertyName(s: Store, id: string | null | undefined) {
  return s.properties.find((x) => x.id === id)?.name ?? null;
}
function unitName(s: Store, id: string | null | undefined) {
  return s.units.find((x) => x.id === id)?.name ?? null;
}
function tenantName(s: Store, id: string | null | undefined) {
  return s.tenants.find((x) => x.id === id)?.fullName ?? null;
}

function activeLeaseForUnit(s: Store, unitId: string): Lease | undefined {
  return s.leases.find(
    (l) => l.unitId === unitId && (l.status === 'active' || l.status === 'month_to_month'),
  );
}

/* -------------------------------- Org / LLC ------------------------------ */

export const repo = {
  async getParentLlc(): Promise<ParentLlc | null> {
    return ms().parentLlcs[0] ?? null;
  },

  async updateParentLlc(id: string, patch: Partial<ParentLlc>): Promise<void> {
    const s = ms();
    const i = s.parentLlcs.findIndex((x) => x.id === id);
    if (i >= 0) s.parentLlcs[i] = { ...s.parentLlcs[i], ...patch, updatedAt: ts() };
  },

  /* ------------------------------ Child Series --------------------------- */

  async listSeries(): Promise<ChildSeriesView[]> {
    const s = ms();
    return s.childSeries.map((cs) => {
      const props = s.properties.filter((p) => p.childSeriesId === cs.id);
      const units = s.units.filter((u) => u.childSeriesId === cs.id);
      const income = s.rentPayments
        .filter((p) => p.childSeriesId === cs.id)
        .reduce((sum, p) => sum + toNumber(p.amount), 0);
      const expenses = s.expenses
        .filter((e) => e.childSeriesId === cs.id)
        .reduce((sum, e) => sum + toNumber(e.amount), 0);
      const outstandingRent = s.rentCharges
        .filter((c) => c.childSeriesId === cs.id)
        .reduce((sum, c) => sum + computeCharge(c, s.rentPayments).balance, 0);
      return {
        ...cs,
        propertyCount: props.length,
        unitCount: units.length,
        occupiedUnits: units.filter((u) => u.occupancyStatus === 'occupied').length,
        income,
        expenses,
        netIncome: income - expenses,
        outstandingRent,
      };
    });
  },

  async getSeries(id: string): Promise<ChildSeries | null> {
    return ms().childSeries.find((x) => x.id === id) ?? null;
  },

  async createSeries(input: Partial<ChildSeries>): Promise<ChildSeries> {
    const s = ms();
    const row: ChildSeries = {
      id: genId(),
      parentLlcId: s.parentLlcs[0]?.id ?? '',
      organizationId: s.orgId,
      name: input.name ?? 'New Series',
      description: input.description ?? null,
      status: (input.status as ChildSeries['status']) ?? 'active',
      ein: input.ein ?? null,
      bankAccountNickname: input.bankAccountNickname ?? null,
      createdAt: ts(),
      updatedAt: ts(),
    };
    s.childSeries.push(row);
    return row;
  },

  async updateSeries(id: string, patch: Partial<ChildSeries>): Promise<void> {
    const s = ms();
    const i = s.childSeries.findIndex((x) => x.id === id);
    if (i >= 0) s.childSeries[i] = { ...s.childSeries[i], ...patch, updatedAt: ts() };
  },

  async deleteSeries(id: string): Promise<void> {
    const s = ms();
    s.childSeries = s.childSeries.filter((x) => x.id !== id);
  },

  /* -------------------------------- Properties --------------------------- */

  async listProperties(f: Filters = {}): Promise<PropertyView[]> {
    const s = ms();
    return s.properties
      .filter((p) => (f.seriesId ? p.childSeriesId === f.seriesId : true))
      .filter((p) => (f.status ? p.status === f.status : true))
      .map((p) => {
        const units = s.units.filter((u) => u.propertyId === p.id);
        return {
          ...p,
          seriesName: seriesName(s, p.childSeriesId),
          unitCount: units.length,
          occupiedUnits: units.filter((u) => u.occupancyStatus === 'occupied').length,
          monthlyRentRoll: units.reduce((sum, u) => sum + toNumber(u.monthlyRent), 0),
        };
      });
  },

  async getProperty(id: string): Promise<Property | null> {
    return ms().properties.find((x) => x.id === id) ?? null;
  },

  async createProperty(input: Partial<Property>): Promise<Property> {
    const s = ms();
    const row: Property = {
      id: genId(),
      childSeriesId: input.childSeriesId ?? s.childSeries[0]?.id ?? '',
      organizationId: s.orgId,
      name: input.name ?? 'New Property',
      addressLine1: input.addressLine1 ?? null,
      addressLine2: input.addressLine2 ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      postalCode: input.postalCode ?? null,
      status: (input.status as Property['status']) ?? 'active',
      notes: input.notes ?? null,
      createdAt: ts(),
      updatedAt: ts(),
    };
    s.properties.push(row);
    return row;
  },

  async updateProperty(id: string, patch: Partial<Property>): Promise<void> {
    const s = ms();
    const i = s.properties.findIndex((x) => x.id === id);
    if (i >= 0) s.properties[i] = { ...s.properties[i], ...patch, updatedAt: ts() };
  },

  async deleteProperty(id: string): Promise<void> {
    const s = ms();
    s.properties = s.properties.filter((x) => x.id !== id);
  },

  /* ---------------------------------- Units ------------------------------ */

  async listUnits(f: Filters = {}): Promise<UnitView[]> {
    const s = ms();
    return s.units
      .filter((u) => (f.seriesId ? u.childSeriesId === f.seriesId : true))
      .filter((u) => (f.propertyId ? u.propertyId === f.propertyId : true))
      .filter((u) => (f.occupancy ? u.occupancyStatus === f.occupancy : true))
      .map((u) => {
        const lease = activeLeaseForUnit(s, u.id);
        return {
          ...u,
          propertyName: propertyName(s, u.propertyId) ?? '—',
          seriesName: seriesName(s, u.childSeriesId),
          tenantName: lease ? tenantName(s, lease.tenantId) : null,
          leaseId: lease?.id ?? null,
        };
      })
      .filter((u) => (f.tenantId ? activeLeaseForUnit(s, u.id)?.tenantId === f.tenantId : true));
  },

  async getUnit(id: string): Promise<Unit | null> {
    return ms().units.find((x) => x.id === id) ?? null;
  },

  async createUnit(input: Partial<Unit>): Promise<Unit> {
    const s = ms();
    const prop = s.properties.find((p) => p.id === input.propertyId);
    const row: Unit = {
      id: genId(),
      propertyId: input.propertyId ?? '',
      childSeriesId: prop?.childSeriesId ?? input.childSeriesId ?? '',
      organizationId: s.orgId,
      name: input.name ?? 'New Unit',
      monthlyRent: input.monthlyRent ?? '0',
      occupancyStatus: (input.occupancyStatus as Unit['occupancyStatus']) ?? 'vacant',
      bedrooms: input.bedrooms ?? null,
      bathrooms: input.bathrooms ?? null,
      squareFeet: input.squareFeet ?? null,
      notes: input.notes ?? null,
      createdAt: ts(),
      updatedAt: ts(),
    };
    s.units.push(row);
    return row;
  },

  async updateUnit(id: string, patch: Partial<Unit>): Promise<void> {
    const s = ms();
    const i = s.units.findIndex((x) => x.id === id);
    if (i >= 0) {
      // keep series in sync with property
      const prop = patch.propertyId
        ? s.properties.find((p) => p.id === patch.propertyId)
        : undefined;
      s.units[i] = {
        ...s.units[i],
        ...patch,
        childSeriesId: prop?.childSeriesId ?? s.units[i].childSeriesId,
        updatedAt: ts(),
      };
    }
  },

  async deleteUnit(id: string): Promise<void> {
    const s = ms();
    s.units = s.units.filter((x) => x.id !== id);
  },

  /* --------------------------------- Tenants ----------------------------- */

  async listTenants(f: Filters = {}): Promise<TenantView[]> {
    const s = ms();
    return s.tenants
      .filter((t) => (f.tenantId ? t.id === f.tenantId : true))
      .map((t) => {
        const lease = s.leases.find(
          (l) => l.tenantId === t.id && (l.status === 'active' || l.status === 'month_to_month'),
        );
        const linked = s.portalTenantId === t.id;
        return {
          ...t,
          unitName: lease ? unitName(s, lease.unitId) : null,
          propertyName: lease ? propertyName(s, lease.propertyId) : null,
          seriesName: lease ? seriesName(s, lease.childSeriesId) : null,
          leaseStatus: lease?.status ?? null,
          balance: tenantBalance(s.rentCharges, s.rentPayments, t.id),
          hasPortalAccess: linked,
        };
      })
      .filter((t) => (f.seriesId ? s.leases.some((l) => l.tenantId === t.id && l.childSeriesId === f.seriesId) : true));
  },

  async getTenant(id: string): Promise<Tenant | null> {
    return ms().tenants.find((x) => x.id === id) ?? null;
  },

  async createTenant(input: Partial<Tenant>): Promise<Tenant> {
    const s = ms();
    const row: Tenant = {
      id: genId(),
      organizationId: s.orgId,
      fullName: input.fullName ?? 'New Tenant',
      email: input.email ?? null,
      phone: input.phone ?? null,
      emergencyContactName: input.emergencyContactName ?? null,
      emergencyContactPhone: input.emergencyContactPhone ?? null,
      notes: input.notes ?? null,
      createdAt: ts(),
      updatedAt: ts(),
    };
    s.tenants.push(row);
    return row;
  },

  async updateTenant(id: string, patch: Partial<Tenant>): Promise<void> {
    const s = ms();
    const i = s.tenants.findIndex((x) => x.id === id);
    if (i >= 0) s.tenants[i] = { ...s.tenants[i], ...patch, updatedAt: ts() };
  },

  async deleteTenant(id: string): Promise<void> {
    const s = ms();
    s.tenants = s.tenants.filter((x) => x.id !== id);
  },

  /* --------------------------------- Leases ------------------------------ */

  async listLeases(f: Filters = {}): Promise<LeaseView[]> {
    const s = ms();
    return s.leases
      .filter((l) => (f.seriesId ? l.childSeriesId === f.seriesId : true))
      .filter((l) => (f.propertyId ? l.propertyId === f.propertyId : true))
      .filter((l) => (f.tenantId ? l.tenantId === f.tenantId : true))
      .filter((l) => (f.status ? l.status === f.status : true))
      .map((l) => ({
        ...l,
        tenantName: tenantName(s, l.tenantId) ?? '—',
        unitName: unitName(s, l.unitId) ?? '—',
        propertyName: propertyName(s, l.propertyId) ?? '—',
        seriesName: seriesName(s, l.childSeriesId),
      }));
  },

  async getLease(id: string): Promise<Lease | null> {
    return ms().leases.find((x) => x.id === id) ?? null;
  },

  async createLease(input: Partial<Lease>): Promise<Lease> {
    const s = ms();
    const unit = s.units.find((u) => u.id === input.unitId);
    const prop = unit ? s.properties.find((p) => p.id === unit.propertyId) : undefined;
    const row: Lease = {
      id: genId(),
      tenantId: input.tenantId ?? '',
      unitId: input.unitId ?? '',
      propertyId: prop?.id ?? input.propertyId ?? '',
      childSeriesId: prop?.childSeriesId ?? input.childSeriesId ?? '',
      organizationId: s.orgId,
      startDate: input.startDate ?? ts().slice(0, 10),
      endDate: input.endDate ?? null,
      monthlyRent: input.monthlyRent ?? unit?.monthlyRent ?? '0',
      securityDepositAmount: input.securityDepositAmount ?? '0',
      rentDueDay: input.rentDueDay ?? 1,
      status: (input.status as Lease['status']) ?? 'active',
      documentId: input.documentId ?? null,
      notes: input.notes ?? null,
      createdAt: ts(),
      updatedAt: ts(),
    };
    s.leases.push(row);
    // Mark unit occupied for active leases.
    if (unit && (row.status === 'active' || row.status === 'month_to_month')) {
      unit.occupancyStatus = 'occupied';
    }
    return row;
  },

  async updateLease(id: string, patch: Partial<Lease>): Promise<void> {
    const s = ms();
    const i = s.leases.findIndex((x) => x.id === id);
    if (i >= 0) s.leases[i] = { ...s.leases[i], ...patch, updatedAt: ts() };
  },

  async deleteLease(id: string): Promise<void> {
    const s = ms();
    s.leases = s.leases.filter((x) => x.id !== id);
  },

  /* ----------------------------- Rent charges ---------------------------- */

  async listRentCharges(f: Filters = {}): Promise<RentChargeView[]> {
    const s = ms();
    return s.rentCharges
      .filter((c) => (f.seriesId ? c.childSeriesId === f.seriesId : true))
      .filter((c) => (f.propertyId ? c.propertyId === f.propertyId : true))
      .filter((c) => (f.unitId ? c.unitId === f.unitId : true))
      .filter((c) => (f.tenantId ? c.tenantId === f.tenantId : true))
      .filter((c) => (f.dateFrom ? c.dueDate >= f.dateFrom : true))
      .filter((c) => (f.dateTo ? c.dueDate <= f.dateTo : true))
      .map((c) => {
        const comp = computeCharge(c, s.rentPayments);
        return {
          ...c,
          tenantName: tenantName(s, c.tenantId) ?? '—',
          unitName: unitName(s, c.unitId) ?? '—',
          propertyName: propertyName(s, c.propertyId) ?? '—',
          seriesName: seriesName(s, c.childSeriesId),
          paidAmount: comp.paid,
          balance: comp.balance,
          computedStatus: comp.status,
        };
      })
      .filter((c) => (f.status ? c.computedStatus === f.status : true))
      .sort((a, b) => (a.dueDate < b.dueDate ? 1 : -1));
  },

  async createRentCharge(input: Partial<RentCharge>): Promise<RentCharge> {
    const s = ms();
    const unit = s.units.find((u) => u.id === input.unitId);
    const prop = unit ? s.properties.find((p) => p.id === unit.propertyId) : undefined;
    const lease = unit ? activeLeaseForUnit(s, unit.id) : undefined;
    const row: RentCharge = {
      id: genId(),
      leaseId: input.leaseId ?? lease?.id ?? null,
      tenantId: input.tenantId ?? lease?.tenantId ?? '',
      unitId: input.unitId ?? '',
      propertyId: prop?.id ?? '',
      childSeriesId: prop?.childSeriesId ?? input.childSeriesId ?? '',
      organizationId: s.orgId,
      dueDate: input.dueDate ?? ts().slice(0, 10),
      periodStart: input.periodStart ?? null,
      periodEnd: input.periodEnd ?? null,
      rentAmount: input.rentAmount ?? unit?.monthlyRent ?? '0',
      lateFeeAmount: input.lateFeeAmount ?? '0',
      status: 'unpaid',
      notes: input.notes ?? null,
      createdAt: ts(),
      updatedAt: ts(),
    };
    s.rentCharges.push(row);
    return row;
  },

  async updateRentCharge(id: string, patch: Partial<RentCharge>): Promise<void> {
    const s = ms();
    const i = s.rentCharges.findIndex((x) => x.id === id);
    if (i >= 0) s.rentCharges[i] = { ...s.rentCharges[i], ...patch, updatedAt: ts() };
  },

  async deleteRentCharge(id: string): Promise<void> {
    const s = ms();
    s.rentCharges = s.rentCharges.filter((x) => x.id !== id);
    s.rentPayments = s.rentPayments.filter((p) => p.rentChargeId !== id);
  },

  /* ------------------------------- Payments ------------------------------ */

  async listPayments(f: Filters = {}): Promise<RentPayment[]> {
    const s = ms();
    return s.rentPayments
      .filter((p) => (f.seriesId ? p.childSeriesId === f.seriesId : true))
      .filter((p) => (f.tenantId ? p.tenantId === f.tenantId : true))
      .sort((a, b) => (a.receivedDate < b.receivedDate ? 1 : -1));
  },

  async recordPayment(input: Partial<RentPayment>): Promise<RentPayment> {
    const s = ms();
    const charge = s.rentCharges.find((c) => c.id === input.rentChargeId);
    const row: RentPayment = {
      id: genId(),
      rentChargeId: input.rentChargeId ?? null,
      tenantId: input.tenantId ?? charge?.tenantId ?? '',
      childSeriesId: charge?.childSeriesId ?? input.childSeriesId ?? '',
      organizationId: s.orgId,
      amount: input.amount ?? '0',
      receivedDate: input.receivedDate ?? ts().slice(0, 10),
      method: (input.method as RentPayment['method']) ?? 'check',
      reference: input.reference ?? null,
      notes: input.notes ?? null,
      externalProcessor: null,
      externalPaymentId: null,
      createdAt: ts(),
      updatedAt: ts(),
    };
    s.rentPayments.push(row);
    // Refresh stored status on the related charge.
    if (charge) {
      charge.status = computeCharge(charge, s.rentPayments).status;
      charge.updatedAt = ts();
    }
    return row;
  },

  /* --------------------------- Security deposits ------------------------- */

  async listDeposits(f: Filters = {}): Promise<SecurityDeposit[]> {
    const s = ms();
    return s.securityDeposits.filter((d) => (f.seriesId ? d.childSeriesId === f.seriesId : true));
  },

  async createDeposit(input: Partial<SecurityDeposit>): Promise<SecurityDeposit> {
    const s = ms();
    const row: SecurityDeposit = {
      id: genId(),
      leaseId: input.leaseId ?? null,
      tenantId: input.tenantId ?? '',
      unitId: input.unitId ?? null,
      childSeriesId: input.childSeriesId ?? '',
      organizationId: s.orgId,
      amount: input.amount ?? '0',
      dateReceived: input.dateReceived ?? null,
      refundAmount: input.refundAmount ?? '0',
      refundDate: input.refundDate ?? null,
      notes: input.notes ?? null,
      createdAt: ts(),
      updatedAt: ts(),
    };
    s.securityDeposits.push(row);
    return row;
  },

  async updateDeposit(id: string, patch: Partial<SecurityDeposit>): Promise<void> {
    const s = ms();
    const i = s.securityDeposits.findIndex((x) => x.id === id);
    if (i >= 0) s.securityDeposits[i] = { ...s.securityDeposits[i], ...patch, updatedAt: ts() };
  },

  /* -------------------------------- Expenses ----------------------------- */

  async listExpenses(f: Filters = {}): Promise<ExpenseView[]> {
    const s = ms();
    return s.expenses
      .filter((e) => (f.seriesId ? e.childSeriesId === f.seriesId : true))
      .filter((e) => (f.propertyId ? e.propertyId === f.propertyId : true))
      .filter((e) => (f.categoryId ? e.categoryId === f.categoryId : true))
      .filter((e) => (f.dateFrom ? e.expenseDate >= f.dateFrom : true))
      .filter((e) => (f.dateTo ? e.expenseDate <= f.dateTo : true))
      .map((e) => ({
        ...e,
        seriesName: seriesName(s, e.childSeriesId),
        propertyName: propertyName(s, e.propertyId),
        categoryName: s.expenseCategories.find((c) => c.id === e.categoryId)?.name ?? null,
        vendorName: s.vendors.find((v) => v.id === e.vendorId)?.name ?? null,
      }))
      .sort((a, b) => (a.expenseDate < b.expenseDate ? 1 : -1));
  },

  async getExpense(id: string): Promise<Expense | null> {
    return ms().expenses.find((x) => x.id === id) ?? null;
  },

  async createExpense(input: Partial<Expense>): Promise<Expense> {
    const s = ms();
    const row: Expense = {
      id: genId(),
      childSeriesId: input.childSeriesId ?? '',
      propertyId: input.propertyId ?? null,
      unitId: input.unitId ?? null,
      categoryId: input.categoryId ?? null,
      vendorId: input.vendorId ?? null,
      organizationId: s.orgId,
      amount: input.amount ?? '0',
      expenseDate: input.expenseDate ?? ts().slice(0, 10),
      description: input.description ?? null,
      notes: input.notes ?? null,
      receiptDocumentId: input.receiptDocumentId ?? null,
      isReconciled: false,
      externalTransactionId: null,
      createdAt: ts(),
      updatedAt: ts(),
    };
    s.expenses.push(row);
    return row;
  },

  async updateExpense(id: string, patch: Partial<Expense>): Promise<void> {
    const s = ms();
    const i = s.expenses.findIndex((x) => x.id === id);
    if (i >= 0) s.expenses[i] = { ...s.expenses[i], ...patch, updatedAt: ts() };
  },

  async deleteExpense(id: string): Promise<void> {
    const s = ms();
    s.expenses = s.expenses.filter((x) => x.id !== id);
  },

  async listCategories(): Promise<ExpenseCategory[]> {
    return ms().expenseCategories;
  },

  async listVendors(): Promise<Vendor[]> {
    return ms().vendors;
  },

  async createVendor(input: Partial<Vendor>): Promise<Vendor> {
    const s = ms();
    const row: Vendor = {
      id: genId(),
      organizationId: s.orgId,
      name: input.name ?? 'New Vendor',
      contactName: input.contactName ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      notes: input.notes ?? null,
      createdAt: ts(),
      updatedAt: ts(),
    };
    s.vendors.push(row);
    return row;
  },

  /* ------------------------------ Maintenance ---------------------------- */

  async listMaintenance(f: Filters = {}): Promise<MaintenanceView[]> {
    const s = ms();
    return s.maintenanceRequests
      .filter((m) => (f.seriesId ? m.childSeriesId === f.seriesId : true))
      .filter((m) => (f.propertyId ? m.propertyId === f.propertyId : true))
      .filter((m) => (f.tenantId ? m.tenantId === f.tenantId : true))
      .filter((m) => (f.status ? m.status === f.status : true))
      .map((m) => ({
        ...m,
        tenantName: tenantName(s, m.tenantId),
        unitName: unitName(s, m.unitId),
        propertyName: propertyName(s, m.propertyId),
        seriesName: seriesName(s, m.childSeriesId),
      }))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async createMaintenance(input: Partial<MaintenanceRequest>): Promise<MaintenanceRequest> {
    const s = ms();
    const unit = s.units.find((u) => u.id === input.unitId);
    const prop = unit ? s.properties.find((p) => p.id === unit.propertyId) : undefined;
    const row: MaintenanceRequest = {
      id: genId(),
      tenantId: input.tenantId ?? null,
      unitId: input.unitId ?? null,
      propertyId: prop?.id ?? input.propertyId ?? null,
      childSeriesId: prop?.childSeriesId ?? input.childSeriesId ?? '',
      organizationId: s.orgId,
      title: input.title ?? 'New Request',
      description: input.description ?? null,
      priority: (input.priority as MaintenanceRequest['priority']) ?? 'medium',
      status: (input.status as MaintenanceRequest['status']) ?? 'open',
      notes: input.notes ?? null,
      createdBy: input.createdBy ?? null,
      completedAt: null,
      createdAt: ts(),
      updatedAt: ts(),
    };
    s.maintenanceRequests.push(row);
    return row;
  },

  async updateMaintenance(id: string, patch: Partial<MaintenanceRequest>): Promise<void> {
    const s = ms();
    const i = s.maintenanceRequests.findIndex((x) => x.id === id);
    if (i >= 0) {
      const completedAt =
        patch.status === 'completed' ? ts() : s.maintenanceRequests[i].completedAt;
      s.maintenanceRequests[i] = {
        ...s.maintenanceRequests[i],
        ...patch,
        completedAt,
        updatedAt: ts(),
      };
    }
  },

  /* ------------------------------- Documents ----------------------------- */

  async listDocuments(f: Filters & { entityType?: string; entityId?: string } = {}): Promise<DocumentView[]> {
    const s = ms();
    return s.documents
      .filter((d) => (f.seriesId ? d.childSeriesId === f.seriesId : true))
      .filter((d) => (f.entityType ? d.entityType === f.entityType : true))
      .filter((d) => (f.entityId ? d.entityId === f.entityId : true))
      .map((d) => ({ ...d, seriesName: d.childSeriesId ? seriesName(s, d.childSeriesId) : null }))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async createDocument(input: Partial<Document>): Promise<Document> {
    const s = ms();
    const row: Document = {
      id: genId(),
      organizationId: s.orgId,
      childSeriesId: input.childSeriesId ?? null,
      entityType: (input.entityType as Document['entityType']) ?? 'child_series',
      entityId: input.entityId ?? null,
      title: input.title ?? 'Untitled',
      documentType: (input.documentType as Document['documentType']) ?? 'other',
      storageBucket: input.storageBucket ?? 'documents',
      storagePath: input.storagePath ?? null,
      fileUrl: input.fileUrl ?? null,
      mimeType: input.mimeType ?? null,
      fileSize: input.fileSize ?? null,
      sharedWithTenant: input.sharedWithTenant ?? false,
      uploadedBy: input.uploadedBy ?? null,
      createdAt: ts(),
      updatedAt: ts(),
    };
    s.documents.push(row);
    return row;
  },

  async deleteDocument(id: string): Promise<void> {
    const s = ms();
    s.documents = s.documents.filter((x) => x.id !== id);
  },

  /* --------------------------------- Notes ------------------------------- */

  async listNotes(entityType?: string, entityId?: string): Promise<Note[]> {
    const s = ms();
    return s.notes
      .filter((n) => (entityType ? n.entityType === entityType : true))
      .filter((n) => (entityId ? n.entityId === entityId : true))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  async createNote(input: Partial<Note>): Promise<Note> {
    const s = ms();
    const row: Note = {
      id: genId(),
      organizationId: s.orgId,
      childSeriesId: input.childSeriesId ?? null,
      entityType: (input.entityType as Note['entityType']) ?? 'child_series',
      entityId: input.entityId ?? null,
      body: input.body ?? '',
      createdBy: input.createdBy ?? null,
      createdAt: ts(),
      updatedAt: ts(),
    };
    s.notes.push(row);
    return row;
  },

  async deleteNote(id: string): Promise<void> {
    const s = ms();
    s.notes = s.notes.filter((x) => x.id !== id);
  },

  /* ------------------------------- Summary ------------------------------- */

  async summary(f: Filters = {}): Promise<FinancialSummary> {
    const s = ms();
    const inRange = (date: string) =>
      (f.dateFrom ? date >= f.dateFrom : true) && (f.dateTo ? date <= f.dateTo : true);

    const charges = s.rentCharges
      .filter((c) => (f.seriesId ? c.childSeriesId === f.seriesId : true))
      .filter((c) => (f.propertyId ? c.propertyId === f.propertyId : true))
      .filter((c) => inRange(c.dueDate));
    const payments = s.rentPayments
      .filter((p) => (f.seriesId ? p.childSeriesId === f.seriesId : true))
      .filter((p) => inRange(p.receivedDate));
    const expenses = s.expenses
      .filter((e) => (f.seriesId ? e.childSeriesId === f.seriesId : true))
      .filter((e) => (f.propertyId ? e.propertyId === f.propertyId : true))
      .filter((e) => inRange(e.expenseDate));
    const units = s.units
      .filter((u) => (f.seriesId ? u.childSeriesId === f.seriesId : true))
      .filter((u) => (f.propertyId ? u.propertyId === f.propertyId : true));
    const deposits = s.securityDeposits.filter((d) =>
      f.seriesId ? d.childSeriesId === f.seriesId : true,
    );

    const totalRentDue = charges.reduce((sum, c) => sum + computeCharge(c, s.rentPayments).total, 0);
    const totalRentCollected = payments.reduce((sum, p) => sum + toNumber(p.amount), 0);
    let outstandingRent = 0;
    let lateRent = 0;
    for (const c of charges) {
      const comp = computeCharge(c, s.rentPayments);
      outstandingRent += comp.balance;
      if (comp.status === 'late') lateRent += comp.balance;
    }
    const totalExpenses = expenses.reduce((sum, e) => sum + toNumber(e.amount), 0);
    const occupiedUnits = units.filter((u) => u.occupancyStatus === 'occupied').length;
    const securityDepositsHeld = deposits.reduce(
      (sum, d) => sum + toNumber(d.amount) - toNumber(d.refundAmount),
      0,
    );

    return {
      totalRentDue,
      totalRentCollected,
      outstandingRent,
      lateRent,
      totalExpenses,
      netIncome: totalRentCollected - totalExpenses,
      occupancyRate: units.length ? occupiedUnits / units.length : 0,
      securityDepositsHeld,
      unitCount: units.length,
      occupiedUnits,
    };
  },

  /* ------------------------------- Reports ------------------------------- */

  /** Expense totals grouped by category (optionally filtered). */
  async expenseByCategory(f: Filters = {}): Promise<{ name: string; total: number }[]> {
    const s = ms();
    const map = new Map<string, number>();
    s.expenses
      .filter((e) => (f.seriesId ? e.childSeriesId === f.seriesId : true))
      .filter((e) => (f.dateFrom ? e.expenseDate >= f.dateFrom : true))
      .filter((e) => (f.dateTo ? e.expenseDate <= f.dateTo : true))
      .forEach((e) => {
        const name = s.expenseCategories.find((c) => c.id === e.categoryId)?.name ?? 'Uncategorized';
        map.set(name, (map.get(name) ?? 0) + toNumber(e.amount));
      });
    return [...map.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);
  },

  /** Profit & loss per child series. */
  async profitAndLossBySeries(): Promise<
    { series: ChildSeries; income: number; expenses: number; net: number }[]
  > {
    const s = ms();
    return s.childSeries.map((cs) => {
      const income = s.rentPayments
        .filter((p) => p.childSeriesId === cs.id)
        .reduce((sum, p) => sum + toNumber(p.amount), 0);
      const expenses = s.expenses
        .filter((e) => e.childSeriesId === cs.id)
        .reduce((sum, e) => sum + toNumber(e.amount), 0);
      return { series: cs, income, expenses, net: income - expenses };
    });
  },

  /** Tenant balances report. */
  async tenantBalances(): Promise<{ tenant: Tenant; balance: number; seriesName: string | null }[]> {
    const s = ms();
    return s.tenants
      .map((t) => {
        const lease = s.leases.find((l) => l.tenantId === t.id);
        return {
          tenant: t,
          balance: tenantBalance(s.rentCharges, s.rentPayments, t.id),
          seriesName: lease ? seriesName(s, lease.childSeriesId) : null,
        };
      })
      .sort((a, b) => b.balance - a.balance);
  },
};

export type Repo = typeof repo;
