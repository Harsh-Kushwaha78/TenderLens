import { z } from 'zod';

/* ---------- Shared contract constants (see docs/INTEGRATION_CONTRACTS.md) ---------- */
export const PROJECT_STATUSES = ['draft', 'planning', 'active', 'on_hold', 'completed', 'cancelled'] as const;
export const CREATABLE_STATUSES = ['draft', 'planning'] as const;
export const PROJECT_TYPES = [
  'building_renovation',
  'interior_fitout',
  'civil_works',
  'electrical_works',
  'plumbing_works',
  'other',
] as const;
export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED'] as const;
export const SORT_FIELDS = ['name', 'createdAt', 'plannedBudget', 'targetCompletionDate'] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectType = (typeof PROJECT_TYPES)[number];
export type Currency = (typeof CURRENCIES)[number];

/** Proposed workflow (pending project-lead confirmation). Same-status updates are always allowed. */
export const STATUS_TRANSITIONS: Record<ProjectStatus, readonly ProjectStatus[]> = {
  draft: ['planning', 'cancelled'],
  planning: ['active', 'on_hold', 'cancelled'],
  active: ['on_hold', 'completed', 'cancelled'],
  on_hold: ['active', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function isTransitionAllowed(from: ProjectStatus, to: ProjectStatus): boolean {
  return from === to || STATUS_TRANSITIONS[from].includes(to);
}

/* ---------- Field validators ---------- */
const MONEY_RE = /^(0|[1-9]\d{0,12})(\.\d{1,2})?$/;

/** Pads a validated decimal string to exactly 2 fraction digits using string ops only. */
export function normalizeMoney(value: string): string {
  const [whole, frac = ''] = value.split('.');
  return `${whole}.${frac.padEnd(2, '0')}`;
}

export function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const moneyString = z
  .string({ invalid_type_error: 'Must be a decimal string such as "1000000.00".', required_error: 'Required.' })
  .trim()
  .refine((v) => MONEY_RE.test(v), 'Must be a non-negative decimal string with up to 13 whole digits and 2 decimals.')
  .transform(normalizeMoney);

const positiveMoney = moneyString.refine((v) => v !== '0.00', 'Must be greater than zero.');

const dateString = z
  .string({ invalid_type_error: 'Must be a date string (YYYY-MM-DD).', required_error: 'Required.' })
  .refine(isValidCalendarDate, 'Must be a valid calendar date in YYYY-MM-DD format.');

const requiredText = (label: string, min: number, max: number) =>
  z
    .string({ invalid_type_error: `${label} must be text.`, required_error: `${label} is required.` })
    .trim()
    .min(min, min === 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be at most ${max} characters.`);

const locationSchema = z
  .object({
    city: requiredText('City', 1, 80),
    state: requiredText('State', 1, 80),
    postalCode: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9][A-Za-z0-9 -]{1,8}[A-Za-z0-9]$/, 'Postal code must be 3-10 letters, digits, spaces or hyphens.')
      .nullable()
      .optional()
      .or(z.literal('').transform(() => null)),
  })
  .strict();

const descriptionSchema = z
  .string()
  .trim()
  .max(2000, 'Description must be at most 2000 characters.')
  .nullable()
  .optional()
  .transform((v) => (v ? v : null));

const baseFields = {
  name: requiredText('Project name', 3, 120),
  projectType: z.enum(PROJECT_TYPES, { errorMap: () => ({ message: `Must be one of: ${PROJECT_TYPES.join(', ')}.` }) }),
  clientName: requiredText('Client name', 2, 120),
  location: locationSchema,
  description: descriptionSchema,
  plannedBudget: positiveMoney,
  currency: z.enum(CURRENCIES, { errorMap: () => ({ message: `Must be one of: ${CURRENCIES.join(', ')}.` }) }),
  contingencyBudget: moneyString.nullable().optional(),
  plannedStartDate: dateString,
  targetCompletionDate: dateString,
};

export const DATE_ORDER_MESSAGE = 'Target completion date must be on or after the planned start date.';

export const createProjectSchema = z
  .object({
    ...baseFields,
    status: z.enum(CREATABLE_STATUSES, { errorMap: () => ({ message: `New projects can only start as: ${CREATABLE_STATUSES.join(', ')}.` }) }).default('draft'),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.plannedStartDate && v.targetCompletionDate && v.targetCompletionDate < v.plannedStartDate) {
      ctx.addIssue({ code: 'custom', path: ['targetCompletionDate'], message: DATE_ORDER_MESSAGE });
    }
  });

export const updateProjectSchema = z
  .object({
    ...baseFields,
    status: z.enum(PROJECT_STATUSES, { errorMap: () => ({ message: `Must be one of: ${PROJECT_STATUSES.join(', ')}.` }) }),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update.' });

export type CreateProjectInput = z.output<typeof createProjectSchema>;
export type UpdateProjectInput = z.output<typeof updateProjectSchema>;

/* ---------- List query ---------- */
const csvList = <T extends readonly [string, ...string[]]>(values: T, label: string) =>
  z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v === undefined ? [] : (Array.isArray(v) ? v : [v]).flatMap((s) => s.split(',')).map((s) => s.trim()).filter(Boolean)))
    .refine((arr) => arr.every((x) => (values as readonly string[]).includes(x)), `${label} contains an unsupported value. Allowed: ${values.join(', ')}.`)
    .transform((arr) => arr as T[number][]);

const boolParam = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => v === 'true');

export const listQuerySchema = z.object({
  q: z.string().trim().max(100, 'Search text must be at most 100 characters.').optional().transform((v) => v || undefined),
  status: csvList(PROJECT_STATUSES, 'status'),
  projectType: csvList(PROJECT_TYPES, 'projectType'),
  sortBy: z.enum(SORT_FIELDS).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  includeDemo: boolParam,
});
export type ListQuery = z.output<typeof listQuerySchema>;

export const dashboardQuerySchema = z.object({
  includeDemo: boolParam,
  currency: z.enum(CURRENCIES).optional(),
});
export type DashboardQuery = z.output<typeof dashboardQuerySchema>;

/* ---------- Helpers ---------- */
export function zodToDetails(error: z.ZodError, raw?: unknown): { field: string; message: string }[] {
  const details = error.issues.map((i) => ({ field: i.path.join('.') || '_', message: i.message }));
  // Zod skips object-level refinements when other fields are invalid; surface the date-order problem anyway
  // so users see every error at once.
  const r = raw as { plannedStartDate?: unknown; targetCompletionDate?: unknown } | null;
  if (
    r && typeof r.plannedStartDate === 'string' && typeof r.targetCompletionDate === 'string' &&
    isValidCalendarDate(r.plannedStartDate) && isValidCalendarDate(r.targetCompletionDate) &&
    r.targetCompletionDate < r.plannedStartDate &&
    !details.some((d) => d.field === 'targetCompletionDate')
  ) {
    details.push({ field: 'targetCompletionDate', message: DATE_ORDER_MESSAGE });
  }
  return details;
}
