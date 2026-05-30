/**
 * File storage abstraction for documents. Swappable backend:
 * - STORAGE_MODE=local (default): writes to ./.uploads and serves via a route.
 * - STORAGE_MODE=supabase: uploads to a Supabase Storage bucket.
 *
 * For the MVP we primarily store document *metadata*; actual bytes are optional.
 * This abstraction is the single wiring point so payments/OCR/etc. can be added
 * later without touching feature code.
 */
import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const MODE = process.env.STORAGE_MODE ?? "local";
const LOCAL_DIR = path.join(process.cwd(), ".uploads");

export interface StoredFile {
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

/** Persist an uploaded File and return metadata to save on the document row. */
export async function storeFile(file: File): Promise<StoredFile> {
  const key = `${randomUUID()}-${file.name}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  if (MODE === "supabase") {
    const { getSupabaseServerClient } = await import("./supabase");
    const supabase = await getSupabaseServerClient();
    const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";
    await supabase.storage.from(bucket).upload(key, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  } else {
    await mkdir(LOCAL_DIR, { recursive: true });
    await writeFile(path.join(LOCAL_DIR, key), bytes);
  }

  return {
    storageKey: key,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: bytes.byteLength,
  };
}

export function isStorageConfigured() {
  return MODE === "local" || MODE === "supabase";
}
