"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  DoorOpen,
  FileSignature,
  FileText,
  Home,
  LayoutDashboard,
  Layers,
  Receipt,
  Settings,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { IconKey, NavItem } from "./nav-config";

const ICONS: Record<IconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  parentLlc: Building2,
  series: Layers,
  properties: Home,
  units: DoorOpen,
  tenants: Users,
  leases: FileSignature,
  rent: Wallet,
  expenses: Receipt,
  maintenance: Wrench,
  documents: FileText,
  reports: BarChart3,
  settings: Settings,
  home: Home,
  lease: FileSignature,
};

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5 px-2">
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/dashboard" &&
            item.href !== "/portal" &&
            pathname.startsWith(item.href));
        const Icon = ICONS[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {Icon ? <Icon className="h-4 w-4" /> : null}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
