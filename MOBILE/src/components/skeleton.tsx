import { t } from '@/messages/id';

const bar = 'animate-shimmer rounded-full bg-surface-2';

/** Kerangka saat memuat: bentuknya sama dengan kartu agar tata letak tidak meloncat. */
export function ListSkeleton({ header = false, count = 4 }: { header?: boolean; count?: number }) {
  return (
    <div role="status" aria-label={t.common.loading}>
      {header && (
        <div className="px-4 pt-6 pb-4">
          <div className={`${bar} mb-4 h-6 w-2/3`} />
          <div className="h-12 animate-shimmer rounded-2xl bg-surface-2" />
        </div>
      )}
      <div className="grid gap-3 px-4">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="grid gap-2.5 rounded-card border border-line/70 bg-white p-4">
            <div className={`${bar} h-3 w-1/3`} />
            <div className={`${bar} h-4 w-3/4`} />
            <div className={`${bar} h-3 w-1/2`} />
            <div className="mt-1 h-14 animate-shimmer rounded-2xl bg-surface" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div role="status" aria-label={t.common.loading} className="px-4 pt-20">
      <div className="flex items-center gap-3">
        <div className="size-16 animate-shimmer rounded-full bg-surface-2" />
        <div className="grid flex-1 gap-2">
          <div className={`${bar} h-5 w-3/4`} />
          <div className={`${bar} h-3 w-1/2`} />
        </div>
      </div>
      <div className="mt-6 h-28 animate-shimmer rounded-card bg-white" />
      <div className="mt-3 h-12 animate-shimmer rounded-2xl bg-surface-2" />
      <div className="mt-3 grid gap-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-shimmer rounded-2xl bg-white" />
        ))}
      </div>
    </div>
  );
}
