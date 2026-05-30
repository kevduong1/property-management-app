"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { requirePermission } from "@/lib/guards";
import { runAction, type ActionResult } from "@/lib/action-result";

const schema = z.object({
  childSeriesId: z.string().min(1, "Series is required."),
  name: z.string().trim().min(1, "Name is required."),
  addressLine1: z.string().trim().optional(),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  status: z.enum(["active", "inactive", "sold"]).default("active"),
  notes: z.string().trim().optional(),
});

function revalidate() {
  revalidatePath("/properties");
  revalidatePath("/dashboard");
}

export async function createProperty(
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePermission("property", "create");
    const data = schema.parse(Object.fromEntries(formData));
    const [row] = await db
      .insert(properties)
      .values({
        organizationId: session.organizationId,
        childSeriesId: data.childSeriesId,
        name: data.name,
        addressLine1: data.addressLine1 || null,
        addressLine2: data.addressLine2 || null,
        city: data.city || null,
        state: data.state || null,
        postalCode: data.postalCode || null,
        status: data.status,
        notes: data.notes || null,
      })
      .returning();
    revalidate();
    return { ok: true, id: row.id };
  });
}

export async function updateProperty(
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePermission("property", "edit");
    const id = String(formData.get("id") ?? "");
    if (!id) return { ok: false, error: "Missing id." };
    const data = schema.parse(Object.fromEntries(formData));
    await db
      .update(properties)
      .set({
        childSeriesId: data.childSeriesId,
        name: data.name,
        addressLine1: data.addressLine1 || null,
        addressLine2: data.addressLine2 || null,
        city: data.city || null,
        state: data.state || null,
        postalCode: data.postalCode || null,
        status: data.status,
        notes: data.notes || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(properties.id, id),
          eq(properties.organizationId, session.organizationId),
        ),
      );
    revalidate();
    revalidatePath(`/properties/${id}`);
    return { ok: true, id };
  });
}

export async function deleteProperty(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePermission("property", "delete");
    try {
      await db
        .delete(properties)
        .where(
          and(
            eq(properties.id, id),
            eq(properties.organizationId, session.organizationId),
          ),
        );
    } catch {
      return {
        ok: false,
        error:
          "Can't delete a property that still has units. Remove the units first.",
      };
    }
    revalidate();
    return { ok: true };
  });
}
