import { apiBlob, apiRequest } from './client';
import type { Boq, BoqSummary, CreateBoqRequest, UpdateBoqRequest } from './types';

export async function listBoqs(projectId: string, signal?: AbortSignal) {
  return (await apiRequest<{ data: BoqSummary[] }>(`/api/projects/${encodeURIComponent(projectId)}/boqs`, { signal })).data;
}
export async function getBoq(id: string, signal?: AbortSignal) {
  return (await apiRequest<{ data: Boq }>(`/api/boqs/${encodeURIComponent(id)}`, { signal })).data;
}
export async function createBoq(projectId: string, body: CreateBoqRequest) {
  return (await apiRequest<{ data: Boq }>(`/api/projects/${encodeURIComponent(projectId)}/boqs`, { method: 'POST', body })).data;
}
export async function updateBoq(id: string, body: UpdateBoqRequest) {
  return (await apiRequest<{ data: Boq }>(`/api/boqs/${encodeURIComponent(id)}`, { method: 'PUT', body })).data;
}
export async function deleteBoq(id: string) {
  await apiRequest<null>(`/api/boqs/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
/** `revision` makes the server refuse the export if the BOQ changed after the preview was loaded. */
export function fetchBoqPdf(id: string, revision: number) {
  return apiBlob(`/api/boqs/${encodeURIComponent(id)}/pdf?revision=${revision}`);
}
