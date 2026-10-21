import { describe, expect, it } from 'vitest';
import { renderBoqPdf } from '../src/boq/pdf.js';
import type { Boq } from '../src/boq/repository.js';
import { extractPages } from './pdfText.js';

const base = (items: Boq['items'], over: Partial<Boq> = {}): Boq => {
  const priced = items.filter((i) => i.lineTotal !== null);
  const total = priced.reduce((s, i) => s + BigInt(i.lineTotal!.replace('.', '')), 0n).toString().padStart(3, '0');
  return {
    id: 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa', projectId: 'p', title: 'Block A - civil works', description: 'Scope: foundations & plinth.', currency: 'INR', revision: 3,
    total: `${total.slice(0, -2)}.${total.slice(-2)}`, pricedItemCount: priced.length, unpricedItemCount: items.length - priced.length, items,
    project: { id: 'p', name: 'Riverside Offices', clientName: 'Acme Infra', location: { city: 'Noida', state: 'Uttar Pradesh', postalCode: '201301' }, currency: 'INR', isDemo: false },
    createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z', ...over,
  };
};
const mk = (n: number, over: Partial<Boq['items'][number]> = {}): Boq['items'][number] => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, position: n, description: `Item ${n}`, specifications: null,
  quantity: '2.000', unit: 'm3', estimatedUnitRate: '10.00', lineTotal: '20.00', source: 'manual', ...over,
});
const render = (b: Boq) => renderBoqPdf(b, { generatedAt: new Date('2026-10-17T08:30:00Z'), compress: true });

describe('renderBoqPdf', () => {
  it('renders title, project block, rows, currency, total, footer and draft marking', async () => {
    const pdf = await render(base([mk(1, { description: 'Excavation', specifications: 'Up to 1.5 m depth', quantity: '12.500', estimatedUnitRate: '450.00', lineTotal: '5625.00' })]));
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const [p1] = await extractPages(pdf);
    for (const s of ['Block A - civil works', 'Riverside Offices', 'Acme Infra', 'Noida, Uttar Pradesh, 201301', 'Excavation', 'Up to 1.5 m depth', '12.5', '450.00', '5,625.00', 'INR', 'DRAFT', '2026-10-17 08:30 UTC', 'Page 1 of 1', 'revision 3']) expect(p1).toContain(s);
    expect(p1).toMatch(/Estimated total/);
  });
  it('uses ₹-safe formatting with Indian grouping and exact large values', async () => {
    const big = mk(1, { quantity: '9999999.999', estimatedUnitRate: '99999999.99', lineTotal: '999999999800000.00' });
    const [p1] = await extractPages(await render(base([big])));
    expect(p1.replace(/[, ]/g, '')).toContain('999999999800000.00');
    expect(p1).toContain('9,99,99,999.99'); // rate 99999999.99 with Indian (lakh/crore) grouping
  });
  it('paginates a long BOQ: header repeats on every page, no rows lost, order preserved, page x of n', async () => {
    const items = Array.from({ length: 140 }, (_, i) => mk(i + 1, { description: `Row ${i + 1} ${'wrap '.repeat(i % 7 === 0 ? 40 : 3)}`.trim(), specifications: i % 5 === 0 ? 'spec note' : null }));
    const pages = await extractPages(await render(base(items)));
    expect(pages.length).toBeGreaterThan(3);
    pages.forEach((t, n) => { expect(t).toContain('Description'); expect(t).toContain('Amount (INR)'); expect(t).toContain(`Page ${n + 1} of ${pages.length}`); });
    const all = pages.join(' ');
    let last = -1;
    for (let i = 1; i <= 140; i++) { const at = all.indexOf(`Row ${i} `); expect(at, `row ${i}`).toBeGreaterThan(last); last = at; }
    expect(pages.at(-1)).toContain('Estimated total');
  });
  it('renders an empty BOQ and marks unpriced items without counting them', async () => {
    const [empty] = await extractPages(await render(base([])));
    expect(empty).toContain('This BOQ has no items yet.');
    expect(empty).toContain('INR 0.00');
    const [unp] = await extractPages(await render(base([mk(1), mk(2, { estimatedUnitRate: null, lineTotal: null })])));
    expect(unp).toContain('1 item(s) shown with');
    expect(unp).toContain('INR 20.00');
  });
  it('keeps special characters and wraps very long descriptions without dropping text', async () => {
    const d = `Tiles "quoted" & 'single' <b>tag</b> ₹ m² m³ é ü ${'x'.repeat(5)} ` + 'longword '.repeat(100);
    const [p1] = await extractPages(await render(base([mk(1, { description: d.trim().slice(0, 1000) })], { title: 'Spëcial "BOQ" & <co>' })));
    for (const s of ['"quoted"', "'single'", '<b>tag</b>', '₹', 'm²', 'm³', 'é', 'Spëcial "BOQ" & <co>']) expect(p1).toContain(s);
  });
  it('uses USD grouping for non-INR currencies', async () => {
    const [p1] = await extractPages(await render(base([mk(1, { lineTotal: '1234567.00', quantity: '1.000', estimatedUnitRate: '1234567.00' })], { currency: 'USD' })));
    expect(p1).toContain('1,234,567.00');
    expect(p1).toContain('USD');
  });
});
