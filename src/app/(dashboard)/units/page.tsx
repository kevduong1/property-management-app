import { LayoutGrid } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { db } from "@/db";
import { childSeries, properties, units } from "@/db/schema";
import { occupancyLabels, occupancyTones } from "@/lib/labels";
import { formatCents } from "@/lib/money";
import { seriesOptions, propertyOptions } from "@/lib/lookups";
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
import { CreateUnitButton, EditUnitButton } from "./unit-form";
import { deleteUnit } from "./actions";

export const dynamic = "force-dynamic";

const OCCUPANCY_OPTIONS = [
  { value: "vacant", label: "Vacant" },
  { value: "occupied", label: "Occupied" },
  { value: "unavailable", label: "Unavailable" },
];

export default async function UnitsPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await props.searchParams;
  const session = await requireSession();

  const canCreate = can(session.role, "unit", "create");
  const canEdit = can(session.role, "unit", "edit");
  const canDelete = can(session.role, "unit", "delete");

  const seriesCtx = await getSeriesContext(session.organizationId);

  // Explicit filter param overrides the active series cookie.
  const seriesFilter = sp.series ?? seriesCtx.currentSeriesId ?? null;
  const propertyFilter = sp.property ?? null;
  const occupancyFilter = sp.occupancy ?? null;

  const [sOpts, pOpts, rows] = await Promise.all([
    seriesOptions(session.organizationId),
    propertyOptions(session.organizationId, seriesFilter),
    (async () => {
      const conds = [eq(units.organizationId, session.organizationId)];
      if (seriesFilter) conds.push(eq(units.childSeriesId, seriesFilter));
      if (propertyFilter) conds.push(eq(units.propertyId, propertyFilter));
      if (occupancyFilter) {
        conds.push(
          eq(
            units.occupancyStatus,
            occupancyFilter as "vacant" | "occupied" | "unavailable",
          ),
        );
      }

      return db
        .select({
          id: units.id,
          label: units.label,
          monthlyRentCents: units.monthlyRentCents,
          occupancyStatus: units.occupancyStatus,
          bedrooms: units.bedrooms,
          bathrooms: units.bathrooms,
          squareFeet: units.squareFeet,
          notes: units.notes,
          propertyId: units.propertyId,
          childSeriesId: units.childSeriesId,
          organizationId: units.organizationId,
          createdAt: units.createdAt,
          updatedAt: units.updatedAt,
          propertyName: properties.name,
          seriesName: childSeries.name,
        })
        .from(units)
        .innerJoin(properties, eq(properties.id, units.propertyId))
        .leftJoin(childSeries, eq(childSeries.id, units.childSeriesId))
        .where(and(...conds))
        .orderBy(properties.name, units.label);
    })(),
  ]);

  // We need all property options (unscoped) to populate the create/edit form
  // even if there's a series filter active in the view.
  const allPOpts = await propertyOptions(session.organizationId);

  const filters = [
    {
      key: "series",
      label: "Series",
      options: sOpts,
      allLabel: "All series",
    },
    {
      key: "property",
      label: "Property",
      options: pOpts,
      allLabel: "All properties",
    },
    {
      key: "occupancy",
      label: "Occupancy",
      options: OCCUPANCY_OPTIONS,
      allLabel: "All statuses",
    },
  ];

  function bedsAndBaths(row: (typeof rows)[0]) {
    const beds =
      row.bedrooms !== null && row.bedrooms !== undefined
        ? `${row.bedrooms} bd`
        : null;
    const baths =
      row.bathrooms !== null && row.bathrooms !== undefined
        ? `${row.bathrooms / 10} ba`
        : null;
    if (!beds && !baths) return "—";
    return [beds, baths].filter(Boolean).join(" / ");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Units"
        description="All units across your properties."
      >
        {canCreate ? (
          <CreateUnitButton propertyOptions={allPOpts} />
        ) : null}
      </PageHeader>

      <FilterBar filters={filters} />

      {rows.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="No units found"
          description="Add your first unit or adjust the filters above."
          action={
            canCreate ? (
              <CreateUnitButton propertyOptions={allPOpts} />
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property — Unit</TableHead>
                <TableHead>Series</TableHead>
                <TableHead>Beds / Baths</TableHead>
                <TableHead className="text-right">Sq Ft</TableHead>
                <TableHead className="text-right">Monthly Rent</TableHead>
                <TableHead>Occupancy</TableHead>
                {canEdit || canDelete ? (
                  <TableHead className="w-[100px]" />
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    {row.propertyName} — {row.label}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.seriesName ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {bedsAndBaths(row)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.squareFeet ? row.squareFeet.toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCents(row.monthlyRentCents)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      tone={occupancyTones[row.occupancyStatus] ?? "muted"}
                    >
                      {occupancyLabels[row.occupancyStatus] ??
                        row.occupancyStatus}
                    </Badge>
                  </TableCell>
                  {canEdit || canDelete ? (
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {canEdit ? (
                          <EditUnitButton
                            unit={row}
                            propertyOptions={allPOpts}
                          />
                        ) : null}
                        {canDelete ? (
                          <ConfirmDelete
                            action={deleteUnit}
                            id={row.id}
                            title={`Delete ${row.propertyName} — ${row.label}?`}
                            description="This removes the unit. Active leases or charges must be removed first."
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
