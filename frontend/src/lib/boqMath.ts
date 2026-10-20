/**
 * Exact BOQ arithmetic (BigInt). Mirror of backend/src/boq/calc.ts; both are tested against
 * docs/boq-calculation-vectors.json. The server remains authoritative: this module only powers live previews.
 */
export const QUANTITY_RE = /^(0|[1-9]\d{0,6})(\.\d{1,3})?$/;
export const RATE_RE = /^(0|[1-9]\d{0,7})(\.\d{1,2})?$/;

const scaled = (v: string, d: number) => { const [w = '0', f = ''] = v.split('.'); return BigInt(w + f.padEnd(d, '0')); };

export const isValidQuantity = (q: string) => QUANTITY_RE.test(q.trim()) && !/^0(\.0+)?$/.test(q.trim());
export const isValidRate = (r: string) => RATE_RE.test(r.trim());

export const lineTotalMinor = (quantity: string, rate: string): bigint => (scaled(quantity.trim(), 3) * scaled(rate.trim(), 2) + 500n) / 1000n;

export function minorToDecimal(minor: bigint): string {
  const s = (minor < 0n ? -minor : minor).toString().padStart(3, '0');
  return `${minor < 0n ? '-' : ''}${s.slice(0, -2)}.${s.slice(-2)}`;
}
export const lineTotal = (q: string, r: string) => minorToDecimal(lineTotalMinor(q, r));

export interface LiveTotals { total: string; priced: number; unpriced: number; invalid: number }

/** Live total over rows; rows with invalid numbers are counted as invalid and excluded (never silently treated as 0). */
export function liveTotals(rows: { quantity: string; rate: string }[]): LiveTotals {
  let sum = 0n, priced = 0, unpriced = 0, invalid = 0;
  for (const r of rows) {
    if (!isValidQuantity(r.quantity) || (r.rate.trim() !== '' && !isValidRate(r.rate))) { invalid++; continue; }
    if (r.rate.trim() === '') { unpriced++; continue; }
    sum += lineTotalMinor(r.quantity, r.rate); priced++;
  }
  return { total: minorToDecimal(sum), priced, unpriced, invalid };
}

/** Trims trailing zeros for display: "12.500" -> "12.5". */
export const trimQuantity = (q: string) => (q.includes('.') ? q.replace(/0+$/, '').replace(/\.$/, '') : q);
