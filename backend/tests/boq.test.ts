import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createPool } from '../src/db.js';
import { runMigrations } from '../src/migrate.js';
import { vectors } from './calc.test.js';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL is required to run API tests.');
if (!/_test(\?|$)/.test(url)) throw new Error('TEST_DATABASE_URL must reference a database whose name ends in "_test".');

const pool = createPool(url);
const app = createApp({ pool, config: { corsOrigin: 'http://localhost:5173', appTimezone: 'UTC', nodeEnv: 'test' } });
const MISSING = '00000000-0000-4000-8000-000000000000';

const mkProject = async (over: Record<string, unknown> = {}) => {
  const r = await request(app).post('/api/projects').send({
    name: 'Office Renovation', projectType: 'building_renovation', clientName: 'Acme', location: { city: 'Noida', state: 'UP' },
    plannedBudget: '1000000', currency: 'INR', plannedStartDate: '2026-11-01', targetCompletionDate: '2026-12-01', ...over });
  expect(r.status).toBe(201);
  return r.body.data as any;
};
const item = (over: Record<string, unknown> = {}) => ({ description: 'Brickwork in cement mortar', quantity: '10', unit: 'm3', estimatedUnitRate: '5000', ...over });
const mkBoq = async (projectId: string, over: Record<string, unknown> = {}) => {
  const r = await request(app).post(`/api/projects/${projectId}/boqs`).send({ title: 'Ground floor works', items: [item()], ...over });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body.data as any;
};
const toInput = (b: any, items = b.items) => ({
  title: b.title, description: b.description, revision: b.revision,
  items: items.map((i: any) => ({ id: i.id ?? null, description: i.description, specifications: i.specifications, quantity: i.quantity, unit: i.unit, estimatedUnitRate: i.estimatedUnitRate })),
});

beforeAll(async () => { await runMigrations(pool); });
beforeEach(async () => { await pool.query('TRUNCATE projects CASCADE'); });
afterAll(async () => { await pool.end(); });

