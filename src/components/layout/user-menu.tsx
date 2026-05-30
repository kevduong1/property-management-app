"use client";

import { useTransition } from "react";
import { ChevronDown, LogOut, UserCog } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { devSwitchUser, logout } from "@/app/actions/context";
import { roleLabels } from "@/lib/labels";
import type { Role } from "@/db/schema";

const DEV_USERS: { email: string; label: string; role: Role }[] = [
  { email: "owner@example.com", label: "Kevin (Owner)", role: "owner" },
  { email: "manager@example.com", label: "Maria (Manager)", role: "manager" },
  {
    email: "bookkeeper@example.com",
    label: "Ben (Bookkeeper)",
    role: "bookkeeper",
  },
  { email: "tenant@example.com", label: "Tara (Tenant)", role: "tenant" },
];

export function UserMenu({
  email,
  fullName,
  role,
  devMode,
}: {
  email: string;
  fullName: string | null;
  role: Role;
  devMode: boolean;
}) {
  const [, startTransition] = useTransition();
  const initials = (fullName ?? email)
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initials}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block font-medium leading-tight">
            {fullName ?? email}
          </span>
          <span className="block text-xs text-muted-foreground">
            {roleLabels[role]}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{email}</DropdownMenuLabel>
        {devMode ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
              <UserCog className="h-3.5 w-3.5" /> Switch role (dev)
            </DropdownMenuLabel>
            {DEV_USERS.map((u) => (
              <DropdownMenuItem
                key={u.email}
                onSelect={() =>
                  startTransition(() => devSwitchUser(u.email))
                }
              >
                {u.label}
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => startTransition(() => logout())}>
          <LogOut className="h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
