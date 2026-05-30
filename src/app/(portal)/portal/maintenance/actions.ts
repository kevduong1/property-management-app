"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { maintenanceRequests } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { runAction, type ActionResult } from "@/lib/action-result";
import { getTenantOverview } from "@/lib/tenant-portal";

const schema = z.object({
  title: z.string().trim().min(1, "Title is required."),
  description: z.string().trim().optional(),
  priority: z
    .enum(["low", "medium", "high", "emergency"])
    .default("medium"),
});

export async function submitMaintenanceRequest(
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireSession();

    // Only tenant role can submit via this action.
    if (session.role !== "tenant") {
      return { ok: false, error: "Only tenants can submit maintenance requests via the portal." };
    }
    if (!session.tenantId) {
      return { ok: false, error: "No tenant record linked to your account." };
    }

    const data = schema.parse(Object.fromEntries(formData));

    // Derive location from the tenant's primary (most recent active) lease.
    const overview = await getTenantOverview(
      session.tenantId,
      session.organizationId,
    );

    const lease = overview.primaryLease;
    if (!lease) {
      return {
        ok: false,
        error:
          "No active lease found. Please contact your property manager.",
      };
    }

    const [row] = await db
      .insert(maintenanceRequests)
      .values({
        organizationId: session.organizationId,
        childSeriesId: lease.childSeriesId,
        propertyId: lease.unit.propertyId,
        unitId: lease.unitId,
        tenantId: session.tenantId,
        title: data.title,
        description: data.description ?? null,
        priority: data.priority,
        status: "open",
      })
      .returning();

    revalidatePath("/portal/maintenance");
    return { ok: true, id: row.id };
  });
}
