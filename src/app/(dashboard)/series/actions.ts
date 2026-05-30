"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { childSeries } from "@/db/schema";
import { requirePermission } from "@/lib/guards";
import { getPrimaryParentLlc } from "@/lib/lookups";
import { runAction, type ActionResult } from "@/lib/action-result";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  description: z.string().trim().optional(),
  status: z.enum(["active", "inactive", "dissolved"]).default("active"),
  ein: z.string().trim().optional(),
  bankAccountNickname: z.string().trim().optional(),
});

function revalidate() {
  revalidatePath("/series");
  revalidatePath("/parent-llc");
  revalidatePath("/dashboard");
}

export async function createSeries(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePermission("series", "create");
    const data = schema.parse(Object.fromEntries(formData));
    const parent = await getPrimaryParentLlc(session.organizationId);
    if (!parent) {
      return { ok: false, error: "Create a parent LLC first." };
    }
    const [row] = await db
      .insert(childSeries)
      .values({
        organizationId: session.organizationId,
        parentLlcId: parent.id,
        name: data.name,
        description: data.description || null,
        status: data.status,
        ein: data.ein || null,
        bankAccountNickname: data.bankAccountNickname || null,
      })
      .returning();
    revalidate();
    return { ok: true, id: row.id };
  });
}

export async function updateSeries(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePermission("series", "edit");
    const id = String(formData.get("id") ?? "");
    if (!id) return { ok: false, error: "Missing id." };
    const data = schema.parse(Object.fromEntries(formData));
    await db
      .update(childSeries)
      .set({
        name: data.name,
        description: data.description || null,
        status: data.status,
        ein: data.ein || null,
        bankAccountNickname: data.bankAccountNickname || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(childSeries.id, id),
          eq(childSeries.organizationId, session.organizationId),
        ),
      );
    revalidate();
    revalidatePath(`/series/${id}`);
    return { ok: true, id };
  });
}

export async function deleteSeries(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePermission("series", "delete");
    try {
      await db
        .delete(childSeries)
        .where(
          and(
            eq(childSeries.id, id),
            eq(childSeries.organizationId, session.organizationId),
          ),
        );
    } catch {
      return {
        ok: false,
        error:
          "Can't delete a series that still has properties. Move or remove them first.",
      };
    }
    revalidate();
    return { ok: true };
  });
}
