/**
 * Domain types used across the app. Base row types come from the Drizzle
 * schema; the `*View` types add the joined/computed fields the UI needs.
 */
import type {
  ChildSeries,
  Expense,
  Lease,
  MaintenanceRequest,
  ParentLlc,
  Property,
  RentCharge,
  RentPayment,
  SecurityDeposit,
  Tenant,
  Unit,
  Document,
  Note,
  Vendor,
  ExpenseCategory,
} from '@/db/schema';

export type {
  ChildSeries,
  Expense,
  Lease,
  MaintenanceRequest,
  ParentLlc,
  Property,
  RentCharge,
  RentPayment,
  SecurityDeposit,
  Tenant,
  Unit,
  Document,
  Note,
  Vendor,
  ExpenseCategory,
};

export type RentChargeStatus = 'unpaid' | 'partially_paid' | 'paid' | 'late';

export interface ChildSeriesView extends ChildSeries {
  propertyCount: number;
  unitCount: number;
  occupiedUnits: number;
  income: number;
  expenses: number;
  netIncome: number;
  outstandingRent: number;
}

export interface PropertyView extends Property {
  seriesName: string;
  unitCount: number;
  occupiedUnits: number;
  monthlyRentRoll: number;
}

export interface UnitView extends Unit {
  propertyName: string;
  seriesName: string;
  tenantName: string | null;
  leaseId: string | null;
}

export interface TenantView extends Tenant {
  unitName: string | null;
  propertyName: string | null;
  seriesName: string | null;
  leaseStatus: string | null;
  balance: number;
  hasPortalAccess: boolean;
}

export interface LeaseView extends Lease {
  tenantName: string;
  unitName: string;
  propertyName: string;
  seriesName: string;
}

export interface RentChargeView extends RentCharge {
  tenantName: string;
  unitName: string;
  propertyName: string;
  seriesName: string;
  paidAmount: number;
  balance: number;
  computedStatus: RentChargeStatus;
}

export interface ExpenseView extends Expense {
  seriesName: string;
  propertyName: string | null;
  categoryName: string | null;
  vendorName: string | null;
}

export interface MaintenanceView extends MaintenanceRequest {
  tenantName: string | null;
  unitName: string | null;
  propertyName: string | null;
  seriesName: string;
}

export interface DocumentView extends Document {
  seriesName: string | null;
}

/** Dashboard / report summary metrics. */
export interface FinancialSummary {
  totalRentDue: number;
  totalRentCollected: number;
  outstandingRent: number;
  lateRent: number;
  totalExpenses: number;
  netIncome: number;
  occupancyRate: number;
  securityDepositsHeld: number;
  unitCount: number;
  occupiedUnits: number;
}

/** Common filter shape used by major list & report pages. */
export interface Filters {
  seriesId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  tenantId?: string | null;
  categoryId?: string | null;
  status?: string | null;
  occupancy?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}
