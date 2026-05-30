"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sum } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  leases,
  rentCharges,
  rentPayments,
  securityDeposits,
  units,
} from "@/db/schema";
import { requirePermission } from "@/lib/guards";
import { runAction, type ActionResult } from "@/lib/action-result";
import { parseDollarsToCents } from "@/lib/money";
import { computeRentStatus } from "@/lib/rent";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function revalidateRent() {
  revalidatePath("/rent");
  revalidatePath("/dashboard");
}

/**
 * Recompute and persist the stored `status` for a rent charge by summing its
 * payments. Called after any write that affects a charge's balance.
 */
async function recalcChargeStatus(chargeId: string): Promise<void> {
  const [charge] = await db
    .select()
    .from(rentCharges)
    .where(eq(rentCharges.id, chargeId))
    .limit(1);
  if (!charge) return;

  const [agg] = await db
    .select({ total: sum(rentPayments.amountCents) })
    .from(rentPayments)
    .where(eq(rentPayments.rentChargeId, chargeId));

  const paidCents = Number(agg?.total ?? 0);
  const status = computeRentStatus({
    rentAmountCents: charge.rentAmountCents,
    lateFeeCents: charge.lateFeeCents,
    dueDate: charge.dueDate,
    paidCents,
  });

  await db
    .update(rentCharges)
    .set({ status, updatedAt: new Date() })
    .where(eq(rentCharges.id, chargeId));
}

/* -------------------------------------------------------------------------- */
/* Rent charges                                                                */
/* -------------------------------------------------------------------------- */

const rentChargeSchema = z.object({
  unitId: z.string().min(1, "Unit is required."),
  tenantId: z.string().min(1, "Tenant is required."),
  leaseId: z.string().optional(),
  dueDate: z.string().min(1, "Due date is required."),
  rentAmount: z.string().min(1, "Rent amount is required."),
  lateFee: z.string().optional(),
  notes: z.string().optional(),
});

export async function createRentCharge(
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePermission("rent", "create");

    const raw = Object.fromEntries(formData);
    const data = rentChargeSchema.parse(raw);

    // Look up the unit to derive childSeriesId and propertyId.
    const [unitRow] = await db
      .select()
      .from(units)
      .where(
        and(
          eq(units.id, data.unitId),
          eq(units.organizationId, session.organizationId),
        ),
      )
      .limit(1);

    if (!unitRow) return { ok: false, error: "Unit not found." };

    // Optionally find an active lease for this unit+tenant.
    let resolvedLeaseId: string | null = data.leaseId || null;
    if (!resolvedLeaseId) {
      const [activeLease] = await db
        .select({ id: leases.id })
        .from(leases)
        .where(
          and(
            eq(leases.organizationId, session.organizationId),
            eq(leases.unitId, data.unitId),
            eq(leases.tenantId, data.tenantId),
            inArray(leases.status, ["active", "month_to_month"]),
          ),
        )
        .limit(1);
      resolvedLeaseId = activeLease?.id ?? null;
    }

    const rentAmountCents = parseDollarsToCents(data.rentAmount);
    const lateFeeCents = data.lateFee ? parseDollarsToCents(data.lateFee) : 0;

    const status = computeRentStatus({
      rentAmountCents,
      lateFeeCents,
      dueDate: data.dueDate,
      paidCents: 0,
    });

    const [row] = await db
      .insert(rentCharges)
      .values({
        organizationId: session.organizationId,
        childSeriesId: unitRow.childSeriesId,
        propertyId: unitRow.propertyId,
        unitId: data.unitId,
        tenantId: data.tenantId,
        leaseId: resolvedLeaseId || null,
        dueDate: data.dueDate,
        rentAmountCents,
        lateFeeCents,
        status,
        notes: data.notes || null,
      })
      .returning();

    revalidateRent();
    return { ok: true, id: row.id };
  });
}

export async function updateRentCharge(
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePermission("rent", "edit");
    const id = String(formData.get("id") ?? "");
    if (!id) return { ok: false, error: "Missing id." };

    const raw = Object.fromEntries(formData);
    const data = rentChargeSchema.parse(raw);

    const rentAmountCents = parseDollarsToCents(data.rentAmount);
    const lateFeeCents = data.lateFee ? parseDollarsToCents(data.lateFee) : 0;

    await db
      .update(rentCharges)
      .set({
        dueDate: data.dueDate,
        rentAmountCents,
        lateFeeCents,
        notes: data.notes || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(rentCharges.id, id),
          eq(rentCharges.organizationId, session.organizationId),
        ),
      );

    // Recompute status after amount/fee change.
    await recalcChargeStatus(id);

    revalidateRent();
    return { ok: true, id };
  });
}

export async function deleteRentCharge(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePermission("rent", "delete");
    try {
      await db
        .delete(rentCharges)
        .where(
          and(
            eq(rentCharges.id, id),
            eq(rentCharges.organizationId, session.organizationId),
          ),
        );
    } catch {
      return {
        ok: false,
        error:
          "Cannot delete a charge that has payments. Delete payments first.",
      };
    }
    revalidateRent();
    return { ok: true };
  });
}

