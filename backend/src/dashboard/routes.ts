import { Router } from 'express';
import type { Pool } from '../db.js';
import { validationError } from '../errors.js';
import { dashboardQuerySchema, PROJECT_STATUSES, zodToDetails } from '../schemas.js';
import { COLUMNS, rowToProject } from '../projects/repository.js';

export const APPROACHING_WINDOW_DAYS = 30;
/** Statuses where a target completion date is still a live commitment. */
const OPEN_STATUSES = ['planning', 'active', 'on_hold'];
const MIN_TREND_PROJECTS = 5;

export function dashboardRouter(pool: Pool, timezone: string): Router {
  const router = Router();

  router.get('/summary', async (req, res, next) => {
    try {
      const parsed = dashboardQuerySchema.safeParse(req.query);
      if (!parsed.success) throw validationError(zodToDetails(parsed.error));
      const { includeDemo, currency } = parsed.data;
      // Static SQL fragments only (never user text).
      const demo = includeDemo ? 'TRUE' : 'NOT is_demo';

      const [totalsR, statusR, currencyR, recentR, trendR, todayR] = await Promise.all([
        pool.query(
          `WITH t AS (SELECT (now() AT TIME ZONE $1)::date AS today)
           SELECT count(*)::int AS total_projects,
                  count(*) FILTER (WHERE status = 'active')::int AS active_projects,
                  count(*) FILTER (WHERE status = ANY($2) AND target_completion_date BETWEEN t.today AND t.today + $3::int)::int AS approaching,
                  count(*) FILTER (WHERE status = ANY($2) AND target_completion_date < t.today)::int AS overdue,
                  count(*) FILTER (WHERE is_demo)::int AS demo_projects
           FROM projects, t WHERE ${demo}`,
          [timezone, OPEN_STATUSES, APPROACHING_WINDOW_DAYS],
        ),
        pool.query(`SELECT status, count(*)::int AS count FROM projects WHERE ${demo} GROUP BY status`),
        pool.query(
          `SELECT currency, sum(planned_budget)::text AS total, count(*)::int AS project_count
           FROM projects WHERE ${demo} AND status <> 'cancelled' GROUP BY currency ORDER BY project_count DESC, currency ASC`,
        ),
        pool.query(`SELECT ${COLUMNS} FROM projects WHERE ${demo} ORDER BY created_at DESC, id ASC LIMIT 5`),
        pool.query(
          `WITH m AS (
             SELECT generate_series(date_trunc('month', now() AT TIME ZONE $1) - interval '5 months',
                                    date_trunc('month', now() AT TIME ZONE $1), interval '1 month') AS month)
           SELECT to_char(m.month, 'YYYY-MM') AS month, count(p.id)::int AS count
           FROM m LEFT JOIN projects p
             ON date_trunc('month', p.created_at AT TIME ZONE $1) = m.month AND ${includeDemo ? 'TRUE' : 'NOT p.is_demo'}
           GROUP BY m.month ORDER BY m.month`,
          [timezone],
        ),
        pool.query(`SELECT to_char((now() AT TIME ZONE $1)::date, 'YYYY-MM-DD') AS today`, [timezone]),
      ]);

      const totals = totalsR.rows[0];
      const counts = new Map<string, number>(statusR.rows.map((r) => [r.status, r.count]));
      const budgetByCurrency = currencyR.rows.map((r) => ({
        currency: String(r.currency).trim(), total: r.total as string, projectCount: r.project_count as number,
      }));
      const chartCurrency = currency ?? budgetByCurrency[0]?.currency ?? null;

      const topR = chartCurrency
        ? await pool.query(
            `SELECT id, name, planned_budget FROM projects
             WHERE ${demo} AND status <> 'cancelled' AND currency = $1 ORDER BY planned_budget DESC, id ASC LIMIT 8`,
            [chartCurrency],
          )
        : { rows: [] as any[] };

      const trendMonths = trendR.rows as { month: string; count: number }[];
      const trendTotal = trendMonths.reduce((s, m) => s + m.count, 0);
      const trendSufficient = trendTotal >= MIN_TREND_PROJECTS && trendMonths.filter((m) => m.count > 0).length >= 2;

      res.json({
        data: {
          asOfDate: todayR.rows[0].today,
          timezone,
          includesDemoData: Boolean(includeDemo),
          demoProjectCount: totals.demo_projects,
          totals: {
            totalProjects: totals.total_projects,
            activeProjects: totals.active_projects,
            approachingCompletion: totals.approaching,
            overdue: totals.overdue,
            approachingWindowDays: APPROACHING_WINDOW_DAYS,
          },
          plannedBudgetByCurrency: budgetByCurrency,
          statusDistribution: PROJECT_STATUSES.map((s) => ({ status: s, count: counts.get(s) ?? 0 })),
          budgetByProject: {
            currency: chartCurrency,
            items: topR.rows.map((r: any) => ({ id: r.id, name: r.name, plannedBudget: r.planned_budget as string })),
          },
          creationTrend: { sufficient: trendSufficient, months: trendMonths },
          recentProjects: recentR.rows.map(rowToProject),
        },
      });
    } catch (e) { next(e); }
  });

  return router;
}
