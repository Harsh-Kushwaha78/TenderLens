import { Router } from 'express';
import { z } from 'zod';
import type { Pool } from '../db.js';
import { ApiError, notFound, validationError } from '../errors.js';
import {
  DATE_ORDER_MESSAGE,
  createProjectSchema,
  isTransitionAllowed,
  listQuerySchema,
  updateProjectSchema,
  zodToDetails,
} from '../schemas.js';
import { findProject, insertProject, listProjects, updateProject } from './repository.js';

const idSchema = z.string().uuid('Project id must be a valid UUID.');
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_-]{8,100}$/;

function parseOrThrow<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, data: unknown, field?: string): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    const details = zodToDetails(r.error, data).map((d) => (field && d.field === '_' ? { ...d, field } : d));
    throw validationError(details);
  }
  return r.data;
}

export function projectsRouter(pool: Pool): Router {
  const router = Router();

  router.post('/', async (req, res, next) => {
    try {
      const input = parseOrThrow(createProjectSchema, req.body);
      const header = req.header('Idempotency-Key');
      if (header !== undefined && !IDEMPOTENCY_KEY_RE.test(header)) {
        throw validationError([{ field: 'Idempotency-Key', message: 'Must be 8-100 characters: letters, digits, "-" or "_".' }]);
      }
      const { project, created } = await insertProject(pool, input, header ?? null);
      if (created) res.status(201).location(`/api/projects/${project.id}`);
      else res.status(200).setHeader('Idempotent-Replayed', 'true');
      res.json({ data: project });
    } catch (e) { next(e); }
  });

  router.get('/', async (req, res, next) => {
    try {
      const q = parseOrThrow(listQuerySchema, req.query);
      const { items, total } = await listProjects(pool, q);
      res.json({
        data: items,
        pagination: { page: q.page, pageSize: q.pageSize, totalItems: total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) },
      });
    } catch (e) { next(e); }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const id = parseOrThrow(idSchema, req.params.id, 'id');
      const project = await findProject(pool, id);
      if (!project) throw notFound();
      res.json({ data: project });
    } catch (e) { next(e); }
  });

  router.patch('/:id', async (req, res, next) => {
    try {
      const id = parseOrThrow(idSchema, req.params.id, 'id');
      const patch = parseOrThrow(updateProjectSchema, req.body);
      const updated = await updateProject(pool, id, patch, (current, p) => {
        if (p.status && !isTransitionAllowed(current.status, p.status)) {
          throw new ApiError(409, 'INVALID_STATUS_TRANSITION', `Cannot change status from "${current.status}" to "${p.status}".`, [
            { field: 'status', message: `Transition ${current.status} -> ${p.status} is not allowed.` },
          ]);
        }
        const start = p.plannedStartDate ?? current.plannedStartDate;
        const end = p.targetCompletionDate ?? current.targetCompletionDate;
        if (end < start) throw validationError([{ field: 'targetCompletionDate', message: DATE_ORDER_MESSAGE }]);
      });
      if (!updated) throw notFound();
      res.json({ data: updated });
    } catch (e) { next(e); }
  });

  return router;
}
