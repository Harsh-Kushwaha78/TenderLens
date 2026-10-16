import type { ApiErrorDetail, CreateProjectRequest, Currency, Project, ProjectStatus, ProjectType, UpdateProjectRequest } from '../api/types';
import { CURRENCIES, PROJECT_TYPES } from './constants';

/** All form fields are strings so money never passes through JS floating point. */
export interface FormValues {
  name: string; projectType: ProjectType | ''; clientName: string;
  city: string; state: string; postalCode: string; description: string;
  plannedBudget: string; currency: Currency; contingencyBudget: string;
  plannedStartDate: string; targetCompletionDate: string; status: ProjectStatus;
}
export type FieldKey = keyof FormValues;
export type FieldErrors = Partial<Record<FieldKey, string>>;

export const STEP_FIELDS: FieldKey[][] = [
  ['name', 'projectType', 'clientName', 'city', 'state', 'postalCode', 'description'],
  ['plannedBudget', 'currency', 'contingencyBudget', 'plannedStartDate', 'targetCompletionDate'],
  [],
];

export const emptyValues = (): FormValues => ({
  name: '', projectType: '', clientName: '', city: '', state: '', postalCode: '', description: '',
  plannedBudget: '', currency: 'INR', contingencyBudget: '', plannedStartDate: '', targetCompletionDate: '', status: 'draft',
});

export const MONEY_RE = /^(0|[1-9]\d{0,12})(\.\d{1,2})?$/;
const POSTAL_RE = /^[A-Za-z0-9][A-Za-z0-9 -]{1,8}[A-Za-z0-9]$/;

export function isValidDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function validateValues(v: FormValues, fields?: FieldKey[]): FieldErrors {
  const e: FieldErrors = {};
  const name = v.name.trim(), client = v.clientName.trim(), city = v.city.trim(), state = v.state.trim();
  if (name.length < 3) e.name = name ? 'Project name must be at least 3 characters.' : 'Project name is required.';
  else if (name.length > 120) e.name = 'Project name must be at most 120 characters.';
  if (!PROJECT_TYPES.includes(v.projectType as ProjectType)) e.projectType = 'Select a project type.';
  if (client.length < 2) e.clientName = client ? 'Client name must be at least 2 characters.' : 'Client or organization is required.';
  else if (client.length > 120) e.clientName = 'Client name must be at most 120 characters.';
  if (!city) e.city = 'City is required.'; else if (city.length > 80) e.city = 'City must be at most 80 characters.';
  if (!state) e.state = 'State is required.'; else if (state.length > 80) e.state = 'State must be at most 80 characters.';
  if (v.postalCode.trim() && !POSTAL_RE.test(v.postalCode.trim())) e.postalCode = 'Use 3-10 letters, digits, spaces or hyphens.';
  if (v.description.trim().length > 2000) e.description = 'Description must be at most 2000 characters.';

  const budget = v.plannedBudget.trim();
  if (!budget) e.plannedBudget = 'Planned budget is required.';
  else if (budget.startsWith('-')) e.plannedBudget = 'Budget cannot be negative.';
  else if (!MONEY_RE.test(budget)) e.plannedBudget = 'Enter a number with up to 2 decimals (no commas or symbols).';
  else if (/^0+(\.0+)?$/.test(budget)) e.plannedBudget = 'Planned budget must be greater than zero.';
  if (!CURRENCIES.includes(v.currency)) e.currency = 'Select a currency.';
  const cont = v.contingencyBudget.trim();
  if (cont) {
    if (cont.startsWith('-')) e.contingencyBudget = 'Contingency cannot be negative.';
    else if (!MONEY_RE.test(cont)) e.contingencyBudget = 'Enter a number with up to 2 decimals (no commas or symbols).';
  }
  if (!v.plannedStartDate) e.plannedStartDate = 'Planned start date is required.';
  else if (!isValidDate(v.plannedStartDate)) e.plannedStartDate = 'Enter a valid date.';
  if (!v.targetCompletionDate) e.targetCompletionDate = 'Target completion date is required.';
  else if (!isValidDate(v.targetCompletionDate)) e.targetCompletionDate = 'Enter a valid date.';
  else if (isValidDate(v.plannedStartDate) && v.targetCompletionDate < v.plannedStartDate) {
    e.targetCompletionDate = 'Target completion must be on or after the start date.';
  }
  if (!fields) return e;
  return Object.fromEntries(Object.entries(e).filter(([k]) => fields.includes(k as FieldKey))) as FieldErrors;
}

