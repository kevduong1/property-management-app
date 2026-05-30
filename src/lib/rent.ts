/**
 * Rent status & balance computation. Status is derived from due date and
 * payment totals (spec section 5): paid / partially_paid / unpaid / late.
 */
import { toNumber } from './format';
import type { RentCharge, RentChargeStatus, RentPayment } from '@/types';

export function chargeTotal(charge: Pick<RentCharge, 'rentAmount' | 'lateFeeAmount'>): number {
  return toNumber(charge.rentAmount) + toNumber(charge.lateFeeAmount);
}

export function paidForCharge(chargeId: string, payments: RentPayment[]): number {
  return payments
    .filter((p) => p.rentChargeId === chargeId)
    .reduce((sum, p) => sum + toNumber(p.amount), 0);
}

/**
 * Derive a rent charge's status from its total owed, amount paid, and due date.
 * `asOf` defaults to today.
 */
export function computeChargeStatus(
  charge: Pick<RentCharge, 'rentAmount' | 'lateFeeAmount' | 'dueDate'>,
  paid: number,
  asOf: Date = new Date(),
): RentChargeStatus {
  const total = chargeTotal(charge);
  if (total > 0 && paid >= total) return 'paid';
  const due = new Date(charge.dueDate);
  const isPastDue = asOf > due;
  if (paid > 0 && paid < total) return 'partially_paid';
  // No payment yet.
  return isPastDue ? 'late' : 'unpaid';
}

export interface ChargeComputation {
  total: number;
  paid: number;
  balance: number;
  status: RentChargeStatus;
}

export function computeCharge(
  charge: Pick<RentCharge, 'id' | 'rentAmount' | 'lateFeeAmount' | 'dueDate'>,
  payments: RentPayment[],
  asOf: Date = new Date(),
): ChargeComputation {
  const total = chargeTotal(charge);
  const paid = paidForCharge(charge.id, payments);
  return {
    total,
    paid,
    balance: Math.max(total - paid, 0),
    status: computeChargeStatus(charge, paid, asOf),
  };
}

/** Outstanding balance for a tenant across all their charges. */
export function tenantBalance(
  charges: RentCharge[],
  payments: RentPayment[],
  tenantId: string,
): number {
  return charges
    .filter((c) => c.tenantId === tenantId)
    .reduce((sum, c) => sum + computeCharge(c, payments).balance, 0);
}
