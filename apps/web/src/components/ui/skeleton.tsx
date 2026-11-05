import { cn } from '@/lib/cn';
import { t } from '@/messages/id';

/**
 * Kerangka pemuatan (skeleton). Dekoratif: pembaca layar hanya mendengar satu "Memuat…" dari pembungkusnya.
 * Muncul dengan fade setelah jeda singkat agar tidak berkedip saat data cepat; shimmer diam bila gerak dikurangi.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('skeleton h-4 rounded-full', className)} />;
}

/** Pembungkus area yang sedang dimuat: mengumumkan status sekali ke pembaca layar. */
export function SkeletonRegion({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{t.common.loading}</span>
      {children}
    </div>
  );
}

/** Beberapa baris teks; baris terakhir lebih pendek seperti paragraf asli. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('grid gap-2.5', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-3.5', i === lines - 1 ? 'w-3/5' : 'w-full')} />
      ))}
    </div>
  );
}

/** Remah roti + chip + judul + subjudul: kepala halaman detail. */
export function PageHeadSkeleton({ chips = 2, subtitle = true }: { chips?: number; subtitle?: boolean }) {
  return (
    <div className="mb-8">
      <div className="mb-5 flex gap-3">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-3.5 w-24" />
      </div>
      {chips > 0 && (
        <div className="mb-4 flex gap-2">
          {Array.from({ length: chips }, (_, i) => (
            <Skeleton key={i} className={cn('h-7', i === 0 ? 'w-24' : 'w-32')} />
          ))}
        </div>
      )}
      <Skeleton className="mb-4 h-10 w-4/5 max-w-xl rounded-2xl sm:h-12" />
      {subtitle && <SkeletonText lines={2} className="max-w-2xl" />}
    </div>
  );
}

/** Kartu faskes (mengikuti FacilityCard). */
export function FacilityCardSkeleton() {
  return (
    <div className="flex h-full flex-col gap-4 rounded-card border border-line/80 bg-white p-5 shadow-soft">
      <div className="flex gap-1.5">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-24" />
      </div>
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-3.5 w-1/2" />
      <div className="mt-auto grid gap-3 rounded-2xl bg-surface/80 p-4">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>
    </div>
  );
}

/** Ubin daftar sederhana (layanan, artikel). */
export function TileSkeleton({ lines = 1 }: { lines?: number }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
      <Skeleton className="mb-3 h-4 w-1/2" />
      <SkeletonText lines={lines} />
    </div>
  );
}

/** Tabel: kepala + baris. Dipakai halaman bandingkan, tarif, dan daftar admin/portal. */
export function TableSkeleton({ rows = 5, cols = 3, className }: { rows?: number; cols?: number; className?: string }) {
  const widths = ['w-2/3', 'w-1/2', 'w-1/3', 'w-2/5'];
  return (
    <div className={cn('overflow-hidden rounded-card border border-line bg-white shadow-soft', className)}>
      <div className="flex gap-6 border-b border-line bg-surface/70 px-4 py-3.5">
        {Array.from({ length: cols }, (_, c) => (
          <Skeleton key={c} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-6 border-b border-line px-4 py-4 last:border-b-0">
          {Array.from({ length: cols }, (_, c) => (
            <div key={c} className="grid flex-1 gap-2">
              <Skeleton className={cn('h-4', widths[(r + c) % widths.length])} />
              {c === cols - 1 && <Skeleton className="h-3 w-1/3" />}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Kerangka portal/admin (profil + navigasi samping + isi) selagi sesi dimuat. */
export function AppShellSkeleton() {
  return (
    <SkeletonRegion className="container grid gap-6 lg:grid-cols-[240px_1fr] lg:gap-10">
      <div className="grid content-start gap-4">
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3 shadow-soft">
          <Skeleton className="size-10 shrink-0 rounded-xl" />
          <div className="grid flex-1 gap-2">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
        <div className="hidden gap-3 px-1 lg:grid">
          {['w-4/5', 'w-3/5', 'w-11/12', 'w-2/3', 'w-1/2'].map((w) => (
            <Skeleton key={w} className={cn('h-4', w)} />
          ))}
        </div>
      </div>
      <div className="min-w-0">
        <Skeleton className="mb-6 h-9 w-1/2 rounded-2xl" />
        <TableSkeleton rows={6} />
      </div>
    </SkeletonRegion>
  );
}

/** Tabel kerangka beserta pengumuman "Memuat…" (untuk daftar di portal/admin). */
export function LoadingTable({ rows = 5, cols = 3 }: { rows?: number; cols?: number }) {
  return (
    <SkeletonRegion>
      <TableSkeleton rows={rows} cols={cols} />
    </SkeletonRegion>
  );
}

/** Kartu formulir kerangka (label + kolom isian). */
export function LoadingForm({ fields = 5 }: { fields?: number }) {
  return (
    <SkeletonRegion className="card grid gap-5">
      <Skeleton className="h-6 w-1/3" />
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="grid gap-2">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-[46px] w-full rounded-field" />
        </div>
      ))}
    </SkeletonRegion>
  );
}
