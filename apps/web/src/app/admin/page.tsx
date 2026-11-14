'use client';

import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Cog,
  FileCheck2,
  Flag,
  ScrollText,
  Tags,
  type LucideIcon,
} from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import type { Me } from '@/lib/types';
import { t } from '@/messages/id';
import { AdminShell, useAdminData, type QueueCounts } from './admin-shell';

interface AuditRow {
  id: number;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string;
  /** Waktu kejadian (API: `at`). */
  at: string;
}

const d = t.dashboard;

/** Antrean di grafik batang, urutan tetap (bukan diurutkan menurut jumlah agar posisi mudah diingat). */
const QUEUES: { key: keyof QueueCounts; href: string; label: string }[] = [
  { key: 'tariffRequests', href: '/admin/moderasi?tab=harga', label: t.moderation.tabs.harga },
  { key: 'revisions', href: '/admin/moderasi?tab=revisi', label: t.moderation.tabs.revisi },
  { key: 'profiles', href: '/admin/moderasi?tab=profil', label: t.moderation.tabs.profil },
  { key: 'media', href: '/admin/moderasi?tab=media', label: t.moderation.tabs.media },
  { key: 'articles', href: '/admin/moderasi?tab=artikel', label: t.moderation.tabs.artikel },
  { key: 'claims', href: '/admin/klaim', label: t.admin.claims },
  { key: 'tariffs', href: '/admin/tarif', label: t.admin.tariffs },
  { key: 'reports', href: '/admin/laporan', label: t.admin.reports },
  { key: 'imports', href: '/admin/impor', label: t.admin.imports },
];

const moderationTotal = (q: QueueCounts) => q.tariffRequests + q.revisions + q.articles + q.media + q.profiles;

const STATS: { label: string; href: string; icon: LucideIcon; tone: string; value: (q: QueueCounts) => number }[] = [
  { label: t.moderation.title, href: '/admin/moderasi', icon: ClipboardCheck, tone: 'bg-mint text-mint-ink', value: moderationTotal },
  { label: t.admin.claims, href: '/admin/klaim', icon: FileCheck2, tone: 'bg-sky text-sky-ink', value: (q) => q.claims },
  { label: t.admin.tariffs, href: '/admin/tarif', icon: Tags, tone: 'bg-lilac text-lilac-ink', value: (q) => q.tariffs },
  { label: t.admin.reports, href: '/admin/laporan', icon: Flag, tone: 'bg-peach text-peach-ink', value: (q) => q.reports },
];

export default function AdminHome() {
  return <AdminShell>{(me) => <Overview me={me} />}</AdminShell>;
}

function Overview({ me }: { me: Me }) {
  const { items: counts, error } = useAdminData<QueueCounts>('/admin/overview');
  const total = counts ? QUEUES.reduce((n, q) => n + counts[q.key], 0) : null;
  const today = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date());
  const firstName = me.user.name.split(/\s+/)[0] ?? me.user.name;

  return (
    <div className="grid gap-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="m-0 text-2xl font-bold tracking-tight sm:text-[1.7rem]">{d.welcome(firstName)}</h2>
          <p className="m-0 mt-1 text-muted">{d.welcomeBody}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-ink-soft">
            <CalendarDays className="size-4 text-muted" aria-hidden="true" />
            {today}
          </span>
          <Link href="/admin/moderasi" className={buttonVariants({ variant: 'primary' })}>
            <ClipboardCheck className="size-4" aria-hidden="true" />
            {t.moderation.title}
          </Link>
        </div>
      </section>

      {error && <p className="error">{error}</p>}

      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:gap-4 xl:grid-cols-4" data-dashboard-stats>
        {STATS.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="group flex h-full flex-col rounded-card border border-line bg-white p-4 text-ink sm:p-5 no-underline shadow-soft transition-[border-color,box-shadow] duration-200 hover:border-primary-200 hover:text-ink hover:no-underline hover:shadow-lift"
            >
              <span className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-3.5">
                <span className={cn('grid size-10 shrink-0 place-items-center rounded-2xl sm:size-12', s.tone)}>
                  <s.icon className="size-[22px]" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  {counts ? (
                    <span className="block text-[1.7rem] leading-none font-bold tracking-tight tabular-nums">{s.value(counts)}</span>
                  ) : (
                    <Skeleton className="h-7 w-12 rounded-lg" />
                  )}
                  <span className="mt-1 block truncate text-sm text-muted">{s.label}</span>
                </span>
              </span>
              <span className="mt-3 flex items-center justify-between border-t border-dashed border-line pt-3 text-sm font-semibold sm:mt-4 text-ink-soft group-hover:text-primary-700">
                {d.viewDetails}
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <QueueChart counts={counts} total={total} />
        <div className="grid content-start gap-6">
          <Activity />
          <JobsPanel />
        </div>
      </div>
    </div>
  );
}

