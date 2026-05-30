/**
 * In-memory demo data store. Seeded with a realistic Series LLC dataset so the
 * entire UI — dashboard, rent roll, reports, tenant portal — is explorable
 * without configuring Supabase. All rows are plain objects matching the Drizzle
 * row shapes (monetary fields stored as strings, dates as ISO `yyyy-MM-dd`).
 *
 * The repo layer (services/repo.ts) reads/writes this store in demo mode and
 * would call Supabase in live mode.
 */
import type {
  ChildSeries,
  Document,
  Expense,
  ExpenseCategory,
  Lease,
  MaintenanceRequest,
  Note,
  ParentLlc,
  Property,
  RentCharge,
  RentPayment,
  SecurityDeposit,
  Tenant,
  Unit,
  Vendor,
} from '@/types';

export function genId(): string {
  // RFC4122-ish v4. Sufficient for demo/local ids.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface Store {
  orgId: string;
  parentLlcs: ParentLlc[];
  childSeries: ChildSeries[];
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
  leases: Lease[];
  rentCharges: RentCharge[];
  rentPayments: RentPayment[];
  securityDeposits: SecurityDeposit[];
  expenseCategories: ExpenseCategory[];
  vendors: Vendor[];
  expenses: Expense[];
  documents: Document[];
  notes: Note[];
  maintenanceRequests: MaintenanceRequest[];
  /** tenantId currently linked to the logged-in tenant portal user (demo). */
  portalTenantId: string | null;
}

const ORG = 'org-demo-0001';
const now = () => new Date().toISOString();

// Date helpers anchored on the seed's "current" month.
function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const CATS = [
  ['repairs', 'Repairs'],
  ['utilities', 'Utilities'],
  ['insurance', 'Insurance'],
  ['property_taxes', 'Property Taxes'],
  ['mortgage', 'Mortgage'],
  ['legal', 'Legal'],
  ['accounting', 'Accounting'],
  ['supplies', 'Supplies'],
  ['capital_improvements', 'Capital Improvements'],
  ['other', 'Other'],
] as const;

