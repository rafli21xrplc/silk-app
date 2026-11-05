import { Skeleton, SkeletonRegion } from '@/components/ui/skeleton';

/** Isi kartu akun selagi halaman masuk/daftar dimuat (kerangka panel ada di layout). */
export default function Loading() {
  return (
    <SkeletonRegion>
      <Skeleton className="mb-3 h-9 w-2/5 rounded-2xl" />
      <Skeleton className="mb-8 h-4 w-4/5" />
      {[0, 1].map((i) => (
        <div key={i} className="mb-5 grid gap-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-12 w-full rounded-field" />
        </div>
      ))}
      <Skeleton className="h-[52px] w-full" />
    </SkeletonRegion>
  );
}
