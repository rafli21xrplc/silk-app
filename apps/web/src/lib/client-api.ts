'use client';

import { BROWSER_API_ORIGIN } from './config';

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: { path?: string; message: string }[];
}

export class ClientApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.message);
  }
}

let csrfToken: string | null = null;

async function getCsrf(): Promise<string> {
  if (csrfToken) return csrfToken;
  const res = await fetch(`${BROWSER_API_ORIGIN}/v1/csrf`, { credentials: 'include' });
  const body = (await res.json()) as { data: { token: string } };
  csrfToken = body.data.token;
  return csrfToken;
}

/** Pemanggil API dari browser: cookie sesi + token CSRF untuk metode selain GET. */
export async function api<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<{ data: T; meta?: { nextCursor?: string | null } }> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (method !== 'GET') headers['x-csrf-token'] = await getCsrf();
  const res = await fetch(`${BROWSER_API_ORIGIN}${path.startsWith('/v1') ? path : `/v1${path}`}`, {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return { data: undefined as T };
  const json = (await res.json().catch(() => ({}))) as { data?: T; meta?: { nextCursor?: string | null }; error?: ApiErrorBody; message?: string; code?: string };
  if (!res.ok) {
    if (json.error?.code === 'CSRF_INVALID') csrfToken = null;
    // Better Auth memakai bentuk { code, message } tanpa pembungkus `error`.
    throw new ClientApiError(res.status, json.error ?? { code: json.code ?? 'INTERNAL', message: json.message ?? 'Terjadi kesalahan' });
  }
  return { data: json.data ?? (json as T), meta: json.meta };
}

/**
 * Panggil endpoint Better Auth (/v1/auth/*). Respons Better Auth tidak dibungkus `data`.
 * `headers` dipakai untuk token Turnstile (`x-captcha-response`).
 */
export async function authApi<T>(path: string, body?: unknown, opts: { headers?: Record<string, string> } = {}): Promise<T> {
  const res = await fetch(`${BROWSER_API_ORIGIN}/v1/auth${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...opts.headers },
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T & { message?: string; code?: string };
  if (!res.ok) throw new ClientApiError(res.status, { code: json.code ?? 'AUTH_ERROR', message: json.message ?? 'Gagal' });
  return json;
}

/** Unggah langsung ke penyimpanan lewat signed URL (tidak melewati API; batas 4,5 MB). */
export async function uploadToSignedUrl(upload: { uploadUrl: string; headers: Record<string, string> }, file: Blob): Promise<void> {
  const res = await fetch(upload.uploadUrl, { method: 'PUT', headers: upload.headers, body: file });
  if (!res.ok) throw new Error(`Unggah gagal (${res.status})`);
}

export function errorMessage(err: unknown): string {
  if (err instanceof ClientApiError) {
    const details = err.body.details?.map((d) => (d.path ? `${d.path}: ${d.message}` : d.message)).join('; ');
    return details ? `${err.body.message} (${details})` : err.body.message;
  }
  return err instanceof Error ? err.message : 'Terjadi kesalahan';
}
