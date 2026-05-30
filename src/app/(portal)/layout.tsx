import { redirect } from "next/navigation";
import { Home } from "lucide-react";
import { requireSession, isSupabaseMode } from "@/lib/auth";
import { isStaff } from "@/lib/rbac";
import { getTenantOverview } from "@/lib/tenant-portal";
import { navForRole } from "@/components/layout/nav-config";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { UserMenu } from "@/components/layout/user-menu";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  // Staff use the management dashboard.
  if (isStaff(session.role)) redirect("/dashboard");

  // Tenant must have a linked tenant record.
  if (!session.tenantId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
        <div className="max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Home className="h-6 w-6 text-muted-foreground" />
          </div>
          <h1 className="mb-2 text-xl font-semibold">No tenant record linked</h1>
          <p className="text-sm text-muted-foreground">
            Your account hasn&apos;t been connected to a tenant record yet.
            Please contact your property manager to get access set up.
          </p>
        </div>
      </div>
    );
  }

  const overview = await getTenantOverview(
    session.tenantId,
    session.organizationId,
  );

  const nav = navForRole(session.role);
  const primaryLease = overview.primaryLease;
  const contextLabel = primaryLease
    ? `${primaryLease.unit.property.name} — ${primaryLease.unit.label}`
    : session.organizationName;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card lg:flex">
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Home className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Tenant Portal</p>
            <p className="text-xs text-muted-foreground">
              {session.organizationName}
            </p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-3">
          <SidebarNav items={nav} />
        </div>
        <div className="border-t p-3 text-xs text-muted-foreground">
          Self-service portal
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background/95 px-4 backdrop-blur lg:px-6">
          <div className="flex items-center gap-3">
            <Home className="h-6 w-6 text-primary lg:hidden" />
            <span className="text-sm font-medium text-muted-foreground">
              {contextLabel}
            </span>
          </div>
          <UserMenu
            email={session.email}
            fullName={session.fullName}
            role={session.role}
            devMode={!isSupabaseMode()}
          />
        </header>

        <main className="flex-1 space-y-6 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