describe('POST /api/projects/:projectId/boqs', () => {
  it('creates a BOQ with server-derived positions, line totals and total; snapshots project currency', async () => {
    const p = await mkProject({ currency: 'USD' });
    const res = await request(app).post(`/api/projects/${p.id}/boqs`).send({
      title: 'Ground floor works', description: 'Scope', items: [item(), item({ description: 'Plaster', quantity: '2.5', unit: 'm2', estimatedUnitRate: '120.40', specifications: '12 mm' })] });
    expect(res.status).toBe(201);
    const b = res.body.data;
    expect(res.headers.location).toBe(`/api/boqs/${b.id}`);
    expect(b).toMatchObject({ projectId: p.id, currency: 'USD', revision: 1, total: '50301.00', pricedItemCount: 2, unpricedItemCount: 0, description: 'Scope' });
    expect(b.items.map((i: any) => [i.position, i.quantity, i.estimatedUnitRate, i.lineTotal])).toEqual([[1, '10.000', '5000.00', '50000.00'], [2, '2.500', '120.40', '301.00']]);
    expect(b.items[1].specifications).toBe('12 mm');
    expect(b.project).toMatchObject({ id: p.id, name: 'Office Renovation', isDemo: false });
    expect(new Date(b.createdAt).toISOString()).toBe(b.createdAt);
  });

  it('keeps the BOQ currency when the project currency is edited later', async () => {
    const p = await mkProject();
    const b = await mkBoq(p.id);
    await request(app).patch(`/api/projects/${p.id}`).send({ currency: 'EUR' });
    const again = (await request(app).get(`/api/boqs/${b.id}`)).body.data;
    expect(again.currency).toBe('INR');
    expect(again.project.currency).toBe('EUR');
  });

  it('allows an empty BOQ and treats a missing rate as unpriced (not zero)', async () => {
    const p = await mkProject();
    expect((await mkBoq(p.id, { items: [] })).total).toBe('0.00');
    const b = await mkBoq(p.id, { items: [item({ estimatedUnitRate: undefined, quantity: '3' }), item({ estimatedUnitRate: '0' })] });
    expect(b.items.map((i: any) => i.lineTotal)).toEqual([null, '0.00']);
    expect(b).toMatchObject({ total: '0.00', pricedItemCount: 1, unpricedItemCount: 1 });
  });

  it('returns 404 for a nonexistent project and 400 for a malformed project id', async () => {
    const r = await request(app).post(`/api/projects/${MISSING}/boqs`).send({ title: 'Ground floor works', items: [] });
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe('NOT_FOUND');
    const bad = await request(app).post('/api/projects/nope/boqs').send({ title: 'Ground floor works', items: [] });
    expect(bad.status).toBe(400);
    expect(bad.body.error.details[0].field).toBe('projectId');
  });

  it('validates with field paths; never accepts client totals/positions; rejects ids on create', async () => {
    const p = await mkProject();
    const r = await request(app).post(`/api/projects/${p.id}/boqs`).send({ title: 'x', items: [item({ quantity: '-1' }), item({ unit: 'bad' }), item({ estimatedUnitRate: '1.234' })] });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('VALIDATION_ERROR');
    expect(r.body.error.details.map((d: any) => d.field)).toEqual(expect.arrayContaining(['title', 'items.0.quantity', 'items.1.unit', 'items.2.estimatedUnitRate']));
    const smuggled = await request(app).post(`/api/projects/${p.id}/boqs`).send({ title: 'Ground floor works', total: '1.00', items: [item({ lineTotal: '1.00' })] });
    expect(smuggled.status).toBe(400);
    const withId = await request(app).post(`/api/projects/${p.id}/boqs`).send({ title: 'Ground floor works', items: [item({ id: '11111111-1111-4111-8111-111111111111' })] });
    expect(withId.status).toBe(400);
    expect(withId.body.error.details[0].field).toBe('items.0.id');
    expect((await pool.query('SELECT count(*)::int AS n FROM boqs')).rows[0].n).toBe(0);
  });

  it('matches the independent oracle for every shared calculation vector (DB generated column == JS)', async () => {
    const p = await mkProject();
    const rows = vectors.lineTotals;
    const b = await mkBoq(p.id, { items: rows.map((v: any, n: number) => item({ description: `Vector ${n}`, quantity: v.quantity, estimatedUnitRate: v.rate })) });
    expect(b.items.map((i: any) => i.lineTotal)).toEqual(rows.map((v: any) => v.lineTotal));
    const expected = rows.reduce((s: bigint, v: any) => s + BigInt(v.lineTotal.replace('.', '')), 0n).toString().padStart(3, '0');
    expect(b.total).toBe(`${expected.slice(0, -2)}.${expected.slice(-2)}`);
  });

  it.each([0, 1, 2])('sums large values exactly (sum vector %i)', async (n) => {
    const s = vectors.sums[n];
    const p = await mkProject();
    const b = await mkBoq(p.id, { items: s.items.map((x: any) => item({ quantity: x.quantity, estimatedUnitRate: x.rate })) });
    expect(b.total).toBe(s.total);
  });

  it('rejects values beyond the documented precision', async () => {
    const p = await mkProject();
    const r = await request(app).post(`/api/projects/${p.id}/boqs`).send({ title: 'Ground floor works', items: [item({ quantity: '10000000' })] });
    expect(r.status).toBe(400);
  });
});

