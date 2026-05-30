/**
 * Money helpers. We store every amount as integer cents in the database and
 * only convert at the UI/IO boundary.
 */

/** Format integer cents as USD, e.g. 123456 -> "$1,234.56". */
export function formatCents(
  cents: number | null | undefined,
  opts: { showCents?: boolean } = {},
): string {
  const value = (cents ?? 0) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: opts.showCents === false ? 0 : 2,
    maximumFractionDigits: opts.showCents === false ? 0 : 2,
  }).format(value);
}

/** Parse a user-entered dollar string (e.g. "1,234.56" or "1234") to cents. */
export function parseDollarsToCents(input: string | number): number {
  if (typeof input === "number") return Math.round(input * 100);
  const cleaned = input.replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return 0;
  return Math.round(parseFloat(cleaned) * 100);
}

/** Cents -> a plain dollar number (for form default values / inputs). */
export function centsToDollars(cents: number | null | undefined): number {
  return (cents ?? 0) / 100;
}

export function sumCents(values: Array<number | null | undefined>): number {
  return values.reduce<number>((acc, v) => acc + (v ?? 0), 0);
}
