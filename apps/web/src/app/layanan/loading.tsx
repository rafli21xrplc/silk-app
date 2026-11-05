import { Skeleton, SkeletonRegion, SkeletonText } from '@/components/ui/skeleton';

/** Mengikuti /layanan: kepala pastel, kolom cari + chip, lalu grup kartu layanan. */
export default function Loading() {
  return (
    <SkeletonRegion className="container">
      <div className="mb-8 rounded-[2rem] border border-white bg-gradient-to-br from-primary-100 via-[#eef7f8] to-sky px-6 py-10 shadow-soft sm:px-10 sm:py-14">
        <Skeleton className="mb-5 h-8 w-44 bg-white/70" />
        <Skeleton className="mb-4 h-10 w-4/5 max-w-xl rounded-2xl sm:h-12" />
        <SkeletonText lines={2} className="max-w-lg" />
        <div className="mt-6 flex gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-8 w-28 bg-white/70" />
          ))}
        </div>
      </div>
      <Skeleton className="mb-4 h-12 w-full max-w-sm" />
      <div className="mb-8 flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-28" />
        ))}
      </div>
      {[0, 1].map((group) => (
        <div key={group} className="mb-12">
          <div className="mb-5 flex items-center gap-3">
            <Skeleton className="size-9 rounded-xl" />
            <Skeleton className="h-6 w-40" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex flex-col gap-4 rounded-card border border-line/80 bg-white p-5 shadow-soft">
                <div className="flex gap-4">
                  <Skeleton className="size-12 shrink-0 rounded-2xl" />
                  <div className="grid flex-1 gap-2.5">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3.5 w-full" />
                  </div>
                </div>
                <div className="grid gap-2.5 rounded-2xl bg-surface/70 p-4">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-3.5 w-32" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </SkeletonRegion>
  );
}
