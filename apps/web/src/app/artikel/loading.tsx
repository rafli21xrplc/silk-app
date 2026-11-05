import { Skeleton, SkeletonRegion, SkeletonText } from '@/components/ui/skeleton';

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-card border border-line/80 bg-white shadow-soft">
      <Skeleton className="aspect-[16/9] h-auto w-full rounded-none" />
      <div className="grid gap-3 p-5">
        <Skeleton className="h-3.5 w-36" />
        <Skeleton className="h-5 w-4/5" />
        <SkeletonText lines={2} />
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <SkeletonRegion className="container">
      <div className="mb-8 rounded-[2rem] border border-white bg-gradient-to-br from-primary-100 via-[#f1f8f7] to-sand-100 px-6 py-10 shadow-soft sm:px-10 sm:py-14">
        <Skeleton className="mb-5 h-8 w-52 bg-white/70" />
        <Skeleton className="mb-4 h-11 w-3/4 max-w-xl rounded-2xl" />
        <Skeleton className="h-4 w-2/3 max-w-md" />
      </div>
      <Skeleton className="mb-8 h-12 w-full max-w-sm" />
      <div className="grid overflow-hidden rounded-[2rem] border border-line/80 bg-white shadow-soft md:grid-cols-[1.1fr_1fr]">
        <div className="grid content-center gap-4 p-6 sm:p-10">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-9 w-11/12 rounded-2xl" />
          <SkeletonText lines={2} />
          <Skeleton className="h-11 w-40" />
        </div>
        <Skeleton className="aspect-[16/9] h-auto w-full rounded-none md:order-first md:aspect-auto md:min-h-[320px]" />
      </div>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </SkeletonRegion>
  );
}