function seed(): Store {
  const parentId = 'llc-parent-0001';

  const categories: ExpenseCategory[] = CATS.map(([slug, name]) => ({
    id: `cat-${slug}`,
    organizationId: null,
    name,
    slug,
    isDefault: true,
    taxLine: null,
    createdAt: now(),
  }));

  const parentLlcs: ParentLlc[] = [
    {
      id: parentId,
      organizationId: ORG,
      name: 'Evergreen Holdings LLC',
      legalName: 'Evergreen Holdings LLC, a Series LLC',
      ein: '88-1234567',
      formationState: 'Texas',
      notes: 'Parent series LLC. Each child series isolates liability per property group.',
      createdAt: now(),
      updatedAt: now(),
    },
  ];

  const mkSeries = (
    id: string,
    name: string,
    ein: string,
    bank: string,
    desc: string,
  ): ChildSeries => ({
    id,
    parentLlcId: parentId,
    organizationId: ORG,
    name,
    description: desc,
    status: 'active',
    ein,
    bankAccountNickname: bank,
    createdAt: now(),
    updatedAt: now(),
  });

  const childSeries: ChildSeries[] = [
    mkSeries('ser-a', 'Series A — Maple Street', '88-1110001', 'Evergreen A Checking', 'Single-family rentals on Maple St.'),
    mkSeries('ser-b', 'Series B — Oak Duplexes', '88-1110002', 'Evergreen B Checking', 'Duplex units on Oak Ave.'),
    mkSeries('ser-c', 'Series C — Downtown Lofts', '88-1110003', 'Evergreen C Checking', 'Loft units downtown.'),
  ];

  const mkProp = (
    id: string,
    seriesId: string,
    name: string,
    line1: string,
    city: string,
  ): Property => ({
    id,
    childSeriesId: seriesId,
    organizationId: ORG,
    name,
    addressLine1: line1,
    addressLine2: null,
    city,
    state: 'TX',
    postalCode: '78701',
    status: 'active',
    notes: null,
    createdAt: now(),
    updatedAt: now(),
  });

  const properties: Property[] = [
    mkProp('prop-1', 'ser-a', '101 Maple St', '101 Maple St', 'Austin'),
    mkProp('prop-2', 'ser-a', '105 Maple St', '105 Maple St', 'Austin'),
    mkProp('prop-3', 'ser-b', 'Oak Ave Duplex', '220 Oak Ave', 'Austin'),
    mkProp('prop-4', 'ser-c', 'Downtown Lofts', '500 Congress Ave', 'Austin'),
  ];

  const mkUnit = (
    id: string,
    propertyId: string,
    seriesId: string,
    name: string,
    rent: string,
    occ: Unit['occupancyStatus'],
    bed: number,
    bath: string,
  ): Unit => ({
    id,
    propertyId,
    childSeriesId: seriesId,
    organizationId: ORG,
    name,
    monthlyRent: rent,
    occupancyStatus: occ,
    bedrooms: bed,
    bathrooms: bath,
    squareFeet: 900 + bed * 150,
    notes: null,
    createdAt: now(),
    updatedAt: now(),
  });

  const units: Unit[] = [
    mkUnit('unit-1', 'prop-1', 'ser-a', 'Single Family', '1850', 'occupied', 3, '2'),
    mkUnit('unit-2', 'prop-2', 'ser-a', 'Single Family', '1750', 'occupied', 3, '2'),
    mkUnit('unit-3', 'prop-3', 'ser-b', 'Unit A', '1200', 'occupied', 2, '1'),
    mkUnit('unit-4', 'prop-3', 'ser-b', 'Unit B', '1200', 'vacant', 2, '1'),
    mkUnit('unit-5', 'prop-4', 'ser-c', 'Loft 201', '1600', 'occupied', 1, '1'),
    mkUnit('unit-6', 'prop-4', 'ser-c', 'Loft 202', '1650', 'occupied', 1, '1'),
    mkUnit('unit-7', 'prop-4', 'ser-c', 'Loft 203', '1700', 'vacant', 2, '2'),
  ];

  const mkTenant = (
    id: string,
    name: string,
    email: string,
    phone: string,
  ): Tenant => ({
    id,
    organizationId: ORG,
    fullName: name,
    email,
    phone,
    emergencyContactName: 'Emergency Contact',
    emergencyContactPhone: '555-0100',
    notes: null,
    createdAt: now(),
    updatedAt: now(),
  });

  const tenants: Tenant[] = [
    mkTenant('ten-1', 'Sarah Johnson', 'sarah.tenant@example.com', '555-0111'),
    mkTenant('ten-2', 'Michael Chen', 'michael@example.com', '555-0112'),
    mkTenant('ten-3', 'Emily Davis', 'emily@example.com', '555-0113'),
    mkTenant('ten-4', 'James Wilson', 'james@example.com', '555-0114'),
    mkTenant('ten-5', 'Olivia Martinez', 'olivia@example.com', '555-0115'),
  ];

  const mkLease = (
    id: string,
    tenantId: string,
    unitId: string,
    propertyId: string,
    seriesId: string,
    rent: string,
    deposit: string,
    start: string,
    end: string | null,
    status: Lease['status'],
  ): Lease => ({
    id,
    tenantId,
    unitId,
    propertyId,
    childSeriesId: seriesId,
    organizationId: ORG,
    startDate: start,
    endDate: end,
    monthlyRent: rent,
    securityDepositAmount: deposit,
    rentDueDay: 1,
    status,
    documentId: null,
    notes: null,
    createdAt: now(),
    updatedAt: now(),
  });

  const leases: Lease[] = [
    mkLease('lease-1', 'ten-1', 'unit-1', 'prop-1', 'ser-a', '1850', '1850', ymd(2025, 9, 1), ymd(2026, 8, 31), 'active'),
    mkLease('lease-2', 'ten-2', 'unit-2', 'prop-2', 'ser-a', '1750', '1750', ymd(2025, 6, 1), ymd(2026, 5, 31), 'active'),
    mkLease('lease-3', 'ten-3', 'unit-3', 'prop-3', 'ser-b', '1200', '1200', ymd(2024, 12, 1), null, 'month_to_month'),
    mkLease('lease-4', 'ten-4', 'unit-5', 'prop-4', 'ser-c', '1600', '1600', ymd(2025, 11, 1), ymd(2026, 10, 31), 'active'),
    mkLease('lease-5', 'ten-5', 'unit-6', 'prop-4', 'ser-c', '1650', '1650', ymd(2026, 6, 1), ymd(2027, 5, 31), 'upcoming'),
  ];

  // Rent charges for the last 3 months for active leases.
  const rentCharges: RentCharge[] = [];
  const rentPayments: RentPayment[] = [];
  const charged: Array<[string, string, string, string, string, string]> = [
    // leaseId, tenantId, unitId, propertyId, seriesId, rent
    ['lease-1', 'ten-1', 'unit-1', 'prop-1', 'ser-a', '1850'],
    ['lease-2', 'ten-2', 'unit-2', 'prop-2', 'ser-a', '1750'],
    ['lease-3', 'ten-3', 'unit-3', 'prop-3', 'ser-b', '1200'],
    ['lease-4', 'ten-4', 'unit-5', 'prop-4', 'ser-c', '1600'],
  ];
  const months: Array<[number, number]> = [
    [2026, 3],
    [2026, 4],
    [2026, 5],
  ];
  charged.forEach(([leaseId, tenantId, unitId, propertyId, seriesId, rent], li) => {
    months.forEach(([y, m], mi) => {
      const cid = `rc-${leaseId}-${y}${m}`;
      const due = ymd(y, m, 1);
      rentCharges.push({
        id: cid,
        leaseId,
        tenantId,
        unitId,
        propertyId,
        childSeriesId: seriesId,
        organizationId: ORG,
        dueDate: due,
        periodStart: ymd(y, m, 1),
        periodEnd: ymd(y, m, 28),
        rentAmount: rent,
        lateFeeAmount: '0',
        status: 'unpaid',
        notes: null,
        createdAt: now(),
        updatedAt: now(),
      });
      // Payment behavior: older months fully paid; current month varied.
      const isCurrent = mi === months.length - 1;
      if (!isCurrent) {
        rentPayments.push({
          id: `pay-${cid}`,
          rentChargeId: cid,
          tenantId,
          childSeriesId: seriesId,
          organizationId: ORG,
          amount: rent,
          receivedDate: ymd(y, m, 2),
          method: 'check',
          reference: null,
          notes: null,
          externalProcessor: null,
          externalPaymentId: null,
          createdAt: now(),
          updatedAt: now(),
        });
      } else {
        // ten-1 paid full, ten-2 partial, ten-3 late (no pay), ten-4 paid
        if (li === 0 || li === 3) {
          rentPayments.push({
            id: `pay-${cid}`,
            rentChargeId: cid,
            tenantId,
            childSeriesId: seriesId,
            organizationId: ORG,
            amount: rent,
            receivedDate: ymd(y, m, 3),
            method: 'bank_transfer',
            reference: null,
            notes: null,
            externalProcessor: null,
            externalPaymentId: null,
            createdAt: now(),
            updatedAt: now(),
          });
        } else if (li === 1) {
          rentPayments.push({
            id: `pay-${cid}`,
            rentChargeId: cid,
            tenantId,
            childSeriesId: seriesId,
            organizationId: ORG,
            amount: '800',
            receivedDate: ymd(y, m, 5),
            method: 'cash',
            reference: null,
            notes: 'Partial payment',
            externalProcessor: null,
            externalPaymentId: null,
            createdAt: now(),
            updatedAt: now(),
          });
        } else if (li === 2) {
          // ten-3 late: add a late fee, no payment
          const rc = rentCharges[rentCharges.length - 1];
          rc.lateFeeAmount = '50';
        }
      }
    });
  });

  const securityDeposits: SecurityDeposit[] = leases
    .filter((l) => l.status === 'active' || l.status === 'month_to_month')
    .map((l) => ({
      id: `dep-${l.id}`,
      leaseId: l.id,
      tenantId: l.tenantId,
      unitId: l.unitId,
      childSeriesId: l.childSeriesId,
      organizationId: ORG,
      amount: l.securityDepositAmount ?? '0',
      dateReceived: l.startDate,
      refundAmount: '0',
      refundDate: null,
      notes: null,
      createdAt: now(),
      updatedAt: now(),
    }));

  const vendors: Vendor[] = [
    { id: 'ven-1', organizationId: ORG, name: 'Austin Plumbing Co', contactName: 'Dave', email: 'dave@austinplumb.com', phone: '555-0200', notes: null, createdAt: now(), updatedAt: now() },
    { id: 'ven-2', organizationId: ORG, name: 'Lone Star Insurance', contactName: null, email: null, phone: '555-0201', notes: null, createdAt: now(), updatedAt: now() },
    { id: 'ven-3', organizationId: ORG, name: 'GreenLawn Care', contactName: null, email: null, phone: '555-0202', notes: null, createdAt: now(), updatedAt: now() },
  ];

  const mkExpense = (
    id: string,
    seriesId: string,
    propertyId: string | null,
    catSlug: string,
    vendorId: string | null,
    amount: string,
    date: string,
    desc: string,
  ): Expense => ({
    id,
    childSeriesId: seriesId,
    propertyId,
    unitId: null,
    categoryId: `cat-${catSlug}`,
    vendorId,
    organizationId: ORG,
    amount,
    expenseDate: date,
    description: desc,
    notes: null,
    receiptDocumentId: null,
    isReconciled: false,
    externalTransactionId: null,
    createdAt: now(),
    updatedAt: now(),
  });

  const expenses: Expense[] = [
    mkExpense('exp-1', 'ser-a', 'prop-1', 'repairs', 'ven-1', '450', ymd(2026, 4, 12), 'Water heater repair'),
    mkExpense('exp-2', 'ser-a', 'prop-1', 'property_taxes', null, '3200', ymd(2026, 1, 31), 'Annual property tax'),
    mkExpense('exp-3', 'ser-a', 'prop-2', 'insurance', 'ven-2', '1100', ymd(2026, 3, 1), 'Annual landlord policy'),
    mkExpense('exp-4', 'ser-b', 'prop-3', 'utilities', null, '180', ymd(2026, 5, 5), 'Shared water bill'),
    mkExpense('exp-5', 'ser-b', 'prop-3', 'repairs', 'ven-1', '320', ymd(2026, 5, 18), 'Leaky faucet Unit A'),
    mkExpense('exp-6', 'ser-c', 'prop-4', 'mortgage', null, '2400', ymd(2026, 5, 1), 'Monthly mortgage'),
    mkExpense('exp-7', 'ser-c', 'prop-4', 'supplies', 'ven-3', '95', ymd(2026, 5, 9), 'Landscaping supplies'),
    mkExpense('exp-8', 'ser-c', 'prop-4', 'capital_improvements', null, '5400', ymd(2026, 2, 20), 'New HVAC Loft 201'),
  ];

  const maintenanceRequests: MaintenanceRequest[] = [
    {
      id: 'mnt-1',
      tenantId: 'ten-1',
      unitId: 'unit-1',
      propertyId: 'prop-1',
      childSeriesId: 'ser-a',
      organizationId: ORG,
      title: 'Dishwasher not draining',
      description: 'Standing water at the bottom after each cycle.',
      priority: 'medium',
      status: 'open',
      notes: null,
      createdBy: null,
      completedAt: null,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: 'mnt-2',
      tenantId: 'ten-3',
      unitId: 'unit-3',
      propertyId: 'prop-3',
      childSeriesId: 'ser-b',
      organizationId: ORG,
      title: 'AC not cooling',
      description: 'Blowing warm air, thermostat set to 70.',
      priority: 'high',
      status: 'in_progress',
      notes: 'Vendor scheduled for Friday.',
      createdBy: null,
      completedAt: null,
      createdAt: now(),
      updatedAt: now(),
    },
  ];

  const documents: Document[] = [
    {
      id: 'doc-1',
      organizationId: ORG,
      childSeriesId: 'ser-a',
      entityType: 'lease',
      entityId: 'lease-1',
      title: 'Johnson Lease 2025-2026.pdf',
      documentType: 'lease',
      storageBucket: 'documents',
      storagePath: 'demo/lease-1.pdf',
      fileUrl: null,
      mimeType: 'application/pdf',
      fileSize: 248000,
      sharedWithTenant: true,
      uploadedBy: null,
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: 'doc-2',
      organizationId: ORG,
      childSeriesId: null,
      entityType: 'parent_llc',
      entityId: parentId,
      title: 'Evergreen Holdings Formation.pdf',
      documentType: 'formation',
      storageBucket: 'documents',
      storagePath: 'demo/formation.pdf',
      fileUrl: null,
      mimeType: 'application/pdf',
      fileSize: 512000,
      sharedWithTenant: false,
      uploadedBy: null,
      createdAt: now(),
      updatedAt: now(),
    },
  ];

  const notes: Note[] = [
    {
      id: 'note-1',
      organizationId: ORG,
      childSeriesId: 'ser-c',
      entityType: 'child_series',
      entityId: 'ser-c',
      body: 'Downtown lofts may convert to short-term rentals next year — confirm series insurance covers it.',
      createdBy: null,
      createdAt: now(),
      updatedAt: now(),
    },
  ];

  return {
    orgId: ORG,
    parentLlcs,
    childSeries,
    properties,
    units,
    tenants,
    leases,
    rentCharges,
    rentPayments,
    securityDeposits,
    expenseCategories: categories,
    vendors,
    expenses,
    documents,
    notes,
    maintenanceRequests,
    portalTenantId: 'ten-1',
  };
}

let _store: Store | null = null;

export function getStore(): Store {
  if (!_store) _store = seed();
  return _store;
}

export function resetStore(): void {
  _store = seed();
}
