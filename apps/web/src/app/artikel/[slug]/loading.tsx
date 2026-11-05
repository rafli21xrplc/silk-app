import { Skeleton, SkeletonRegion, SkeletonText } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonRegion className="container">
      <div className="mb-4 flex gap-3">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-3.5 w-20" />
      </div>
      <div className="grid overflow-hidden rounded-[2rem] border border-line/80 bg-white shadow-soft md:grid-cols-[1.5fr_1fr]">
        <div className="grid gap-4 px-6 py-8 sm:px-10 sm:py-12">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-10 w-11/12 rounded-2xl" />
          <Skeleton className="h-10 w-2/3 rounded-2xl" />
          <SkeletonText lines={2} />
          <div className="mt-2 flex items-center gap-3 border-t border-line pt-5">
            <Skeleton className="size-11 rounded-full" />
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        </div>
        <Skeleton className="order-first aspect-[21/9] h-auto w-full rounded-none md:order-none md:aspect-auto" />
      </div>
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-14">
        <div className="max-w-[70ch]">
          <SkeletonText lines={4} className="mb-8" />
          <Skeleton className="mb-4 h-7 w-1/2 rounded-xl" />
          <SkeletonText lines={5} className="mb-8" />
          <SkeletonText lines={3} />
        </div>
        <div className="hidden gap-3 rounded-card border border-line bg-white p-5 shadow-soft lg:grid lg:self-start">
          <Skeleton className="mb-2 h-3 w-24" />
          {['w-4/5', 'w-3/5', 'w-11/12'].map((w) => (
            <Skeleton key={w} className={`h-3.5 ${w}`} />
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}
