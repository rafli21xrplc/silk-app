'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ClientApiError, errorMessage } from './client-api';
import { useQuery } from './query-cache';
import { homePathFor, roleAllowed, type AreaRequirement } from './role-home';
import type { Me } from './types';

/** `/me` dianggap segar selama 30 detik; setelahnya tetap tampil seketika lalu diperbarui di belakang. */
export const ME_STALE_MS = 30_000;

/**
 * Ambil pengguna yang masuk. Bila belum masuk, arahkan ke /masuk dengan `kembali` ke halaman ini.
 * Penegakan akses tetap di API; ini hanya untuk tampilan.
 */
export function useMe(opts: { require?: AreaRequirement } = {}) {
  const router = useRouter();
  const { data, error } = useQuery<Me>('/me', { staleMs: ME_STALE_MS });

  const wrongRole = !!data && !roleAllowed(opts.require ?? 'signed-in', data.user.role);
  const unauthenticated = error instanceof ClientApiError && (error.status === 401 || error.status === 403);
  const home = data ? homePathFor(data.user) : '/';

  useEffect(() => {
    if (wrongRole) router.replace(home);
    else if (unauthenticated) router.replace(`/masuk?kembali=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }, [wrongRole, unauthenticated, router, home]);

  return {
    me: data && !wrongRole && !unauthenticated ? data : null,
    error: error && !unauthenticated ? errorMessage(error) : null,
  };
}

export { safeReturnPath } from './redirect';
