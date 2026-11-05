import { PageHeadSkeleton, Skeleton, SkeletonRegion, SkeletonText, TableSkeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonRegion className="container">
      <PageHeadSkeleton chips={2} />
      <div className="mb-10 grid items-stretch gap-4 md:grid-cols-[1.1fr_1fr]">
        <div className="grid gap-5 rounded-card border border-line bg-white p-6 shadow-soft">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="grid gap-2">
              <Skeleton className="h-3 w-24" />
              <SkeletonText lines={1} />
            </div>
          ))}
        </div>
        <Skeleton className="h-[280px] w-full rounded-card md:h-full md:min-h-[320px]" />
      </div>
      <Skeleton className="mb-4 h-7 w-48" />
      <TableSkeleton rows={6} cols={3} />
    </SkeletonRegion>
  );
}
