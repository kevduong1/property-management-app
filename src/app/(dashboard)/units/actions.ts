"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { properties, units } from "@/db/schema";
import { requirePermission } from "@/lib/guards";
import { parseDollarsToCents } from "@/lib/money";
import { runAction, type ActionResult } from "@/lib/action-result";

const schema = z.object({
  propertyId: z.string().min(1, "Property is required."),
  label: z.string().trim().min(1, "Unit label is required."),
  monthlyRent: z.string().default("0"),
  occupancyStatus: z
    .enum(["vacant", "occupied", "unavailable"])
    .default("vacant"),
  bedrooms: z.string().optional(),
  bathrooms: z.string().optional(),
  squareFeet: z.string().optional(),
  notes: z.string().trim().optional(),
});

/** Derive childSeriesId from the chosen property (org-scoped). */
async function deriveSeriesId(
  propertyId: string,
  organizationId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ childSeriesId: properties.childSeriesId })
    .from(properties)
    .where(
      and(
        eq(properties.id, propertyId),
        eq(properties.organizationId, organizationId),
      ),
    )
    .limit(1);
  return row?.childSeriesId ?? null;
}

function revalidate() {
  revalidatePath("/units");
  revalidatePath("/properties");
  revalidatePath("/dashboard");
}

export async function createUnit(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePermission("unit", "create");
    const data = schema.parse(Object.fromEntries(formData));

    const childSeriesId = await deriveSeriesId(
      data.propertyId,
      session.organizationId,
    );
    if (!childSeriesId) {
      return { ok: false, error: "Property not found or access denied." };
    }

    const monthlyRentCents = parseDollarsToCents(data.monthlyRent);
    const bedrooms =
      data.bedrooms && data.bedrooms !== ""
        ? parseInt(data.bedrooms, 10)
        : null;
    const bathroomsRaw =
      data.bathrooms && data.bathrooms !== ""
        ? parseFloat(data.bathrooms)
        : null;
    const bathrooms =
      bathroomsRaw !== null ? Math.round(bathroomsRaw * 10) : null;
    const squareFeet =
      data.squareFeet && data.squareFeet !== ""
        ? parseInt(data.squareFeet, 10)
        : null;

    const [row] = await db
      .insert(units)
      .values({
        organizationId: session.organizationId,
        propertyId: data.propertyId,
        childSeriesId,
        label: data.label,
        monthlyRentCents,
        occupancyStatus: data.occupancyStatus,
        bedrooms,
        bathrooms,
        squareFeet,
        notes: data.notes || null,
      })
      .returning();

    revalidate();
    revalidatePath(`/properties/${data.propertyId}`);
    return { ok: true, id: row.id };
  });
}

export async function updateUnit(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePermission("unit", "edit");
    const id = String(formData.get("id") ?? "");
    if (!id) return { ok: false, error: "Missing id." };

    const data = schema.parse(Object.fromEntries(formData));

    const childSeriesId = await deriveSeriesId(
      data.propertyId,
      session.organizationId,
    );
    if (!childSeriesId) {
      return { ok: false, error: "Property not found or access denied." };
    }

    const monthlyRentCents = parseDollarsToCents(data.monthlyRent);
    const bedrooms =
      data.bedrooms && data.bedrooms !== ""
        ? parseInt(data.bedrooms, 10)
        : null;
    const bathroomsRaw =
      data.bathrooms && data.bathrooms !== ""
        ? parseFloat(data.bathrooms)
        : null;
    const bathrooms =
      bathroomsRaw !== null ? Math.round(bathroomsRaw * 10) : null;
    const squareFeet =
      data.squareFeet && data.squareFeet !== ""
        ? parseInt(data.squareFeet, 10)
        : null;

    await db
      .update(units)
      .set({
        propertyId: data.propertyId,
        childSeriesId,
        label: data.label,
        monthlyRentCents,
        occupancyStatus: data.occupancyStatus,
        bedrooms,
        bathrooms,
        squareFeet,
        notes: data.notes || null,
        updatedAt: new Date(),
      })
      .where(
        and(eq(units.id, id), eq(units.organizationId, session.organizationId)),
      );

    revalidate();
    revalidatePath(`/properties/${data.propertyId}`);
    return { ok: true, id };
  });
}

export async function deleteUnit(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePermission("unit", "delete");
    try {
      await db
        .delete(units)
        .where(
          and(
            eq(units.id, id),
            eq(units.organizationId, session.organizationId),
          ),
        );
    } catch {
      return {
        ok: false,
        error:
          "Can't delete a unit that still has active leases or charges. Remove them first.",
      };
    }
    revalidate();
    return { ok: true };
  });
}
