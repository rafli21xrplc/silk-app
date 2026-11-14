import Link from 'next/link';
import { cn } from '@/lib/cn';
import { t } from '@/messages/id';

/** Judul bagian dengan tautan "Lihat semua" opsional. */
export function SectionHead({ id, title, href, className }: { id: string; title: React.ReactNode; href?: string; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 px-5 pb-2.5', className)}>
      <h2 id={id} className="m-0 text-base font-bold">
        {title}
      </h2>
      {href && (
        <Link href={href} className="-my-2.5 py-2.5 text-sm font-semibold text-primary-700 no-underline">
          {t.common.seeAll}
        </Link>
      )}
    </div>
  );
}

/**
 * Karusel geser horizontal dengan snap. Kartu berikutnya sengaja terpotong di tepi kanan
 * sebagai tanda bahwa daftar bisa digeser (tanpa panah atau titik halaman).
 */
export function Rail({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <ul aria-label={label} className={cn('no-scrollbar m-0 flex list-none snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1', className)}>
      {children}
    </ul>
  );
}

export function RailItem({ className, children }: { className?: string; children: React.ReactNode }) {
  return <li className={cn('flex shrink-0 snap-start', className)}>{children}</li>;
}
