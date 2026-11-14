import 'server-only';
import type { z } from 'zod';
import { dataResponse } from '@silk/shared';
import rawSnapshot from '../../demo/snapshot.json';
import { snapshotSchema, type Snapshot } from './snapshot';

/**
 * Sumber data SILK Mobile: API publik SILK, dengan cadangan data demo.
 *
 * - Respons API selalu divalidasi dengan skema Zod dari @silk/shared sebelum dipakai.
 * - API mati, lambat (> SILK_API_TIMEOUT_MS), galat 5xx, atau data tidak lolos skema → data cadangan.
 * - 404 dari API berarti memang tidak ada (bukan alasan memakai cadangan).
 * - Setelah API gagal dihubungi, permintaan berikutnya langsung memakai cadangan selama 15 detik
 *   agar demo tetap cepat. Ini hanya penghemat waktu per instance; tidak ada data yang disimpan.
 */

export type DataSource = 'live' | 'demo';

export type Fetched<T> = { kind: 'ok'; data: T; nextCursor: string | null } | { kind: 'not_found' } | { kind: 'unavailable' };

export const API_ORIGIN = (process.env.SILK_API_ORIGIN || 'http://127.0.0.1:4000').replace(/\/+$/, '');
const TIMEOUT_MS = Number(process.env.SILK_API_TIMEOUT_MS) || 3500;
// Di Vercel tanpa SILK_API_ORIGIN tidak ada API lokal yang bisa dihubungi: langsung pakai data cadangan
// daripada mencoba 127.0.0.1 di setiap permintaan.
const DEMO_ONLY = process.env.SILK_DEMO_ONLY === '1' || (!process.env.SILK_API_ORIGIN && Boolean(process.env.VERCEL));
const COOLDOWN_MS = 15_000;
let unavailableUntil = 0;

export interface FetchOptions {
  /** Detik; bawaan 5 menit. Data harga tidak berubah per detik. */
  revalidate?: number;
  tags?: string[];
}

export async function fetchApi<S extends z.ZodType>(path: string, schema: S, opts: FetchOptions = {}): Promise<Fetched<z.infer<S>>> {
  if (DEMO_ONLY || Date.now() < unavailableUntil) return { kind: 'unavailable' };
  let res: Response;
  try {
    res = await fetch(`${API_ORIGIN}/v1${path}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: opts.revalidate ?? 300, tags: opts.tags },
    });
  } catch (err) {
    unavailableUntil = Date.now() + COOLDOWN_MS;
    console.error(`[silk-mobile] API tidak terjangkau (${path}); memakai data cadangan:`, err instanceof Error ? err.message : err);
    return { kind: 'unavailable' };
  }
  if (res.status === 404) return { kind: 'not_found' };
  if (!res.ok) {
    if (res.status >= 500) unavailableUntil = Date.now() + COOLDOWN_MS;
    console.error(`[silk-mobile] API ${res.status} (${path}); memakai data cadangan.`);
    return { kind: 'unavailable' };
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    console.error(`[silk-mobile] Respons API bukan JSON (${path}); memakai data cadangan.`);
    return { kind: 'unavailable' };
  }
  // Skema generik: TS tidak bisa menurunkan bentuk dataResponse<S>; hasil di-cast setelah validasi runtime.
  const parsed = dataResponse(schema as z.ZodType).safeParse(body);
  if (!parsed.success) {
    console.error(`[silk-mobile] Respons API tidak lolos skema (${path}); memakai data cadangan.`, parsed.error.issues.slice(0, 3));
    return { kind: 'unavailable' };
  }
  return { kind: 'ok', data: parsed.data.data as z.infer<S>, nextCursor: parsed.data.meta?.nextCursor ?? null };
}

let snapshot: Snapshot | null = null;

/** Data cadangan, divalidasi sekali per instance. */
export function getSnapshot(): Snapshot {
  snapshot ??= snapshotSchema.parse(rawSnapshot);
  return snapshot;
}
