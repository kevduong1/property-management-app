import Link from "next/link";
import { Users } from "lucide-react";
import { and, count, eq, ilike, or } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { db } from "@/db";
import { leases, tenants } from "@/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar } from "@/components/shared/filter-bar";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { CreateTenantButton, EditTenantButton } from "./tenant-form";
import { deleteTenant } from "./actions";

export const dynamic = "force-dynamic";

export default async function TenantsPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [session, sp] = await Promise.all([requireSession(), props.searchParams]);
  const canCreate = can(session.role, "tenant", "create");
  const canEdit = can(session.role, "tenant", "edit");
  const canDelete = can(session.role, "tenant", "delete");

  const q = sp.q?.trim() ?? "";

  // Load tenants with active lease count.
  const conditions = [eq(tenants.organizationId, session.organizationId)];
  if (q) {
    conditions.push(
      or(
        ilike(tenants.fullName, `%${q}%`),
        ilike(tenants.email, `%${q}%`),
      )!,
    );
  }

  const rows = await db
    .select()
    .from(tenants)
    .where(and(...conditions))
    .orderBy(tenants.fullName);

  // Count active leases per tenant in one query.
  const activeLeaseCounts = await db
    .select({
      tenantId: leases.tenantId,
      cnt: count(leases.id),
    })
    .from(leases)
    .where(
      and(
        eq(leases.organizationId, session.organizationId),
        eq(leases.status, "active"),
      ),
    )
    .groupBy(leases.tenantId);

  const activeLeasesByTenant = new Map(
    activeLeaseCounts.map((r) => [r.tenantId, Number(r.cnt)]),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenants"
        description="Manage tenants and their contact information."
      >
        {canCreate ? <CreateTenantButton /> : null}
      </PageHeader>

      <FilterBar filters={[]} showSearch />

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={q ? "No tenants match your search" : "No tenants yet"}
          description={
            q
              ? "Try a different name or email."
              : "Add your first tenant to get started."
          }
          action={!q && canCreate ? <CreateTenantButton /> : undefined}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Active leases</TableHead>
                  {canEdit || canDelete ? (
                    <TableHead className="w-24" />
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/tenants/${t.id}`}
                        className="hover:underline"
                      >
                        {t.fullName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {t.phone ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {activeLeasesByTenant.get(t.id) ?? 0}
                    </TableCell>
                    {canEdit || canDelete ? (
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {canEdit ? (
                            <EditTenantButton tenant={t} />
                          ) : null}
                          {canDelete ? (
                            <ConfirmDelete
                              action={deleteTenant}
                              id={t.id}
                              title={`Delete ${t.fullName}?`}
                              description="This will permanently remove the tenant. Tenants with leases cannot be deleted."
                            />
                          ) : null}
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