/** Grafik batang mendatar: jumlah menunggu per antrean. Setiap baris tautan ke antreannya. */
function QueueChart({ counts, total }: { counts: QueueCounts | null; total: number | null }) {
  const max = counts ? Math.max(1, ...QUEUES.map((q) => counts[q.key])) : 1;
  return (
    <section aria-labelledby="antrean" className="rounded-card border border-line bg-white p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="antrean" className="m-0 text-lg">
            {d.queuesTitle}
          </h2>
          <p className="m-0 mt-0.5 text-sm text-muted">{t.admin.pending}</p>
        </div>
        <div className="text-right">
          {total === null ? (
            <Skeleton className="ml-auto h-8 w-14 rounded-lg" />
          ) : (
            <p className="m-0 text-[1.7rem] leading-none font-bold tabular-nums">{total}</p>
          )}
          <p className="m-0 mt-1 text-xs text-muted">{d.totalPending}</p>
        </div>
      </div>
      {total === 0 && (
        <p className="mt-4 mb-0 flex items-center gap-2 rounded-xl bg-ok-soft px-3.5 py-2.5 text-sm font-semibold text-ok">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          {d.allClear}
        </p>
      )}
      <ul className="m-0 mt-5 grid list-none gap-1 p-0" data-queue-chart>
        {QUEUES.map((q) => {
          const n = counts?.[q.key];
          return (
            <li key={q.key}>
              <Link
                href={q.href}
                className="group grid grid-cols-[minmax(0,9.5rem)_1fr_2.5rem] items-center gap-3 rounded-xl px-2 py-2 text-ink no-underline hover:bg-surface hover:text-ink hover:no-underline sm:grid-cols-[minmax(0,12rem)_1fr_3rem]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{q.label}</span>
                  <span className="block truncate text-xs text-muted">{d.queueHints[q.key]}</span>
                </span>
                <span className="h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                  {n !== undefined && (
                    <span
                      className={cn('block h-full rounded-full transition-[width] duration-500 ease-soft', n > 0 ? 'bg-primary-500' : 'bg-transparent')}
                      style={{ width: `${(n / max) * 100}%` }}
                    />
                  )}
                </span>
                <span className="text-right text-sm font-bold tabular-nums">{n ?? '–'}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Aktivitas terbaru dari log audit (6 catatan terakhir). */
function Activity() {
  const { items, error } = useAdminData<AuditRow[]>('/admin/audit-logs?limit=6');
  const tones = ['bg-primary-500', 'bg-sky-ink', 'bg-peach-ink', 'bg-lilac-ink'];
  return (
    <section aria-labelledby="aktivitas" className="rounded-card border border-line bg-white p-5 shadow-soft">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="aktivitas" className="m-0 text-lg">
          {d.activityTitle}
        </h2>
        <Link href="/admin/audit" className="inline-flex items-center gap-1 text-sm font-semibold no-underline">
          {d.activityAll}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
      {error && <p className="error m-0">{error}</p>}
      {!items && !error && (
        <div className="grid gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      )}
      {items?.length === 0 && <p className="m-0 text-sm text-muted">{d.activityEmpty}</p>}
      {items && items.length > 0 && (
        <ol className="m-0 grid list-none gap-2 p-0">
          {items.map((r, i) => (
            <li key={r.id} className="relative overflow-hidden rounded-xl bg-surface/70 py-2.5 pr-3 pl-4">
              <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1', tones[i % tones.length])} />
              <p className="m-0 flex items-center gap-2 text-sm font-semibold">
                <ScrollText className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
                <code className="truncate bg-transparent p-0 text-[0.82rem]">{r.action}</code>
              </p>
              <p className="m-0 mt-0.5 truncate text-xs text-muted">
                {r.entity} · {formatDateTime(r.at)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Ringkasan job latar per jenis dan status. */
function JobsPanel() {
  const { items, error } = useAdminData<{ type: string; status: string; n: number }[]>('/admin/jobs');
  const tone = (s: string) =>
    s === 'gagal' || s === 'failed' ? 'bg-danger-soft text-danger' : s === 'selesai' || s === 'done' ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn';
  return (
    <section aria-labelledby="job-latar" className="rounded-card border border-line bg-white p-5 shadow-soft">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="job-latar" className="m-0 flex items-center gap-2 text-lg">
          <Cog className="size-[18px] text-muted" aria-hidden="true" />
          {d.jobsTitle}
        </h2>
        <Link href="/admin/jobs" className="inline-flex items-center gap-1 text-sm font-semibold no-underline">
          {d.jobsAll}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
      {error && <p className="error m-0">{error}</p>}
      {!items && !error && <Skeleton className="h-16 rounded-xl" />}
      {items?.length === 0 && <p className="m-0 text-sm text-muted">{d.jobsEmpty}</p>}
      {items && items.length > 0 && (
        <ul className="m-0 grid list-none gap-1.5 p-0">
          {items.slice(0, 6).map((r) => (
            <li key={`${r.type}-${r.status}`} className="flex items-center justify-between gap-3 text-sm">
              <code className="truncate bg-transparent p-0">{r.type}</code>
              <span className="flex shrink-0 items-center gap-2">
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', tone(r.status))}>{r.status}</span>
                <span className="w-8 text-right font-bold tabular-nums">{r.n}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
