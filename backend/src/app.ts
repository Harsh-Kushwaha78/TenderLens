import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import type { Config } from './config.js';
import type { Pool } from './db.js';
import { boqsRouter, projectBoqsRouter } from './boq/routes.js';
import { dashboardRouter } from './dashboard/routes.js';
import { ApiError } from './errors.js';
import { projectsRouter } from './projects/routes.js';

const DB_UNAVAILABLE_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', '57P01', '57P03', '08000', '08001', '08003', '08006']);

function isDbUnavailable(err: any): boolean {
  const codes = [err?.code, ...(Array.isArray(err?.errors) ? err.errors.map((e: any) => e?.code) : [])];
  return (
    codes.some((c) => DB_UNAVAILABLE_CODES.has(c)) ||
    /timeout exceeded when trying to connect|Connection terminated|Connection refused/i.test(String(err?.message))
  );
}

export function createApp(deps: { pool: Pool; config: Pick<Config, 'corsOrigin' | 'appTimezone' | 'nodeEnv'> }) {
  const { pool, config } = deps;
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });
  app.use(cors({ origin: config.corsOrigin, exposedHeaders: ['Location', 'Idempotent-Replayed', 'Content-Disposition'] }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', async (_req, res, next) => {
    try {
      await pool.query('SELECT 1');
      res.json({ data: { status: 'ok', database: 'up' } });
    } catch (e) { next(e); }
  });
  app.use('/api/projects/:projectId/boqs', projectBoqsRouter(pool));
  app.use('/api/projects', projectsRouter(pool));
  app.use('/api/boqs', boqsRouter(pool));
  app.use('/api/dashboard', dashboardRouter(pool, config.appTimezone));

  app.use((_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'Route not found.')));

  const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    let apiErr: ApiError;
    if (err instanceof ApiError) apiErr = err;
    else if (err?.type === 'entity.parse.failed') apiErr = new ApiError(400, 'BAD_REQUEST', 'Request body is not valid JSON.');
    else if (err?.type === 'entity.too.large') apiErr = new ApiError(400, 'BAD_REQUEST', 'Request body is too large.');
    else if (isDbUnavailable(err)) apiErr = new ApiError(503, 'SERVICE_UNAVAILABLE', 'The database is currently unavailable. Please try again shortly.');
    else apiErr = new ApiError(500, 'INTERNAL_ERROR', 'An unexpected error occurred.');

    if (apiErr.status >= 500 && config.nodeEnv !== 'test') {
      // Log type/code only; never request bodies, SQL parameters or connection strings.
      console.error(`[error] ${apiErr.code} ${err?.name ?? ''} ${err?.code ?? ''}`.trim());
    }
    res.status(apiErr.status).json({ error: { code: apiErr.code, message: apiErr.message, details: apiErr.details } });
  };
  app.use(errorHandler);
  return app;
}
