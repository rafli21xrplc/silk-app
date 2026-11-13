import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, ChevronRight, Search } from 'lucide-react';
import { ChipLink } from '@/components/chip-link';
import { DemoNotice } from '@/components/demo-notice';
import { Empty } from '@/components/empty';
import { EstimateChip, PriceTag } from '@/components/price';
import { categoryTone, IconTile, serviceIcon } from '@/components/service-icon';
import { ShareButton } from '@/components/share-button';
import { TopBar } from '@/components/top-bar';
import { VerificationBadge } from '@/components/trust';
import { formatRupiah } from '@silk/shared';
import { formatShortDate, priceRangeText } from '@/lib/format';
import { toQueryString } from '@/lib/search';
import { anyDemo, getCompare, getService, snapshotDate } from '@/lib/silk/api';
import { summarizeCities } from '@/lib/summary';
import { t } from '@/messages/id';

export const revalidate = 300;

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const s = await getService((await params).slug);
  return s ? { title: s.data.name, description: s.data.description ?? undefined } : {};
}

export default async function ServicePage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { slug } = await params;
  const sp = await searchParams;
  const loaded = await getService(slug);
  if (!loaded) notFound();
  const s = loaded.data;
  const sum = summarizeCities(s.cities);
  const cities = s.cities.map((c) => c.city);
  const city = typeof sp.kota === 'string' && cities.includes(sp.kota) ? sp.kota : cities[0];
  const hideStale = sp.lama === '0';
  const compare = city ? await getCompare(slug, city, hideStale) : null;
  const href = (patch: { kota?: string; lama?: string }) => {
    const qs = toQueryString({ kota: city, lama: hideStale ? '0' : undefined, ...patch });
    return qs ? `/layanan/${slug}?${qs}` : `/layanan/${slug}`;
  };
  const range = priceRangeText(sum.minPrice, sum.maxPrice);

  return (
    <>
      <TopBar title={s.name} backHref="/layanan" action={<ShareButton title={s.name} />} />
      <DemoNotice show={anyDemo(loaded, compare)} date={snapshotDate()} />

      <div className="px-4 pt-5">
        <div className="flex items-start gap-3">
          <IconTile icon={serviceIcon(s.slug)} tone={categoryTone(s.category.slug)} />
          <div className="min-w-0">
            <p className="m-0 text-[0.75rem] font-semibold text-muted">{s.category.name}</p>
            <h1 className="m-0 text-[1.35rem] leading-tight font-extrabold tracking-tight">{s.name}</h1>
          </div>
        </div>
        {s.description && <p className="m-0 mt-3 text-sm text-ink-soft">{s.description}</p>}
      </div>

      <section className="mx-4 mt-4 rounded-card bg-gradient-to-br from-primary-600 to-primary-800 p-5 text-white shadow-lift" aria-label={t.services.range}>
        <p className="m-0 text-[0.8rem] font-semibold text-primary-100">{t.services.range}</p>
        <p className="m-0 mt-1 text-[1.6rem] leading-tight font-extrabold tracking-tight tabular-nums">{range ?? t.services.noPrice}</p>
        <p className="m-0 mt-1.5 text-[0.8rem] text-primary-50">
          {t.services.facilities(sum.facilityCount)}
          {sum.latestVerifiedAt && ` · ${t.services.lastChecked(formatShortDate(sum.latestVerifiedAt))}`}
        </p>
      </section>

      {s.cities.length > 1 && (
        <section aria-labelledby="per-wilayah" className="mt-5 px-4">
          <h2 id="per-wilayah" className="m-0 mb-2 text-base font-bold">
            {t.services.perCity}
          </h2>
          <ul className="m-0 grid list-none grid-cols-2 gap-2.5 p-0">
            {s.cities.map((c) => (
              <li key={c.city} className="rounded-2xl bg-white p-3.5 shadow-soft">
                <p className="m-0 text-[0.75rem] font-semibold text-muted">{c.city}</p>
                <p className="m-0 mt-0.5 text-[0.95rem] font-bold tabular-nums">{priceRangeText(c.minPrice, c.maxPrice) ?? '–'}</p>
                {c.medianPrice !== null && <p className="m-0 text-[0.72rem] text-muted">{t.services.median(formatRupiah(c.medianPrice))}</p>}
                <p className="m-0 text-[0.72rem] text-muted">{t.services.facilities(c.facilityCount)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="bandingkan" className="mt-6">
        <div className="px-4">
          <h2 id="bandingkan" className="m-0 text-base font-bold">
            {t.services.compareTitle}
          </h2>
          <p className="m-0 mt-0.5 mb-3 text-[0.8rem] text-muted">{t.services.compareHint}</p>
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
          {cities.map((c) => (
            <ChipLink key={c} href={href({ kota: c })} active={c === city}>
              {c}
            </ChipLink>
          ))}
          <ChipLink href={href({ lama: hideStale ? undefined : '0' })} active={hideStale}>
            {t.services.hideStale}
          </ChipLink>
        </div>
        {!compare || compare.data.rows.length === 0 ? (
          <Empty text={t.services.noCompare} />
        ) : (
          <ol className="m-0 grid list-none gap-2.5 px-4" data-compare>
            {compare.data.rows.map((r) => {
              const included = Object.values(r.components).filter(Boolean).length;
              const total = Object.keys(r.components).length;
              return (
                <li key={r.tariffId}>
                  <Link href={`/faskes/${r.facility.slug}`} className="tap flex items-start gap-3 rounded-2xl border border-line/70 bg-white p-3.5 text-ink no-underline shadow-soft">
                    <span className="grid min-w-0 flex-1 gap-1">
                      <span className="text-sm leading-snug font-bold">{r.facility.name}</span>
                      <PriceTag price={r.price} size="sm" />
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.72rem] text-muted">
                        <VerificationBadge level={r.verification} />
                        <span>{`${t.trust.effectiveFrom} ${formatShortDate(r.effectiveFrom)}`}</span>
                        {total > 0 && <span>{`${t.facility.packageContents} ${included}/${total}`}</span>}
                        {r.stale && (
                          <span className="inline-flex items-center gap-1 font-semibold text-warn">
                            <AlertTriangle className="size-3" aria-hidden="true" />
                            {t.trust.stale}
                          </span>
                        )}
                      </span>
                    </span>
                    <ChevronRight className="mt-1 size-5 shrink-0 text-muted" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className="mt-5 grid gap-2 px-4">
        <p className="m-0 flex items-center gap-2 text-[0.75rem] text-muted">
          <EstimateChip /> {t.price.estimateHelp}
        </p>
        <Link
          href={`/cari?service=${s.slug}`}
          className="tap mt-2 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary-600 font-semibold text-white no-underline shadow-soft"
        >
          <Search className="size-4" aria-hidden="true" />
          {t.services.searchFacilities}
        </Link>
      </div>
    </>
  );
}
