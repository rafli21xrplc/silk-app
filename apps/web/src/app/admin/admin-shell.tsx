'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  ClipboardCheck,
  Cog,
  FileCheck2,
  Flag,
  Handshake,
  LayoutDashboard,
  ScrollText,
  ShieldAlert,
  Tags,
  Upload,
  UserRound,
} from 'lucide-react';
import type { NavItem } from '@/components/account-nav';
import { activeHref, AppShell, Loading } from '@/components/app-shell';
import type { PaginationState } from '@/components/ui/data-panel';
import { Select } from '@/components/ui/select';
import { ClientApiError, errorMessage } from '@/lib/client-api';
import { DEFAULT_PAGE_SIZE, mergeCursors, pagePath } from '@/lib/pagination';
import { queryCache, useQuery } from '@/lib/query-cache';
import type { Me } from '@/lib/types';
import { useMe } from '@/lib/use-me';
import { t } from '@/messages/id';

/** Jumlah item menunggu per antrean (GET /admin/overview). */
export interface QueueCounts {
  claims: number;
  tariffs: number;
  reports: number;
  imports: number;
  profiles: number;
  revisions: number;
  media: number;
  tariffRequests: number;
  articles: number;
}

const NAV: (NavItem & { count?: (q: QueueCounts) => number })[] = [
  { href: '/admin', label: t.admin.overview, icon: LayoutDashboard, group: 'main' },
  {
    href: '/admin/moderasi',
    label: t.moderation.title,
    icon: ClipboardCheck,
    group: 'moderation',
    count: (q) => q.tariffRequests + q.revisions + q.articles + q.media + q.profiles,
  },
  { href: '/admin/klaim', label: t.admin.claims, icon: FileCheck2, group: 'moderation', count: (q) => q.claims },
  { href: '/admin/mitra', label: t.admin.partners, icon: Handshake, group: 'moderation' },
  { href: '/admin/tarif', label: t.admin.tariffs, icon: Tags, group: 'moderation', count: (q) => q.tariffs },
  { href: '/admin/laporan', label: t.admin.reports, icon: Flag, group: 'moderation', count: (q) => q.reports },
  { href: '/admin/impor', label: t.admin.imports, icon: Upload, group: 'data', count: (q) => q.imports },
  { href: '/admin/faskes', label: t.admin.facilities, icon: Building2, group: 'data' },
  { href: '/admin/aturan-konten', label: t.admin.rules, icon: ShieldAlert, group: 'data' },
  { href: '/admin/audit', label: t.admin.audit, icon: ScrollText, group: 'system' },
  { href: '/admin/jobs', label: t.admin.jobs, icon: Cog, group: 'system' },
  { href: '/akun', label: t.account.title, icon: UserRound, group: 'account' },
];

/** Panel admin: wajib staf (admin/moderator) dengan MFA aktif; tanpa MFA diarahkan ke /admin/mfa. */
export function AdminShell({ children }: { children: (me: Me) => React.ReactNode }) {
  const { me, error } = useMe({ require: 'staff' });
  const router = useRouter();
  useEffect(() => {
    if (me && !me.user.twoFactorEnabled) router.replace('/admin/mfa');
  }, [me, router]);
  if (!me || !me.user.twoFactorEnabled) return <Loading error={error} />;
  return <AdminFrame me={me}>{children(me)}</AdminFrame>;
}

/** Kerangka dengan angka antrean di menu; judul halaman = menu yang aktif. */
function AdminFrame({ me, children }: { me: Me; children: React.ReactNode }) {
  const pathname = usePathname() ?? '/admin';
  const { items: counts } = useAdminData<QueueCounts>('/admin/overview');
  const nav: NavItem[] = NAV.map(({ count, ...n }) => ({ ...n, badge: counts && count ? count(counts) : undefined }));
  const active = activeHref(pathname, nav);
  const title = nav.find((n) => n.href === active)?.label ?? t.admin.title;
  return (
    <AppShell me={me} area={t.admin.title} title={title} nav={nav}>
      {children}
    </AppShell>
  );
}

/**
 * Ambil data admin lewat cache (tampil seketika saat kembali ke halaman, lalu diperbarui di belakang).
 * Sesi kedaluwarsa → /masuk; MFA belum aktif → /admin/mfa.
 */
