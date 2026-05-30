import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { requireSession, isSupabaseMode } from "@/lib/auth";
import { isStaff } from "@/lib/rbac";
import { getSeriesContext } from "@/lib/series-context";
import { navForRole } from "@/components/layout/nav-config";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { SeriesSwitcher } from "@/components/layout/series-switcher";
import { UserMenu } from "@/components/layout/user-menu";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  // Tenants use the dedicated portal.
  if (!isStaff(session.role)) redirect("/portal");

  const { list, currentSeriesId, current } = await getSeriesContext(
    session.organizationId,
  );
  const nav = navForRole(session.role);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card lg:flex">
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">SeriesBooks</p>
            <p className="text-xs text-muted-foreground">
              {session.organizationName}
            </p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-3">
          <SidebarNav items={nav} />
        </div>
        <div className="border-t p-3 text-xs text-muted-foreground">
          Bookkeeping-first · Series LLC
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background/95 px-4 backdrop-blur lg:px-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="lg:hidden">
              <Building2 className="h-6 w-6 text-primary" />
            </Link>
            <SeriesSwitcher list={list} currentSeriesId={currentSeriesId} />
          </div>
          <UserMenu
            email={session.email}
            fullName={session.fullName}
            role={session.role}
            devMode={!isSupabaseMode()}
          />
        </header>

        {/* Active-series context banner */}
        <div className="border-b bg-muted/40 px-4 py-1.5 text-xs lg:px-6">
          <span className="text-muted-foreground">Viewing: </span>
          <span className="font-medium">
            {current ? current.name : "All child series"}
          </span>
        </div>

        <main className="flex-1 space-y-6 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
