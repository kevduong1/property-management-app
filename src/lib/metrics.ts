/**
 * Financial aggregation layer. Powers the dashboard cards and every report.
 *
 * All functions are organization-scoped and accept an optional filter so the
 * same logic serves "All series", a single child series, a property, etc.
 * Amounts are integer cents throughout. For MVP data volumes we load the
 * relevant rows and reduce in TypeScript, which keeps the per-charge status /
 * balance logic in one place (`@/lib/rent`).
 */
import "server-only";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  childSeries,
  expenses,
  properties,
  rentCharges,
  rentPayments,
  securityDeposits,
  units,
  type ExpenseCategoryKind,
} from "@/db/schema";
import { balanceCents, computeRentStatus } from "@/lib/rent";

export interface FinancialFilter {
  seriesId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  tenantId?: string | null;
  categoryKind?: ExpenseCategoryKind | null;
  from?: string | null; // YYYY-MM-DD inclusive
  to?: string | null; // YYYY-MM-DD inclusive
}

export interface DashboardMetrics {
  rentDueCents: number;
  rentCollectedCents: number;
  outstandingCents: number;
  lateCents: number;
  expensesCents: number;
  netIncomeCents: number;
  occupancyRate: number; // 0..1
  occupiedUnits: number;
  totalUnits: number;
  depositsHeldCents: number;
}

/* ----------------------------- shared loaders ---------------------------- */

async function loadCharges(orgId: string, f: FinancialFilter) {
  const conds = [eq(rentCharges.organizationId, orgId)];
  if (f.seriesId) conds.push(eq(rentCharges.childSeriesId, f.seriesId));
  if (f.propertyId) conds.push(eq(rentCharges.propertyId, f.propertyId));
  if (f.unitId) conds.push(eq(rentCharges.unitId, f.unitId));
  if (f.tenantId) conds.push(eq(rentCharges.tenantId, f.tenantId));
  if (f.from) conds.push(gte(rentCharges.dueDate, f.from));
  if (f.to) conds.push(lte(rentCharges.dueDate, f.to));

  const charges = await db
    .select()
    .from(rentCharges)
    .where(and(...conds));

  // Sum payments per charge.
  const ids = charges.map((c) => c.id);
  const payments = ids.length
    ? await db
        .select()
        .from(rentPayments)
        .where(inArray(rentPayments.rentChargeId, ids))
    : [];
  const paidByCharge = new Map<string, number>();
  for (const p of payments) {
    paidByCharge.set(
      p.rentChargeId,
      (paidByCharge.get(p.rentChargeId) ?? 0) + p.amountCents,
    );
  }

  return charges.map((c) => {
    const paidCents = paidByCharge.get(c.id) ?? 0;
    const totals = {
      rentAmountCents: c.rentAmountCents,
      lateFeeCents: c.lateFeeCents,
      dueDate: c.dueDate,
      paidCents,
    };
    return {
      ...c,
      paidCents,
      balanceCents: balanceCents(totals),
      computedStatus: computeRentStatus(totals),
      totalDueCents: c.rentAmountCents + c.lateFeeCents,
    };
  });
}

async function loadExpenses(orgId: string, f: FinancialFilter) {
  const conds = [eq(expenses.organizationId, orgId)];
  if (f.seriesId) conds.push(eq(expenses.childSeriesId, f.seriesId));
  if (f.propertyId) conds.push(eq(expenses.propertyId, f.propertyId));
  if (f.unitId) conds.push(eq(expenses.unitId, f.unitId));
  if (f.categoryKind) conds.push(eq(expenses.categoryKind, f.categoryKind));
  if (f.from) conds.push(gte(expenses.incurredDate, f.from));
  if (f.to) conds.push(lte(expenses.incurredDate, f.to));
  return db
    .select()
    .from(expenses)
    .where(and(...conds));
}

async function loadPayments(orgId: string, f: FinancialFilter) {
  const conds = [eq(rentPayments.organizationId, orgId)];
  if (f.seriesId) conds.push(eq(rentPayments.childSeriesId, f.seriesId));
  if (f.from) conds.push(gte(rentPayments.receivedDate, f.from));
  if (f.to) conds.push(lte(rentPayments.receivedDate, f.to));
  return db
    .select()
    .from(rentPayments)
    .where(and(...conds));
}

/* ----------------------------- public API -------------------------------- */

