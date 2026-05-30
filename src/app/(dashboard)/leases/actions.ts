"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { leases, units } from "@/db/schema";
import { requirePermission } from "@/lib/guards";
import { parseDollarsToCents } from "@/lib/money";
import { runAction, type ActionResult } from "@/lib/action-result";

const schema = z.object({
  tenantId: z.string().uuid("Tenant is required."),
  unitId: z.string().uuid("Unit is required."),
  startDate: z.string().min(1, "Start date is required."),
  endDate: z.string().optional(),
  monthlyRent: z.string().min(1, "Monthly rent is required."),
  securityDeposit: z.string().default("0"),
  status: z.enum(["active", "expired", "upcoming", "month_to_month", "terminated"]).default("active"),
  notes: z.string().trim().optional(),
});

async function deriveChildSeriesId(
  unitId: string,
  organizationId: string,
): Promise<string | null> {
  const [unit] = await db
    .select({ childSeriesId: units.childSeriesId })
    .from(units)
    .where(and(eq(units.id, unitId), eq(units.organizationId, organizationId)))
    .limit(1);
  return unit?.childSeriesId ?? null;
}

function revalidate() {
  revalidatePath("/leases");
  revalidatePath("/tenants");
  revalidatePath("/dashboard");
}

export async function createLease(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePermission("lease", "create");
    const raw = Object.fromEntries(formData);
    const data = schema.parse(raw);

    const childSeriesId = await deriveChildSeriesId(
      data.unitId,
      session.organizationId,
    );
    if (!childSeriesId) {
      return { ok: false, error: "Could not find the series for the selected unit." };
    }

    const monthlyRentCents = parseDollarsToCents(data.monthlyRent);
    const securityDepositCents = parseDollarsToCents(data.securityDeposit);
    const endDate = data.endDate?.trim() ? data.endDate.trim() : null;

    const [row] = await db
      .insert(leases)
      .values({
        organizationId: session.organizationId,
        tenantId: data.tenantId,
        unitId: data.unitId,
        childSeriesId,
        startDate: data.startDate,
        endDate,
        monthlyRentCents,
        securityDepositCents,
        status: data.status,
        notes: data.notes || null,
      })
      .returning();

    revalidate();
    return { ok: true, id: row.id };
  });
}

export async function updateLease(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePermission("lease", "edit");
    const id = String(formData.get("id") ?? "");
    if (!id) return { ok: false, error: "Missing id." };

    const raw = Object.fromEntries(formData);
    const data = schema.parse(raw);

    const childSeriesId = await deriveChildSeriesId(
      data.unitId,
      session.organizationId,
    );
    if (!childSeriesId) {
      return { ok: false, error: "Could not find the series for the selected unit." };
    }

    const monthlyRentCents = parseDollarsToCents(data.monthlyRent);
    const securityDepositCents = parseDollarsToCents(data.securityDeposit);
    const endDate = data.endDate?.trim() ? data.endDate.trim() : null;

    await db
      .update(leases)
      .set({
        tenantId: data.tenantId,
        unitId: data.unitId,
        childSeriesId,
        startDate: data.startDate,
        endDate,
        monthlyRentCents,
        securityDepositCents,
        status: data.status,
        notes: data.notes || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(leases.id, id),
          eq(leases.organizationId, session.organizationId),
        ),
      );

    revalidate();
    revalidatePath(`/leases/${id}`);
    return { ok: true, id };
  });
}

export async function deleteLease(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePermission("lease", "delete");
    // Rent charges have onDelete: set null on leaseId so they are retained.
    await db
      .delete(leases)
      .where(
        and(
          eq(leases.id, id),
          eq(leases.organizationId, session.organizationId),
        ),
      );
    revalidate();
    return { ok: true };
  });
}
