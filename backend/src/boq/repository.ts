import type pg from 'pg';
import type { Pool } from '../db.js';
import { ApiError, validationError } from '../errors.js';
import type { Currency } from '../schemas.js';
import type { BoqUnit, CreateBoqInput, UpdateBoqInput } from './schemas.js';

type Db = Pick<pg.Pool, 'query'>;

export interface BoqItem {
  id: string; position: number; description: string; specifications: string | null;
  quantity: string; unit: BoqUnit; estimatedRate: string | null; lineTotal: string | null;
}
export interface BoqProjectRef {
  id: string; name: string; clientName: string; location: { city: string; state: string; postalCode: string | null };
  currency: Currency; isDemo: boolean;
}
export interface Boq {
  id: string; projectId: string; title: string; description: string | null; currency: Currency; revision: number;
  total: string; pricedItemCount: number; unpricedItemCount: number; items: BoqItem[];
  project: BoqProjectRef; createdAt: string; updatedAt: string;
}
export interface BoqSummary {
  id: string; projectId: string; title: string; currency: Currency; revision: number;
  itemCount: number; unpricedItemCount: number; total: string; createdAt: string; updatedAt: string;
}

const toMinor = (d: string) => BigInt(d.replace('.', ''));
const fromMinor = (m: bigint) => { const s = m.toString().padStart(3, '0'); return `${s.slice(0, -2)}.${s.slice(-2)}`; };

export async function getBoq(db: Db, id: string): Promise<Boq | null> {
  const b = await db.query(
    `SELECT b.id, b.project_id, b.title, b.description, b.currency, b.revision, b.created_at, b.updated_at,
            p.name AS p_name, p.client_name AS p_client, p.location_city, p.location_state, p.location_postal_code,
            p.currency AS p_currency, p.is_demo AS p_is_demo
     FROM boqs b JOIN projects p ON p.id = b.project_id WHERE b.id = $1`, [id]);
  const r = b.rows[0];
  if (!r) return null;
  const it = await db.query(
    `SELECT id, position, description, specifications, quantity, unit, estimated_rate, line_total
     FROM boq_items WHERE boq_id = $1 ORDER BY position`, [id]);
  const items: BoqItem[] = it.rows.map((x) => ({
    id: x.id, position: x.position, description: x.description, specifications: x.specifications ?? null,
    quantity: x.quantity, unit: x.unit, estimatedRate: x.estimated_rate ?? null, lineTotal: x.line_total ?? null,
  }));
  const priced = items.filter((i) => i.lineTotal !== null);
  const total = fromMinor(priced.reduce((s, i) => s + toMinor(i.lineTotal!), 0n));
  return {
    id: r.id, projectId: r.project_id, title: r.title, description: r.description ?? null,
    currency: String(r.currency).trim() as Currency, revision: r.revision,
    total, pricedItemCount: priced.length, unpricedItemCount: items.length - priced.length, items,
    project: {
      id: r.project_id, name: r.p_name, clientName: r.p_client,
      location: { city: r.location_city, state: r.location_state, postalCode: r.location_postal_code ?? null },
      currency: String(r.p_currency).trim() as Currency, isDemo: r.p_is_demo,
    },
    createdAt: new Date(r.created_at).toISOString(), updatedAt: new Date(r.updated_at).toISOString(),
  };
}

/** One aggregate query (no N+1) for all BOQs of a project. */
export async function listBoqs(db: Db, projectId: string): Promise<BoqSummary[]> {
  const res = await db.query(
    `SELECT b.id, b.project_id, b.title, b.currency, b.revision, b.created_at, b.updated_at,
            count(i.id)::int AS item_count,
            count(i.id) FILTER (WHERE i.line_total IS NULL)::int AS unpriced,
            COALESCE(sum(i.line_total), 0)::text AS total
     FROM boqs b LEFT JOIN boq_items i ON i.boq_id = b.id
     WHERE b.project_id = $1 GROUP BY b.id ORDER BY b.updated_at DESC, b.id ASC`, [projectId]);
  return res.rows.map((r) => ({
    id: r.id, projectId: r.project_id, title: r.title, currency: String(r.currency).trim() as Currency, revision: r.revision,
    itemCount: r.item_count, unpricedItemCount: r.unpriced, total: r.total,
    createdAt: new Date(r.created_at).toISOString(), updatedAt: new Date(r.updated_at).toISOString(),
  }));
}

