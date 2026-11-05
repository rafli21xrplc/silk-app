import { describe, expect, it, vi } from 'vitest';

// client-api memakai `'use client'` dan API_ORIGIN; uji hanya memakai createQueryCache dengan fetcher palsu.
vi.mock('./client-api', () => ({ api: vi.fn() }));
const { createQueryCache } = await import('./query-cache');

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createQueryCache', () => {
  it('permintaan sama yang sedang berjalan hanya dikirim sekali (dedupe)', async () => {
    const d = deferred<{ data: unknown }>();
    const fetcher = vi.fn(() => d.promise);
    const cache = createQueryCache(fetcher);
    const a = cache.fetchQuery('/me');
    const b = cache.fetchQuery('/me');
    d.resolve({ data: { id: 1 } });
    expect((await a).data).toEqual({ id: 1 });
    expect((await b).data).toEqual({ id: 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('menyimpan hasil dan memberi tahu pelanggan', async () => {
    const cache = createQueryCache(async () => ({ data: [1, 2], meta: { nextCursor: 'x' } }));
    const listener = vi.fn();
    cache.subscribe(listener);
    await cache.fetchQuery('/admin/claims');
    expect(cache.peek('/admin/claims')?.data).toEqual([1, 2]);
    expect(cache.peek('/admin/claims')?.meta?.nextCursor).toBe('x');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('isFresh mengikuti umur data', async () => {
    let clock = 1_000;
    const cache = createQueryCache(async () => ({ data: 1 }), () => clock);
    expect(cache.isFresh('/me', 30_000)).toBe(false);
    await cache.fetchQuery('/me');
    clock += 10_000;
    expect(cache.isFresh('/me', 30_000)).toBe(true);
    clock += 25_000;
    expect(cache.isFresh('/me', 30_000)).toBe(false);
  });

  it('galat tidak disimpan dan permintaan berikutnya mencoba lagi', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('401')).mockResolvedValueOnce({ data: 'ok' });
    const cache = createQueryCache(fetcher);
    await expect(cache.fetchQuery('/me')).rejects.toThrow('401');
    expect(cache.peek('/me')).toBeUndefined();
    expect((await cache.fetchQuery('/me')).data).toBe('ok');
  });

  it('invalidate(prefix) hanya menghapus path yang cocok', async () => {
    const cache = createQueryCache(async (p) => ({ data: p }));
    await Promise.all(['/admin/claims', '/admin/claims/1', '/me'].map((p) => cache.fetchQuery(p)));
    cache.invalidate('/admin/claims');
    expect(cache.peek('/admin/claims')).toBeUndefined();
    expect(cache.peek('/admin/claims/1')).toBeUndefined();
    expect(cache.peek('/me')).toBeDefined();
  });

  it('invalidate(prefix, keep) menyisakan halaman yang sedang dilihat', async () => {
    const cache = createQueryCache(async (p) => ({ data: p }));
    const pages = ['/admin/claims?limit=10', '/admin/claims?limit=10&cursor=b'];
    await Promise.all(pages.map((p) => cache.fetchQuery(p)));
    cache.invalidate('/admin/claims', pages[1]);
    expect(cache.peek(pages[0]!)).toBeUndefined();
    expect(cache.peek(pages[1]!)).toBeDefined();
  });

  it('respons yang tiba setelah cache dikosongkan (keluar akun) tidak disimpan', async () => {
    const d = deferred<{ data: unknown }>();
    const cache = createQueryCache(() => d.promise);
    const p = cache.fetchQuery('/me');
    cache.invalidate('');
    d.resolve({ data: { user: 'lama' } });
    await p;
    expect(cache.peek('/me')).toBeUndefined();
  });
});