/* -------------------------------------------------------------------------- */
/* Rent payments                                                               */
/* -------------------------------------------------------------------------- */

const rentPaymentSchema = z.object({
  rentChargeId: z.string().min(1, "Charge is required."),
  amount: z.string().min(1, "Amount is required."),
  receivedDate: z.string().min(1, "Received date is required."),
  method: z.enum(["cash", "check", "ach", "card", "zelle", "venmo", "other"]),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export async function createRentPayment(
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePermission("rent", "create");

    const raw = Object.fromEntries(formData);
    const data = rentPaymentSchema.parse(raw);

    // Load the charge to get childSeriesId (and verify org ownership).
    const [charge] = await db
      .select()
      .from(rentCharges)
      .where(
        and(
          eq(rentCharges.id, data.rentChargeId),
          eq(rentCharges.organizationId, session.organizationId),
        ),
      )
      .limit(1);

    if (!charge) return { ok: false, error: "Charge not found." };

    const amountCents = parseDollarsToCents(data.amount);
    if (amountCents <= 0) return { ok: false, error: "Amount must be positive." };

    const [row] = await db
      .insert(rentPayments)
      .values({
        organizationId: session.organizationId,
        rentChargeId: data.rentChargeId,
        childSeriesId: charge.childSeriesId,
        amountCents,
        receivedDate: data.receivedDate,
        method: data.method,
        reference: data.reference || null,
        notes: data.notes || null,
      })
      .returning();

    // Recompute the parent charge status.
    await recalcChargeStatus(data.rentChargeId);

    revalidateRent();
    return { ok: true, id: row.id };
  });
}

export async function deleteRentPayment(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePermission("rent", "delete");

    // Find payment to get the charge id before deleting.
    const [payment] = await db
      .select()
      .from(rentPayments)
      .where(
        and(
          eq(rentPayments.id, id),
          eq(rentPayments.organizationId, session.organizationId),
        ),
      )
      .limit(1);

    if (!payment) return { ok: false, error: "Payment not found." };

    await db
      .delete(rentPayments)
      .where(
        and(
          eq(rentPayments.id, id),
          eq(rentPayments.organizationId, session.organizationId),
        ),
      );

    // Recompute status after payment removed.
    await recalcChargeStatus(payment.rentChargeId);

    revalidateRent();
    return { ok: true };
  });
}

/* -------------------------------------------------------------------------- */
/* Security deposits                                                           */
/* -------------------------------------------------------------------------- */

const depositSchema = z.object({
  childSeriesId: z.string().min(1, "Series is required."),
  tenantId: z.string().min(1, "Tenant is required."),
  leaseId: z.string().optional(),
  unitId: z.string().optional(),
  amount: z.string().min(1, "Amount is required."),
  receivedDate: z.string().optional(),
  refundAmount: z.string().optional(),
  refundDate: z.string().optional(),
  notes: z.string().optional(),
});

export async function createSecurityDeposit(
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePermission("deposit", "create");

    const raw = Object.fromEntries(formData);
    const data = depositSchema.parse(raw);

    const [row] = await db
      .insert(securityDeposits)
      .values({
        organizationId: session.organizationId,
        childSeriesId: data.childSeriesId,
        tenantId: data.tenantId,
        leaseId: data.leaseId || null,
        unitId: data.unitId || null,
        amountCents: parseDollarsToCents(data.amount),
        receivedDate: data.receivedDate || null,
        refundAmountCents: data.refundAmount
          ? parseDollarsToCents(data.refundAmount)
          : 0,
        refundDate: data.refundDate || null,
        notes: data.notes || null,
      })
      .returning();

    revalidateRent();
    return { ok: true, id: row.id };
  });
}

export async function updateSecurityDeposit(
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePermission("deposit", "edit");
    const id = String(formData.get("id") ?? "");
    if (!id) return { ok: false, error: "Missing id." };

    const raw = Object.fromEntries(formData);
    const data = depositSchema.parse(raw);

    await db
      .update(securityDeposits)
      .set({
        tenantId: data.tenantId,
        leaseId: data.leaseId || null,
        unitId: data.unitId || null,
        amountCents: parseDollarsToCents(data.amount),
        receivedDate: data.receivedDate || null,
        refundAmountCents: data.refundAmount
          ? parseDollarsToCents(data.refundAmount)
          : 0,
        refundDate: data.refundDate || null,
        notes: data.notes || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(securityDeposits.id, id),
          eq(securityDeposits.organizationId, session.organizationId),
        ),
      );

    revalidateRent();
    return { ok: true, id };
  });
}

export async function deleteSecurityDeposit(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePermission("deposit", "delete");
    await db
      .delete(securityDeposits)
      .where(
        and(
          eq(securityDeposits.id, id),
          eq(securityDeposits.organizationId, session.organizationId),
        ),
      );
    revalidateRent();
    return { ok: true };
  });
}
