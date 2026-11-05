'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PAGE_SIZES, pageWindow } from '@/lib/pagination';
import { t } from '@/messages/id';
import { Select } from './select';

export interface PaginationState {
  /** Halaman aktif (0-based). */
  page: number;
  /** Jumlah halaman yang sudah diketahui. */
  pageCount: number;
  /** Nomor baris pertama dan terakhir di halaman ini (1-based). */
  from: number;
  to: number;
  /** Total baris bila diketahui (daftar tanpa kursor). */
  total?: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize?: (size: number) => void;
}

/**
 * Wadah daftar admin/portal: isi (tabel atau baris) + kaki paginasi dalam satu kartu.
 * `busy` meredupkan isi selagi halaman lain dimuat, agar tinggi tabel tidak melompat.
 */
export function DataPanel({
  children,
  pagination,
  busy,
  scroll = true,
  label,
}: {
  children: React.ReactNode;
  pagination?: PaginationState;
  busy?: boolean;
  /** Gulir mendatar untuk tabel lebar. */
  scroll?: boolean;
  /** Nama area gulir untuk pembaca layar. */
  label?: string;
}) {
  return (
    <section
      className="data-panel overflow-hidden rounded-card border border-line bg-white shadow-soft [&_tbody_td]:align-middle [&_tbody_th]:align-middle"
      aria-busy={busy || undefined}
    >
      <div
        className={cn(
          'transition-opacity duration-200 ease-soft',
          scroll && 'overflow-x-auto',
          busy && 'pointer-events-none opacity-55',
        )}
        {...(scroll ? { tabIndex: 0, role: 'region', 'aria-label': label } : {})}
      >
        {children}
      </div>
      {pagination && <Pagination {...pagination} />}
    </section>
  );
}

export function Pagination({
  page,
  pageCount,
  from,
  to,
  total,
  pageSize,
  onPage,
  onPageSize,
}: PaginationState) {
  const btn =
    'grid size-9 place-items-center rounded-full text-sm font-semibold tabular-nums transition-colors duration-150 ease-soft disabled:pointer-events-none disabled:opacity-40';
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-line bg-surface/60 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-muted">
        <span aria-live="polite" className="tabular-nums">
          {t.pagination.range(from, to)}
          {total !== undefined && ` ${t.pagination.of(total)}`}
        </span>
        {onPageSize && (
          <span className="flex items-center gap-2">
            <span aria-hidden="true">{t.pagination.perPage}</span>
            <Select
              variant="chip"
              label={t.pagination.perPage}
              value={String(pageSize)}
              onValueChange={(v) => onPageSize(Number(v))}
              options={PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
              align="start"
            />
          </span>
        )}
      </div>
      {pageCount > 1 && (
        <nav aria-label={t.pagination.label}>
          <ul className="m-0 flex list-none items-center gap-1 p-0">
            <li>
              <button
                type="button"
                className={cn(btn, 'text-ink-soft hover:bg-surface-2')}
                disabled={page === 0}
                onClick={() => onPage(page - 1)}
              >
                <ChevronLeft className="size-[18px]" aria-hidden="true" />
                <span className="sr-only">{t.pagination.prev}</span>
              </button>
            </li>
            {pageWindow(page, pageCount).map((p, i) =>
              p === 'gap' ? (
                <li
                  key={`gap-${i}`}
                  className="grid size-9 place-items-center text-muted"
                  aria-hidden="true"
                >
                  …
                </li>
              ) : (
                <li key={p}>
                  <button
                    type="button"
                    className={cn(
                      btn,
                      p === page
                        ? 'bg-primary-600 text-white shadow-[0_6px_14px_-6px_rgb(14_124_116/0.7)]'
                        : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
                    )}
                    aria-current={p === page ? 'page' : undefined}
                    aria-label={t.pagination.page(p + 1)}
                    onClick={() => onPage(p)}
                  >
                    {p + 1}
                  </button>
                </li>
              ),
            )}
            <li>
              <button
                type="button"
                className={cn(btn, 'text-ink-soft hover:bg-surface-2')}
                disabled={page >= pageCount - 1}
                onClick={() => onPage(page + 1)}
              >
                <ChevronRight className="size-[18px]" aria-hidden="true" />
                <span className="sr-only">{t.pagination.next}</span>
              </button>
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}
