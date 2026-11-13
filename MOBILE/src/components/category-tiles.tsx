import Link from 'next/link';
import { categoryPhoto } from '@/demo/photos';
import { cn } from '@/lib/cn';
import { QUICK_LINKS } from '@/lib/home';
import { t } from '@/messages/id';

/** Ubin lebar di grid 3 kolom; sisanya 1 kolom. Pola bergantian agar tidak terlihat seperti tabel. */
const WIDE = new Set(['laboratorium', 'rawat-inap']);

/**
 * Ubin kategori berfoto di beranda (grid "bento"): kebutuhan pasien sebagai pintu masuk,
 * ditutup ubin "Semua layanan" dengan jumlah layanan.
 */
export function CategoryBento({ serviceTotal }: { serviceTotal: number }) {
  return (
    <nav aria-label={t.home.categoriesLabel} className="mx-4 grid auto-rows-[6.5rem] grid-cols-3 gap-2.5">
      {QUICK_LINKS.map((q) => {
        const photo = categoryPhoto(q.key);
        return (
          <Link
            key={q.key}
            href={q.href}
            data-category-tile={q.key}
            className={cn('relative overflow-hidden rounded-2xl bg-surface-2 no-underline active:opacity-90', WIDE.has(q.key) && 'col-span-2')}
          >
            {photo && <img src={photo.wide} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" decoding="async" />}
            <span className="absolute bottom-2 left-2 rounded-lg bg-white px-2 py-1 text-xs font-semibold text-ink">{t.quick[q.key]}</span>
          </Link>
        );
      })}
      <Link href="/layanan" className="flex flex-col justify-between rounded-2xl bg-ink p-3 text-white no-underline active:opacity-90">
        <span className="text-sm leading-tight font-semibold">{t.home.shortcuts.services}</span>
        <span className="text-xs text-white/75">{t.home.serviceTotal(serviceTotal)}</span>
      </Link>
    </nav>
  );
}
