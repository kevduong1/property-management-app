/**
 * Shared constants: roles, status labels, badge variants, navigation, and the
 * MVP expense categories. Keep enum string values in sync with db/schema.ts.
 */
import type { BadgeVariant } from '@/components/ui/Badge';

/* ------------------------------- Roles ----------------------------------- */

export type Role = 'owner_admin' | 'manager' | 'bookkeeper' | 'tenant';

export const ROLE_LABELS: Record<Role, string> = {
  owner_admin: 'Owner / Admin',
  manager: 'Manager',
  bookkeeper: 'Bookkeeper',
  tenant: 'Tenant',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner_admin: 'Full access to all data and settings',
  manager: 'Manage properties, tenants, rent, expenses, docs & maintenance',
  bookkeeper: 'View everything; manage financial records',
  tenant: 'View your lease, balance, rent history & shared documents',
};

/* ----------------------------- Status maps ------------------------------- */

export const SERIES_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  active: { label: 'Active', variant: 'success' },
  inactive: { label: 'Inactive', variant: 'muted' },
  pending: { label: 'Pending', variant: 'warning' },
  dissolved: { label: 'Dissolved', variant: 'danger' },
};

export const PROPERTY_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  active: { label: 'Active', variant: 'success' },
  inactive: { label: 'Inactive', variant: 'muted' },
  sold: { label: 'Sold', variant: 'info' },
};

export const OCCUPANCY_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  occupied: { label: 'Occupied', variant: 'success' },
  vacant: { label: 'Vacant', variant: 'warning' },
  unavailable: { label: 'Unavailable', variant: 'muted' },
};

export const LEASE_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  active: { label: 'Active', variant: 'success' },
  upcoming: { label: 'Upcoming', variant: 'info' },
  month_to_month: { label: 'Month-to-month', variant: 'info' },
  expired: { label: 'Expired', variant: 'muted' },
  terminated: { label: 'Terminated', variant: 'danger' },
};

export const RENT_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  paid: { label: 'Paid', variant: 'success' },
  partially_paid: { label: 'Partial', variant: 'warning' },
  unpaid: { label: 'Unpaid', variant: 'muted' },
  late: { label: 'Late', variant: 'danger' },
};

export const MAINTENANCE_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  open: { label: 'Open', variant: 'info' },
  in_progress: { label: 'In Progress', variant: 'warning' },
  completed: { label: 'Completed', variant: 'success' },
  canceled: { label: 'Canceled', variant: 'muted' },
};

export const MAINTENANCE_PRIORITY: Record<string, { label: string; variant: BadgeVariant }> = {
  low: { label: 'Low', variant: 'muted' },
  medium: { label: 'Medium', variant: 'info' },
  high: { label: 'High', variant: 'warning' },
  urgent: { label: 'Urgent', variant: 'danger' },
};

export const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'money_order', label: 'Money Order' },
  { value: 'online', label: 'Online' },
  { value: 'other', label: 'Other' },
];

export const DOCUMENT_TYPES: { value: string; label: string }[] = [
  { value: 'lease', label: 'Lease' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'formation', label: 'LLC / Series Formation' },
  { value: 'vendor_contract', label: 'Vendor Contract' },
  { value: 'tenant_notice', label: 'Tenant Notice' },
  { value: 'inspection_photo', label: 'Inspection Photo' },
  { value: 'other', label: 'Other' },
];

export const ENTITY_TYPES: { value: string; label: string }[] = [
  { value: 'parent_llc', label: 'Parent LLC' },
  { value: 'child_series', label: 'Child Series' },
  { value: 'property', label: 'Property' },
  { value: 'unit', label: 'Unit' },
  { value: 'tenant', label: 'Tenant' },
  { value: 'lease', label: 'Lease' },
  { value: 'rent_charge', label: 'Rent Charge' },
  { value: 'rent_payment', label: 'Payment' },
  { value: 'expense', label: 'Expense' },
  { value: 'security_deposit', label: 'Security Deposit' },
  { value: 'maintenance_request', label: 'Maintenance Request' },
];

/* --------------------------- Navigation ---------------------------------- */

export type NavItem = {
  href: string;
  label: string;
  icon: string; // name handled by Icon component
};

export const MAIN_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'grid' },
  { href: '/parent-llc', label: 'Parent LLC', icon: 'building' },
  { href: '/series', label: 'Child Series', icon: 'layers' },
  { href: '/properties', label: 'Properties', icon: 'home' },
  { href: '/units', label: 'Units', icon: 'door' },
  { href: '/tenants', label: 'Tenants', icon: 'users' },
  { href: '/leases', label: 'Leases', icon: 'file' },
  { href: '/rent', label: 'Rent', icon: 'dollar' },
  { href: '/expenses', label: 'Expenses', icon: 'receipt' },
  { href: '/maintenance', label: 'Maintenance', icon: 'wrench' },
  { href: '/documents', label: 'Documents', icon: 'folder' },
  { href: '/reports', label: 'Reports', icon: 'chart' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
];
