import { PageHeadSkeleton, SkeletonRegion, TileSkeleton } from '@/components/ui/skeleton';

/** Kerangka umum saat berpindah halaman publik yang belum punya kerangka khusus. */
export default function Loading() {
  return (
    <SkeletonRegion className="container">
      <PageHeadSkeleton chips={0} />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <TileSkeleton key={i} lines={2} />
        ))}
      </div>
    </SkeletonRegion>
  );
}
