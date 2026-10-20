import type { ApiErrorDetail, Boq, BoqItemInput, BoqUnit, CreateBoqRequest } from '../api/types';
import { BOQ_UNITS, MAX_BOQ_ITEMS } from './constants';
import { isValidQuantity, isValidRate, trimQuantity } from './boqMath';

/** Editable row: every numeric field is a string so money/quantities never pass through floats. */
export interface BoqRow {
  key: string; // client-only stable React key
  id: string | null; // server item id; null = new
  description: string; specifications: string; quantity: string; unit: BoqUnit | ''; rate: string;
}
export interface BoqFormValues { title: string; description: string; rows: BoqRow[] }
export type RowField = 'description' | 'specifications' | 'quantity' | 'unit' | 'rate';
export type RowErrors = Partial<Record<RowField, string>>;
export interface BoqErrors { title?: string; description?: string; items?: string; rows: Record<string, RowErrors> }

let seq = 0;
export const newKey = () => `row-${Date.now().toString(36)}-${(seq++).toString(36)}`;
export const emptyRow = (): BoqRow => ({ key: newKey(), id: null, description: '', specifications: '', quantity: '', unit: '', rate: '' });
export const emptyForm = (): BoqFormValues => ({ title: '', description: '', rows: [emptyRow()] });

export const formFromBoq = (b: Boq): BoqFormValues => ({
  title: b.title, description: b.description ?? '',
  rows: b.items.map((i) => ({ key: newKey(), id: i.id, description: i.description, specifications: i.specifications ?? '', quantity: trimQuantity(i.quantity), unit: i.unit, rate: i.estimatedRate ?? '' })),
});

export const rowHasContent = (r: BoqRow) => Boolean(r.description.trim() || r.specifications.trim() || r.quantity.trim() || r.rate.trim() || r.unit);

export function validateRow(r: BoqRow): RowErrors {
  const e: RowErrors = {};
  const d = r.description.trim();
  if (!d) e.description = 'Description is required.'; else if (d.length > 1000) e.description = 'At most 1000 characters.';
  if (r.specifications.trim().length > 1000) e.specifications = 'At most 1000 characters.';
  const q = r.quantity.trim();
  if (!q) e.quantity = 'Quantity is required.';
  else if (q.startsWith('-')) e.quantity = 'Cannot be negative.';
  else if (!isValidQuantity(q)) e.quantity = /^0(\.0+)?$/.test(q) ? 'Must be greater than zero.' : 'Use a number with up to 3 decimals (max 7 whole digits).';
  if (!BOQ_UNITS.includes(r.unit as BoqUnit)) e.unit = 'Select a unit.';
  const rate = r.rate.trim();
  if (rate) {
    if (rate.startsWith('-')) e.rate = 'Cannot be negative.';
    else if (!isValidRate(rate)) e.rate = 'Use a number with up to 2 decimals (max 8 whole digits).';
  }
  return e;
}

export function validateForm(v: BoqFormValues): BoqErrors {
  const out: BoqErrors = { rows: {} };
  const t = v.title.trim();
  if (t.length < 3) out.title = t ? 'Title must be at least 3 characters.' : 'BOQ title is required.'; else if (t.length > 150) out.title = 'At most 150 characters.';
  if (v.description.trim().length > 2000) out.description = 'At most 2000 characters.';
  if (v.rows.length > MAX_BOQ_ITEMS) out.items = `A BOQ can have at most ${MAX_BOQ_ITEMS} items.`;
  for (const r of v.rows) { const e = validateRow(r); if (Object.keys(e).length) out.rows[r.key] = e; }
  return out;
}
export const hasErrors = (e: BoqErrors) => Boolean(e.title || e.description || e.items || Object.keys(e.rows).length);

export function toItemInputs(rows: BoqRow[]): BoqItemInput[] {
  return rows.map((r) => ({
    id: r.id, description: r.description.trim(), specifications: r.specifications.trim() || null,
    quantity: r.quantity.trim(), unit: r.unit as BoqUnit, estimatedRate: r.rate.trim() || null,
  }));
}
export const toPayload = (v: BoqFormValues): CreateBoqRequest => ({ title: v.title.trim(), description: v.description.trim() || null, items: toItemInputs(v.rows) });

/** Stable snapshot for dirty-checking (ignores client keys). */
export const snapshot = (v: BoqFormValues) => JSON.stringify(toPayload(v));

/** Maps server details like "items.2.quantity" back onto rows (by index). */
export function mapServerErrors(details: ApiErrorDetail[], rows: BoqRow[]): { errors: BoqErrors; general: string[] } {
  const errors: BoqErrors = { rows: {} };
  const general: string[] = [];
  for (const d of details) {
    const f = d.field ?? '';
    const m = /^items\.(\d+)\.(\w+)$/.exec(f);
    if (m) {
      const row = rows[Number(m[1])];
      const field = m[2] === 'estimatedRate' ? 'rate' : (m[2] ?? '');
      if (row && ['description', 'specifications', 'quantity', 'unit', 'rate'].includes(field)) { (errors.rows[row.key] ??= {})[field as RowField] ??= d.message; continue; }
      general.push(`Item ${Number(m[1]) + 1}: ${d.message}`); continue;
    }
    if (f === 'title') errors.title = d.message;
    else if (f === 'description') errors.description = d.message;
    else if (f === 'items') errors.items = d.message;
    else general.push(d.message);
  }
  return { errors, general };
}