export function useAdminData<T>(path: string | null) {
  const router = useRouter();
  const query = useQuery<T>(path);
  const [error, setError] = useState<string | null>(null);
  const handle = useCallback(
    (err: unknown) => {
      if (
        err instanceof ClientApiError &&
        ['SESSION_EXPIRED', 'UNAUTHENTICATED'].includes(err.body.code)
      ) {
        router.replace(`/masuk?kembali=${encodeURIComponent(window.location.pathname)}`);
      } else if (err instanceof ClientApiError && err.body.code === 'MFA_REQUIRED')
        router.replace('/admin/mfa');
      else setError(errorMessage(err));
    },
    [router],
  );
  useEffect(() => {
    if (query.error) handle(query.error);
  }, [query.error, handle]);
  useEffect(() => setError(null), [path]);

  const { refetch } = query;
  const reload = useCallback(() => {
    setError(null);
    void refetch();
  }, [refetch]);

  return {
    items: query.data ?? null,
    nextCursor: query.meta?.nextCursor ?? null,
    error,
    setError,
    reload,
    handle,
  };
}

/**
 * Daftar admin berhalaman (kursor dari API). Halaman yang pernah dibuka tersimpan di cache, jadi bolak-balik
 * halaman instan; selagi halaman baru dimuat, baris lama tetap tampil (diredupkan) agar tinggi tabel tidak melompat.
 * Filter atau ukuran halaman berubah → kembali ke halaman 1.
 */
export function useAdminList<Row>(base: string, initialSize: number = DEFAULT_PAGE_SIZE) {
  const [pageSize, setPageSize] = useState(initialSize);
  const key = `${base}#${pageSize}`;
  const [nav, setNav] = useState<{ key: string; cursors: (string | null)[]; page: number }>({
    key,
    cursors: [null],
    page: 0,
  });
  const state = nav.key === key ? nav : { key, cursors: [null], page: 0 };
  const path = pagePath(base, pageSize, state.cursors[state.page] ?? null);
  const {
    items,
    nextCursor,
    error,
    setError,
    reload: reloadPage,
    handle,
  } = useAdminData<Row[]>(path);

  const [shown, setShown] = useState<{ key: string; rows: Row[] } | null>(null);
  useEffect(() => {
    if (items) setShown({ key, rows: items });
  }, [items, key]);
  const rows = items ?? (shown?.key === key ? shown.rows : null);

  const cursors = mergeCursors(state.cursors, state.page, items ? nextCursor : undefined);
  const goTo = (page: number) => setNav({ key, cursors, page });

  // Halaman jadi kosong setelah tindakan (mis. baris terakhir disetujui): mundur satu halaman.
  useEffect(() => {
    if (items && items.length === 0 && state.page > 0)
      setNav({ key, cursors: state.cursors.slice(0, state.page), page: state.page - 1 });
  }, [items, key, state.page, state.cursors]);

  /** Muat ulang halaman ini; halaman lain (dan status lain) dibuang dari cache karena isinya bisa bergeser. */
  const reload = useCallback(() => {
    queryCache.invalidate(base.split('?')[0], path);
    reloadPage();
  }, [base, path, reloadPage]);

  const from = state.page * pageSize + 1;
  return {
    rows,
    error,
    setError,
    handle,
    reload,
    /** Sedang memuat halaman lain sambil menampilkan baris lama. */
    busy: !items && rows !== null,
    pagination: {
      page: state.page,
      pageCount: cursors.length,
      from,
      to: from + Math.max((rows?.length ?? 0) - 1, 0),
      pageSize,
      onPage: goTo,
      onPageSize: setPageSize,
    } satisfies PaginationState,
  };
}

/** Paginasi di browser untuk daftar yang dikirim utuh oleh API (mis. aturan konten). */
export function useLocalPages<Row>(all: Row[] | null, initialSize: number = DEFAULT_PAGE_SIZE) {
  const [pageSize, setPageSize] = useState(initialSize);
  const [wanted, setPage] = useState(0);
  const total = all?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(wanted, pageCount - 1);
  const rows = all ? all.slice(page * pageSize, (page + 1) * pageSize) : null;
  return {
    rows,
    pagination: {
      page,
      pageCount,
      from: page * pageSize + 1,
      to: Math.min((page + 1) * pageSize, total),
      total,
      pageSize,
      onPage: setPage,
      onPageSize: (n: number) => {
        setPageSize(n);
        setPage(0);
      },
    } satisfies PaginationState,
  };
}

export function StatusFilter({
  value,
  options,
  onChange,
  labels,
}: {
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  labels?: Record<string, string>;
}) {
  return (
    <label className="grid gap-1.5 text-[0.925rem] font-semibold text-ink-soft">
      {t.common.status}
      <Select
        value={value}
        onValueChange={onChange}
        label={t.common.status}
        className="min-w-[200px]"
        options={options.map((o) => ({ value: o, label: labels?.[o] ?? o }))}
      />
    </label>
  );
}
