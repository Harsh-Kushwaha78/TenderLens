import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createPool } from '../src/db.js';
import { runMigrations } from '../src/migrate.js';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL is required to run API tests.');
// Safety: these tests TRUNCATE the projects table. Never point them at a real database.
if (!/_test(\?|$)/.test(url)) throw new Error('TEST_DATABASE_URL must reference a database whose name ends in "_test".');

const pool = createPool(url);
const app = createApp({ pool, config: { corsOrigin: 'http://localhost:5173', appTimezone: 'UTC', nodeEnv: 'test' } });

const day = (offset: number) => {
  const d = new Date(); d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

const payload = (over: Record<string, unknown> = {}) => ({
  name: 'Office Renovation',
  projectType: 'building_renovation',
  clientName: 'Acme Corp',
  location: { city: 'Ghaziabad', state: 'Uttar Pradesh' },
  plannedBudget: '1000000.00',
  currency: 'INR',
  plannedStartDate: day(5),
  targetCompletionDate: day(60),
  ...over,
});

const create = async (over: Record<string, unknown> = {}) => {
  const res = await request(app).post('/api/projects').send(payload(over));
  expect(res.status).toBe(201);
  return res.body.data as any;
};

beforeAll(async () => { await runMigrations(pool); });
// CASCADE: boqs/boq_items reference projects (Feature 2)
beforeEach(async () => { await pool.query('TRUNCATE projects CASCADE'); });
afterAll(async () => { await pool.end(); });

describe('POST /api/projects', () => {
  it('creates a project and persists it with decimal-safe money', async () => {
    const res = await request(app).post('/api/projects').send(payload({ plannedBudget: '1234567890123.45', contingencyBudget: '10' }));
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/projects/${res.body.data.id}`);
    expect(res.body.data).toMatchObject({
      name: 'Office Renovation', status: 'draft', plannedBudget: '1234567890123.45', contingencyBudget: '10.00',
      currency: 'INR', isDemo: false, description: null, location: { city: 'Ghaziabad', state: 'Uttar Pradesh', postalCode: null },
    });
    expect(new Date(res.body.data.createdAt).toISOString()).toBe(res.body.data.createdAt);
    const row = await pool.query('SELECT planned_budget::text AS b, is_demo FROM projects');
    expect(row.rows).toEqual([{ b: '1234567890123.45', is_demo: false }]);
  });

  it('returns field-level validation errors in the standard error shape', async () => {
    const res = await request(app).post('/api/projects').send(payload({ plannedBudget: '-1', targetCompletionDate: day(1), name: '' }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map((d: any) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'plannedBudget', 'targetCompletionDate']));
    expect(JSON.stringify(res.body)).not.toMatch(/stack|at \w+ \(/);
  });

  it('rejects client-supplied isDemo and numeric money', async () => {
    expect((await request(app).post('/api/projects').send(payload({ isDemo: true }))).status).toBe(400);
    expect((await request(app).post('/api/projects').send(payload({ plannedBudget: 5000 }))).status).toBe(400);
  });

  it('returns BAD_REQUEST for malformed JSON', async () => {
    const res = await request(app).post('/api/projects').set('Content-Type', 'application/json').send('{"name":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('is idempotent for a repeated Idempotency-Key', async () => {
    const key = 'create-key-123456';
    const a = await request(app).post('/api/projects').set('Idempotency-Key', key).send(payload());
    const b = await request(app).post('/api/projects').set('Idempotency-Key', key).send(payload());
    expect(a.status).toBe(201);
    expect(b.status).toBe(200);
    expect(b.headers['idempotent-replayed']).toBe('true');
    expect(b.body.data.id).toBe(a.body.data.id);
    expect((await pool.query('SELECT count(*)::int AS n FROM projects')).rows[0].n).toBe(1);
  });

  it('rejects a malformed Idempotency-Key', async () => {
    const res = await request(app).post('/api/projects').set('Idempotency-Key', 'x').send(payload());
    expect(res.status).toBe(400);
  });
});

describe('GET /api/projects/:id', () => {
  it('returns a project', async () => {
    const p = await create();
    const res = await request(app).get(`/api/projects/${p.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(p.id);
  });
  it('returns 404 for a missing project and 400 for a malformed id', async () => {
    const missing = await request(app).get('/api/projects/00000000-0000-4000-8000-000000000000');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
    const bad = await request(app).get('/api/projects/not-a-uuid');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/projects (list)', () => {
  beforeEach(async () => {
    await create({ name: 'Alpha Tower Fitout', clientName: 'Zenith Ltd', projectType: 'interior_fitout', plannedBudget: '500.00', location: { city: 'Noida', state: 'Uttar Pradesh' }, targetCompletionDate: day(90) });
    await create({ name: 'Beta Wiring', clientName: 'Acme Corp', projectType: 'electrical_works', plannedBudget: '90000.00', location: { city: 'Pune', state: 'Maharashtra' }, targetCompletionDate: day(30) });
    await create({ name: 'Gamma Paving 100%', clientName: 'Orbit Inc', projectType: 'civil_works', plannedBudget: '7000.50', location: { city: 'Jaipur', state: 'Rajasthan' }, status: 'planning', targetCompletionDate: day(200) });
  });

  it('paginates with totals', async () => {
    const res = await request(app).get('/api/projects?pageSize=2&page=2&sortBy=name&sortOrder=asc');
    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({ page: 2, pageSize: 2, totalItems: 3, totalPages: 2 });
    expect(res.body.data.map((p: any) => p.name)).toEqual(['Gamma Paving 100%']);
  });

  it('searches by name, client and location, case-insensitively', async () => {
    const names = async (q: string) => (await request(app).get('/api/projects').query({ q })).body.data.map((p: any) => p.name);
    expect(await names('beta')).toEqual(['Beta Wiring']);
    expect(await names('ZENITH')).toEqual(['Alpha Tower Fitout']);
    expect(await names('rajasthan')).toEqual(['Gamma Paving 100%']);
  });

  it('treats LIKE wildcards in search text literally', async () => {
    const res = await request(app).get('/api/projects').query({ q: '100%' });
    expect(res.body.data.map((p: any) => p.name)).toEqual(['Gamma Paving 100%']);
    expect((await request(app).get('/api/projects').query({ q: '%' })).body.data).toHaveLength(1);
    expect((await request(app).get('/api/projects').query({ q: "'; DROP TABLE projects;--" })).body.data).toHaveLength(0);
    expect((await pool.query('SELECT count(*)::int AS n FROM projects')).rows[0].n).toBe(3);
  });

  it('filters by status and project type', async () => {
    const byStatus = await request(app).get('/api/projects?status=planning');
    expect(byStatus.body.data.map((p: any) => p.name)).toEqual(['Gamma Paving 100%']);
    const byType = await request(app).get('/api/projects?projectType=electrical_works,civil_works&sortBy=name&sortOrder=asc');
    expect(byType.body.data.map((p: any) => p.name)).toEqual(['Beta Wiring', 'Gamma Paving 100%']);
  });

  it('sorts by budget numerically (not lexically) and by target date', async () => {
    const budget = await request(app).get('/api/projects?sortBy=plannedBudget&sortOrder=desc');
    expect(budget.body.data.map((p: any) => p.plannedBudget)).toEqual(['90000.00', '7000.50', '500.00']);
    const target = await request(app).get('/api/projects?sortBy=targetCompletionDate&sortOrder=asc');
    expect(target.body.data.map((p: any) => p.name)).toEqual(['Beta Wiring', 'Alpha Tower Fitout', 'Gamma Paving 100%']);
  });

  it('returns 400 for invalid query parameters', async () => {
    const res = await request(app).get('/api/projects?status=bogus&pageSize=500');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns an empty page (not an error) when nothing matches', async () => {
    const res = await request(app).get('/api/projects?q=nothing-matches-this');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ data: [], pagination: { totalItems: 0, totalPages: 1 } });
  });
});

describe('demo data isolation', () => {
  it('hides is_demo rows unless includeDemo=true, in list and dashboard', async () => {
    await create({ name: 'Real Project' });
    await pool.query(`INSERT INTO projects (name, project_type, client_name, location_city, location_state, planned_budget, currency,
      planned_start_date, target_completion_date, status, is_demo) VALUES ('[DEMO] Fake','other','Demo Client','X','Y',100,'INR',current_date,current_date+10,'active',TRUE)`);
    expect((await request(app).get('/api/projects')).body.data.map((p: any) => p.name)).toEqual(['Real Project']);
    const withDemo = await request(app).get('/api/projects?includeDemo=true');
    expect(withDemo.body.pagination.totalItems).toBe(2);
    expect(withDemo.body.data.find((p: any) => p.name === '[DEMO] Fake').isDemo).toBe(true);
    expect((await request(app).get('/api/dashboard/summary')).body.data.totals.totalProjects).toBe(1);
    const dash = (await request(app).get('/api/dashboard/summary?includeDemo=true')).body.data;
    expect(dash).toMatchObject({ includesDemoData: true, demoProjectCount: 1 });
    expect(dash.totals.totalProjects).toBe(2);
  });
});

describe('PATCH /api/projects/:id', () => {
  it('updates fields, bumps updatedAt, keeps createdAt, and leaves other fields unchanged', async () => {
    const p = await create({ description: 'old' });
    await new Promise((r) => setTimeout(r, 15));
    const res = await request(app).patch(`/api/projects/${p.id}`).send({ name: 'Renamed Project', plannedBudget: '2500000.5', description: null, location: { city: 'Delhi', state: 'Delhi', postalCode: '110001' } });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'Renamed Project', plannedBudget: '2500000.50', description: null, clientName: 'Acme Corp', location: { city: 'Delhi', state: 'Delhi', postalCode: '110001' } });
    expect(res.body.data.createdAt).toBe(p.createdAt);
    expect(new Date(res.body.data.updatedAt).getTime()).toBeGreaterThan(new Date(p.updatedAt).getTime());
    const again = await request(app).get(`/api/projects/${p.id}`);
    expect(again.body.data.name).toBe('Renamed Project');
  });

  it('validates the merged date range against stored values', async () => {
    const p = await create();
    const res = await request(app).patch(`/api/projects/${p.id}`).send({ targetCompletionDate: day(-30) });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('targetCompletionDate');
    expect((await request(app).get(`/api/projects/${p.id}`)).body.data.targetCompletionDate).toBe(p.targetCompletionDate);
  });

  it('enforces status transitions with 409', async () => {
    const p = await create();
    const bad = await request(app).patch(`/api/projects/${p.id}`).send({ status: 'completed' });
    expect(bad.status).toBe(409);
    expect(bad.body.error.code).toBe('INVALID_STATUS_TRANSITION');
    expect((await request(app).patch(`/api/projects/${p.id}`).send({ status: 'planning' })).status).toBe(200);
    expect((await request(app).patch(`/api/projects/${p.id}`).send({ status: 'active' })).body.data.status).toBe('active');
    expect((await request(app).patch(`/api/projects/${p.id}`).send({ status: 'completed' })).body.data.status).toBe('completed');
    expect((await request(app).patch(`/api/projects/${p.id}`).send({ status: 'active' })).status).toBe(409);
  });

  it('returns 404 for unknown ids, 400 for empty/unknown-field bodies', async () => {
    expect((await request(app).patch('/api/projects/00000000-0000-4000-8000-000000000000').send({ name: 'Valid Name' })).status).toBe(404);
    const p = await create();
    expect((await request(app).patch(`/api/projects/${p.id}`).send({})).status).toBe(400);
    expect((await request(app).patch(`/api/projects/${p.id}`).send({ isDemo: true })).status).toBe(400);
    expect((await request(app).patch(`/api/projects/${p.id}`).send({ id: p.id })).status).toBe(400);
  });
});

