import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Clock3, Globe, MapPin, Minus, Phone, Scale, ShieldCheck } from 'lucide-react';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { ContactLinks } from '@/components/contact-links';
import { DisclaimerBanner } from '@/components/disclaimer-banner';
import { FacilityMap } from '@/components/facility-map';
import { JsonLd } from '@/components/json-ld';
import { Reveal } from '@/components/motion/reveal';
import { InfoPopover } from '@/components/ui/info-popover';
import { PriceDisplay } from '@/components/price-display';
import { ReportDataDialog } from '@/components/report-data-dialog';
import { TariffHistoryDrawer } from '@/components/tariff-history-drawer';
import { TrackView } from '@/components/track-view';
import { TrustBadge } from '@/components/trust-badge';
import { apiGetOrNull } from '@/lib/api';
import { MAP_STYLE_URL } from '@/lib/config';
import { formatDate } from '@/lib/format';
import { formatTimeRange, groupByWeekday, tzShort, weekdayName } from '@/lib/profile';
import { medicalOrganizationLd } from '@/lib/seo';
import type { FacilityDetail } from '@/lib/types';
import { t } from '@/messages/id';

type Params = Promise<{ slug: string }>;

/** ISR + revalidasi per tag `facility:{slug}` (dipicu API saat tarif atau profil berubah). */
export const revalidate = 3600;

/** Tidak ada prerender saat build; halaman dibuat saat diminta pertama kali lalu di-cache (ISR). */
export function generateStaticParams() {
  return [];
}

const load = (slug: string) => apiGetOrNull<FacilityDetail>(`/facilities/${encodeURIComponent(slug)}`, { tags: [`facility:${slug}`, 'facilities'] });

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const f = await load(slug);
  if (!f) return { title: t.notFound.title, robots: { index: false } };
  const latest = f.tariffs.map((x) => x.trust.verifiedAt).filter(Boolean).sort().at(-1);
  const title = `Tarif ${f.name}, ${f.city}${latest ? ` (diperbarui ${formatDate(latest)})` : ''}`;
  const description = `Tarif layanan ${t.facilityType[f.type]?.toLowerCase()} ${f.name} di ${f.city} lengkap dengan tanggal berlaku dan sumber data. ${f.address}.`;
  return {
    title,
    description,
    alternates: { canonical: `/faskes/${f.slug}` },
    openGraph: { title, description, url: `/faskes/${f.slug}`, type: 'website' },
  };
}

