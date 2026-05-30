/**
 * Human-readable labels and badge styling for enum values used across the UI.
 */
import type {
  DocumentType,
  ExpenseCategoryKind,
  LeaseStatus,
  MaintenancePriority,
  MaintenanceStatus,
  RentChargeStatus,
  Role,
} from "@/db/schema";

export type BadgeTone =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted";

export const roleLabels: Record<Role, string> = {
  owner: "Owner / Admin",
  manager: "Manager",
  bookkeeper: "Bookkeeper",
  tenant: "Tenant",
};

export const rentStatusLabels: Record<RentChargeStatus, string> = {
  unpaid: "Unpaid",
  partial: "Partially paid",
  paid: "Paid",
  late: "Late",
};

export const rentStatusTones: Record<RentChargeStatus, BadgeTone> = {
  unpaid: "muted",
  partial: "warning",
  paid: "success",
  late: "danger",
};

export const leaseStatusLabels: Record<LeaseStatus, string> = {
  active: "Active",
  expired: "Expired",
  upcoming: "Upcoming",
  month_to_month: "Month-to-month",
  terminated: "Terminated",
};

export const leaseStatusTones: Record<LeaseStatus, BadgeTone> = {
  active: "success",
  expired: "muted",
  upcoming: "info",
  month_to_month: "info",
  terminated: "danger",
};

export const occupancyLabels: Record<string, string> = {
  vacant: "Vacant",
  occupied: "Occupied",
  unavailable: "Unavailable",
};

export const occupancyTones: Record<string, BadgeTone> = {
  vacant: "warning",
  occupied: "success",
  unavailable: "muted",
};

export const seriesStatusTones: Record<string, BadgeTone> = {
  active: "success",
  inactive: "muted",
  dissolved: "danger",
};

export const propertyStatusTones: Record<string, BadgeTone> = {
  active: "success",
  inactive: "muted",
  sold: "info",
};

export const expenseCategoryLabels: Record<ExpenseCategoryKind, string> = {
  repairs: "Repairs",
  utilities: "Utilities",
  insurance: "Insurance",
  property_taxes: "Property taxes",
  mortgage: "Mortgage",
  legal: "Legal",
  accounting: "Accounting",
  supplies: "Supplies",
  capital_improvements: "Capital improvements",
  other: "Other",
};

export const documentTypeLabels: Record<DocumentType, string> = {
  lease: "Lease",
  receipt: "Receipt",
  invoice: "Invoice",
  insurance: "Insurance",
  formation: "Formation document",
  vendor_contract: "Vendor contract",
  tenant_notice: "Tenant notice",
  inspection_photo: "Inspection photo",
  other: "Other",
};

export const maintenanceStatusLabels: Record<MaintenanceStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  completed: "Completed",
  canceled: "Canceled",
};

export const maintenanceStatusTones: Record<MaintenanceStatus, BadgeTone> = {
  open: "warning",
  in_progress: "info",
  completed: "success",
  canceled: "muted",
};

export const maintenancePriorityLabels: Record<MaintenancePriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  emergency: "Emergency",
};

export const maintenancePriorityTones: Record<MaintenancePriority, BadgeTone> =
  {
    low: "muted",
    medium: "info",
    high: "warning",
    emergency: "danger",
  };

export const paymentMethodLabels: Record<string, string> = {
  cash: "Cash",
  check: "Check",
  ach: "ACH",
  card: "Card",
  zelle: "Zelle",
  venmo: "Venmo",
  other: "Other",
};

export function titleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
