'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { api } from './client-api';

/**
 * Cache GET kecil di browser untuk portal/admin (stale-while-revalidate), tanpa dependensi tambahan.
 * - Permintaan sama yang sedang berjalan dipakai bersama (dedupe), mis. `/me` dari header dan shell.
 * - Data yang pernah dimuat langsung tampil saat halaman dibuka lagi, lalu diperbarui di belakang.
 * - Hanya di memori tab ini; dibersihkan saat masuk/keluar agar data akun lain tidak terbawa.
 * Akses tetap ditegakkan API; cache ini hanya mempercepat tampilan.
 */

export interface QueryEntry<T = unknown> {
  data: T;
  meta?: { nextCursor?: string | null };
  /** Waktu data diterima (ms epoch). */
  at: number;
}

type Fetcher = (path: string) => Promise<{ data: unknown; meta?: { nextCursor?: string | null } }>;

export function createQueryCache(fetcher: Fetcher, now: () => number = Date.now) {
  const entries = new Map<string, QueryEntry>();
  const inflight = new Map<string, Promise<QueryEntry>>();
  const listeners = new Set<() => void>();
  // Dinaikkan saat cache dikosongkan; respons lama yang tiba setelahnya diabaikan.
  let generation = 0;
  const emit = () => listeners.forEach((l) => l());

  function fetchQuery<T>(path: string): Promise<QueryEntry<T>> {
    const pending = inflight.get(path);
    if (pending) return pending as Promise<QueryEntry<T>>;
    const gen = generation;
    const p = fetcher(path)
      .then((r) => {
        const entry: QueryEntry = { data: r.data, meta: r.meta, at: now() };
        if (gen === generation) {
          entries.set(path, entry);
          emit();
        }
        return entry;
      })
      .finally(() => {
        if (inflight.get(path) === p) inflight.delete(path);
      });
    inflight.set(path, p);
    return p as Promise<QueryEntry<T>>;
  }

  return {
    fetchQuery,
    peek: <T>(path: string) => entries.get(path) as QueryEntry<T> | undefined,
    isFresh: (path: string, staleMs: number) => {
      const e = entries.get(path);
      return e !== undefined && now() - e.at < staleMs;
    },
    /** Hapus entri yang path-nya diawali `prefix` (semua bila kosong), kecuali `keep`. */
    invalidate(prefix = '', keep?: string) {
      let changed = false;
      for (const key of [...entries.keys()]) {
        if (key.startsWith(prefix) && key !== keep) {
          entries.delete(key);
          changed = true;
        }
      }
      if (prefix === '') {
        generation++;
        inflight.clear();
      }
      if (changed) emit();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Satu cache per tab browser. */
export const queryCache = createQueryCache((path) => api('GET', path));

/** Kosongkan seluruh cache (dipanggil saat masuk dan keluar). */
export const clearQueryCache = () => queryCache.invalidate('');

export interface UseQueryResult<T> {
  data: T | undefined;
  meta: QueryEntry['meta'];
  error: unknown;
  /** true selama belum ada data sama sekali (tampilkan skeleton). */
  loading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Ambil `path` lewat cache. Data cache tampil seketika; diperbarui di belakang bila lebih tua dari `staleMs`
 * (bawaan 0 = selalu diperbarui saat komponen dipasang). `path = null` menunda pengambilan.
 */
export function useQuery<T>(path: string | null, opts: { staleMs?: number } = {}): UseQueryResult<T> {
  const staleMs = opts.staleMs ?? 0;
  const entry = useSyncExternalStore(
    queryCache.subscribe,
    () => (path ? queryCache.peek<T>(path) : undefined),
    () => undefined,
  );
  const [error, setError] = useState<{ path: string; err: unknown } | null>(null);

  const refetch = useCallback(async () => {
    if (!path) return;
    try {
      await queryCache.fetchQuery<T>(path);
      setError(null);
    } catch (err) {
      setError({ path, err });
    }
  }, [path]);

  useEffect(() => {
    if (!path || queryCache.isFresh(path, staleMs)) return;
    void refetch();
  }, [path, staleMs, refetch]);

  const currentError = error && error.path === path ? error.err : null;
  return { data: entry?.data, meta: entry?.meta, error: currentError, loading: !!path && !entry && !currentError, refetch };
}
