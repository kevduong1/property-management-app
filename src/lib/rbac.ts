/**
 * Role-based access control. Roles: owner, manager, bookkeeper, tenant.
 *
 * - owner:      everything
 * - manager:    manage properties, units, tenants, leases, rent, expenses,
 *               documents, notes, maintenance. Cannot manage org users/settings.
 * - bookkeeper: view everything + manage financial records (rent charges,
 *               payments, expenses, deposits, reports). Read-only on the rest.
 * - tenant:     self-service portal only.
 */
import type { Role } from "@/db/schema";

export type Resource =
  | "series"
  | "property"
  | "unit"
  | "tenant"
  | "lease"
  | "rent" // rent charges + payments
  | "expense"
  | "deposit"
  | "document"
  | "note"
  | "maintenance"
  | "report"
  | "settings";

export type Action = "view" | "create" | "edit" | "delete";

const FULL: Action[] = ["view", "create", "edit", "delete"];
const VIEW: Action[] = ["view"];

// Permission matrix: role -> resource -> allowed actions.
const MATRIX: Record<Role, Partial<Record<Resource, Action[]>>> = {
  owner: {
    series: FULL,
    property: FULL,
    unit: FULL,
    tenant: FULL,
    lease: FULL,
    rent: FULL,
    expense: FULL,
    deposit: FULL,
    document: FULL,
    note: FULL,
    maintenance: FULL,
    report: VIEW,
    settings: FULL,
  },
  manager: {
    series: VIEW,
    property: FULL,
    unit: FULL,
    tenant: FULL,
    lease: FULL,
    rent: FULL,
    expense: FULL,
    deposit: FULL,
    document: FULL,
    note: FULL,
    maintenance: FULL,
    report: VIEW,
    settings: [],
  },
  bookkeeper: {
    series: VIEW,
    property: VIEW,
    unit: VIEW,
    tenant: VIEW,
    lease: VIEW,
    rent: FULL,
    expense: FULL,
    deposit: FULL,
    document: ["view", "create"],
    note: ["view", "create"],
    maintenance: VIEW,
    report: VIEW,
    settings: [],
  },
  tenant: {
    // The tenant portal uses dedicated, ownership-scoped queries rather than
    // the general resource matrix; tenants have no management permissions here.
    maintenance: ["view", "create"],
    document: VIEW,
  },
};

export function can(role: Role, resource: Resource, action: Action): boolean {
  return MATRIX[role]?.[resource]?.includes(action) ?? false;
}

/** True for staff roles that use the management dashboard. */
export function isStaff(role: Role): boolean {
  return role === "owner" || role === "manager" || role === "bookkeeper";
}

/** Convenience: can this role write (create/edit/delete) the resource at all? */
export function canManage(role: Role, resource: Resource): boolean {
  return (
    can(role, resource, "create") ||
    can(role, resource, "edit") ||
    can(role, resource, "delete")
  );
}
