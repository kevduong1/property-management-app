"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { maintenanceRequests, properties } from "@/db/schema";
import { requirePermission } from "@/lib/guards";
import { runAction, type ActionResult } from "@/lib/action-result";

const PRIORITY_VALUES = ["low", "medium", "high", "emergency"] as const;
const STATUS_VALUES = ["open", "in_progress", "completed", "canceled"] as const;

const schema = z.object({
  propertyId: z.string().min(1, "Property is required."),
  unitId: z.string().optional(),
  tenantId: z.string().optional(),
  title: z.string().trim().min(1, "Title is required."),
  description: z.string().trim().optional(),
  priority: z.enum(PRIORITY_VALUES).default("medium"),
  status: z.enum(STATUS_VALUES).default("open"),
  resolutionNotes: z.string().trim().optional(),
});

/** Look up the childSeriesId for a given property (org-scoped). */
async function resolveSeriesId(
  orgId: string,
  propertyId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ childSeriesId: properties.childSeriesId })
    .from(properties)
    .where(
      and(
        eq(properties.id, propertyId),
        eq(properties.organizationId, orgId),
      ),
    )
    .limit(1);
  return row?.childSeriesId ?? null;
}

function revalidate() {
  revalidatePath("/maintenance");
  revalidatePath("/dashboard");
}

export async function createMaintenanceRequest(
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePermission("maintenance", "create");
    const raw = Object.fromEntries(formData);
    const data = schema.parse(raw);

    const childSeriesId = await resolveSeriesId(
      session.organizationId,
      data.propertyId,
    );
    if (!childSeriesId) {
      return { ok: false, error: "Property not found or not in your organization." };
    }

    const [row] = await db
      .insert(maintenanceRequests)
      .values({
        organizationId: session.organizationId,
        childSeriesId,
        propertyId: data.propertyId,
        unitId: data.unitId || null,
        tenantId: data.tenantId || null,
        title: data.title,
        description: data.description || null,
        priority: data.priority,
        status: data.status,
        resolutionNotes: data.resolutionNotes || null,
      })
      .returning();

    revalidate();
    return { ok: true, id: row.id };
  });
}

export async function updateMaintenanceRequest(
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePermission("maintenance", "edit");
    const id = String(formData.get("id") ?? "");
    if (!id) return { ok: false, error: "Missing id." };

    const raw = Object.fromEntries(formData);
    const data = schema.parse(raw);

    const childSeriesId = await resolveSeriesId(
      session.organizationId,
      data.propertyId,
    );
    if (!childSeriesId) {
      return { ok: false, error: "Property not found or not in your organization." };
    }

    await db
      .update(maintenanceRequests)
      .set({
        childSeriesId,
        propertyId: data.propertyId,
        unitId: data.unitId || null,
        tenantId: data.tenantId || null,
        title: data.title,
        description: data.description || null,
        priority: data.priority,
        status: data.status,
        resolutionNotes: data.resolutionNotes || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(maintenanceRequests.id, id),
          eq(maintenanceRequests.organizationId, session.organizationId),
        ),
      );

    revalidate();
    return { ok: true, id };
  });
}

export async function deleteMaintenanceRequest(
  id: string,
): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePermission("maintenance", "delete");
    await db
      .delete(maintenanceRequests)
      .where(
        and(
          eq(maintenanceRequests.id, id),
          eq(maintenanceRequests.organizationId, session.organizationId),
        ),
      );
    revalidate();
    return { ok: true };
  });
}
