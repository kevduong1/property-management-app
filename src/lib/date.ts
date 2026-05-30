import { format, isValid, parseISO } from "date-fns";

/** Format a YYYY-MM-DD date string (or Date) for display, e.g. "May 30, 2026". */
export function formatDate(
  value: string | Date | null | undefined,
  pattern = "MMM d, yyyy",
): string {
  if (!value) return "—";
  const d = typeof value === "string" ? parseISO(value) : value;
  if (!isValid(d)) return "—";
  return format(d, pattern);
}

/** Today's date as a YYYY-MM-DD string (suitable for `date` columns). */
export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/** First day of the current month as YYYY-MM-DD. */
export function startOfMonthISO(d = new Date()): string {
  return format(new Date(d.getFullYear(), d.getMonth(), 1), "yyyy-MM-dd");
}

export function isPast(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const d = parseISO(dateStr);
  if (!isValid(d)) return false;
  // Compare date-only (ignore time of day).
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}