export default async function FacilityPage({ params }: { params: Params }) {
  const { slug } = await params;
  const f = await load(slug);
  if (!f) notFound();
  const operational = f.schedules.filter((x) => x.kind === 'operasional');
  const practice = f.schedules.filter((x) => x.kind === 'praktik');
  const otherLocations = f.locations.filter((l) => !l.isPrimary);

  return (
    <div className="container pb-20 md:pb-0">
      <Breadcrumbs items={[{ name: 'Beranda', path: '/' }, { name: f.city, path: `/cari?city=${encodeURIComponent(f.city)}` }, { name: f.name, path: `/faskes/${f.slug}` }]} />
      <JsonLd data={medicalOrganizationLd(f)} />

      <header className="mb-8">
        <p className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-surface-2 px-3 py-1 font-medium text-ink-soft">{t.facilityType[f.type]}</span>
          <span className="inline-flex items-center gap-1 text-muted">
            <MapPin className="size-4" aria-hidden="true" />
            {f.city}
          </span>
          <InfoPopover content={t.trustHelp[f.verification] ?? ''}>
            <span className={`badge badge-${f.verification}`}>
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              {t.verification[f.verification]}
            </span>
          </InfoPopover>
        </p>
        <h1 className="mb-3">{f.name}</h1>
        {f.description && <p className="prose m-0 text-[1.05rem]">{f.description}</p>}
      </header>

      <MediaGallery media={f.media} name={f.name} />

      <div className={f.location && MAP_STYLE_URL ? 'grid items-stretch gap-4 md:grid-cols-[1.1fr_1fr]' : 'grid gap-4'}>
        <section className="rounded-card border border-line bg-white p-6 shadow-soft" aria-labelledby="info">
          <h2 id="info" className="sr-only">
            Informasi
          </h2>
          <dl className={f.location && MAP_STYLE_URL ? 'm-0 grid gap-4' : 'm-0 grid gap-x-8 gap-y-4 md:grid-cols-2'}>
            <InfoRow icon={<MapPin className="size-[18px]" aria-hidden="true" />} label={t.facility.address}>
              {f.address}
            </InfoRow>
            {f.phone && (
              <InfoRow icon={<Phone className="size-[18px]" aria-hidden="true" />} label={t.facility.phone}>
                {f.phone}
              </InfoRow>
            )}
            {f.website && (
              <InfoRow icon={<Globe className="size-[18px]" aria-hidden="true" />} label={t.facility.website}>
                <a href={f.website} rel="noopener noreferrer nofollow" target="_blank" className="break-all">
                  {f.website.replace(/^https?:\/\//, '')}
                </a>
              </InfoRow>
            )}
            {operational.length > 0 ? (
              <InfoRow icon={<Clock3 className="size-[18px]" aria-hidden="true" />} label={t.facility.hours}>
                <WeeklySchedule items={operational} />
              </InfoRow>
            ) : (
              f.hours &&
              Object.keys(f.hours).length > 0 && (
                <InfoRow icon={<Clock3 className="size-[18px]" aria-hidden="true" />} label={t.facility.hours}>
                  <span className="grid gap-0.5">
                    {sortDays(Object.entries(f.hours)).map(([day, h]) => (
                      <span key={day}>
                        <span className="capitalize">{day}</span>: {h}
                      </span>
                    ))}
                  </span>
                </InfoRow>
              )
            )}
            {otherLocations.length > 0 && (
              <InfoRow icon={<MapPin className="size-[18px]" aria-hidden="true" />} label={t.facility.otherLocations}>
                <ul className="m-0 grid list-none gap-1 p-0">
                  {otherLocations.map((l, i) => (
                    <li key={i}>
                      {l.label && <strong className="font-semibold">{l.label}: </strong>}
                      {l.address}, {l.city}
                    </li>
                  ))}
                </ul>
              </InfoRow>
            )}
          </dl>
          <ContactLinks facilityId={f.id} city={f.city} phone={f.phone} lat={f.location?.lat ?? null} lng={f.location?.lng ?? null} address={`${f.name}, ${f.address}, ${f.city}`} />
          <ContactLinks sticky facilityId={f.id} city={f.city} phone={f.phone} lat={f.location?.lat ?? null} lng={f.location?.lng ?? null} address={`${f.name}, ${f.address}, ${f.city}`} />
        </section>
        {f.location && MAP_STYLE_URL && <FacilityMap lat={f.location.lat} lng={f.location.lng} name={f.name} />}
      </div>

      <h2 id="tarif" className="mt-14">
        {t.facility.tariffs}
      </h2>
      <DisclaimerBanner />
      {f.tariffs.length === 0 ? (
        <p className="rounded-card border border-dashed border-line-strong bg-white p-6 text-center text-muted">{t.facility.noTariffs}</p>
      ) : (
        <Reveal className="grid gap-4">
          {f.tariffs.map((tariff) => (
            <article
              key={tariff.id}
              data-reveal
              className="tariff grid gap-4 rounded-card border border-line bg-white p-5 shadow-soft sm:p-6"
              aria-labelledby={`tariff-${tariff.id}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                <div className="min-w-0">
                  <p className="mb-1 text-sm text-muted">{tariff.service.category}</p>
                  <h3 id={`tariff-${tariff.id}`} className="m-0 text-lg">
                    {tariff.package ? `${tariff.package.name} (${tariff.service.name})` : tariff.service.name}
                  </h3>
                </div>
                <PriceDisplay price={tariff.price} size="lg" />
              </div>
              <TrustBadge trust={tariff.trust} />
              {tariff.package && (
                <ul className="m-0 grid list-none gap-1.5 rounded-2xl bg-surface p-4 sm:grid-cols-2">
                  {tariff.package.components.map((c) => (
                    <li key={c.label} className={`flex items-start gap-2 text-[0.92rem] ${c.included ? 'text-ink' : 'text-muted'}`}>
                      {c.included ? (
                        <Check className="mt-0.5 size-4 shrink-0 text-ok" strokeWidth={2.5} aria-hidden="true" />
                      ) : (
                        <Minus className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      )}
                      <span>
                        {c.label} {!c.included && <span className="text-sm">({t.compare.notIncluded})</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {(tariff.inclusions || tariff.exclusions) && (
                <div className="grid gap-1 text-[0.92rem] text-ink-soft">
                  {tariff.inclusions && (
                    <p className="m-0">
                      <strong className="text-ink">{t.facility.includes}:</strong> {tariff.inclusions}
                    </p>
                  )}
                  {tariff.exclusions && (
                    <p className="m-0">
                      <strong className="text-ink">{t.facility.excludes}:</strong> {tariff.exclusions}
                    </p>
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-4 text-[0.92rem]">
                <Link
                  href={`/bandingkan/${tariff.service.slug}?kota=${encodeURIComponent(f.city)}`}
                  className="inline-flex items-center gap-1.5 font-semibold no-underline hover:underline"
                >
                  <Scale className="size-4" aria-hidden="true" />
                  {t.facility.compare}
                </Link>
                <ReportDataDialog tariffId={tariff.id} facilityId={f.id} service={tariff.service.slug} />
                <TariffHistoryDrawer tariffId={tariff.id} />
              </div>
            </article>
          ))}
        </Reveal>
      )}

      {practice.length > 0 && (
        <section aria-labelledby="jadwal-praktik">
          <h2 id="jadwal-praktik" className="mt-14">
            {t.facility.scheduleKinds.praktik}
          </h2>
          <div className="rounded-card border border-line bg-white p-6 shadow-soft">
            <WeeklySchedule items={practice} withPractitioner />
          </div>
        </section>
      )}

      {f.practitioners.length > 0 && (
        <section aria-labelledby="nakes">
          <h2 id="nakes" className="mt-14">
            {t.facility.practitioners}
          </h2>
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {f.practitioners.map((p) => (
              <li key={p.slug} className="rounded-2xl border border-line bg-white px-4 py-3 shadow-soft">
                <Link href={`/dokter/${p.slug}`} className="font-semibold no-underline hover:underline">
                  {p.name}
                </Link>
                {p.specialty && <span className="block text-sm text-muted">{p.specialty}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-12 rounded-2xl bg-surface px-4 py-3 text-sm text-muted">
        {t.facility.updated} {formatDate(f.updatedAt)} · <Link href={`/portal/klaim?faskes=${f.id}&nama=${encodeURIComponent(f.name)}`}>{t.facility.claim}</Link>
      </p>
      <TrackView event="facility_viewed" props={{ facility_id: f.id, city: f.city }} />
    </div>
  );
}

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-700">{icon}</span>
      <div className="min-w-0">
        <dt className="text-sm text-muted">{label}</dt>
        <dd className="m-0 text-ink">{children}</dd>
      </div>
    </div>
  );
}

type Schedule = FacilityDetail['schedules'][number];

/** Jadwal per hari Senin–Minggu dalam jam lokal + zona waktu (K7); hari tanpa jadwal ditulis "Tutup". */
function WeeklySchedule({ items, withPractitioner }: { items: Schedule[]; withPractitioner?: boolean }) {
  const days = groupByWeekday(items);
  return (
    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
      {days
        .filter((d) => !withPractitioner || d.items.length > 0)
        .map((d) => (
          <div key={d.weekday} className="contents">
            <dt className="text-ink-soft">{weekdayName(d.weekday)}</dt>
            <dd className="m-0">
              {d.items.length === 0 ? (
                <span className="text-muted">{t.facility.closed}</span>
              ) : (
                <span className="grid gap-0.5">
                  {d.items.map((s, i) => (
                    <span key={i}>
                      <span className="tabular-nums">{formatTimeRange(s.start, s.end)}</span> {tzShort(s.timezone)}
                      {withPractitioner && s.practitioner && (
                        <>
                          {' · '}
                          <Link href={`/dokter/${s.practitioner.slug}`}>{s.practitioner.name}</Link>
                        </>
                      )}
                      {s.note && <span className="text-muted"> · {s.note}</span>}
                    </span>
                  ))}
                </span>
              )}
            </dd>
          </div>
        ))}
    </dl>
  );
}

/** Foto dan video yang sudah disetujui moderator (K8). Video tidak dimuat sebelum diputar. */
function MediaGallery({ media, name }: { media: FacilityDetail['media']; name: string }) {
  const photos = media.filter((m) => m.kind === 'foto');
  const video = media.find((m) => m.kind === 'video');
  if (photos.length === 0 && !video) return null;
  return (
    <section aria-labelledby="galeri" className="mb-8 grid gap-4">
      <h2 id="galeri" className="sr-only">
        {t.facility.gallery}
      </h2>
      {photos.length > 0 && (
        <ul className="m-0 flex snap-x snap-mandatory list-none gap-3 overflow-x-auto p-0 pb-2">
          {photos.map((p, i) => (
            <li key={p.id} className="w-[min(80vw,340px)] shrink-0 snap-start">
              <figure className="m-0">
                <img
                  src={p.url}
                  alt={p.caption ?? `${name}, ${t.facility.gallery.toLowerCase()} ${i + 1}`}
                  className="aspect-[4/3] w-full rounded-2xl border border-line object-cover"
                  loading={i < 2 ? 'eager' : 'lazy'}
                />
                {p.caption && <figcaption className="mt-1 text-sm text-muted">{p.caption}</figcaption>}
              </figure>
            </li>
          ))}
        </ul>
      )}
      {video && (
        <figure className="m-0 max-w-2xl">
          <video controls preload="none" src={video.url} className="aspect-video w-full rounded-2xl bg-ink" aria-label={video.caption ?? `${t.facility.video} ${name}`} />
          <figcaption className="mt-1 text-sm text-muted">{video.caption ?? t.facility.video}</figcaption>
        </figure>
      )}
    </section>
  );
}

/** Urutkan jam buka Senin–Minggu (data API berupa objek tanpa urutan). */
const DAY_ORDER = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
function sortDays(entries: [string, string][]) {
  const rank = (d: string) => {
    const i = DAY_ORDER.indexOf(d.toLowerCase().replace("'", ''));
    return i === -1 ? DAY_ORDER.length : i;
  };
  return [...entries].sort((a, b) => rank(a[0]) - rank(b[0]));
}
