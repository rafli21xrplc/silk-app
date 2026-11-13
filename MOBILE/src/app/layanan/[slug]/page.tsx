import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Search } from 'lucide-react';
import { formatRupiah } from '@silk/shared';
import { ChipLink } from '@/components/chip-link';
import { DemoNotice } from '@/components/demo-notice';
import { Empty } from '@/components/empty';
import { ListBox, ListGroup, ListRow } from '@/components/list';
import { Thumb } from '@/components/photo';
import { PriceValue } from '@/components/price';
import { RangeBar } from '@/components/range-bar';
import { ShareButton } from '@/components/share-button';
import { TopBar } from '@/components/top-bar';
import { TrustNote } from '@/components/trust';
import { formatShortDate, priceRangeText } from '@/lib/format';
import { facilityPhoto } from '@/lib/photos';
import { relativeWidth } from '@/lib/range';
import { toQueryString } from '@/lib/search';
import { anyDemo, getCompare, getService, snapshotDate } from '@/lib/silk/api';
import { summarizeCities } from '@/lib/summary';
import { commonVerification } from '@/lib/trust';
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
  const rows = compare?.data.rows ?? [];
  const priced = rows.filter((r) => r.price.type !== 'tanya' && r.price.min !== null).map((r) => r.price.min!);
  const top = priced.length ? Math.max(...priced) : 0;
  const common = commonVerification(rows);
  const cityStat = s.cities.find((c) => c.city === city) ?? null;

  return (
    <>
      <TopBar title={s.name} backHref="/layanan" action={<ShareButton title={s.name} />} />
      <DemoNotice show={anyDemo(loaded, compare)} date={snapshotDate()} />

      <header className="px-5 pt-5">
        <p className="m-0 text-xs font-semibold tracking-wide text-muted uppercase">{s.category.name}</p>
        <h1 className="m-0 mt-1 text-2xl leading-tight font-bold tracking-tight">{s.name}</h1>
        {s.description && <p className="m-0 mt-1.5 text-base text-ink-soft">{s.description}</p>}
      </header>

      {/* Ringkasan: rentang semua wilayah, lalu per wilayah sebagai baris (bukan kotak yang mematahkan angka). */}
      <ListBox className="mt-5">
        <li className="px-4 py-4" aria-label={t.services.range}>
          <span className="block text-xs text-muted">{t.services.rangeIn(sum.facilityCount)}</span>
          <span className="mt-1 block text-3xl leading-tight font-bold tracking-tight tabular-nums">{range ?? t.services.noPrice}</span>
          <span className="mt-1 block text-xs text-muted">
            {t.price.estimate}
            {sum.latestVerifiedAt && ` · ${t.services.lastChecked(formatShortDate(sum.latestVerifiedAt))}`}
          </span>
        </li>
        {s.cities.length > 1 &&
          s.cities.map((c) => (
            <ListRow
              key={c.city}
              title={c.city}
              sub={t.services.cityRow(c.medianPrice !== null ? formatRupiah(c.medianPrice) : null, c.facilityCount)}
              trailing={<span className="text-sm font-semibold tabular-nums">{priceRangeText(c.minPrice, c.maxPrice) ?? '–'}</span>}
            />
          ))}
      </ListBox>

      <section aria-labelledby="bandingkan" className="mt-8">
        <h2 id="bandingkan" className="m-0 px-5 text-base font-bold">
          {t.services.compareTitle}
        </h2>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-4">
          {cities.map((c) => (
            <ChipLink key={c} href={href({ kota: c })} active={c === city}>
              {c}
            </ChipLink>
          ))}
          <ChipLink href={href({ lama: hideStale ? undefined : '0' })} active={hideStale}>
            {t.services.hideStale}
          </ChipLink>
        </div>
        {rows.length === 0 ? (
          <div className="pt-4">
            <Empty text={t.services.noCompare} />
          </div>
        ) : (
          <>
            {priced.length > 1 && city && (
              <div className="mx-4 mt-4 rounded-2xl bg-white px-4 pt-1 pb-3.5">
                <RangeBar values={priced} median={cityStat?.medianPrice ?? null} label={t.services.spread(city)} />
              </div>
            )}
            <ListGroup className="mt-3" note={`${t.price.groupNote(common ? (t.verification[common] ?? null) : null)} ${t.services.compareHint}`}>
              {rows.map((r) => {
                const value = r.price.type !== 'tanya' ? r.price.min : null;
                return (
                  <ListRow
                    key={r.tariffId}
                    marker="compare"
                    href={`/faskes/${r.facility.slug}`}
                    chevron={false}
                    leading={<Thumb photo={facilityPhoto(r.facility.slug)} className="size-11 rounded-lg" />}
                    title={r.facility.name}
                    sub={
                      <>
                        {value !== null && top > 0 && (
                          <span
                            className="mt-1 mb-1.5 block h-1 rounded-full bg-primary-300"
                            style={{ width: `${relativeWidth(value, top)}%` }}
                            aria-hidden="true"
                          />
                        )}
                        <TrustNote trust={r} common={common} />
                      </>
                    }
                    trailing={<PriceValue price={r.price} />}
                  />
                );
              })}
            </ListGroup>
          </>
        )}
      </section>

      <div className="mt-6 px-4">
        <Link
          href={`/cari?service=${s.slug}`}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary-600 font-semibold text-white no-underline active:bg-primary-700"
        >
          <Search className="size-4" aria-hidden="true" />
          {t.services.searchFacilities}
        </Link>
      </div>
    </>
  );
}
