/** Paginasi berbasis kursor untuk daftar portal/admin (API mengembalikan `meta.nextCursor`). */

export const PAGE_SIZES = [10, 20, 50] as const;
export const DEFAULT_PAGE_SIZE = 10;

/** Tambahkan `limit` dan `cursor` ke path API, mempertahankan query yang sudah ada. */
export function pagePath(base: string, limit: number, cursor: string | null): string {
  const [pathname, query = ''] = base.split('?');
  const params = new URLSearchParams(query);
  params.set('limit', String(limit));
  if (cursor) params.set('cursor', cursor);
  else params.delete('cursor');
  return `${pathname}?${params}`;
}

/**
 * Kursor awal tiap halaman yang sudah diketahui (`cursors[0]` = null untuk halaman 1).
 * `next`: kursor halaman sesudah `page` dari respons (undefined = belum dimuat, null = halaman terakhir).
 */
export function mergeCursors(
  cursors: readonly (string | null)[],
  page: number,
  next: string | null | undefined,
): (string | null)[] {
  if (next === undefined) return [...cursors];
  if (next === null) return cursors.slice(0, page + 1);
  if (cursors[page + 1] === next) return [...cursors];
  // Data bergeser (mis. setelah tindakan): halaman sesudahnya dihitung ulang dari kursor baru.
  return [...cursors.slice(0, page + 1), next];
}

/** Nomor halaman yang ditampilkan (0-based) dengan celah: 0 … 4 5 6 … 11. */
export function pageWindow(page: number, count: number): (number | 'gap')[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i);
  const last = count - 1;
  const start = Math.max(1, Math.min(page - 1, last - 4));
  const end = Math.min(last - 1, Math.max(page + 1, 4));
  const out: (number | 'gap')[] = [0];
  if (start > 1) out.push('gap');
  for (let i = start; i <= end; i++) out.push(i);
  if (end < last - 1) out.push('gap');
  out.push(last);
  return out;
}
