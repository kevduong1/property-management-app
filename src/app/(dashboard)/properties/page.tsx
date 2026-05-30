import Link from "next/link";
import { Building2 } from "lucide-react";
import { and, eq, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { db } from "@/db";
import { childSeries, properties, units } from "@/db/schema";
import { propertyStatusTones } from "@/lib/labels";
import { seriesOptions } from "@/lib/lookups";
import { getSeriesContext } from "@/lib/series-context";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar } from "@/components/shared/filter-bar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { CreatePropertyButton, EditPropertyButton } from "./property-form";
import { deleteProperty } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "sold", label: "Sold" },
];

export default async function PropertiesPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await props.searchParams;
  const session = await requireSession();

  const canCreate = can(session.role, "property", "create");
  const canEdit = can(session.role, "property", "edit");
  const canDelete = can(session.role, "property", "delete");

  const seriesCtx = await getSeriesContext(session.organizationId);

  // Explicit filter param overrides the active series cookie.
  const seriesFilter = sp.series ?? seriesCtx.currentSeriesId ?? null;
  const statusFilter = sp.status ?? null;

  const [opts, rows] = await Promise.all([
    seriesOptions(session.organizationId),
    (async () => {
      const conds = [eq(properties.organizationId, session.organizationId)];
      if (seriesFilter) conds.push(eq(properties.childSeriesId, seriesFilter));
      if (statusFilter)
        conds.push(
          eq(
            properties.status,
            statusFilter as "active" | "inactive" | "sold",
          ),
        );

      return db
        .select({
          id: properties.id,
          name: properties.name,
          addressLine1: properties.addressLine1,
          city: properties.city,
          state: properties.state,
          postalCode: properties.postalCode,
          status: properties.status,
          childSeriesId: properties.childSeriesId,
          seriesName: childSeries.name,
          unitCount: sql<number>`cast(count(${units.id}) as int)`,
          // carry all columns for the edit form
          addressLine2: properties.addressLine2,
          notes: properties.notes,
          organizationId: properties.organizationId,
          createdAt: properties.createdAt,
          updatedAt: properties.updatedAt,
        })
        .from(properties)
        .leftJoin(childSeries, eq(childSeries.id, properties.childSeriesId))
        .leftJoin(units, eq(units.propertyId, properties.id))
        .where(and(...conds))
        .groupBy(
          properties.id,
          properties.name,
          properties.addressLine1,
          properties.addressLine2,
          properties.city,
          properties.state,
          properties.postalCode,
          properties.status,
          properties.childSeriesId,
          properties.notes,
          properties.organizationId,
          properties.createdAt,
          properties.updatedAt,
          childSeries.name,
        )
        .orderBy(properties.name);
    })(),
  ]);

  const filters = [
    {
      key: "series",
      label: "Series",
      options: opts,
      allLabel: "All series",
    },
    {
      key: "status",
      label: "Status",
      options: STATUS_OPTIONS,
      allLabel: "All statuses",
    },
  ];

  function addressOf(row: (typeof rows)[0]) {
    const parts = [row.addressLine1, row.city, row.state, row.postalCode]
      .filter(Boolean)
      .join(", ");
    return parts || "—";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Properties"
        description="All properties across your child series."
      >
        {canCreate ? <CreatePropertyButton seriesOptions={opts} /> : null}
      </PageHeader>

      <FilterBar filters={filters} />

      {rows.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No properties found"
          description="Add your first property or adjust the filters above."
          action={canCreate ? <CreatePropertyButton seriesOptions={opts} /> : undefined}
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Series</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Units</TableHead>
                {canEdit || canDelete ? (
                  <TableHead className="w-[100px]" />
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/properties/${row.id}`}
                      className="hover:underline"
                    >
                      {row.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {addressOf(row)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.seriesName ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      tone={propertyStatusTones[row.status] ?? "muted"}
                    >
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.unitCount}
                  </TableCell>
                  {canEdit || canDelete ? (
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {canEdit ? (
                          <EditPropertyButton
                            property={row}
                            seriesOptions={opts}
                          />
                        ) : null}
                        {canDelete ? (
                          <ConfirmDelete
                            action={deleteProperty}
                            id={row.id}
                            title={`Delete ${row.name}?`}
                            description="This removes the property. All units must be deleted first."
                          />
                        ) : null}
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
