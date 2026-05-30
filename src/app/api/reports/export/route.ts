import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getDashboardMetrics,
  getEnrichedCharges,
  getExpenseByCategory,
  getSeriesSummaries,
  type FinancialFilter,
} from "@/lib/metrics";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/date";
import { expenseCategoryLabels, rentStatusLabels } from "@/lib/labels";
import { db } from "@/db";
import { childSeries, securityDeposits, tenants, units, properties } from "@/db/schema";
import { and, eq } from "drizzle-orm";

/** Escape a CSV cell value: wrap in quotes if it contains comma, quote, or newline. */
function csvCell(value: string | number | null | undefined): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(cells: Array<string | number | null | undefined>): string {
  return cells.map(csvCell).join(",");
}

function csvFromRows(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): string {
  return [headers.join(","), ...rows.map(csvRow)].join("\n");
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const orgId = session.organizationId;
  const { searchParams } = req.nextUrl;
  const report = searchParams.get("report") ?? "pl";
  const seriesId = searchParams.get("series") ?? null;
  const propertyId = searchParams.get("property") ?? null;
  const from = searchParams.get("from") ?? null;
  const to = searchParams.get("to") ?? null;

  const filter: FinancialFilter = { seriesId, propertyId, from, to };

  let csvContent = "";
  let filename = report;

  switch (report) {
    case "pl": {
      const summaries = await getSeriesSummaries(orgId, filter);
      const totalIncome = summaries.reduce((s, r) => s + r.incomeCents, 0);
      const totalExpenses = summaries.reduce((s, r) => s + r.expensesCents, 0);
      const totalNet = summaries.reduce((s, r) => s + r.netCents, 0);
      const totalOutstanding = summaries.reduce(
        (s, r) => s + r.outstandingCents,
        0,
      );

      const dataRows = summaries.map((s) => [
        s.name,
        s.status,
        formatCents(s.incomeCents),
        formatCents(s.expensesCents),
        formatCents(s.netCents),
        formatCents(s.outstandingCents),
        s.propertyCount,
        s.unitCount,
      ]);
      dataRows.push([
        "TOTAL",
        "",
        formatCents(totalIncome),
        formatCents(totalExpenses),
        formatCents(totalNet),
        formatCents(totalOutstanding),
        "",
        "",
      ]);

      csvContent = csvFromRows(
        [
          "Series",
          "Status",
          "Income",
          "Expenses",
          "Net",
          "Outstanding",
          "Properties",
          "Units",
        ],
        dataRows,
      );
      filename = "pl-by-series";
      break;
    }

    case "income": {
      const summaries = await getSeriesSummaries(orgId, filter);
      const dataRows = summaries.map((s) => [
        s.name,
        formatCents(s.incomeCents),
        formatCents(s.outstandingCents),
      ]);
      dataRows.push([
        "TOTAL",
        formatCents(summaries.reduce((s, r) => s + r.incomeCents, 0)),
        formatCents(summaries.reduce((s, r) => s + r.outstandingCents, 0)),
      ]);
      csvContent = csvFromRows(
        ["Series", "Rent Collected", "Outstanding"],
        dataRows,
      );
      filename = "income-summary";
      break;
    }

    case "expenses": {
      const summaries = await getSeriesSummaries(orgId, filter);
      const dataRows = summaries.map((s) => [
        s.name,
        formatCents(s.expensesCents),
        formatCents(s.netCents),
      ]);
      dataRows.push([
        "TOTAL",
        formatCents(summaries.reduce((s, r) => s + r.expensesCents, 0)),
        formatCents(summaries.reduce((s, r) => s + r.netCents, 0)),
      ]);
      csvContent = csvFromRows(
        ["Series", "Expenses", "Net Income"],
        dataRows,
      );
      filename = "expense-summary";
      break;
    }

    case "expense-category": {
      const byCategory = await getExpenseByCategory(orgId, filter);
      const totalCents = byCategory.reduce((s, c) => s + c.totalCents, 0);
      const dataRows = byCategory.map((c) => {
        const pct =
          totalCents > 0
            ? ((c.totalCents / totalCents) * 100).toFixed(1) + "%"
            : "0%";
        return [expenseCategoryLabels[c.kind], c.count, formatCents(c.totalCents), pct];
      });
      dataRows.push([
        "TOTAL",
        byCategory.reduce((s, c) => s + c.count, 0),
        formatCents(totalCents),
        "100%",
      ]);
      csvContent = csvFromRows(
        ["Category", "Count", "Total", "% of Total"],
        dataRows,
      );
      filename = "expenses-by-category";
      break;
    }

    case "rent-roll": {
      const charges = await getEnrichedCharges(orgId, filter);

      // Build lookup maps
      const [allTenants, allUnits, allProperties, allSeries] = await Promise.all([
        db
          .select({ id: tenants.id, name: tenants.fullName })
          .from(tenants)
          .where(eq(tenants.organizationId, orgId)),
        db
          .select({
            id: units.id,
            label: units.label,
            propertyId: units.propertyId,
          })
          .from(units)
          .where(eq(units.organizationId, orgId)),
        db
          .select({ id: properties.id, name: properties.name })
          .from(properties)
          .where(eq(properties.organizationId, orgId)),
        db
          .select({ id: childSeries.id, name: childSeries.name })
          .from(childSeries)
          .where(eq(childSeries.organizationId, orgId)),
      ]);

      const tenantById = new Map(allTenants.map((t) => [t.id, t.name]));
      const propertyById = new Map(allProperties.map((p) => [p.id, p.name]));
      const unitById = new Map(
        allUnits.map((u) => [
          u.id,
          `${propertyById.get(u.propertyId) ?? ""} — ${u.label}`,
        ]),
      );
      const seriesById = new Map(allSeries.map((s) => [s.id, s.name]));

      const dataRows = charges.map((c) => [
        tenantById.get(c.tenantId) ?? c.tenantId,
        unitById.get(c.unitId) ?? c.unitId,
        seriesById.get(c.childSeriesId) ?? c.childSeriesId,
        formatDate(c.dueDate),
        formatCents(c.totalDueCents),
        formatCents(c.paidCents),
        formatCents(c.balanceCents),
        rentStatusLabels[c.computedStatus] ?? c.computedStatus,
      ]);

      csvContent = csvFromRows(
        [
          "Tenant",
          "Unit",
          "Series",
          "Due Date",
          "Rent Due",
          "Paid",
          "Balance",
          "Status",
        ],
        dataRows,
      );
      filename = "rent-roll";
      break;
    }

    case "tenant-balance": {
      const charges = await getEnrichedCharges(orgId, filter);

      const allTenants = await db
        .select({ id: tenants.id, name: tenants.fullName })
        .from(tenants)
        .where(eq(tenants.organizationId, orgId));
      const tenantById = new Map(allTenants.map((t) => [t.id, t.name]));

      const tenantMap = new Map<
        string,
        { name: string; billed: number; paid: number; balance: number }
      >();
      for (const c of charges) {
        const cur = tenantMap.get(c.tenantId) ?? {
          name: tenantById.get(c.tenantId) ?? c.tenantId,
          billed: 0,
          paid: 0,
          balance: 0,
        };
        cur.billed += c.totalDueCents;
        cur.paid += c.paidCents;
        cur.balance += c.balanceCents;
        tenantMap.set(c.tenantId, cur);
      }

      const entries = [...tenantMap.values()];
      const dataRows = entries.map((t) => [
        t.name,
        formatCents(t.billed),
        formatCents(t.paid),
        formatCents(t.balance),
      ]);
      dataRows.push([
        "TOTAL",
        formatCents(entries.reduce((s, t) => s + t.billed, 0)),
        formatCents(entries.reduce((s, t) => s + t.paid, 0)),
        formatCents(entries.reduce((s, t) => s + t.balance, 0)),
      ]);

      csvContent = csvFromRows(
        ["Tenant", "Total Billed", "Total Paid", "Balance"],
        dataRows,
      );
      filename = "tenant-balance";
      break;
    }

    case "deposits": {
      const depConds = [eq(securityDeposits.organizationId, orgId)];
      if (seriesId) depConds.push(eq(securityDeposits.childSeriesId, seriesId));
      const deposits = await db
        .select()
        .from(securityDeposits)
        .where(and(...depConds));

      const [allTenants, allSeries] = await Promise.all([
        db
          .select({ id: tenants.id, name: tenants.fullName })
          .from(tenants)
          .where(eq(tenants.organizationId, orgId)),
        db
          .select({ id: childSeries.id, name: childSeries.name })
          .from(childSeries)
          .where(eq(childSeries.organizationId, orgId)),
      ]);
      const tenantById = new Map(allTenants.map((t) => [t.id, t.name]));
      const seriesById = new Map(allSeries.map((s) => [s.id, s.name]));

      const dataRows = deposits.map((d) => [
        tenantById.get(d.tenantId) ?? d.tenantId,
        seriesById.get(d.childSeriesId) ?? d.childSeriesId,
        formatDate(d.receivedDate),
        formatCents(d.amountCents),
        formatCents(d.refundAmountCents),
        formatCents(d.amountCents - d.refundAmountCents),
        formatDate(d.refundDate),
      ]);
      const totalHeld = deposits.reduce(
        (s, d) => s + (d.amountCents - d.refundAmountCents),
        0,
      );
      dataRows.push([
        "TOTAL",
        "",
        "",
        formatCents(deposits.reduce((s, d) => s + d.amountCents, 0)),
        formatCents(deposits.reduce((s, d) => s + d.refundAmountCents, 0)),
        formatCents(totalHeld),
        "",
      ]);

      csvContent = csvFromRows(
        [
          "Tenant",
          "Series",
          "Received Date",
          "Amount",
          "Refunded",
          "Net Held",
          "Refund Date",
        ],
        dataRows,
      );
      filename = "security-deposits";
      break;
    }

    case "property": {
      // Property-level income & expense report.
      const propConds = [eq(properties.organizationId, orgId)];
      if (seriesId) propConds.push(eq(properties.childSeriesId, seriesId));
      if (propertyId) propConds.push(eq(properties.id, propertyId));
      const props = await db
        .select({
          id: properties.id,
          name: properties.name,
          seriesId: properties.childSeriesId,
        })
        .from(properties)
        .where(and(...propConds));

      const seriesRows = await db
        .select({ id: childSeries.id, name: childSeries.name })
        .from(childSeries)
        .where(eq(childSeries.organizationId, orgId));
      const seriesById = new Map(seriesRows.map((s) => [s.id, s.name]));

      let totIncome = 0;
      let totExpense = 0;
      const dataRows: Array<Array<string | number>> = [];
      for (const p of props) {
        const m = await getDashboardMetrics(orgId, {
          ...filter,
          propertyId: p.id,
        });
        totIncome += m.rentCollectedCents;
        totExpense += m.expensesCents;
        dataRows.push([
          p.name,
          seriesById.get(p.seriesId) ?? p.seriesId,
          formatCents(m.rentCollectedCents),
          formatCents(m.expensesCents),
          formatCents(m.netIncomeCents),
          formatCents(m.outstandingCents),
        ]);
      }
      dataRows.push([
        "TOTAL",
        "",
        formatCents(totIncome),
        formatCents(totExpense),
        formatCents(totIncome - totExpense),
        "",
      ]);
      csvContent = csvFromRows(
        ["Property", "Series", "Income", "Expenses", "Net", "Outstanding"],
        dataRows,
      );
      filename = "property-income-expense";
      break;
    }

    default: {
      return new NextResponse(`Unknown report: ${report}`, { status: 400 });
    }
  }

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
    },
  });
}
