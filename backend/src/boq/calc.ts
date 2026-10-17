/**
 * Exact BOQ arithmetic with BigInt (no floating point).
 *   quantity: up to 7 whole digits + 3 decimals  -> integer thousandths
 *   rate:     up to 8 whole digits + 2 decimals  -> integer minor units (cents)
 *   line total (minor units) = round_half_up(thousandths * cents / 1000)
 * Must match the PostgreSQL generated column round(quantity * estimated_rate, 2) and the frontend copy
 * (frontend/src/lib/boqMath.ts). Both are tested against docs/boq-calculation-vectors.json.
 */
export const QUANTITY_RE = /^(0|[1-9]\d{0,6})(\.\d{1,3})?$/;
export const RATE_RE = /^(0|[1-9]\d{0,7})(\.\d{1,2})?$/;

const toScaled = (v: string, decimals: number): bigint => {
  const [whole = '0', frac = ''] = v.split('.');
  return BigInt(whole + frac.padEnd(decimals, '0'));
};

export const quantityToThousandths = (q: string) => toScaled(q, 3);
export const rateToMinor = (r: string) => toScaled(r, 2);

export function lineTotalMinor(quantity: string, rate: string): bigint {
  return (quantityToThousandths(quantity) * rateToMinor(rate) + 500n) / 1000n;
}

export function minorToDecimal(minor: bigint): string {
  const neg = minor < 0n;
  const s = (neg ? -minor : minor).toString().padStart(3, '0');
  return `${neg ? '-' : ''}${s.slice(0, -2)}.${s.slice(-2)}`;
}

export const lineTotal = (quantity: string, rate: string) => minorToDecimal(lineTotalMinor(quantity, rate));

/** Sum of rounded line totals; items without a rate are excluded (never treated as zero). */
export function boqTotal(items: { quantity: string; rate: string | null }[]): string {
  let sum = 0n;
  for (const i of items) if (i.rate !== null) sum += lineTotalMinor(i.quantity, i.rate);
  return minorToDecimal(sum);
}

export const normalizeQuantity = (q: string) => { const [w, f = ''] = q.split('.'); return `${w}.${f.padEnd(3, '0')}`; };
export const normalizeRate = (r: string) => { const [w, f = ''] = r.split('.'); return `${w}.${f.padEnd(2, '0')}`; };
