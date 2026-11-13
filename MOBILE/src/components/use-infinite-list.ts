'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import type { z } from 'zod';

type PageShape<T> = { items: T[]; nextCursor: string | null; source: 'live' | 'demo' };

/**
 * Gulir tanpa batas: halaman pertama dari server (SSR), halaman berikutnya dari route handler.
 * Respons divalidasi skema yang sama; sentinel memuat halaman berikutnya saat terlihat.
 */
export function useInfiniteList<T>(opts: {
  key: string;
  endpoint: string;
  query: string;
  initial: PageShape<T>;
  schema: z.ZodType<PageShape<T>>;
}) {
  const q = useInfiniteQuery({
    queryKey: [opts.key, opts.query],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam, signal }) => {
      const qs = new URLSearchParams(opts.query);
      if (pageParam) qs.set('cursor', pageParam);
      const res = await fetch(`${opts.endpoint}?${qs.toString()}`, { signal, headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return opts.schema.parse(await res.json());
    },
    getNextPageParam: (last) => last.nextCursor,
    initialData: { pages: [opts.initial], pageParams: [null] },
  });

  const sentinel = useRef<HTMLDivElement | null>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = q;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage();
    }, { rootMargin: '400px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const items = q.data.pages.flatMap((p) => p.items);
  const demo = q.data.pages.some((p) => p.source === 'demo');
  return { ...q, items, demo, sentinel };
}
