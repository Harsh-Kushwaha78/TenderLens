import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { boqTotal, lineTotal, minorToDecimal, normalizeQuantity, normalizeRate } from '../src/boq/calc.js';
import { createBoqSchema, updateBoqSchema } from '../src/boq/schemas.js';

export const vectors = JSON.parse(readFileSync(new URL('../../docs/boq-calculation-vectors.json', import.meta.url), 'utf8'));

describe('BOQ exact arithmetic (shared vectors, independent Python-decimal oracle)', () => {
  it.each(vectors.lineTotals)('$quantity x $rate = $lineTotal', ({ quantity, rate, lineTotal: expected }) => {
    expect(lineTotal(quantity, rate)).toBe(expected);
  });
  it.each(vectors.sums.map((s: any, i: number) => [i, s]))('sum vector %i', (_i, s: any) => {
    expect(boqTotal(s.items.map((x: any) => ({ quantity: x.quantity, rate: x.rate })))).toBe(s.total);
  });
  it('shows why floats are unsafe: 0.1 + 0.2 stays exact', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(boqTotal([{ quantity: '1', rate: '0.10' }, { quantity: '1', rate: '0.20' }])).toBe('0.30');
  });
  it('excludes unpriced items instead of treating them as zero', () => {
    expect(boqTotal([{ quantity: '2', rate: '5.00' }, { quantity: '9', rate: null }])).toBe('10.00');
  });
  it('formats minor units and normalises scales', () => {
    expect(minorToDecimal(5n)).toBe('0.05');
    expect(minorToDecimal(0n)).toBe('0.00');
    expect(normalizeQuantity('7')).toBe('7.000');
    expect(normalizeRate('7.5')).toBe('7.50');
  });
});

describe('BOQ request schemas', () => {
  const item = { description: 'Brickwork', quantity: '10', unit: 'm3', estimatedUnitRate: '100' };
  it('accepts valid input and normalises decimals', () => {
    const r = createBoqSchema.parse({ title: 'Ground floor', items: [item] });
    expect(r.items[0]).toMatchObject({ quantity: '10.000', estimatedUnitRate: '100.00', specifications: null, id: null });
  });
  it.each([
    ['numeric quantity', { quantity: 10 }], ['negative quantity', { quantity: '-1' }], ['zero quantity', { quantity: '0' }], ['zero with decimals', { quantity: '0.000' }],
    ['4 decimal quantity', { quantity: '1.2345' }], ['8 whole-digit quantity', { quantity: '12345678' }], ['exponent', { quantity: '1e3' }], ['comma', { quantity: '1,000' }],
    ['negative rate', { estimatedUnitRate: '-0.01' }], ['3 decimal rate', { estimatedUnitRate: '1.234' }], ['numeric rate', { estimatedUnitRate: 5 }], ['9 whole-digit rate', { estimatedUnitRate: '123456789' }],
    ['bad unit', { unit: 'cubits' }], ['empty description', { description: '  ' }], ['client lineTotal', { lineTotal: '1.00' }], ['client position', { position: 3 }],
  ])('rejects %s', (_l, over) => {
    expect(createBoqSchema.safeParse({ title: 'Ground floor', items: [{ ...item, ...over }] }).success).toBe(false);
  });
  it('allows a zero rate and a missing rate; rejects a client total and >500 items', () => {
    expect(createBoqSchema.safeParse({ title: 'Ground floor', items: [{ ...item, estimatedUnitRate: '0' }, { ...item, estimatedUnitRate: null }, { ...item, estimatedUnitRate: undefined }] }).success).toBe(true);
    expect(createBoqSchema.safeParse({ title: 'Ground floor', total: '1.00', items: [] }).success).toBe(false);
    expect(createBoqSchema.safeParse({ title: 'Ground floor', items: Array(501).fill(item) }).success).toBe(false);
  });
  it('requires revision on update and rejects duplicate item ids', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(updateBoqSchema.safeParse({ title: 'Ground floor', items: [] }).success).toBe(false);
    expect(updateBoqSchema.safeParse({ title: 'Ground floor', revision: 1, items: [{ ...item, id }, { ...item, id }] }).success).toBe(false);
  });
});