describe('GET /api/projects/:projectId/boqs and /api/boqs/:id', () => {
  it('lists only this project\'s BOQs with aggregated counts and totals', async () => {
    const a = await mkProject(); const other = await mkProject({ name: 'Other Project' });
    await mkBoq(a.id, { title: 'First BOQ', items: [item(), item({ estimatedUnitRate: undefined })] });
    await mkBoq(other.id, { title: 'Foreign BOQ' });
    const r = await request(app).get(`/api/projects/${a.id}/boqs`);
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(1);
    expect(r.body.data[0]).toMatchObject({ title: 'First BOQ', itemCount: 2, unpricedItemCount: 1, total: '50000.00', currency: 'INR', revision: 1 });
    expect((await request(app).get(`/api/projects/${(await mkProject({ name: 'Empty Project' })).id}/boqs`)).body.data).toEqual([]);
    expect((await request(app).get(`/api/projects/${MISSING}/boqs`)).status).toBe(404);
  });
  it('returns a BOQ with ordered items; 404 for unknown id; 400 for malformed id', async () => {
    const p = await mkProject();
    const b = await mkBoq(p.id, { items: [item({ description: 'A' }), item({ description: 'B' }), item({ description: 'C' })] });
    const r = await request(app).get(`/api/boqs/${b.id}`);
    expect(r.body.data.items.map((i: any) => i.description)).toEqual(['A', 'B', 'C']);
    expect((await request(app).get(`/api/boqs/${MISSING}`)).status).toBe(404);
    expect((await request(app).get('/api/boqs/not-a-uuid')).status).toBe(400);
  });
  it('round-trips special characters and long text unchanged', async () => {
    const p = await mkProject();
    const desc = `Tiles <b>"quoted"</b> & 'single' ₹ m² é ${'long '.repeat(180)}`.trim();
    const b = await mkBoq(p.id, { title: 'Spëcial & "chars" <test>', items: [item({ description: desc.slice(0, 1000) })] });
    const back = (await request(app).get(`/api/boqs/${b.id}`)).body.data;
    expect(back.title).toBe('Spëcial & "chars" <test>');
    expect(back.items[0].description).toBe(desc.slice(0, 1000).trim());
  });
});

describe('PUT /api/boqs/:id', () => {
  it('edits, reorders, adds and removes items atomically, preserving stable ids and bumping revision', async () => {
    const p = await mkProject();
    const b = await mkBoq(p.id, { items: [item({ description: 'A' }), item({ description: 'B' }), item({ description: 'C' })] });
    const [A, B, C] = b.items;
    const input = toInput(b, [C, { ...A, quantity: '4', description: 'A edited' }, { id: null, description: 'D new', specifications: null, quantity: '1', unit: 'day', estimatedUnitRate: '99.99' }]);
    input.title = 'Renamed BOQ';
    const r = await request(app).put(`/api/boqs/${b.id}`).send(input);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const u = r.body.data;
    expect(u.revision).toBe(2);
    expect(u.title).toBe('Renamed BOQ');
    expect(u.items.map((i: any) => [i.position, i.description])).toEqual([[1, 'C'], [2, 'A edited'], [3, 'D new']]);
    expect(u.items[0].id).toBe(C.id);
    expect(u.items[1].id).toBe(A.id);
    expect(u.items.some((i: any) => i.id === B.id)).toBe(false);
    expect(u.items[1].lineTotal).toBe('20000.00');
    expect(u.total).toBe(`${(50000 + 20000) + 99}.99`);
    expect(Date.parse(u.updatedAt)).toBeGreaterThanOrEqual(Date.parse(b.updatedAt));
    expect((await pool.query('SELECT count(*)::int AS n FROM boq_items')).rows[0].n).toBe(3);
  });

  it('rejects a stale revision with 409 and changes nothing', async () => {
    const p = await mkProject();
    const b = await mkBoq(p.id);
    expect((await request(app).put(`/api/boqs/${b.id}`).send({ ...toInput(b), title: 'First writer' })).status).toBe(200);
    const stale = await request(app).put(`/api/boqs/${b.id}`).send({ ...toInput(b), title: 'Second writer' });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('CONFLICT');
    const now = (await request(app).get(`/api/boqs/${b.id}`)).body.data;
    expect([now.title, now.revision]).toEqual(['First writer', 2]);
  });

  it('refuses item ids that belong to another BOQ (same or different project) and leaves both untouched', async () => {
    const p1 = await mkProject(); const p2 = await mkProject({ name: 'Second Project' });
    const mine = await mkBoq(p1.id, { title: 'Mine BOQ' });
    const sameProject = await mkBoq(p1.id, { title: 'Sibling BOQ', items: [item({ description: 'Sibling item' })] });
    const foreign = await mkBoq(p2.id, { title: 'Foreign BOQ', items: [item({ description: 'Foreign item' })] });
    for (const victim of [sameProject, foreign]) {
      const input = toInput(mine, [{ ...victim.items[0], description: 'HIJACKED' }]);
      const r = await request(app).put(`/api/boqs/${mine.id}`).send(input);
      expect(r.status).toBe(400);
      expect(r.body.error.details[0].field).toBe('items.0.id');
    }
    const check = await pool.query("SELECT description FROM boq_items WHERE description = 'HIJACKED'");
    expect(check.rowCount).toBe(0);
    expect((await request(app).get(`/api/boqs/${mine.id}`)).body.data.revision).toBe(1);
  });

  it('validates the body (missing revision, duplicate ids, unknown fields) and 404s unknown BOQs', async () => {
    const p = await mkProject(); const b = await mkBoq(p.id);
    const { revision, ...noRev } = toInput(b);
    expect((await request(app).put(`/api/boqs/${b.id}`).send(noRev)).status).toBe(400);
    const dup = toInput(b, [b.items[0], b.items[0]]);
    expect((await request(app).put(`/api/boqs/${b.id}`).send(dup)).status).toBe(400);
    expect((await request(app).put(`/api/boqs/${b.id}`).send({ ...toInput(b), projectId: MISSING })).status).toBe(400);
    expect((await request(app).put(`/api/boqs/${MISSING}`).send(toInput(b))).status).toBe(404);
  });

  it('rolls back the whole update (delete + upsert + metadata) when one item write fails', async () => {
    const p = await mkProject();
    const b = await mkBoq(p.id, { items: [item({ description: 'Keep A' }), item({ description: 'Will be removed' })] });
    await pool.query(`CREATE OR REPLACE FUNCTION boq_test_fail() RETURNS trigger AS $$ BEGIN
      IF NEW.description = 'BOOM' THEN RAISE EXCEPTION 'forced failure'; END IF; RETURN NEW; END $$ LANGUAGE plpgsql`);
    await pool.query('CREATE TRIGGER boq_test_fail BEFORE INSERT OR UPDATE ON boq_items FOR EACH ROW EXECUTE FUNCTION boq_test_fail()');
    try {
      const input = toInput(b, [b.items[0], { id: null, description: 'BOOM', specifications: null, quantity: '1', unit: 'm', estimatedUnitRate: '1' }]);
      input.title = 'Should not persist';
      const r = await request(app).put(`/api/boqs/${b.id}`).send(input);
      expect(r.status).toBe(500);
      expect(r.body.error.code).toBe('INTERNAL_ERROR');
      expect(JSON.stringify(r.body)).not.toMatch(/forced failure|boq_test_fail/);
    } finally {
      await pool.query('DROP TRIGGER IF EXISTS boq_test_fail ON boq_items');
      await pool.query('DROP FUNCTION IF EXISTS boq_test_fail()');
    }
    const now = (await request(app).get(`/api/boqs/${b.id}`)).body.data;
    expect([now.title, now.revision, now.items.map((i: any) => i.description)]).toEqual(['Ground floor works', 1, ['Keep A', 'Will be removed']]);
  });
});

