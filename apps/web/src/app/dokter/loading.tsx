import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <SkeletonRegion className="container">
      <Skeleton className="mb-2 h-10 w-2/3 max-w-md rounded-2xl" />
      <Skeleton className="mb-5 h-5 w-full max-w-xl" />
      <Skeleton className="mb-5 h-14 w-full rounded-full" />
      <div className="mb-5 flex flex-wrap gap-2">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-36" />
      </div>
      <ul className="m-0 grid list-none gap-4 p-0 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="grid gap-4 rounded-card border border-line bg-white p-5 shadow-soft">
            <div className="flex gap-4">
              <Skeleton className="size-16 shrink-0 rounded-full" />
              <div className="grid flex-1 gap-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </li>
        ))}
      </ul>
    </SkeletonRegion>
  );
}
