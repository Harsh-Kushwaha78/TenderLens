import type { ApiErrorDetail } from './types';

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

export class ApiClientError extends Error {
  constructor(
    public readonly status: number, // 0 = network failure
    public readonly code: string,
    message: string,
    public readonly details: ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
  get isNetwork() { return this.status === 0; }
  get isNotFound() { return this.status === 404 || (this.status === 400 && this.details.some((d) => d.field === 'id')); }
}

export async function apiRequest<T>(
  path: string,
  opts: { method?: string; body?: unknown; headers?: Record<string, string>; signal?: AbortSignal } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: opts.method ?? 'GET',
      headers: { Accept: 'application/json', ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...opts.headers },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ApiClientError(0, 'NETWORK_ERROR', 'Cannot reach the TenderLens server. Check that the API is running and try again.');
  }

  let payload: any = null;
  try { payload = await res.json(); } catch { /* non-JSON body */ }

  if (!res.ok) {
    const e = payload?.error;
    if (res.status === 503) throw new ApiClientError(503, e?.code ?? 'SERVICE_UNAVAILABLE', e?.message ?? 'The service is temporarily unavailable. Please retry.', e?.details ?? []);
    throw new ApiClientError(res.status, e?.code ?? 'UNEXPECTED_ERROR', e?.message ?? `Request failed (HTTP ${res.status}).`, e?.details ?? []);
  }
  return payload as T;
}

/** Fetches a binary body (e.g. PDF). Errors use the same ApiClientError mapping as JSON requests. */
export async function apiBlob(path: string, signal?: AbortSignal): Promise<{ blob: Blob; filename: string | null }> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/pdf, application/json' }, signal });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ApiClientError(0, 'NETWORK_ERROR', 'Cannot reach the TenderLens server. Check that the API is running and try again.');
  }
  if (!res.ok) {
    let payload: any = null;
    try { payload = await res.json(); } catch { /* not JSON */ }
    const e = payload?.error;
    throw new ApiClientError(res.status, e?.code ?? 'UNEXPECTED_ERROR', e?.message ?? `Request failed (HTTP ${res.status}).`, e?.details ?? []);
  }
  const m = /filename="?([^";]+)"?/i.exec(res.headers.get('Content-Disposition') ?? '');
  return { blob: await res.blob(), filename: m?.[1] ?? null };
}