describe('DELETE /api/boqs/:id and referential integrity', () => {
  it('deletes the BOQ and its items, leaves the project, and 404s afterwards', async () => {
    const p = await mkProject(); const b = await mkBoq(p.id); const keep = await mkBoq(p.id, { title: 'Keep me BOQ' });
    expect((await request(app).delete(`/api/boqs/${b.id}`)).status).toBe(204);
    expect((await request(app).get(`/api/boqs/${b.id}`)).status).toBe(404);
    expect((await request(app).delete(`/api/boqs/${b.id}`)).status).toBe(404);
    expect((await pool.query('SELECT count(*)::int AS n FROM boq_items WHERE boq_id = $1', [b.id])).rows[0].n).toBe(0);
    expect((await request(app).get(`/api/boqs/${keep.id}`)).body.data.items).toHaveLength(1);
    expect((await request(app).get(`/api/projects/${p.id}`)).status).toBe(200);
  });
  it('prevents deleting a project that still has BOQs (no orphans) and rejects invalid references', async () => {
    const p = await mkProject(); await mkBoq(p.id);
    await expect(pool.query('DELETE FROM projects WHERE id = $1', [p.id])).rejects.toThrow(/foreign key/i);
    await expect(pool.query("INSERT INTO boqs (project_id, title, currency) VALUES ($1, 'Orphan BOQ', 'INR')", [MISSING])).rejects.toThrow(/foreign key/i);
    await expect(pool.query("INSERT INTO boq_items (boq_id, position, description, quantity, unit) VALUES ($1, 1, 'x', 1, 'm')", [MISSING])).rejects.toThrow(/foreign key/i);
  });
  it('does not change project behaviour or the dashboard', async () => {
    const p = await mkProject(); await mkBoq(p.id);
    const d = (await request(app).get('/api/dashboard/summary')).body.data;
    expect(d.totals.totalProjects).toBe(1);
    expect((await request(app).get('/api/projects')).body.pagination.totalItems).toBe(1);
  });
});

