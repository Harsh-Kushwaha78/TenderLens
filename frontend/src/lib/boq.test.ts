import { describe, expect, it } from 'vitest';
import vectors from '../../../docs/boq-calculation-vectors.json';
import { isValidQuantity, isValidRate, lineTotal, liveTotals, trimQuantity } from './boqMath';
import { emptyRow, mapServerErrors, snapshot, toPayload, validateForm, validateRow, type BoqRow } from './boqForm';

describe('boqMath matches the shared oracle vectors (same file the backend is tested against)', () => {
  it.each(vectors.lineTotals)('$quantity x $rate = $lineTotal', ({ quantity, rate, lineTotal: expected }) => {
    expect(lineTotal(quantity, rate)).toBe(expected);
  });
  it.each(vectors.sums.map((s, i) => [i, s] as const))('sum vector %i', (_i, s) => {
    expect(liveTotals(s.items.map((x) => ({ quantity: x.quantity, rate: x.rate }))).total).toBe(s.total);
  });
  it('is exact where floats are not', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(liveTotals([{ quantity: '1', rate: '0.10' }, { quantity: '1', rate: '0.20' }]).total).toBe('0.30');
  });
  it('counts unpriced and invalid rows separately and never treats them as zero', () => {
    const t = liveTotals([{ quantity: '2', rate: '5' }, { quantity: '3', rate: '' }, { quantity: '-1', rate: '5' }, { quantity: '1', rate: 'abc' }]);
    expect(t).toEqual({ total: '10.00', priced: 1, unpriced: 1, invalid: 2 });
  });
  it('validates numbers like the server', () => {
    expect([isValidQuantity('0'), isValidQuantity('0.000'), isValidQuantity('1.2345'), isValidQuantity('12345678'), isValidQuantity('7.125')]).toEqual([false, false, false, false, true]);
    expect([isValidRate('0'), isValidRate('-1'), isValidRate('1.234'), isValidRate('99999999.99')]).toEqual([true, false, false, true]);
    expect(trimQuantity('12.500')).toBe('12.5');
    expect(trimQuantity('7.000')).toBe('7');
    expect(trimQuantity('10')).toBe('10');
  });
});

describe('boqForm', () => {
  const row = (o: Partial<BoqRow> = {}): BoqRow => ({ ...emptyRow(), description: 'Brickwork', quantity: '10', unit: 'm3', rate: '100', ...o });
  it('validates rows with specific messages', () => {
    expect(validateRow(row())).toEqual({});
    expect(validateRow(row({ description: ' ', quantity: '-1', unit: '', rate: '-5' }))).toMatchObject({ description: expect.any(String), quantity: 'Cannot be negative.', unit: 'Select a unit.', rate: 'Cannot be negative.' });
    expect(validateRow(row({ quantity: '0' })).quantity).toBe('Must be greater than zero.');
    expect(validateRow(row({ rate: '' })).rate).toBeUndefined(); // empty rate = not estimated yet
    expect(validateRow(row({ rate: '1.234' })).rate).toMatch(/2 decimals/);
  });
  it('validates the form and builds a payload without totals/positions; keeps ids and nulls optionals', () => {
    expect(validateForm({ title: 'x', description: '', rows: [row()] }).title).toMatch(/at least 3/);
    const r = row({ id: 'abc', specifications: '  ', rate: '' });
    const p = toPayload({ title: ' Ground ', description: '  ', rows: [r] });
    expect(p).toEqual({ title: 'Ground', description: null, items: [{ id: 'abc', description: 'Brickwork', specifications: null, quantity: '10', unit: 'm3', estimatedRate: null }] });
    expect(Object.keys(p.items[0]!)).not.toContain('lineTotal');
  });
  it('dirty snapshot ignores client keys but sees edits and reordering', () => {
    const a = row({ description: 'A' }), b = row({ description: 'B' });
    const s1 = snapshot({ title: 'T', description: '', rows: [a, b] });
    expect(snapshot({ title: 'T', description: '', rows: [{ ...a, key: 'other' }, b] })).toBe(s1);
    expect(snapshot({ title: 'T', description: '', rows: [b, a] })).not.toBe(s1);
  });
  it('maps server error paths onto rows', () => {
    const rows = [row(), row()];
    const m = mapServerErrors([{ field: 'items.1.estimatedRate', message: 'bad rate' }, { field: 'title', message: 'bad title' }, { field: 'revision', message: 'stale' }], rows);
    expect(m.errors.rows[rows[1]!.key]).toEqual({ rate: 'bad rate' });
    expect(m.errors.title).toBe('bad title');
    expect(m.general).toEqual(['stale']);
  });
});
