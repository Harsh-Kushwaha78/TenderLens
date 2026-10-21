import type pg from 'pg';
import type { Pool } from '../db.js';
import {
  type CreateProjectInput,
  type ListQuery,
  type ProjectStatus,
  type ProjectType,
  type Currency,
  type UpdateProjectInput,
} from '../schemas.js';

export interface Project {
  id: string;
  name: string;
  projectType: ProjectType;
  clientName: string;
  location: { city: string; state: string; postalCode: string | null };
  description: string | null;
  plannedBudget: string;
  currency: Currency;
  contingencyBudget: string | null;
  plannedStartDate: string;
  targetCompletionDate: string;
  status: ProjectStatus;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export const COLUMNS = `id, name, project_type, client_name, location_city, location_state, location_postal_code,
  description, planned_budget, currency, contingency_budget, planned_start_date, target_completion_date,
  status, is_demo, created_at, updated_at`;

export function rowToProject(r: Record<string, any>): Project {
  return {
    id: r.id,
    name: r.name,
    projectType: r.project_type,
    clientName: r.client_name,
    location: { city: r.location_city, state: r.location_state, postalCode: r.location_postal_code ?? null },
    description: r.description ?? null,
    plannedBudget: r.planned_budget,
    currency: String(r.currency).trim() as Currency,
    contingencyBudget: r.contingency_budget ?? null,
    plannedStartDate: r.planned_start_date,
    targetCompletionDate: r.target_completion_date,
    status: r.status,
    isDemo: r.is_demo,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export async function insertProject(
  pool: Pool,
  input: CreateProjectInput,
  idempotencyKey: string | null,
): Promise<{ project: Project; created: boolean }> {
  const res = await pool.query(
    `INSERT INTO projects (name, project_type, client_name, location_city, location_state, location_postal_code,
        description, planned_budget, currency, contingency_budget, planned_start_date, target_completion_date,
        status, idempotency_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING ${COLUMNS}`,
    [
      input.name, input.projectType, input.clientName, input.location.city, input.location.state,
      input.location.postalCode ?? null, input.description ?? null, input.plannedBudget, input.currency,
      input.contingencyBudget ?? null, input.plannedStartDate, input.targetCompletionDate, input.status,
      idempotencyKey,
    ],
  );
  if (res.rows[0]) return { project: rowToProject(res.rows[0]), created: true };
  // Idempotent replay: same key already used -> return the originally created project.
  const existing = await pool.query(`SELECT ${COLUMNS} FROM projects WHERE idempotency_key = $1`, [idempotencyKey]);
  return { project: rowToProject(existing.rows[0]), created: false };
}

export async function findProject(pool: Pool, id: string): Promise<Project | null> {
  const res = await pool.query(`SELECT ${COLUMNS} FROM projects WHERE id = $1`, [id]);
  return res.rows[0] ? rowToProject(res.rows[0]) : null;
}

const SORT_SQL: Record<ListQuery['sortBy'], string> = {
  name: 'lower(name)',
  createdAt: 'created_at',
  plannedBudget: 'planned_budget',
  targetCompletionDate: 'target_completion_date',
};

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function listProjects(pool: Pool, q: ListQuery): Promise<{ items: Project[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (v: unknown) => { params.push(v); return `$${params.length}`; };

  if (!q.includeDemo) where.push('is_demo = FALSE');
  if (q.q) {
    const p = add(`%${escapeLike(q.q)}%`);
    where.push(`(name ILIKE ${p} OR client_name ILIKE ${p} OR location_city ILIKE ${p} OR location_state ILIKE ${p})`);
  }
  if (q.status.length) where.push(`status = ANY(${add(q.status)})`);
  if (q.projectType.length) where.push(`project_type = ANY(${add(q.projectType)})`);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const filterParams = [...params];

  const dir = q.sortOrder === 'asc' ? 'ASC' : 'DESC'; // whitelisted, never user text
  const limit = add(q.pageSize);
  const offset = add((q.page - 1) * q.pageSize);

  const [rows, count] = await Promise.all([
    pool.query(
      `SELECT ${COLUMNS} FROM projects ${whereSql} ORDER BY ${SORT_SQL[q.sortBy]} ${dir}, id ASC LIMIT ${limit} OFFSET ${offset}`,
      params,
    ),
    pool.query(`SELECT count(*)::int AS total FROM projects ${whereSql}`, filterParams),
  ]);
  return { items: rows.rows.map(rowToProject), total: count.rows[0].total };
}

/**
 * Locks the row, lets the caller validate the merged result, then writes it.
 * `prepare` may throw an ApiError to abort (transition / date-order checks).
 */
export async function updateProject(
  pool: Pool,
  id: string,
  patch: UpdateProjectInput,
  prepare: (current: Project, patch: UpdateProjectInput) => void,
): Promise<Project | null> {
  const client: pg.PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');
    const cur = await client.query(`SELECT ${COLUMNS} FROM projects WHERE id = $1 FOR UPDATE`, [id]);
    if (!cur.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }
    const current = rowToProject(cur.rows[0]);
    prepare(current, patch);

    const m = {
      name: patch.name ?? current.name,
      projectType: patch.projectType ?? current.projectType,
      clientName: patch.clientName ?? current.clientName,
      location: patch.location ?? current.location,
      description: patch.description !== undefined ? patch.description : current.description,
      plannedBudget: patch.plannedBudget ?? current.plannedBudget,
      currency: patch.currency ?? current.currency,
      contingencyBudget: patch.contingencyBudget !== undefined ? patch.contingencyBudget : current.contingencyBudget,
      plannedStartDate: patch.plannedStartDate ?? current.plannedStartDate,
      targetCompletionDate: patch.targetCompletionDate ?? current.targetCompletionDate,
      status: patch.status ?? current.status,
    };
    const upd = await client.query(
      `UPDATE projects SET name=$2, project_type=$3, client_name=$4, location_city=$5, location_state=$6,
         location_postal_code=$7, description=$8, planned_budget=$9, currency=$10, contingency_budget=$11,
         planned_start_date=$12, target_completion_date=$13, status=$14, updated_at=now()
       WHERE id=$1 RETURNING ${COLUMNS}`,
      [
        id, m.name, m.projectType, m.clientName, m.location.city, m.location.state, m.location.postalCode ?? null,
        m.description, m.plannedBudget, m.currency, m.contingencyBudget, m.plannedStartDate, m.targetCompletionDate,
        m.status,
      ],
    );
    await client.query('COMMIT');
    return rowToProject(upd.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