describe('GET /api/boqs/:id/pdf', () => {
  it('returns a real PDF attachment with a non-sensitive predictable filename', async () => {
    const p = await mkProject(); const b = await mkBoq(p.id, { title: 'Confidential Tower BOQ' });
    const r = await request(app).get(`/api/boqs/${b.id}/pdf?revision=1`).buffer(true).parse((res, cb) => { const c: Buffer[] = []; res.on('data', (d: Buffer) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); });
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toBe('application/pdf');
    expect(r.headers['content-disposition']).toBe(`attachment; filename="TenderLens-BOQ-${b.id.slice(0, 8)}-r1.pdf"`);
    expect(r.headers['content-disposition']).not.toMatch(/Confidential|Tower|Acme|Office/);
    expect(r.headers['cache-control']).toBe('no-store');
    const body = r.body as Buffer;
    expect(body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(body.subarray(-8).toString()).toContain('%%EOF');
  });
  it('does not modify saved data', async () => {
    const p = await mkProject(); const b = await mkBoq(p.id, { items: [item(), item({ estimatedUnitRate: undefined })] });
    const before = await pool.query('SELECT (SELECT row_to_json(x) FROM boqs x WHERE id=$1) AS b, (SELECT json_agg(i ORDER BY position) FROM boq_items i WHERE boq_id=$1) AS items', [b.id]);
    for (let n = 0; n < 2; n++) expect((await request(app).get(`/api/boqs/${b.id}/pdf`)).status).toBe(200);
    const after = await pool.query('SELECT (SELECT row_to_json(x) FROM boqs x WHERE id=$1) AS b, (SELECT json_agg(i ORDER BY position) FROM boq_items i WHERE boq_id=$1) AS items', [b.id]);
    expect(after.rows[0]).toEqual(before.rows[0]);
  });
  it('409s when the previewed revision is stale; 404/400 for bad ids; 400 for bad revision', async () => {
    const p = await mkProject(); const b = await mkBoq(p.id);
    await request(app).put(`/api/boqs/${b.id}`).send({ ...toInput(b), title: 'Changed title' });
    const stale = await request(app).get(`/api/boqs/${b.id}/pdf?revision=1`);
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('CONFLICT');
    expect((await request(app).get(`/api/boqs/${b.id}/pdf?revision=2`)).status).toBe(200);
    expect((await request(app).get(`/api/boqs/${MISSING}/pdf`)).status).toBe(404);
    expect((await request(app).get('/api/boqs/bad/pdf')).status).toBe(400);
    expect((await request(app).get(`/api/boqs/${b.id}/pdf?revision=abc`)).status).toBe(400);
  });
  it('returns 422 UNSUPPORTED_CHARACTERS (not a corrupted PDF) for text the font cannot draw', async () => {
    const p = await mkProject(); const b = await mkBoq(p.id, { items: [item({ description: 'सीमेंट कंक्रीट' })] });
    const r = await request(app).get(`/api/boqs/${b.id}/pdf`);
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe('UNSUPPORTED_CHARACTERS');
    expect(r.body.error.details[0].field).toBe('item 1 description');
  });
  it('generates a multi-page PDF for a long persisted BOQ', async () => {
    const p = await mkProject();
    const b = await mkBoq(p.id, { items: Array.from({ length: 60 }, (_, n) => item({ description: `Item ${n + 1} ${'lorem ipsum '.repeat(12)}`.trim(), specifications: 'spec '.repeat(10).trim() })) });
    const r = await request(app).get(`/api/boqs/${b.id}/pdf`).buffer(true).parse((res, cb) => { const c: Buffer[] = []; res.on('data', (d: Buffer) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); });
    expect(r.status).toBe(200);
    const { extractPages } = await import('./pdfText.js');
    expect((await extractPages(r.body as Buffer)).length).toBeGreaterThan(2);
  });
});
