import { PageHeadSkeleton, Skeleton, SkeletonRegion, TableSkeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonRegion className="container">
      <PageHeadSkeleton chips={0} />
      <div className="mb-5 flex flex-wrap gap-2">
        <Skeleton className="h-10 w-44" />
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-52" />
      </div>
      <Skeleton className="mb-5 h-12 w-full rounded-2xl" />
      <TableSkeleton rows={6} cols={2} />
    </SkeletonRegion>
  );
}