async function withTx<T>(pool: Pool, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally { client.release(); }
}

async function upsertItems(c: pg.PoolClient, boqId: string, items: CreateBoqInput['items']) {
  if (items.length === 0) return;
  // Ownership guard: ON CONFLICT may only update rows already belonging to THIS boq.
  await c.query(
    `INSERT INTO boq_items (id, boq_id, position, description, specifications, quantity, unit, estimated_rate)
     SELECT COALESCE(t.id, gen_random_uuid()), $1, t.position, t.description, t.specifications, t.quantity::numeric, t.unit, t.rate::numeric
     FROM unnest($2::uuid[], $3::int[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[])
          AS t(id, position, description, specifications, quantity, unit, rate)
     ON CONFLICT (id) DO UPDATE SET position = EXCLUDED.position, description = EXCLUDED.description,
       specifications = EXCLUDED.specifications, quantity = EXCLUDED.quantity, unit = EXCLUDED.unit,
       estimated_rate = EXCLUDED.estimated_rate, updated_at = now()
     WHERE boq_items.boq_id = EXCLUDED.boq_id`,
    [boqId, items.map((i) => i.id), items.map((_, n) => n + 1), items.map((i) => i.description),
     items.map((i) => i.specifications), items.map((i) => i.quantity), items.map((i) => i.unit), items.map((i) => i.estimatedRate)],
  );
}

/** Returns null when the project does not exist. */
export async function createBoq(pool: Pool, projectId: string, input: CreateBoqInput): Promise<Boq | null> {
  return withTx(pool, async (c) => {
    const p = await c.query('SELECT currency FROM projects WHERE id = $1 FOR SHARE', [projectId]);
    if (!p.rows[0]) return null;
    // Items sent on create must be new: client-supplied ids would reference rows that do not exist yet.
    const bad = input.items.findIndex((i) => i.id !== null);
    if (bad !== -1) throw validationError([{ field: `items.${bad}.id`, message: 'New BOQ items must not include an id.' }]);
    const ins = await c.query(
      'INSERT INTO boqs (project_id, title, description, currency) VALUES ($1,$2,$3,$4) RETURNING id',
      [projectId, input.title, input.description, p.rows[0].currency]);
    await upsertItems(c, ins.rows[0].id, input.items);
    return getBoq(c, ins.rows[0].id);
  });
}

/** Full replace of metadata + items, atomically, guarded by optimistic concurrency. Returns null if BOQ not found. */
export async function replaceBoq(pool: Pool, id: string, input: UpdateBoqInput): Promise<Boq | null> {
  return withTx(pool, async (c) => {
    const cur = await c.query('SELECT revision FROM boqs WHERE id = $1 FOR UPDATE', [id]);
    if (!cur.rows[0]) return null;
    if (cur.rows[0].revision !== input.revision) {
      throw new ApiError(409, 'CONFLICT', 'This BOQ was changed by someone else since you opened it. Reload to see the latest version.',
        [{ field: 'revision', message: `Saved revision is ${cur.rows[0].revision}; you edited revision ${input.revision}.` }]);
    }
    const supplied = input.items.map((i) => i.id).filter((x): x is string => x !== null);
    if (supplied.length) {
      const own = await c.query('SELECT id FROM boq_items WHERE boq_id = $1 AND id = ANY($2::uuid[])', [id, supplied]);
      const ownIds = new Set(own.rows.map((r) => r.id));
      const details = input.items.flatMap((it, n) => (it.id && !ownIds.has(it.id)
        ? [{ field: `items.${n}.id`, message: 'This item does not belong to this BOQ.' }] : []));
      if (details.length) throw validationError(details);
    }
    await c.query('DELETE FROM boq_items WHERE boq_id = $1 AND NOT (id = ANY($2::uuid[]))', [id, supplied]);
    await upsertItems(c, id, input.items);
    await c.query('UPDATE boqs SET title=$2, description=$3, revision = revision + 1, updated_at = now() WHERE id=$1',
      [id, input.title, input.description]);
    return getBoq(c, id);
  });
}

export async function deleteBoq(db: Db, id: string): Promise<boolean> {
  const r = await db.query('DELETE FROM boqs WHERE id = $1', [id]);
  return (r.rowCount ?? 0) > 0;
}
