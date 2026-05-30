/**
 * "Current child series" context. The selected series is stored in a cookie and
 * used to scope every major page — making it obvious which series the user is
 * viewing (the core product requirement). `null` means "All series".
 */
import "server-only";
import { cookies } from "next/headers";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { childSeries, type ChildSeries } from "@/db/schema";

export const SERIES_COOKIE = "pm_series";

export interface SeriesContext {
  currentSeriesId: string | null; // null => all series
  current: ChildSeries | null;
  list: ChildSeries[];
}

export async function getSeriesContext(
  organizationId: string,
): Promise<SeriesContext> {
  const list = await db
    .select()
    .from(childSeries)
    .where(eq(childSeries.organizationId, organizationId))
    .orderBy(asc(childSeries.name));

  const cookieStore = await cookies();
  const raw = cookieStore.get(SERIES_COOKIE)?.value;
  const currentSeriesId =
    raw && raw !== "all" && list.some((s) => s.id === raw) ? raw : null;
  const current = currentSeriesId
    ? (list.find((s) => s.id === currentSeriesId) ?? null)
    : null;

  return { currentSeriesId, current, list };
}
