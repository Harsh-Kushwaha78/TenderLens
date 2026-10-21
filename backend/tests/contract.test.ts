import { readFileSync } from 'node:fs';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { createApp } from '../src/app.js';
import { createPool } from '../src/db.js';
import { ERROR_CODES } from '../src/errors.js';
import { runMigrations } from '../src/migrate.js';
import { QUANTITY_RE, RATE_RE } from '../src/boq/calc.js';
import { BOQ_UNITS, createBoqSchema, updateBoqSchema } from '../src/boq/schemas.js';
import { CURRENCIES, PROJECT_STATUSES, PROJECT_TYPES } from '../src/schemas.js';

const spec: any = parse(readFileSync(new URL('../../docs/openapi.yaml', import.meta.url), 'utf8'));
const url = process.env.TEST_DATABASE_URL;
if (!url || !/_test(\?|$)/.test(url)) throw new Error('TEST_DATABASE_URL (database name ending in _test) is required.');
const pool = createPool(url);
const app = createApp({ pool, config: { corsOrigin: 'http://localhost:5173', appTimezone: 'UTC', nodeEnv: 'test' } });
const ID = '00000000-0000-4000-8000-000000000000';

beforeAll(async () => { await runMigrations(pool); });
beforeEach(async () => { await pool.query('TRUNCATE projects CASCADE'); });
afterAll(async () => { await pool.end(); });

/** Walks Express 4's router stack to list every mounted route as "METHOD /openapi/{style}/path". */
function implementedRoutes(): string[] {
  const out: string[] = [];
  const toPath = (re: RegExp) => re.source.replace(/^\^/, '').replace('\\/?(?=\\/|$)', '').replace(/\\\//g, '/').replace(/\(\?:\/?\(\[\^\/\]\+\?\)\)/g, '/{p}');
  const walk = (stack: any[], prefix: string) => {
    for (const l of stack) {
      if (l.route) for (const m of Object.keys(l.route.methods)) out.push(`${m.toUpperCase()} ${prefix}${l.route.path === '/' ? '' : l.route.path}`);
      else if (l.name === 'router' && l.handle?.stack) walk(l.handle.stack, prefix + toPath(l.regexp));
    }
  };
  walk((app as any)._router.stack, '');
  return out;
}
const norm = (p: string) => p.replace(/\{[^}]+\}/g, '{p}').replace(/:[A-Za-z]+/g, '{p}');

