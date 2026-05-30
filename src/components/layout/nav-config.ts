import {
  Building2,
  FileText,
  Home,
  LayoutDashboard,
  Layers,
  Receipt,
  Settings,
  Wallet,
  Wrench,
  Users,
  FileSignature,
  DoorOpen,
  BarChart3,
} from "lucide-react";
import type { Role } from "@/db/schema";
import { isStaff } from "@/lib/rbac";

export interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  /** Roles allowed to see this nav item. Defaults to all staff. */
  roles?: Role[];
}

export const STAFF_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/parent-llc", label: "Parent LLC", icon: Building2 },
  { href: "/series", label: "Child Series", icon: Layers },
  { href: "/properties", label: "Properties", icon: Home },
  { href: "/units", label: "Units", icon: DoorOpen },
  { href: "/tenants", label: "Tenants", icon: Users },
  { href: "/leases", label: "Leases", icon: FileSignature },
  { href: "/rent", label: "Rent", icon: Wallet },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    roles: ["owner"],
  },
];

export const TENANT_NAV: NavItem[] = [
  { href: "/portal", label: "My Home", icon: Home },
  { href: "/portal/lease", label: "Lease", icon: FileSignature },
  { href: "/portal/rent", label: "Rent & Balance", icon: Wallet },
  { href: "/portal/documents", label: "Documents", icon: FileText },
  { href: "/portal/maintenance", label: "Maintenance", icon: Wrench },
];

export function navForRole(role: Role): NavItem[] {
  if (!isStaff(role)) return TENANT_NAV;
  return STAFF_NAV.filter((item) => !item.roles || item.roles.includes(role));
}
