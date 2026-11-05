import { Skeleton, SkeletonRegion, SkeletonText } from '@/components/ui/skeleton';

/** Mengikuti /layanan/[slug]: kepala + panel ringkasan, lalu kartu harga per wilayah. */
export default function Loading() {
  return (
    <SkeletonRegion className="container">
      <div className="mb-5 flex gap-3">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-3.5 w-24" />
      </div>
      <div className="mb-10 grid items-center gap-8 rounded-[2rem] border border-white bg-gradient-to-br from-surface via-white to-canvas px-6 py-8 shadow-soft sm:px-10 sm:py-12 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <div className="mb-5 flex items-center gap-4">
            <Skeleton className="size-16 rounded-[1.4rem] sm:size-20" />
            <Skeleton className="h-8 w-28" />
          </div>
          <Skeleton className="mb-4 h-10 w-3/5 rounded-2xl sm:h-12" />
          <SkeletonText lines={2} className="max-w-xl" />
        </div>
        <div className="grid gap-3 rounded-card border border-line/60 bg-white p-6">
          <Skeleton className="h-3 w-36" />
          <Skeleton className="h-7 w-52" />
          <div className="mt-2 grid grid-cols-2 gap-2.5 border-t border-line pt-4">
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="col-span-2 h-4" />
          </div>
        </div>
      </div>
      <Skeleton className="mb-3 h-7 w-64" />
      <Skeleton className="mb-5 h-4 w-96 max-w-full" />
      <div className="grid gap-5 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="grid gap-4 rounded-card border border-line/80 bg-white p-6 shadow-soft">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-2 w-full" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-14 rounded-2xl" />
              <Skeleton className="h-14 rounded-2xl" />
            </div>
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}
