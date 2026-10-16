import { describe, expect, it } from 'vitest';
import {
  STATUS_TRANSITIONS,
  PROJECT_STATUSES,
  createProjectSchema,
  isTransitionAllowed,
  listQuerySchema,
  normalizeMoney,
  updateProjectSchema,
} from '../src/schemas.js';

const valid = {
  name: 'Office Renovation',
  projectType: 'building_renovation',
  clientName: 'Acme Corp',
  location: { city: 'Ghaziabad', state: 'Uttar Pradesh', postalCode: null },
  description: 'Scope summary',
  plannedBudget: '1000000',
  currency: 'INR',
  contingencyBudget: '50000.5',
  plannedStartDate: '2026-11-01',
  targetCompletionDate: '2026-12-15',
};

describe('createProjectSchema', () => {
  it('accepts a valid payload, normalizes money strings and defaults status to draft', () => {
    const r = createProjectSchema.parse(valid);
    expect(r.plannedBudget).toBe('1000000.00');
    expect(r.contingencyBudget).toBe('50000.50');
    expect(r.status).toBe('draft');
  });

  it('keeps precision for large decimal strings (no float arithmetic)', () => {
    const r = createProjectSchema.parse({ ...valid, plannedBudget: '9999999999999.99' });
    expect(r.plannedBudget).toBe('9999999999999.99');
  });

  it.each([
    ['numeric budget', { plannedBudget: 1000 }],
    ['negative budget', { plannedBudget: '-5.00' }],
    ['zero budget', { plannedBudget: '0' }],
    ['3 decimals', { plannedBudget: '10.123' }],
    ['exponent notation', { plannedBudget: '1e6' }],
    ['leading zeros', { plannedBudget: '007' }],
    ['negative contingency', { contingencyBudget: '-1' }],
    ['unknown currency', { currency: 'XYZ' }],
    ['unknown type', { projectType: 'space_station' }],
    ['short name', { name: 'ab' }],
    ['impossible date', { plannedStartDate: '2026-02-30' }],
    ['wrong date format', { plannedStartDate: '01/11/2026' }],
    ['end before start', { targetCompletionDate: '2026-10-31' }],
    ['status active on create', { status: 'active' }],
    ['unknown field', { isDemo: true }],
    ['bad postal code', { location: { city: 'X', state: 'Y', postalCode: '!!' } }],
  ])('rejects %s', (_label, override) => {
    expect(createProjectSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it('allows an end date equal to the start date', () => {
    expect(createProjectSchema.safeParse({ ...valid, targetCompletionDate: '2026-11-01' }).success).toBe(true);
  });

  it('reports the date-order error on targetCompletionDate', () => {
    const r = createProjectSchema.safeParse({ ...valid, targetCompletionDate: '2026-10-31' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(['targetCompletionDate']);
  });
});

describe('updateProjectSchema', () => {
  it('accepts partial updates and rejects empty or unknown-field bodies', () => {
    expect(updateProjectSchema.safeParse({ status: 'planning' }).success).toBe(true);
    expect(updateProjectSchema.safeParse({}).success).toBe(false);
    expect(updateProjectSchema.safeParse({ id: 'x' }).success).toBe(false);
    expect(updateProjectSchema.safeParse({ createdAt: '2026-01-01T00:00:00Z' }).success).toBe(false);
  });
  it('allows clearing description and contingency with null', () => {
    const r = updateProjectSchema.parse({ description: null, contingencyBudget: null });
    expect(r.description).toBeNull();
    expect(r.contingencyBudget).toBeNull();
  });
});

describe('status transitions', () => {
  it('allows same-status and listed transitions only', () => {
    expect(isTransitionAllowed('draft', 'draft')).toBe(true);
    expect(isTransitionAllowed('draft', 'planning')).toBe(true);
    expect(isTransitionAllowed('draft', 'active')).toBe(false);
    expect(isTransitionAllowed('active', 'completed')).toBe(true);
    expect(isTransitionAllowed('completed', 'active')).toBe(false);
    expect(isTransitionAllowed('cancelled', 'draft')).toBe(false);
  });
  it('defines transitions for every status', () => {
    for (const s of PROJECT_STATUSES) expect(STATUS_TRANSITIONS[s]).toBeDefined();
  });
});

describe('listQuerySchema', () => {
  it('applies defaults', () => {
    const q = listQuerySchema.parse({});
    expect(q).toMatchObject({ sortBy: 'createdAt', sortOrder: 'desc', page: 1, pageSize: 10, status: [], projectType: [], includeDemo: false });
  });
  it('parses comma lists, repeated params and flags', () => {
    const q = listQuerySchema.parse({ status: 'active,draft', projectType: ['other', 'civil_works'], includeDemo: 'true', pageSize: '25' });
    expect(q.status).toEqual(['active', 'draft']);
    expect(q.projectType).toEqual(['other', 'civil_works']);
    expect(q.includeDemo).toBe(true);
    expect(q.pageSize).toBe(25);
  });
  it.each([{ status: 'bogus' }, { sortBy: 'budgetDesc' }, { pageSize: '1000' }, { page: '0' }, { includeDemo: 'yes' }])('rejects %o', (bad) => {
    expect(listQuerySchema.safeParse(bad).success).toBe(false);
  });
});

describe('normalizeMoney', () => {
  it('pads using string operations', () => {
    expect(normalizeMoney('5')).toBe('5.00');
    expect(normalizeMoney('5.1')).toBe('5.10');
    expect(normalizeMoney('0.07')).toBe('0.07');
  });
});
