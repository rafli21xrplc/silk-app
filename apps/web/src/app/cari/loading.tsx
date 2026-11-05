import { FacilityCardSkeleton, Skeleton, SkeletonRegion } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonRegion className="container">
      <Skeleton className="mb-5 h-10 w-2/3 max-w-md rounded-2xl" />
      <Skeleton className="mb-5 h-14 w-full rounded-full" />
      <div className="mb-5 flex flex-wrap gap-2">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="mb-5 h-12 w-full rounded-2xl" />
      <ul className="m-0 grid list-none gap-4 p-0 lg:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i}>
            <FacilityCardSkeleton />
          </li>
        ))}
      </ul>
    </SkeletonRegion>
  );
}
