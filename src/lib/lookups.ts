/**
 * Reusable option loaders for form selects (series, properties, units, tenants,
 * vendors, categories). Keeps dropdowns consistent across every create/edit
 * dialog and avoids duplicating org-scoped queries.
 */
import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  childSeries,
  expenseCategories,
  parentLlcs,
  properties,
  tenants,
  units,
  vendors,
} from "@/db/schema";

export interface Option {
  value: string;
  label: string;
  /** Optional metadata used to cascade selects (e.g. a unit's series id). */
  meta?: Record<string, string | number | null>;
}

export async function getPrimaryParentLlc(orgId: string) {
  const [row] = await db
    .select()
    .from(parentLlcs)
    .where(eq(parentLlcs.organizationId, orgId))
    .orderBy(asc(parentLlcs.createdAt))
    .limit(1);
  return row ?? null;
}

export async function seriesOptions(orgId: string): Promise<Option[]> {
  const rows = await db
    .select({ id: childSeries.id, name: childSeries.name })
    .from(childSeries)
    .where(eq(childSeries.organizationId, orgId))
    .orderBy(asc(childSeries.name));
  return rows.map((r) => ({ value: r.id, label: r.name }));
}

export async function propertyOptions(
  orgId: string,
  seriesId?: string | null,
): Promise<Option[]> {
  const conds = [eq(properties.organizationId, orgId)];
  if (seriesId) conds.push(eq(properties.childSeriesId, seriesId));
  const rows = await db
    .select({
      id: properties.id,
      name: properties.name,
      seriesId: properties.childSeriesId,
    })
    .from(properties)
    .where(and(...conds))
    .orderBy(asc(properties.name));
  return rows.map((r) => ({
    value: r.id,
    label: r.name,
    meta: { seriesId: r.seriesId },
  }));
}

export async function unitOptions(
  orgId: string,
  seriesId?: string | null,
): Promise<Option[]> {
  const conds = [eq(units.organizationId, orgId)];
  if (seriesId) conds.push(eq(units.childSeriesId, seriesId));
  const rows = await db
    .select({
      id: units.id,
      label: units.label,
      propertyId: units.propertyId,
      seriesId: units.childSeriesId,
      rent: units.monthlyRentCents,
      propertyName: properties.name,
    })
    .from(units)
    .innerJoin(properties, eq(properties.id, units.propertyId))
    .where(and(...conds))
    .orderBy(asc(properties.name), asc(units.label));
  return rows.map((r) => ({
    value: r.id,
    label: `${r.propertyName} — ${r.label}`,
    meta: {
      propertyId: r.propertyId,
      seriesId: r.seriesId,
      rent: r.rent,
    },
  }));
}

export async function tenantOptions(orgId: string): Promise<Option[]> {
  const rows = await db
    .select({ id: tenants.id, name: tenants.fullName })
    .from(tenants)
    .where(eq(tenants.organizationId, orgId))
    .orderBy(asc(tenants.fullName));
  return rows.map((r) => ({ value: r.id, label: r.name }));
}

export async function vendorOptions(orgId: string): Promise<Option[]> {
  const rows = await db
    .select({ id: vendors.id, name: vendors.name })
    .from(vendors)
    .where(eq(vendors.organizationId, orgId))
    .orderBy(asc(vendors.name));
  return rows.map((r) => ({ value: r.id, label: r.name }));
}

export async function categoryOptions(orgId: string): Promise<Option[]> {
  const rows = await db
    .select({
      id: expenseCategories.id,
      name: expenseCategories.name,
      kind: expenseCategories.kind,
    })
    .from(expenseCategories)
    .where(eq(expenseCategories.organizationId, orgId))
    .orderBy(asc(expenseCategories.name));
  return rows.map((r) => ({
    value: r.id,
    label: r.name,
    meta: { kind: r.kind },
  }));
}