export function toCreatePayload(v: FormValues): CreateProjectRequest {
  return {
    name: v.name.trim(),
    projectType: v.projectType as ProjectType,
    clientName: v.clientName.trim(),
    location: { city: v.city.trim(), state: v.state.trim(), postalCode: v.postalCode.trim() || null },
    description: v.description.trim() || null,
    plannedBudget: v.plannedBudget.trim(),
    currency: v.currency,
    contingencyBudget: v.contingencyBudget.trim() || null,
    plannedStartDate: v.plannedStartDate,
    targetCompletionDate: v.targetCompletionDate,
    status: v.status === 'planning' ? 'planning' : 'draft',
  };
}

export function fromProject(p: Project): FormValues {
  return {
    name: p.name, projectType: p.projectType, clientName: p.clientName,
    city: p.location.city, state: p.location.state, postalCode: p.location.postalCode ?? '', description: p.description ?? '',
    plannedBudget: p.plannedBudget, currency: p.currency, contingencyBudget: p.contingencyBudget ?? '',
    plannedStartDate: p.plannedStartDate, targetCompletionDate: p.targetCompletionDate, status: p.status,
  };
}

const sameMoney = (a: string, b: string) => {
  const norm = (s: string) => { const [w = '', f = ''] = s.trim().split('.'); return `${w}.${f.padEnd(2, '0')}`; };
  return norm(a) === norm(b);
};

/** Builds a PATCH body containing only the fields that actually changed. */
export function toUpdatePayload(original: Project, v: FormValues): UpdateProjectRequest {
  const next = toCreatePayload({ ...v, status: v.status });
  const patch: UpdateProjectRequest = {};
  if (next.name !== original.name) patch.name = next.name;
  if (next.projectType !== original.projectType) patch.projectType = next.projectType;
  if (next.clientName !== original.clientName) patch.clientName = next.clientName;
  if (next.location.city !== original.location.city || next.location.state !== original.location.state ||
      (next.location.postalCode ?? null) !== original.location.postalCode) patch.location = next.location;
  if ((next.description ?? null) !== original.description) patch.description = next.description ?? null;
  if (!sameMoney(next.plannedBudget, original.plannedBudget)) patch.plannedBudget = next.plannedBudget;
  if (next.currency !== original.currency) patch.currency = next.currency;
  const origCont = original.contingencyBudget;
  if (next.contingencyBudget === null ? origCont !== null : origCont === null || !sameMoney(next.contingencyBudget ?? '', origCont)) {
    patch.contingencyBudget = next.contingencyBudget ?? null;
  }
  if (next.plannedStartDate !== original.plannedStartDate) patch.plannedStartDate = next.plannedStartDate;
  if (next.targetCompletionDate !== original.targetCompletionDate) patch.targetCompletionDate = next.targetCompletionDate;
  if (v.status !== original.status) patch.status = v.status;
  return patch;
}

/** Maps API validation details (e.g. "location.city") onto form field keys. */
export function mapApiErrors(details: ApiErrorDetail[]): { fieldErrors: FieldErrors; unmapped: string[] } {
  const fieldErrors: FieldErrors = {};
  const unmapped: string[] = [];
  const keys: Record<string, FieldKey> = {
    name: 'name', projectType: 'projectType', clientName: 'clientName', 'location.city': 'city', 'location.state': 'state',
    'location.postalCode': 'postalCode', description: 'description', plannedBudget: 'plannedBudget', currency: 'currency',
    contingencyBudget: 'contingencyBudget', plannedStartDate: 'plannedStartDate', targetCompletionDate: 'targetCompletionDate', status: 'status',
  };
  for (const d of details) {
    const k = d.field ? keys[d.field] : undefined;
    if (k) fieldErrors[k] ??= d.message; else unmapped.push(d.message);
  }
  return { fieldErrors, unmapped };
}

export function firstStepWithError(errors: FieldErrors): number {
  const idx = STEP_FIELDS.findIndex((fields) => fields.some((f) => errors[f]));
  return idx === -1 ? 2 : idx;
}
