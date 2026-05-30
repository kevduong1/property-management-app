import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2 } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { db } from "@/db";
import { childSeries, properties, units } from "@/db/schema";
import {
  occupancyLabels,
  occupancyTones,
  propertyStatusTones,
} from "@/lib/labels";
import { formatCents } from "@/lib/money";
import { seriesOptions } from "@/lib/lookups";
import { PageHeader } from "@/components/shared/page-header";
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
import { EmptyState } from "@/components/shared/empty-state";
import { EditPropertyButton } from "../property-form";
import { deleteProperty } from "../actions";

export const dynamic = "force-dynamic";

export default async function PropertyDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const session = await requireSession();

  const canEdit = can(session.role, "property", "edit");
  const canDelete = can(session.role, "property", "delete");
  const canEditUnit = can(session.role, "unit", "edit");
  const canDeleteUnit = can(session.role, "unit", "delete");

  const [property] = await db
    .select({
      id: properties.id,
      name: properties.name,
      addressLine1: properties.addressLine1,
      addressLine2: properties.addressLine2,
      city: properties.city,
      state: properties.state,
      postalCode: properties.postalCode,
      status: properties.status,
      childSeriesId: properties.childSeriesId,
      notes: properties.notes,
      organizationId: properties.organizationId,
      createdAt: properties.createdAt,
      updatedAt: properties.updatedAt,
      seriesName: childSeries.name,
    })
    .from(properties)
    .leftJoin(childSeries, eq(childSeries.id, properties.childSeriesId))
    .where(
      and(
        eq(properties.id, id),
        eq(properties.organizationId, session.organizationId),
      ),
    )
    .limit(1);

  if (!property) notFound();

  const [propertyUnits, opts] = await Promise.all([
    db
      .select()
      .from(units)
      .where(
        and(
          eq(units.propertyId, id),
          eq(units.organizationId, session.organizationId),
        ),
      )
      .orderBy(units.label),
    seriesOptions(session.organizationId),
  ]);

  function fullAddress() {
    const line1 = property.addressLine1;
    const line2 = property.addressLine2;
    const cityStateZip = [property.city, property.state, property.postalCode]
      .filter(Boolean)
      .join(", ");
    return [line1, line2, cityStateZip].filter(Boolean).join(", ") || null;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={property.name}
        description={fullAddress() ?? undefined}
      >
        <div className="flex items-center gap-2">
          <Badge tone={propertyStatusTones[property.status] ?? "muted"}>
            {property.status}
          </Badge>
          {canEdit ? (
            <EditPropertyButton property={property} seriesOptions={opts} />
          ) : null}
          {canDelete ? (
            <ConfirmDelete
              action={deleteProperty}
              id={property.id}
              title={`Delete ${property.name}?`}
              description="This removes the property. All units must be deleted first."
            />
          ) : null}
        </div>
      </PageHeader>

      {property.seriesName ? (
        <p className="text-sm text-muted-foreground">
          Series:{" "}
          <span className="font-medium text-foreground">
            {property.seriesName}
          </span>
        </p>
      ) : null}

      {property.notes ? (
        <p className="whitespace-pre-wrap rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {property.notes}
        </p>
      ) : null}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Units</h2>
          {canEditUnit ? (
            <Link
              href={`/units?property=${id}`}
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Manage in units list
            </Link>
          ) : null}
        </div>

        {propertyUnits.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No units yet"
            description="Add units from the Units page to start tracking occupancy and rent."
          />
        ) : (
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead>Beds / Baths</TableHead>
                  <TableHead className="text-right">Sq Ft</TableHead>
                  <TableHead className="text-right">Monthly Rent</TableHead>
                  <TableHead>Occupancy</TableHead>
                  {canEditUnit || canDeleteUnit ? (
                    <TableHead className="w-[80px]" />
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {propertyUnits.map((unit) => (
                  <TableRow key={unit.id}>
                    <TableCell className="font-medium">{unit.label}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {unit.bedrooms !== null && unit.bedrooms !== undefined
                        ? `${unit.bedrooms} bd`
                        : "—"}
                      {unit.bathrooms !== null && unit.bathrooms !== undefined
                        ? ` / ${unit.bathrooms / 10} ba`
                        : ""}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {unit.squareFeet ? unit.squareFeet.toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCents(unit.monthlyRentCents)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        tone={occupancyTones[unit.occupancyStatus] ?? "muted"}
                      >
                        {occupancyLabels[unit.occupancyStatus] ??
                          unit.occupancyStatus}
                      </Badge>
                    </TableCell>
                    {canEditUnit || canDeleteUnit ? (
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {canEditUnit ? (
                            <Link
                              href={`/units?property=${id}`}
                              className="inline-flex items-center rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent"
                            >
                              Edit
                            </Link>
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
    </div>
  );
}
