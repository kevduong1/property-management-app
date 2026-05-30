/** Formatting helpers for currency, dates, and numbers. */
import { format, isValid, parseISO } from 'date-fns';

/** Parse a numeric/string money value into a number (Drizzle returns strings). */
export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value: string | number | null | undefined): string {
  return currencyFmt.format(toNumber(value));
}

/** Compact currency for tight card layouts, e.g. $12.3k */
export function formatCurrencyCompact(value: string | number | null | undefined): string {
  const n = toNumber(value);
  if (Math.abs(n) >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(n);
  }
  return formatCurrency(n);
}

export function formatDate(
  value: string | Date | null | undefined,
  pattern = 'MMM d, yyyy',
): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? parseISO(value) : value;
  return isValid(d) ? format(d, pattern) : '—';
}

export function formatPercent(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/** Today's date as an ISO `yyyy-MM-dd` string. */
export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}
