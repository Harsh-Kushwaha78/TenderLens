import { Router } from 'express';
import { z } from 'zod';
import type { Pool } from '../db.js';
import { ApiError, notFound, validationError } from '../errors.js';
import { zodToDetails } from '../schemas.js';
import { boqPdfFilename, renderBoqPdf } from './pdf.js';
import { createBoq, deleteBoq, getBoq, listBoqs, replaceBoq } from './repository.js';
import { createBoqSchema, pdfQuerySchema, updateBoqSchema } from './schemas.js';

const uuid = (label: string) => z.string().uuid(`${label} must be a valid UUID.`);

function parse<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, data: unknown, field?: string): T {
  const r = schema.safeParse(data);
  if (!r.success) throw validationError(zodToDetails(r.error, undefined).map((d) => (field && d.field === '_' ? { ...d, field } : d)));
  return r.data;
}

/** Mounted at /api/projects/:projectId/boqs */
export function projectBoqsRouter(pool: Pool): Router {
  const router = Router({ mergeParams: true });
  router.get('/', async (req, res, next) => {
    try {
      const projectId = parse(uuid('Project id'), (req.params as { projectId?: string }).projectId, 'projectId');
      const exists = await pool.query('SELECT 1 FROM projects WHERE id = $1', [projectId]);
      if (!exists.rows[0]) throw notFound('Project not found.');
      res.json({ data: await listBoqs(pool, projectId) });
    } catch (e) { next(e); }
  });
  router.post('/', async (req, res, next) => {
    try {
      const projectId = parse(uuid('Project id'), (req.params as { projectId?: string }).projectId, 'projectId');
      const input = parse(createBoqSchema, req.body);
      const boq = await createBoq(pool, projectId, input);
      if (!boq) throw notFound('Project not found.');
      res.status(201).location(`/api/boqs/${boq.id}`).json({ data: boq });
    } catch (e) { next(e); }
  });
  return router;
}

/** Mounted at /api/boqs */
export function boqsRouter(pool: Pool): Router {
  const router = Router();
  const boqId = (v: unknown) => parse(uuid('BOQ id'), v, 'id');
  const notFoundBoq = () => notFound('BOQ not found.');

  router.get('/:id', async (req, res, next) => {
    try {
      const boq = await getBoq(pool, boqId(req.params.id));
      if (!boq) throw notFoundBoq();
      res.json({ data: boq });
    } catch (e) { next(e); }
  });

  router.put('/:id', async (req, res, next) => {
    try {
      const id = boqId(req.params.id);
      const boq = await replaceBoq(pool, id, parse(updateBoqSchema, req.body));
      if (!boq) throw notFoundBoq();
      res.json({ data: boq });
    } catch (e) { next(e); }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      if (!(await deleteBoq(pool, boqId(req.params.id)))) throw notFoundBoq();
      res.status(204).end();
    } catch (e) { next(e); }
  });

  // Generated on demand from the SAVED row (never from client-supplied data). If `revision` is given and the
  // saved revision differs (the user previewed an older version), respond 409 instead of silently exporting different data.
  router.get('/:id/pdf', async (req, res, next) => {
    try {
      const id = boqId(req.params.id);
      const { revision } = parse(pdfQuerySchema, req.query);
      const boq = await getBoq(pool, id);
      if (!boq) throw notFoundBoq();
      if (revision !== undefined && revision !== boq.revision) {
        throw new ApiError(409, 'CONFLICT', 'This BOQ changed after you opened the preview. Reload the preview, then download again.',
          [{ field: 'revision', message: `Saved revision is ${boq.revision}; requested ${revision}.` }]);
      }
      let pdf: Buffer;
      try { pdf = await renderBoqPdf(boq); }
      catch (err) {
        if (err instanceof ApiError) throw err;
        throw new ApiError(500, 'DOCUMENT_GENERATION_FAILED', 'The PDF could not be generated. Please try again.');
      }
      res.status(200)
        .setHeader('Content-Type', 'application/pdf')
        .setHeader('Content-Disposition', `attachment; filename="${boqPdfFilename(boq)}"`)
        .setHeader('Content-Length', String(pdf.length))
        .setHeader('Cache-Control', 'no-store')
        .end(pdf);
    } catch (e) { next(e); }
  });
  return router;
}
