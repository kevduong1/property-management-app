import type { Role } from "@/db/schema";
import { isStaff } from "@/lib/rbac";

/**
 * Nav items carry an `icon` *key* (string), not a component, so they can be
 * passed from server components into the client <SidebarNav> without crossing
 * the serialization boundary. The key is resolved to a Lucide icon inside
 * sidebar-nav.tsx (a client component).
 */
export type IconKey =
  | "dashboard"
  | "parentLlc"
  | "series"
  | "properties"
  | "units"
  | "tenants"
  | "leases"
  | "rent"
  | "expenses"
  | "maintenance"
  | "documents"
  | "reports"
  | "settings"
  | "home"
  | "lease";

export interface NavItem {
  href: string;
  label: string;
  icon: IconKey;
  /** Roles allowed to see this nav item. Defaults to all staff. */
  roles?: Role[];
}

export const STAFF_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/parent-llc", label: "Parent LLC", icon: "parentLlc" },
  { href: "/series", label: "Child Series", icon: "series" },
  { href: "/properties", label: "Properties", icon: "properties" },
  { href: "/units", label: "Units", icon: "units" },
  { href: "/tenants", label: "Tenants", icon: "tenants" },
  { href: "/leases", label: "Leases", icon: "leases" },
  { href: "/rent", label: "Rent", icon: "rent" },
  { href: "/expenses", label: "Expenses", icon: "expenses" },
  { href: "/maintenance", label: "Maintenance", icon: "maintenance" },
  { href: "/documents", label: "Documents", icon: "documents" },
  { href: "/reports", label: "Reports", icon: "reports" },
  { href: "/settings", label: "Settings", icon: "settings", roles: ["owner"] },
];

export const TENANT_NAV: NavItem[] = [
  { href: "/portal", label: "My Home", icon: "home" },
  { href: "/portal/lease", label: "Lease", icon: "lease" },
  { href: "/portal/rent", label: "Rent & Balance", icon: "rent" },
  { href: "/portal/documents", label: "Documents", icon: "documents" },
  { href: "/portal/maintenance", label: "Maintenance", icon: "maintenance" },
];

export function navForRole(role: Role): NavItem[] {
  if (!isStaff(role)) return TENANT_NAV;
  return STAFF_NAV.filter((item) => !item.roles || item.roles.includes(role));
}
