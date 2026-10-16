import type { Currency, DecimalString } from '../api/types';

const LOCALE = 'en-IN';

/** Formats a decimal STRING for display. Intl.NumberFormat accepts decimal strings without float rounding. */
export function formatMoney(value: DecimalString, currency: Currency | string): string {
  try {
    return new Intl.NumberFormat(LOCALE, { style: 'currency', currency, maximumFractionDigits: 2, minimumFractionDigits: 0 })
      .format(value as unknown as number);
  } catch {
    return `${currency} ${value}`;
  }
}

/** Display-only compact form for chart axes/labels (converts to Number; never used for arithmetic). */
export function formatCompact(value: DecimalString | number, currency?: Currency | string): string {
  const n = typeof value === 'number' ? value : Number(value);
  return new Intl.NumberFormat(LOCALE, {
    notation: 'compact', maximumFractionDigits: 1,
    ...(currency ? { style: 'currency', currency } : {}),
  }).format(n);
}

function parseYmd(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

/** Calendar dates (YYYY-MM-DD) are formatted in UTC so they never shift by timezone. */
export function formatDate(ymd: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(parseYmd(ymd));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export function formatMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  return new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(Date.UTC(y, m - 1, 1));
}

export function localToday(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function daysBetween(fromYmd: string, toYmd: string): number {
  return Math.round((parseYmd(toYmd) - parseYmd(fromYmd)) / 86_400_000);
}

export function locationLabel(l: { city: string; state: string }): string {
  return `${l.city}, ${l.state}`;
}
