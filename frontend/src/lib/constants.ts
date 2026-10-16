import type { Currency, ProjectStatus, ProjectType, SortField } from '../api/types';

export const PROJECT_STATUSES: ProjectStatus[] = ['draft', 'planning', 'active', 'on_hold', 'completed', 'cancelled'];
export const STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: 'Draft', planning: 'Planning', active: 'Active', on_hold: 'On hold', completed: 'Completed', cancelled: 'Cancelled',
};
/** Chart/legend colours; status is always also shown as text, never by colour alone. */
export const STATUS_COLORS: Record<ProjectStatus, string> = {
  draft: '#94a3b8', planning: '#3b82f6', active: '#14b8a6', on_hold: '#f59e0b', completed: '#6366f1', cancelled: '#ef4444',
};
/** Mirrors backend STATUS_TRANSITIONS (proposed workflow; the server is authoritative). */
export const STATUS_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  draft: ['planning', 'cancelled'],
  planning: ['active', 'on_hold', 'cancelled'],
  active: ['on_hold', 'completed', 'cancelled'],
  on_hold: ['active', 'cancelled'],
  completed: [],
  cancelled: [],
};
export const allowedStatuses = (current: ProjectStatus): ProjectStatus[] => [current, ...STATUS_TRANSITIONS[current]];

export const PROJECT_TYPES: ProjectType[] = [
  'building_renovation', 'interior_fitout', 'civil_works', 'electrical_works', 'plumbing_works', 'other',
];
export const TYPE_LABELS: Record<ProjectType, string> = {
  building_renovation: 'Building renovation', interior_fitout: 'Interior fit-out', civil_works: 'Civil works',
  electrical_works: 'Electrical works', plumbing_works: 'Plumbing works', other: 'Other',
};
export const CURRENCIES: Currency[] = ['INR', 'USD', 'EUR', 'GBP', 'AED'];
export const SORT_LABELS: Record<SortField, string> = {
  createdAt: 'Date created', name: 'Project name', plannedBudget: 'Planned budget', targetCompletionDate: 'Target completion',
};
export const SORT_FIELDS = Object.keys(SORT_LABELS) as SortField[];
