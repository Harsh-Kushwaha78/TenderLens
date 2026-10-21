import { describe, expect, it } from 'vitest';
import { daysBetween, formatDate, formatMoney, localToday } from './format';
import { allowedStatuses } from './constants';
import { emptyValues, fromProject, mapApiErrors, toCreatePayload, toUpdatePayload, validateValues } from './validation';
import type { Project } from '../api/types';

const good = { ...emptyValues(), name: 'Office Renovation', projectType: 'civil_works' as const, clientName: 'Acme', city: 'Noida', state: 'UP', plannedBudget: '1500000.5', plannedStartDate: '2026-11-01', targetCompletionDate: '2026-12-15' };

describe('validateValues', () => {
  it('accepts a valid form', () => expect(validateValues(good)).toEqual({}));
  it('requires fields and explains why', () => {
    const e = validateValues(emptyValues());
    expect(Object.keys(e)).toEqual(expect.arrayContaining(['name', 'projectType', 'clientName', 'city', 'state', 'plannedBudget', 'plannedStartDate', 'targetCompletionDate']));
  });
  it.each(['-5', '0', '12.345', '1,000', 'abc', '1e6'])('rejects budget %s', (b) => expect(validateValues({ ...good, plannedBudget: b }).plannedBudget).toBeTruthy());
  it('rejects negative contingency but allows blank', () => {
    expect(validateValues({ ...good, contingencyBudget: '-1' }).contingencyBudget).toMatch(/negative/);
    expect(validateValues({ ...good, contingencyBudget: '' }).contingencyBudget).toBeUndefined();
  });
  it('rejects end before start, accepts equal', () => {
    expect(validateValues({ ...good, targetCompletionDate: '2026-10-01' }).targetCompletionDate).toMatch(/on or after/);
    expect(validateValues({ ...good, targetCompletionDate: '2026-11-01' }).targetCompletionDate).toBeUndefined();
  });
  it('limits validation to the requested fields', () => expect(Object.keys(validateValues(emptyValues(), ['name']))).toEqual(['name']));
});

describe('payload mapping', () => {
  it('keeps money as strings and nulls empty optionals', () => {
    const p = toCreatePayload({ ...good, description: '  ', postalCode: '' });
    expect(p.plannedBudget).toBe('1500000.5');
    expect(typeof p.plannedBudget).toBe('string');
    expect(p).toMatchObject({ description: null, contingencyBudget: null, location: { postalCode: null }, status: 'draft' });
  });
  const project: Project = { id: 'x', name: 'Office Renovation', projectType: 'civil_works', clientName: 'Acme', location: { city: 'Noida', state: 'UP', postalCode: null }, description: null, plannedBudget: '1500000.50', currency: 'INR', contingencyBudget: null, plannedStartDate: '2026-11-01', targetCompletionDate: '2026-12-15', status: 'draft', isDemo: false, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' };
  it('sends only changed fields on update (1500000.5 equals 1500000.50)', () => {
    expect(toUpdatePayload(project, fromProject(project))).toEqual({});
    expect(toUpdatePayload(project, { ...fromProject(project), plannedBudget: '1500000.5' })).toEqual({});
    expect(toUpdatePayload(project, { ...fromProject(project), name: 'New Name', status: 'planning' })).toEqual({ name: 'New Name', status: 'planning' });
  });
});

describe('mapApiErrors', () => {
  it('maps nested server fields to form keys', () => {
    const r = mapApiErrors([{ field: 'location.city', message: 'bad city' }, { field: 'plannedBudget', message: 'bad' }, { field: 'Idempotency-Key', message: 'k' }]);
    expect(r.fieldErrors).toEqual({ city: 'bad city', plannedBudget: 'bad' });
    expect(r.unmapped).toEqual(['k']);
  });
});

describe('format + constants', () => {
  it('formats INR from a decimal string without float rounding', () => {
    expect(formatMoney('9999999999999.99', 'INR')).toContain('99,99,99,99,99,999.99');
  });
  it('formats calendar dates without timezone shift', () => expect(formatDate('2026-11-01')).toBe('1 Nov 2026'));
  it('computes day differences and local date', () => {
    expect(daysBetween('2026-10-17', '2026-11-16')).toBe(30);
    expect(localToday(new Date(2026, 9, 17, 23, 59))).toBe('2026-10-17');
  });
  it('offers only valid status transitions', () => {
    expect(allowedStatuses('draft')).toEqual(['draft', 'planning', 'cancelled']);
    expect(allowedStatuses('completed')).toEqual(['completed']);
  });
});
