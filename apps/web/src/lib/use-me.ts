'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ClientApiError, errorMessage } from './client-api';
import { useQuery } from './query-cache';
import type { Me } from './types';

/** `/me` dianggap segar selama 30 detik; setelahnya tetap tampil seketika lalu diperbarui di belakang. */
export const ME_STALE_MS = 30_000;

/**
 * Ambil pengguna yang masuk. Bila belum masuk, arahkan ke /masuk dengan `kembali` ke halaman ini.
 * Penegakan akses tetap di API; ini hanya untuk tampilan.
 */
export function useMe(opts: { require?: 'faskes' | 'staff' } = {}) {
  const router = useRouter();
  const { data, error } = useQuery<Me>('/me', { staleMs: ME_STALE_MS });

  const wrongRole = !!data && ((opts.require === 'staff' && data.user.role === 'faskes') || (opts.require === 'faskes' && data.user.role !== 'faskes'));
  const unauthenticated = error instanceof ClientApiError && (error.status === 401 || error.status === 403);

  useEffect(() => {
    if (wrongRole) router.replace(opts.require === 'staff' ? '/portal' : '/admin');
    else if (unauthenticated) router.replace(`/masuk?kembali=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }, [wrongRole, unauthenticated, router, opts.require]);

  return {
    me: data && !wrongRole && !unauthenticated ? data : null,
    error: error && !unauthenticated ? errorMessage(error) : null,
  };
}

export { safeReturnPath } from './redirect';
