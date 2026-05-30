"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { requirePermission } from "@/lib/guards";
import { storeFile } from "@/lib/storage";
import { runAction, type ActionResult } from "@/lib/action-result";

const documentTypeValues = [
  "lease",
  "receipt",
  "invoice",
  "insurance",
  "formation",
  "vendor_contract",
  "tenant_notice",
  "inspection_photo",
  "other",
] as const;

const entityTypeValues = [
  "parent_llc",
  "child_series",
  "property",
  "unit",
  "tenant",
  "lease",
  "rent_charge",
  "expense",
  "payment",
  "document",
  "maintenance_request",
] as const;

const schema = z.object({
  title: z.string().trim().min(1, "Title is required."),
  type: z.enum(documentTypeValues),
  entityType: z.enum(entityTypeValues),
  entityId: z.string().trim().min(1, "Entity is required."),
  childSeriesId: z.string().trim().optional().transform((v) => v || null),
  sharedWithTenant: z.string().optional().transform((v) => v === "on"),
});

function revalidate() {
  revalidatePath("/documents");
  revalidatePath("/dashboard");
}

export async function createDocument(
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePermission("document", "create");

    const raw = Object.fromEntries(formData);
    const parsed = schema.parse(raw);

    // Handle optional file upload.
    const file = formData.get("file");
    let fileMetadata: {
      storageKey?: string | null;
      fileName?: string | null;
      mimeType?: string | null;
      sizeBytes?: number | null;
    } = {};

    if (file instanceof File && file.size > 0) {
      const stored = await storeFile(file);
      fileMetadata = {
        storageKey: stored.storageKey,
        fileName: stored.fileName,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
      };
    }

    const [row] = await db
      .insert(documents)
      .values({
        organizationId: session.organizationId,
        entityType: parsed.entityType,
        entityId: parsed.entityId,
        childSeriesId: parsed.childSeriesId ?? null,
        title: parsed.title,
        type: parsed.type,
        sharedWithTenant: parsed.sharedWithTenant,
        uploadedByUserId: session.userId,
        ...fileMetadata,
      })
      .returning();

    revalidate();
    return { ok: true, id: row.id };
  });
}

export async function deleteDocument(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePermission("document", "delete");
    await db
      .delete(documents)
      .where(
        and(
          eq(documents.id, id),
          eq(documents.organizationId, session.organizationId),
        ),
      );
    revalidate();
    return { ok: true };
  });
}
