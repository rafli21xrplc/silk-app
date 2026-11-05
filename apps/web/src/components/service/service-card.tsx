import Link from 'next/link';
import { ArrowUpRight, Building2, MapPin } from 'lucide-react';
import { priceRangeText, type CatalogItem } from '@/lib/service-summary';
import { t } from '@/messages/id';
import { categoryTone, IconTile, serviceIcon } from './service-visual';

/** Kartu katalog: ikon + nama + deskripsi, lalu panel rentang harga dan cakupan faskes/wilayah. */
export function ServiceCard({ service }: { service: CatalogItem }) {
  const tone = categoryTone(service.category.slug);
  const s = service.summary;
  const range = s ? priceRangeText(s.minPrice, s.maxPrice) : null;
  return (
    <article className="group relative flex h-full flex-col gap-4 rounded-card border border-line/80 bg-white p-5 shadow-soft transition-[border-color,box-shadow,transform] duration-300 ease-soft hover:-translate-y-1 hover:border-primary-200 hover:shadow-lift">
      <div className="flex items-start gap-4">
        <IconTile
          icon={serviceIcon(service.slug)}
          tone={tone}
          className="transition-transform duration-300 ease-soft group-hover:scale-110 group-hover:-rotate-3"
        />
        <div className="min-w-0 flex-1">
          <h3 className="m-0 text-[1.05rem] leading-snug">
            <Link
              href={`/layanan/${service.slug}`}
              className="text-ink no-underline after:absolute after:inset-0 after:rounded-card after:content-[''] group-hover:text-primary-800 hover:no-underline"
            >
              {service.name}
            </Link>
          </h3>
          {service.description && <p className="mt-1 mb-0 line-clamp-2 text-sm text-muted">{service.description}</p>}
        </div>
        <ArrowUpRight
          className="mt-0.5 size-5 shrink-0 text-primary-600 transition-transform duration-300 ease-soft group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          aria-hidden="true"
        />
      </div>

      <div className="mt-auto rounded-2xl bg-surface/70 px-4 py-3.5">
        <p className="m-0 text-xs font-semibold tracking-wide text-muted uppercase">{t.services.priceRange}</p>
        {range ? (
          <p className="m-0 mt-0.5 font-bold text-ink tabular-nums">{range}</p>
        ) : (
          <p className="m-0 mt-0.5 text-[0.95rem] text-muted">{t.services.noPrice}</p>
        )}
        {s && s.cityCount > 0 && (
          <p className="m-0 mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="size-3.5 text-muted" aria-hidden="true" />
              {t.services.facilityCount(s.facilityCount)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-3.5 text-muted" aria-hidden="true" />
              {t.services.cityCount(s.cityCount)}
            </span>
          </p>
        )}
      </div>
    </article>
  );
}
