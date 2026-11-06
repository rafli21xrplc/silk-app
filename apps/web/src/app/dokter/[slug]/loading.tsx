import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonRegion className="container">
      <Skeleton className="mb-6 h-4 w-60" />
      <div className="mb-2 grid gap-6 rounded-card border border-line bg-white p-6 shadow-soft sm:grid-cols-[auto_1fr] sm:p-8">
        <Skeleton className="size-28 rounded-full sm:size-32" />
        <div className="grid content-start gap-3">
          <Skeleton className="h-9 w-2/3 max-w-md rounded-2xl" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-7 w-64 rounded-full" />
          <div className="flex gap-2">
            <Skeleton className="h-11 w-32 rounded-full" />
            <Skeleton className="h-11 w-32 rounded-full" />
          </div>
        </div>
      </div>
      <Skeleton className="mb-4 h-7 w-48" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48 rounded-card" />
        <Skeleton className="h-48 rounded-card" />
      </div>
    </SkeletonRegion>
  );
}
