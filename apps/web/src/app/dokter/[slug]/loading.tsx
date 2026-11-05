import { PageHeadSkeleton, Skeleton, SkeletonRegion } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonRegion className="container">
      <PageHeadSkeleton chips={0} subtitle={false} />
      <div className="grid max-w-2xl gap-4 rounded-card border border-line bg-white p-5 shadow-soft">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex gap-6">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}
