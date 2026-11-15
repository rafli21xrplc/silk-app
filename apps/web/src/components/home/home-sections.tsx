import Link from 'next/link';
import { ArrowRight, Search, Stethoscope } from 'lucide-react';
import { FACILITY_TYPES, formatPrice, type PractitionerSpecialty } from '@silk/shared';
import { NearMeButton } from '@/components/search/near-me-button';
import { ResultsMap, type MapPoint } from '@/components/search/results-map';
import { Select } from '@/components/ui/select';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { FacilityListItem } from '@/lib/types';
import { photoSrc, TILE_PHOTOS } from '@/lib/photos';
import { t } from '@/messages/id';

const h = t.home;

/** Ubin jenis layanan di bawah hero (dari SILK versi lama). Tautan ke direktori yang sudah ada, bukan halaman baru. */
const TILES: { key: string; href: string }[] = [
  { key: 'dokter', href: '/dokter' },
  { key: 'rumah_sakit', href: '/cari?type=rumah_sakit' },
  { key: 'klinik', href: '/cari?type=klinik' },
  { key: 'puskesmas', href: '/cari?type=puskesmas' },
  { key: 'laboratorium', href: '/cari?type=laboratorium' },
  { key: 'apotek', href: '/cari?type=apotek' },
  { key: 'gaya_hidup', href: '/cari?type=gaya_hidup' },
  { key: 'artikel', href: '/artikel' },
];

export function CategoryTiles() {
  return (
    <section aria-labelledby="mau-cari" className="mt-10">
      <h2 id="mau-cari" className="mt-0 mb-4">
        {h.tilesTitle}
      </h2>
      <nav aria-label={h.tilesLabel}>
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4">
          {TILES.map(({ key, href }) => {
            const photo = TILE_PHOTOS[key];
            const c = h.tiles[key]!;
            return (
              <li key={key}>
                <Link
                  href={href}
                  data-home-tile={key}
                  className="group flex h-full items-center gap-2.5 rounded-card border border-line/80 bg-white p-3 text-ink sm:gap-3 sm:p-4 no-underline shadow-soft transition-[border-color,box-shadow,transform] duration-300 ease-soft hover:-translate-y-0.5 hover:border-primary-200 hover:text-ink hover:no-underline hover:shadow-lift"
                >
                  <span className="size-12 shrink-0 overflow-hidden rounded-2xl bg-surface-2 sm:size-14">
                    {photo && (
                      <img
                        src={photoSrc(photo, 'sq')}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="size-full object-cover transition-transform duration-500 ease-soft group-hover:scale-105"
                      />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[0.95rem] leading-snug font-semibold sm:text-base">{c.title}</span>
                    <span className="hidden text-sm text-muted sm:block">{c.body}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </section>
  );
}

/** Pintasan spesialisasi: yang punya dokter terbanyak di SILK (jumlah dari data, bukan pembayaran). */
export function SpecialtyShortcuts({ specialties }: { specialties: PractitionerSpecialty[] }) {
  const top = [...specialties].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'id')).slice(0, 6);
  if (top.length === 0) return null;
  return (
    <section aria-labelledby="spesialis" className="mt-14">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="spesialis" className="mt-0 mb-1">
            {h.specialtiesTitle}
          </h2>
          <p className="m-0 max-w-2xl text-muted">{h.specialtiesHint}</p>
        </div>
        <Link href="/dokter" className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold no-underline shadow-soft hover:bg-primary-50 hover:no-underline">
          {h.doctorsAll} <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
      <ul className="mt-6 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {top.map((s) => (
          <li key={s.name}>
            <Link
              href={`/dokter?specialty=${encodeURIComponent(s.name)}`}
              data-specialty={s.name}
              className="group flex items-center justify-between gap-3 rounded-card border border-line/80 bg-white px-5 py-4 text-ink no-underline shadow-soft transition-[border-color,box-shadow] duration-300 ease-soft hover:border-primary-200 hover:text-ink hover:no-underline hover:shadow-lift"
            >
              <span className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-mint text-mint-ink">
                  <Stethoscope className="size-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold">{s.name}</span>
                  <span className="block text-sm text-muted">{h.specialtyCount(s.count)}</span>
                </span>
              </span>
              <ArrowRight className="size-4 text-primary-700 transition-transform duration-300 ease-soft group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * "Layanan di sekitar Anda" + "Cari fasilitas kesehatan" (dari SILK versi lama). Peta hanya bila gaya peta
 * dikonfigurasi; pencarian per jenis dan "Dekat saya" selalu ada.
 */
export function NearbySection({ facilities, mapOn }: { facilities: FacilityListItem[]; mapOn: boolean }) {
  const points: MapPoint[] = facilities.flatMap((f) =>
    f.location
      ? [{ id: f.id, slug: f.slug, name: f.name, typeLabel: t.facilityType[f.type] ?? f.type, priceText: f.price ? formatPrice(f.price, { ask: t.price.ask, from: t.price.from }) : null, ...f.location }]
      : [],
  );
  return (
    <section aria-labelledby="sekitar" className="mt-14">
      <h2 id="sekitar" className="mt-0 mb-1">
        {h.nearbyTitle}
      </h2>
      <p className="m-0 max-w-2xl text-muted">{h.nearbyHint}</p>
      <div className={cn('mt-6 grid gap-4', mapOn && points.length > 0 && 'lg:grid-cols-[minmax(0,1fr)_340px]')}>
        {mapOn && points.length > 0 && (
          <div>
            <ResultsMap points={points} center={null} className="h-[360px] overflow-hidden rounded-card border border-line/80 shadow-soft sm:h-[420px]" />
            <p className="m-0 mt-2 text-xs text-muted">{h.nearbyCount(points.length)}</p>
          </div>
        )}
        <div className="flex flex-col justify-center gap-4 rounded-card bg-gradient-to-br from-primary-700 to-primary-900 p-6 text-white shadow-lift">
          <div>
            <h3 className="mt-0 mb-1 text-white">{h.typeSearchTitle}</h3>
            <p className="m-0 text-sm text-primary-50">{h.typeSearchHint}</p>
          </div>
          <form action="/cari" method="get" className="grid gap-3" data-type-search>
            <Select
              name="type"
              label={h.typeSearchLabel}
              defaultValue=""
              options={[{ value: '', label: t.search.allTypes }, ...FACILITY_TYPES.map((ft) => ({ value: ft, label: t.facilityType[ft] ?? ft }))]}
            />
            <button type="submit" className={cn(buttonVariants({ variant: 'primary' }), 'bg-amber-400 text-ink hover:bg-amber-300 hover:text-ink')}>
              <Search className="size-4" aria-hidden="true" />
              {h.typeSearchSubmit}
            </button>
          </form>
          <div className="[&_button]:border-white/40 [&_button]:bg-transparent [&_button]:text-white [&_p]:text-primary-50">
            <NearMeButton state={{}} />
          </div>
        </div>
      </div>
    </section>
  );
}
