import { apiRequest } from './client';
import type { CreateProjectRequest, DashboardSummary, ListParams, Project, ProjectListResponse, UpdateProjectRequest } from './types';

export function listProjects(params: ListParams, signal?: AbortSignal) {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.status?.length) qs.set('status', params.status.join(','));
  if (params.projectType?.length) qs.set('projectType', params.projectType.join(','));
  if (params.sortBy) qs.set('sortBy', params.sortBy);
  if (params.sortOrder) qs.set('sortOrder', params.sortOrder);
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  if (params.includeDemo) qs.set('includeDemo', 'true');
  return apiRequest<ProjectListResponse>(`/api/projects?${qs}`, { signal });
}

export async function getProject(id: string, signal?: AbortSignal) {
  return (await apiRequest<{ data: Project }>(`/api/projects/${encodeURIComponent(id)}`, { signal })).data;
}

export async function createProject(body: CreateProjectRequest, idempotencyKey: string) {
  return (await apiRequest<{ data: Project }>('/api/projects', { method: 'POST', body, headers: { 'Idempotency-Key': idempotencyKey } })).data;
}

export async function updateProject(id: string, body: UpdateProjectRequest) {
  return (await apiRequest<{ data: Project }>(`/api/projects/${encodeURIComponent(id)}`, { method: 'PATCH', body })).data;
}

export async function getDashboardSummary(opts: { includeDemo: boolean; currency?: string }, signal?: AbortSignal) {
  const qs = new URLSearchParams();
  if (opts.includeDemo) qs.set('includeDemo', 'true');
  if (opts.currency) qs.set('currency', opts.currency);
  return (await apiRequest<{ data: DashboardSummary }>(`/api/dashboard/summary?${qs}`, { signal })).data;
}