describe('OpenAPI <-> implementation', () => {
  const documented = Object.entries<any>(spec.paths).flatMap(([p, ops]) => Object.keys(ops).filter((m) => ['get', 'post', 'put', 'patch', 'delete'].includes(m)).map((m) => `${m.toUpperCase()} ${norm(p)}`));
  const implemented = implementedRoutes().map((r) => { const [m, ...p] = r.split(' '); return `${m} ${norm(p.join(' '))}`; });

  it('documents exactly the routes the server implements (no undocumented, no phantom endpoints)', () => {
    const impl = implemented.filter((r) => r.includes('/api/'));
    expect([...new Set(impl)].sort()).toEqual([...new Set(documented)].sort());
  });

  it.each(Object.entries<any>(spec.paths).flatMap(([p, ops]) => Object.keys(ops).filter((m) => ['get', 'post', 'put', 'patch', 'delete'].includes(m)).map((m) => [m.toUpperCase(), p] as const)))(
    '%s %s answers with a documented status code', async (method, path) => {
      const concrete = path.replace(/\{[^}]+\}/g, ID);
      const res = await (request(app) as any)[method.toLowerCase()](concrete).send({});
      expect(Object.keys(spec.paths[path][method.toLowerCase()].responses), `${method} ${path} -> ${res.status}`).toContain(String(res.status));
    });

  it('keeps enums and regex patterns identical to the code', () => {
    const s = spec.components.schemas;
    expect(s.BoqUnit.enum).toEqual([...BOQ_UNITS]);
    expect(s.Currency.enum).toEqual([...CURRENCIES]);
    expect(s.ProjectStatus.enum).toEqual([...PROJECT_STATUSES]);
    expect(s.ProjectType.enum).toEqual([...PROJECT_TYPES]);
    expect(s.ErrorBody.properties.error.properties.code.enum).toEqual([...ERROR_CODES]);
    // Compare behaviour, not source text ([0-9] vs \d are equivalent).
    const samples = ['0', '1', '12.5', '12.500', '7.125', '1.2345', '12345678', '9999999.999', '-1', '1e3', '1,000', '01', '.5', '5.', '', '99999999.99', '123456789', '0.001', '0.00'];
    for (const [pattern, re] of [[s.BoqQuantity.pattern, QUANTITY_RE], [s.BoqRate.pattern, RATE_RE]] as const) {
      const doc = new RegExp(pattern);
      for (const v of samples) expect(doc.test(v), `${pattern} vs ${JSON.stringify(v)}`).toBe(re.test(v));
    }
    expect(spec.paths['/api/projects/{projectId}/boqs'].post.requestBody.content['application/json'].schema.$ref).toBe('#/components/schemas/CreateBoq');
  });

  it('request schemas list exactly the fields the validators accept', () => {
    const s = spec.components.schemas;
    expect(Object.keys(s.CreateBoq.properties).sort()).toEqual(Object.keys(createBoqSchema.shape).sort());
    expect(Object.keys(s.UpdateBoq.properties).sort()).toEqual(Object.keys(updateBoqSchema.shape).sort());
    const itemShape = (createBoqSchema.shape.items as any).innerType().element.shape; // items is wrapped by a refinement
    expect(Object.keys(s.BoqItemInput.properties).sort()).toEqual(Object.keys(itemShape).sort());
    expect(s.CreateBoq.properties.items.maxItems).toBe(500);
  });

  it('real responses contain exactly the documented fields (Boq, BoqItem, BoqSummary, error body)', async () => {
    const proj = (await request(app).post('/api/projects').send({ name: 'Contract Project', projectType: 'other', clientName: 'Acme', location: { city: 'A', state: 'B' }, plannedBudget: '10', currency: 'INR', plannedStartDate: '2026-11-01', targetCompletionDate: '2026-12-01' })).body.data;
    const created = await request(app).post(`/api/projects/${proj.id}/boqs`).send({ title: 'Contract BOQ', items: [{ description: 'x', quantity: '1', unit: 'm', estimatedUnitRate: '2' }] });
    expect(created.status).toBe(201);
    const s = spec.components.schemas;
    const keys = (o: object) => Object.keys(o).sort();
    expect(keys(created.body.data)).toEqual(Object.keys(s.Boq.properties).sort());
    expect(keys(created.body.data.project)).toEqual(Object.keys(s.Boq.properties.project.properties).sort());
    expect(keys(created.body.data.items[0])).toEqual(Object.keys(s.BoqItem.properties).sort());
    s.Boq.required.forEach((k: string) => expect(created.body.data).toHaveProperty(k));
    const list = await request(app).get(`/api/projects/${proj.id}/boqs`);
    expect(keys(list.body.data[0])).toEqual(Object.keys(s.BoqSummary.properties).sort());
    const bad = await request(app).get('/api/boqs/not-a-uuid');
    expect(keys(bad.body.error)).toEqual(['code', 'details', 'message']);
    expect(ERROR_CODES).toContain(bad.body.error.code);
  });

  it('documented number formats are what the API returns (3-decimal quantity, 2-decimal money)', async () => {
    const proj = (await request(app).post('/api/projects').send({ name: 'Format Project', projectType: 'other', clientName: 'Acme', location: { city: 'A', state: 'B' }, plannedBudget: '10', currency: 'INR', plannedStartDate: '2026-11-01', targetCompletionDate: '2026-12-01' })).body.data;
    const b = (await request(app).post(`/api/projects/${proj.id}/boqs`).send({ title: 'Format BOQ', items: [{ description: 'x', quantity: '3', unit: 'kg', estimatedUnitRate: '7' }] })).body.data;
    expect(b.items[0]).toMatchObject({ quantity: '3.000', estimatedUnitRate: '7.00', lineTotal: '21.00' });
    expect(b.total).toBe('21.00');
    expect(new RegExp(spec.components.schemas.Decimal.pattern).test(b.total)).toBe(true);
  });
});
