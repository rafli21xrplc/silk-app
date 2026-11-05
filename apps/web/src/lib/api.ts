import 'server-only';
import { connection } from 'next/server';
import { API_ORIGIN } from './config';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

interface FetchOpts {
  /** Tag ISR untuk revalidasi per entitas (bagian 2, alur 1). */
  tags?: string[];
  /** Detik; `false` = cache sampai di-revalidate; 0 = selalu baru (SSR dinamis). */
  revalidate?: number | false;
}

/** Pemanggil API di server (Server Component). */
export async function apiGet<T>(path: string, opts: FetchOpts = {}): Promise<{ data: T; meta?: { nextCursor?: string | null } }> {
  let res: Response;
  try {
    res = await fetch(`${API_ORIGIN}/v1${path}`, {
      headers: { accept: 'application/json' },
      ...(opts.revalidate === 0
        ? { cache: 'no-store' as const }
        : { next: { tags: opts.tags, revalidate: opts.revalidate ?? 3600 } }),
    });
  } catch (err) {
    // API belum bisa dihubungi saat `next build` (mis. build lokal tanpa API): jangan gagalkan build,
    // tetapi render halaman saat request. Data cache per tag tetap berlaku.
    if (process.env.NEXT_PHASE === 'phase-production-build') await connection();
    throw err;
  }
  if (!res.ok) {
    let code = 'INTERNAL';
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: { code: string; message: string } };
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
    } catch {
      // abaikan body non-JSON
    }
    throw new ApiError(res.status, code, message);
  }
  return res.json() as Promise<{ data: T; meta?: { nextCursor?: string | null } }>;
}

/** Sama seperti apiGet tetapi 404 menjadi null (untuk notFound()). */
export async function apiGetOrNull<T>(path: string, opts: FetchOpts = {}): Promise<T | null> {
  try {
    return (await apiGet<T>(path, opts)).data;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}