export async function getDashboardMetrics(
  orgId: string,
  f: FinancialFilter = {},
): Promise<DashboardMetrics> {
  const [charges, exp, pays] = await Promise.all([
    loadCharges(orgId, f),
    loadExpenses(orgId, f),
    loadPayments(orgId, f),
  ]);

  const rentDueCents = charges.reduce((s, c) => s + c.totalDueCents, 0);
  const rentCollectedCents = pays.reduce((s, p) => s + p.amountCents, 0);
  const outstandingCents = charges.reduce((s, c) => s + c.balanceCents, 0);
  const lateCents = charges
    .filter((c) => c.computedStatus === "late")
    .reduce((s, c) => s + c.balanceCents, 0);
  const expensesCents = exp.reduce((s, e) => s + e.amountCents, 0);

  // Occupancy (units in scope).
  const unitConds = [eq(units.organizationId, orgId)];
  if (f.seriesId) unitConds.push(eq(units.childSeriesId, f.seriesId));
  if (f.propertyId) unitConds.push(eq(units.propertyId, f.propertyId));
  const unitRows = await db
    .select({ status: units.occupancyStatus })
    .from(units)
    .where(and(...unitConds));
  const totalUnits = unitRows.length;
  const occupiedUnits = unitRows.filter(
    (u) => u.status === "occupied",
  ).length;

  // Deposits held = received - refunded.
  const depConds = [eq(securityDeposits.organizationId, orgId)];
  if (f.seriesId) depConds.push(eq(securityDeposits.childSeriesId, f.seriesId));
  const deps = await db
    .select()
    .from(securityDeposits)
    .where(and(...depConds));
  const depositsHeldCents = deps.reduce(
    (s, d) => s + (d.amountCents - d.refundAmountCents),
    0,
  );

  return {
    rentDueCents,
    rentCollectedCents,
    outstandingCents,
    lateCents,
    expensesCents,
    netIncomeCents: rentCollectedCents - expensesCents,
    occupancyRate: totalUnits ? occupiedUnits / totalUnits : 0,
    occupiedUnits,
    totalUnits,
    depositsHeldCents,
  };
}

export interface SeriesSummary {
  seriesId: string;
  name: string;
  status: string;
  propertyCount: number;
  unitCount: number;
  incomeCents: number;
  expensesCents: number;
  netCents: number;
  outstandingCents: number;
}

/** Per-child-series rollups for the Parent LLC overview. */
export async function getSeriesSummaries(
  orgId: string,
  f: FinancialFilter = {},
): Promise<SeriesSummary[]> {
  const seriesRows = await db
    .select()
    .from(childSeries)
    .where(eq(childSeries.organizationId, orgId));

  const result: SeriesSummary[] = [];
  for (const s of seriesRows) {
    const sf: FinancialFilter = { ...f, seriesId: s.id };
    const [charges, exp, pays] = await Promise.all([
      loadCharges(orgId, sf),
      loadExpenses(orgId, sf),
      loadPayments(orgId, sf),
    ]);
    const propCount = await db
      .select({ id: properties.id })
      .from(properties)
      .where(
        and(
          eq(properties.organizationId, orgId),
          eq(properties.childSeriesId, s.id),
        ),
      );
    const unitCount = await db
      .select({ id: units.id })
      .from(units)
      .where(
        and(eq(units.organizationId, orgId), eq(units.childSeriesId, s.id)),
      );

    const incomeCents = pays.reduce((acc, p) => acc + p.amountCents, 0);
    const expensesCents = exp.reduce((acc, e) => acc + e.amountCents, 0);
    result.push({
      seriesId: s.id,
      name: s.name,
      status: s.status,
      propertyCount: propCount.length,
      unitCount: unitCount.length,
      incomeCents,
      expensesCents,
      netCents: incomeCents - expensesCents,
      outstandingCents: charges.reduce((acc, c) => acc + c.balanceCents, 0),
    });
  }
  return result;
}

/** Expense totals grouped by category kind. */
export async function getExpenseByCategory(
  orgId: string,
  f: FinancialFilter = {},
): Promise<{ kind: ExpenseCategoryKind; totalCents: number; count: number }[]> {
  const exp = await loadExpenses(orgId, f);
  const map = new Map<ExpenseCategoryKind, { totalCents: number; count: number }>();
  for (const e of exp) {
    const cur = map.get(e.categoryKind) ?? { totalCents: 0, count: 0 };
    cur.totalCents += e.amountCents;
    cur.count += 1;
    map.set(e.categoryKind, cur);
  }
  return [...map.entries()]
    .map(([kind, v]) => ({ kind, ...v }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

/** Expose the enriched charge loader for the rent-roll & tenant balance reports. */
export async function getEnrichedCharges(orgId: string, f: FinancialFilter = {}) {
  return loadCharges(orgId, f);
}
