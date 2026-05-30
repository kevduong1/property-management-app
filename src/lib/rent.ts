/**
 * Rent-charge domain logic: derive paid/unpaid/partial/late status from the
 * charge totals + payments + due date. This is the single source of truth used
 * by both the rent-roll display and the server actions that persist `status`.
 */
import type { RentChargeStatus } from "@/db/schema";
import { isPast } from "./date";

export interface ChargeTotals {
  rentAmountCents: number;
  lateFeeCents: number;
  dueDate: string; // YYYY-MM-DD
  paidCents: number; // sum of payments applied
}

export function chargeTotalDueCents(c: {
  rentAmountCents: number;
  lateFeeCents: number;
}): number {
  return c.rentAmountCents + c.lateFeeCents;
}

/**
 * Compute the canonical status:
 * - paid:    payments >= total due
 * - partial: 0 < payments < total due
 * - late:    nothing/partial paid AND due date is in the past
 * - unpaid:  nothing paid and not yet past due
 */
export function computeRentStatus(t: ChargeTotals): RentChargeStatus {
  const totalDue = t.rentAmountCents + t.lateFeeCents;
  if (totalDue > 0 && t.paidCents >= totalDue) return "paid";
  if (t.paidCents > 0) {
    // Partial — but if also overdue, surface as late for attention.
    return isPast(t.dueDate) ? "late" : "partial";
  }
  if (isPast(t.dueDate)) return "late";
  return "unpaid";
}

export function balanceCents(t: ChargeTotals): number {
  return Math.max(0, t.rentAmountCents + t.lateFeeCents - t.paidCents);
}
