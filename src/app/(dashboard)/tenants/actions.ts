"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { leases, tenants } from "@/db/schema";
import { requirePermission } from "@/lib/guards";
import { runAction, type ActionResult } from "@/lib/action-result";

const schema = z.object({
  fullName: z.string().trim().min(1, "Full name is required."),
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  emergencyContactName: z.string().trim().optional(),
  emergencyContactPhone: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

function revalidate() {
  revalidatePath("/tenants");
  revalidatePath("/dashboard");
}

export async function createTenant(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePermission("tenant", "create");
    const data = schema.parse(Object.fromEntries(formData));
    const [row] = await db
      .insert(tenants)
      .values({
        organizationId: session.organizationId,
        fullName: data.fullName,
        email: data.email || null,
        phone: data.phone || null,
        emergencyContactName: data.emergencyContactName || null,
        emergencyContactPhone: data.emergencyContactPhone || null,
        notes: data.notes || null,
      })
      .returning();
    revalidate();
    return { ok: true, id: row.id };
  });
}

export async function updateTenant(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePermission("tenant", "edit");
    const id = String(formData.get("id") ?? "");
    if (!id) return { ok: false, error: "Missing id." };
    const data = schema.parse(Object.fromEntries(formData));
    await db
      .update(tenants)
      .set({
        fullName: data.fullName,
        email: data.email || null,
        phone: data.phone || null,
        emergencyContactName: data.emergencyContactName || null,
        emergencyContactPhone: data.emergencyContactPhone || null,
        notes: data.notes || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tenants.id, id),
          eq(tenants.organizationId, session.organizationId),
        ),
      );
    revalidate();
    revalidatePath(`/tenants/${id}`);
    return { ok: true, id };
  });
}

export async function deleteTenant(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePermission("tenant", "delete");
    // Check if tenant has any leases.
    const existing = await db
      .select({ id: leases.id })
      .from(leases)
      .where(
        and(
          eq(leases.tenantId, id),
          eq(leases.organizationId, session.organizationId),
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      return {
        ok: false,
        error:
          "This tenant has leases on record. Remove or reassign the leases before deleting the tenant.",
      };
    }
    try {
      await db
        .delete(tenants)
        .where(
          and(
            eq(tenants.id, id),
            eq(tenants.organizationId, session.organizationId),
          ),
        );
    } catch {
      return {
        ok: false,
        error: "Could not delete this tenant. They may have related records.",
      };
    }
    revalidate();
    return { ok: true };
  });
}
