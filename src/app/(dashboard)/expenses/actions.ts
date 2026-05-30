"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { expenseCategories, expenses } from "@/db/schema";
import { requirePermission } from "@/lib/guards";
import { parseDollarsToCents } from "@/lib/money";
import { runAction, type ActionResult } from "@/lib/action-result";
import { todayISO } from "@/lib/date";

const CATEGORY_KINDS = [
  "repairs",
  "utilities",
  "insurance",
  "property_taxes",
  "mortgage",
  "legal",
  "accounting",
  "supplies",
  "capital_improvements",
  "other",
] as const;

const schema = z.object({
  childSeriesId: z.string().min(1, "Series is required."),
  propertyId: z.string().optional(),
  unitId: z.string().optional(),
  vendorId: z.string().optional(),
  categoryKind: z.enum(CATEGORY_KINDS),
  amount: z.string().min(1, "Amount is required."),
  incurredDate: z.string().min(1, "Date is required."),
  description: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

/** Try to find a matching expenseCategories row for the org+kind. */
async function resolveCategoryId(
  orgId: string,
  kind: (typeof CATEGORY_KINDS)[number],
): Promise<string | null> {
  const [row] = await db
    .select({ id: expenseCategories.id })
    .from(expenseCategories)
    .where(
      and(
        eq(expenseCategories.organizationId, orgId),
        eq(expenseCategories.kind, kind),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

function revalidate() {
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
}

export async function createExpense(
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePermission("expense", "create");
    const raw = Object.fromEntries(formData);
    const data = schema.parse(raw);

    const amountCents = parseDollarsToCents(data.amount);
    const categoryId = await resolveCategoryId(
      session.organizationId,
      data.categoryKind,
    );

    const [row] = await db
      .insert(expenses)
      .values({
        organizationId: session.organizationId,
        childSeriesId: data.childSeriesId,
        propertyId: data.propertyId || null,
        unitId: data.unitId || null,
        vendorId: data.vendorId || null,
        categoryId,
        categoryKind: data.categoryKind,
        amountCents,
        incurredDate: data.incurredDate,
        description: data.description || null,
        notes: data.notes || null,
      })
      .returning();

    revalidate();
    return { ok: true, id: row.id };
  });
}

export async function updateExpense(
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePermission("expense", "edit");
    const id = String(formData.get("id") ?? "");
    if (!id) return { ok: false, error: "Missing id." };

    const raw = Object.fromEntries(formData);
    const data = schema.parse(raw);

    const amountCents = parseDollarsToCents(data.amount);
    const categoryId = await resolveCategoryId(
      session.organizationId,
      data.categoryKind,
    );

    await db
      .update(expenses)
      .set({
        childSeriesId: data.childSeriesId,
        propertyId: data.propertyId || null,
        unitId: data.unitId || null,
        vendorId: data.vendorId || null,
        categoryId,
        categoryKind: data.categoryKind,
        amountCents,
        incurredDate: data.incurredDate,
        description: data.description || null,
        notes: data.notes || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(expenses.id, id),
          eq(expenses.organizationId, session.organizationId),
        ),
      );

    revalidate();
    return { ok: true, id };
  });
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePermission("expense", "delete");
    await db
      .delete(expenses)
      .where(
        and(
          eq(expenses.id, id),
          eq(expenses.organizationId, session.organizationId),
        ),
      );
    revalidate();
    return { ok: true };
  });
}

// Re-export for use in page (default to today)
export { todayISO };
