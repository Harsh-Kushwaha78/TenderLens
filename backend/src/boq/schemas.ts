import { z } from 'zod';
import { normalizeQuantity, normalizeRate, QUANTITY_RE, RATE_RE } from './calc.js';

export const BOQ_UNITS = ['m', 'm2', 'm3', 'sqft', 'kg', 'tonne', 'litre', 'piece', 'set', 'bag', 'day', 'lump_sum'] as const;
export type BoqUnit = (typeof BOQ_UNITS)[number];
export const MAX_BOQ_ITEMS = 500;

const text = (label: string, min: number, max: number) =>
  z.string({ invalid_type_error: `${label} must be text.`, required_error: `${label} is required.` })
    .trim()
    .min(min, min <= 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be at most ${max} characters.`);

const optionalText = (label: string, max: number) =>
  z.string({ invalid_type_error: `${label} must be text.` }).trim().max(max, `${label} must be at most ${max} characters.`)
    .nullable().optional().transform((v) => (v ? v : null));

const quantity = z
  .string({ invalid_type_error: 'Quantity must be a decimal string such as "12.5".', required_error: 'Quantity is required.' })
  .trim()
  .refine((v) => QUANTITY_RE.test(v), 'Quantity must be a number with up to 7 whole digits and 3 decimals.')
  .refine((v) => !/^0(\.0+)?$/.test(v), 'Quantity must be greater than zero.')
  .transform(normalizeQuantity);

const rate = z
  .string({ invalid_type_error: 'Rate must be a decimal string such as "1250.00".' })
  .trim()
  .refine((v) => RATE_RE.test(v), 'Rate must be a non-negative number with up to 8 whole digits and 2 decimals.')
  .transform(normalizeRate)
  .nullable()
  .optional()
  .transform((v) => v ?? null);

const itemSchema = z.object({
  id: z.string().uuid('Item id must be a valid UUID.').nullable().optional().transform((v) => v ?? null),
  description: text('Item description', 1, 1000),
  specifications: optionalText('Specifications', 1000),
  quantity,
  unit: z.enum(BOQ_UNITS, { errorMap: () => ({ message: `Unit must be one of: ${BOQ_UNITS.join(', ')}.` }) }),
  estimatedRate: rate,
}).strict();

const boqFields = {
  title: text('BOQ title', 3, 150),
  description: optionalText('Description', 2000),
  items: z.array(itemSchema, { required_error: 'items is required.', invalid_type_error: 'items must be an array.' })
    .max(MAX_BOQ_ITEMS, `A BOQ can have at most ${MAX_BOQ_ITEMS} items.`)
    .superRefine((items, ctx) => {
      const seen = new Set<string>();
      items.forEach((it, i) => {
        if (it.id) {
          if (seen.has(it.id)) ctx.addIssue({ code: 'custom', path: [i, 'id'], message: 'Duplicate item id in request.' });
          seen.add(it.id);
        }
      });
    }),
};

/** Totals, line totals and positions are NEVER accepted from clients (strict) - the server derives them. */
export const createBoqSchema = z.object(boqFields).strict();
export const updateBoqSchema = z
  .object({ ...boqFields, revision: z.number({ invalid_type_error: 'revision must be an integer.', required_error: 'revision is required.' }).int().min(1) })
  .strict();

export type CreateBoqInput = z.output<typeof createBoqSchema>;
export type UpdateBoqInput = z.output<typeof updateBoqSchema>;
export const pdfQuerySchema = z.object({ revision: z.coerce.number().int().min(1).optional() });
