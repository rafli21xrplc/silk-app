'use client';

import { Search, SearchX, X } from 'lucide-react';
import { EmptyState } from './empty-state';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { t } from '@/messages/id';

const DEBOUNCE_MS = 350;

/**
 * Kotak cari daftar admin/portal. Mencari otomatis setelah berhenti mengetik (350 ms) atau saat Enter;
 * tombol × mengosongkan. `onSearch` menerima kata kunci yang sudah dipangkas.
 */
export function ListSearch({
  placeholder,
  onSearch,
  initial = '',
  className,
}: {
  placeholder: string;
  onSearch: (q: string) => void;
  initial?: string;
  className?: string;
}) {
  const [text, setText] = useState(initial);
  const sent = useRef(initial.trim());
  const latest = useRef(onSearch);

  useEffect(() => {
    latest.current = onSearch;
  });
  const send = useCallback((value: string) => {
    const q = value.trim();
    if (q === sent.current) return;
    sent.current = q;
    latest.current(q);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => send(text), DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [text, send]);

  return (
    <form
      role="search"
      className={cn('relative min-w-[min(100%,260px)] flex-1', className)}
      onSubmit={(e) => {
        e.preventDefault();
        send(text);
      }}
    >
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted" aria-hidden="true" />
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        maxLength={100}
        enterKeyHint="search"
        autoComplete="off"
        data-list-search
        className="h-11 w-full rounded-xl border border-line bg-white pr-10 pl-10 text-[0.95rem] text-ink shadow-[0_1px_1px_rgb(28_40_38/0.04)] outline-none placeholder:text-muted focus:border-primary-400 [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button
          type="button"
          onClick={() => {
            setText('');
            send('');
          }}
          className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
        >
          <X className="size-4" aria-hidden="true" />
          <span className="sr-only">{t.listSearch.clear}</span>
        </button>
      )}
    </form>
  );
}

/** Tambah `q` ke path API bila ada kata kunci. */
export function withQuery(path: string, q: string): string {
  if (!q) return path;
  return `${path}${path.includes('?') ? '&' : '?'}q=${encodeURIComponent(q)}`;
}

/** Baris alat di atas daftar: kotak cari + filter, rata bawah. */
export function ListToolbar({ children }: { children: React.ReactNode }) {
  return <div className="mb-5 flex flex-wrap items-end gap-3">{children}</div>;
}

/** Tampilan kosong saat pencarian tidak menemukan apa pun (berbeda dari antrean kosong). */
export function NoResults({ q }: { q: string }) {
  return (
    <EmptyState icon={SearchX} title={t.listSearch.noResults}>
      {t.listSearch.noResultsBody(q)}
    </EmptyState>
  );
}