describe('GET /api/dashboard/summary', () => {
  it('returns an honest empty summary with no projects', async () => {
    const d = (await request(app).get('/api/dashboard/summary')).body.data;
    expect(d.totals).toMatchObject({ totalProjects: 0, activeProjects: 0, approachingCompletion: 0, overdue: 0 });
    expect(d.plannedBudgetByCurrency).toEqual([]);
    expect(d.budgetByProject).toEqual({ currency: null, items: [] });
    expect(d.creationTrend.sufficient).toBe(false);
    expect(d.statusDistribution).toHaveLength(6);
    expect(d.recentProjects).toEqual([]);
  });

  it('computes counts, per-currency decimal totals, approaching/overdue and chart data from persisted rows', async () => {
    const a = await create({ name: 'Active Soon', plannedBudget: '100.10', targetCompletionDate: day(10) });
    await request(app).patch(`/api/projects/${a.id}`).send({ status: 'planning' });
    await request(app).patch(`/api/projects/${a.id}`).send({ status: 'active' });
    await create({ name: 'Far Future', plannedBudget: '200.20', plannedStartDate: day(1), targetCompletionDate: day(120) });
    const c = await create({ name: 'Overdue One', plannedBudget: '0.30', plannedStartDate: day(-60), targetCompletionDate: day(-3), status: 'planning' });
    await create({ name: 'Dollar Job', currency: 'USD', plannedBudget: '5000.00', targetCompletionDate: day(20), status: 'planning' });
    const x = await create({ name: 'Cancelled Job', plannedBudget: '99999.00' });
    await request(app).patch(`/api/projects/${x.id}`).send({ status: 'cancelled' });
    void c;

    const d = (await request(app).get('/api/dashboard/summary')).body.data;
    expect(d.totals).toMatchObject({ totalProjects: 5, activeProjects: 1, approachingCompletion: 2, overdue: 1, approachingWindowDays: 30 });
    // 0.10 + 0.20 floats would drift; NUMERIC sum is exact. Cancelled excluded.
    expect(d.plannedBudgetByCurrency).toEqual([
      { currency: 'INR', total: '300.60', projectCount: 3 },
      { currency: 'USD', total: '5000.00', projectCount: 1 },
    ]);
    expect(d.statusDistribution.find((s: any) => s.status === 'active').count).toBe(1);
    expect(d.statusDistribution.find((s: any) => s.status === 'cancelled').count).toBe(1);
    expect(d.budgetByProject.currency).toBe('INR');
    expect(d.budgetByProject.items.map((i: any) => i.plannedBudget)).toEqual(['200.20', '100.10', '0.30']);
    const usd = (await request(app).get('/api/dashboard/summary?currency=USD')).body.data;
    expect(usd.budgetByProject).toMatchObject({ currency: 'USD', items: [{ name: 'Dollar Job', plannedBudget: '5000.00' }] });
    expect(d.recentProjects).toHaveLength(5);
    expect(d.creationTrend.sufficient).toBe(false); // all created this month -> not enough history to claim a trend
    expect(d.creationTrend.months).toHaveLength(6);
  });

  it('rejects invalid query parameters', async () => {
    expect((await request(app).get('/api/dashboard/summary?currency=XXX')).status).toBe(400);
  });
});

describe('platform behaviour', () => {
  it('health reports database up', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body).toEqual({ data: { status: 'ok', database: 'up' } });
  });
  it('returns the standard 404 shape for unknown routes', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
  it('returns 503 SERVICE_UNAVAILABLE without leaking details when the database is unreachable', async () => {
    const dead = createPool('postgres://tenderlens:x@127.0.0.1:1/tenderlens_test');
    const deadApp = createApp({ pool: dead, config: { corsOrigin: '*', appTimezone: 'UTC', nodeEnv: 'test' } });
    const res = await request(deadApp).get('/api/projects');
    await dead.end();
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(JSON.stringify(res.body)).not.toMatch(/127\.0\.0\.1|postgres:/);
  });
});
