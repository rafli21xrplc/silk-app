import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CalendarDays, Info, MapPin } from 'lucide-react';
import { notFound } from 'next/navigation';
import { ArticleCard } from '@/components/article/article-card';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { DisclaimerBanner } from '@/components/disclaimer-banner';
import { DoctorAvatar } from '@/components/doctor/doctor-avatar';
import { DoctorBadges } from '@/components/doctor/doctor-badges';
import { DoctorConsultation } from '@/components/doctor/doctor-consultation';
import { DoctorContact } from '@/components/doctor/doctor-contact';
import { DoctorVideo } from '@/components/doctor/doctor-video';
import { JsonLd } from '@/components/json-ld';
import { Reveal } from '@/components/motion/reveal';
import { WeeklySchedule } from '@/components/profile/weekly-schedule';
import { ResultsMap, type MapPoint } from '@/components/search/results-map';
import { ShareLinkButton } from '@/components/share-link-button';
import { TariffCard } from '@/components/tariff-card';
import { apiGetOrNull } from '@/lib/api';
import { fromPartnerSummary } from '@/lib/article-merge';
import { MAP_STYLE_URL } from '@/lib/config';
import { withDoctorDefaults } from '@/lib/doctor';
import { formatDate } from '@/lib/format';
import { physicianLd } from '@/lib/seo';
import type { PractitionerDetail } from '@/lib/types';
import { t } from '@/messages/id';

type Params = Promise<{ slug: string }>;

/** ISR + revalidasi per tag `practitioner:{slug}` (dipicu API saat profil, jadwal, media, atau tarif berubah). */
export const revalidate = 3600;

/** Tidak ada prerender saat build; halaman dibuat saat diminta pertama kali lalu di-cache (ISR). */
export function generateStaticParams() {
  return [];
}

async function load(slug: string): Promise<PractitionerDetail | null> {
  const p = await apiGetOrNull<PractitionerDetail>(`/practitioners/${encodeURIComponent(slug)}`, { tags: [`practitioner:${slug}`, 'practitioners'] });
  return p ? withDoctorDefaults(p) : null;
}

const uniq = (xs: string[]) => [...new Set(xs)];

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const p = await load((await params).slug);
  if (!p) return { title: t.notFound.title, robots: { index: false } };
  const title = `${p.name}${p.specialty ? `, ${p.specialty}` : ''}`;
  const description = t.doctors.metaDescription(p.name, p.specialty, p.practices.map((x) => x.facility.name).slice(0, 3));
  return {
    title,
    description,
    alternates: { canonical: `/dokter/${p.slug}` },
    openGraph: { title, description, url: `/dokter/${p.slug}`, type: 'profile', ...(p.photo ? { images: [{ url: p.photo.url }] } : {}) },
  };
}

/**
 * Profil publik dokter (Fase 4b): identitas dan lencana verifikasi, kontak praktik utama, tentang, video,
 * jadwal per tempat praktik, peta, tarif praktik utama, dan artikel. Tidak ada peringkat atau iklan.
 */
export default async function PractitionerPage({ params }: { params: Params }) {
  const p = await load((await params).slug);
  if (!p) notFound();
  const primary = p.practices.find((x) => x.isPrimary) ?? null;
  const primaryPlace = primary?.locations.find((l) => l.isPrimary) ?? primary?.locations[0] ?? null;
  const cities = uniq(p.practices.flatMap((x) => (x.locations.length ? x.locations.map((l) => l.city) : [x.facility.city])));
  const withSchedule = p.practices.filter((x) => x.schedules.length > 0);
  // Biaya konsultasi sudah tampil di atas; daftar tarif di bawah memuat layanan lainnya.
  const otherTariffs = p.tariffs.filter((x) => x.id !== p.consultation?.id);
  const points: MapPoint[] = p.practices.flatMap((x) =>
    x.locations.map((l, i) => ({
      id: `${x.facility.slug}-${i}`,
      slug: x.facility.slug,
      name: l.label ? `${x.facility.name} (${l.label})` : x.facility.name,
      typeLabel: t.facilityType[x.facility.type] ?? x.facility.type,
      priceText: null,
      lat: l.lat,
      lng: l.lng,
    })),
  );

  return (
    <div className="container">
      <Breadcrumbs
        items={[
          { name: 'Beranda', path: '/' },
          { name: t.nav.doctors, path: '/dokter' },
          { name: p.name, path: `/dokter/${p.slug}` },
        ]}
      />
      <JsonLd data={physicianLd(p)} />

      {/* Di atas lipatan (evaluasi USP R4): siapa dokternya, video perkenalan, biaya konsultasi, cara menghubungi. */}
      <header className="mb-2 grid gap-5 rounded-card border border-line bg-white p-5 shadow-soft sm:p-8 lg:grid-cols-2 lg:gap-x-8">
        <div className="flex min-w-0 items-start gap-4 lg:col-start-1">
          <DoctorAvatar name={p.name} photoUrl={p.photo?.url ?? null} size="md" className="sm:size-20" />
          <div className="grid min-w-0 gap-2">
            <div>
              <h1 className="mb-1 text-[clamp(1.5rem,1.2rem+1.4vw,2.2rem)]">{p.name}</h1>
              {p.specialty && <p className="m-0 text-lg font-medium text-ink-soft">{p.specialty}</p>}
            </div>
            <DoctorBadges verification={p.verification} strDate={p.strVerifiedAt ? formatDate(p.strVerifiedAt) : null} />
            {p.strNo && <p className="m-0 text-sm text-muted">{`${t.practitioner.str}: ${p.strNo}`}</p>}
            {cities.length > 0 && (
              <p className="m-0 flex items-center gap-1.5 text-ink-soft">
                <MapPin className="size-4 shrink-0 text-muted" aria-hidden="true" />
                {cities.join(', ')}
              </p>
            )}
          </div>
        </div>
        {p.video && (
          <section aria-labelledby="video" className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <h2 id="video" className="sr-only">
              {t.doctors.video}
            </h2>
            <DoctorVideo video={p.video} name={p.name} posterUrl={p.photo?.url ?? null} />
          </section>
        )}
        <div className="grid min-w-0 content-start gap-4 lg:col-start-1">
          {primary && <DoctorConsultation tariff={p.consultation} practiceName={primary.facility.name} city={primary.facility.city} />}
          {primary && (
            <DoctorContact
              facilityId={primary.facility.id}
              city={primary.facility.city}
              phone={p.contact?.phone ?? null}
              website={p.contact?.website ?? null}
              location={primaryPlace ? { lat: primaryPlace.lat, lng: primaryPlace.lng } : null}
            />
          )}
          <ShareLinkButton label={t.doctors.share} copiedLabel={t.doctors.copied} className="m-0" />
        </div>
      </header>

      <section aria-labelledby="jadwal">
        <h2 id="jadwal" className="mt-12">
          {t.doctors.schedule}
        </h2>
        {withSchedule.length === 0 ? (
          <p className="rounded-card border border-dashed border-line-strong bg-white p-6 text-center text-muted">{t.doctors.noSchedule}</p>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {withSchedule.map((x) => (
                <div key={x.facility.slug} className="rounded-card border border-line bg-white p-6 shadow-soft">
                  <h3 className="mb-3 flex items-start gap-2 text-base">
                    <CalendarDays className="mt-0.5 size-[18px] shrink-0 text-primary-700" aria-hidden="true" />
                    <Link href={`/faskes/${x.facility.slug}`}>{x.facility.name}</Link>
                  </h3>
                  <WeeklySchedule items={x.schedules} onlyOpenDays />
                </div>
              ))}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-sm text-muted">
              <Info className="size-4 shrink-0" aria-hidden="true" />
              {t.doctors.scheduleHint}
            </p>
          </>
        )}
      </section>

      {p.practices.length > 0 && (
        <section aria-labelledby="tempat-praktik">
          <h2 id="tempat-praktik" className="mt-12">
            {t.doctors.practices}
          </h2>
          <div className={MAP_STYLE_URL && points.length > 0 ? 'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,440px)]' : ''}>
            <ul className="m-0 grid list-none gap-3 p-0">
              {p.practices.map((x) => (
                <li key={x.facility.slug} className="rounded-card border border-line bg-white p-5 shadow-soft">
                  <p className="mb-1 text-sm font-semibold text-primary-700">{x.isPrimary ? t.doctors.primaryPractice : t.doctors.otherPractice}</p>
                  <h3 className="mb-1 text-lg">{x.facility.name}</h3>
                  <p className="mb-2 text-sm text-muted">{t.facilityType[x.facility.type] ?? x.facility.type}</p>
                  {x.locations.length > 0 && (
                    <ul className="mb-3 grid list-none gap-1 p-0 text-ink-soft">
                      {x.locations.map((l, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <MapPin className="mt-1 size-4 shrink-0 text-muted" aria-hidden="true" />
                          <span>
                            {l.label && <strong className="font-semibold">{l.label}: </strong>}
                            {l.address}, {l.city}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link href={`/faskes/${x.facility.slug}`} className="inline-flex items-center gap-1 text-sm font-semibold">
                    {t.doctors.openFacility} <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
            {MAP_STYLE_URL && points.length > 0 && (
              <aside aria-label={t.doctors.map} className="lg:sticky lg:top-24">
                <ResultsMap points={points} center={null} className="map h-[360px] md:h-[420px]" />
              </aside>
            )}
          </div>
        </section>
      )}

      {p.about && (
        <section aria-labelledby="tentang">
          <h2 id="tentang" className="mt-12">
            {t.doctors.about}
          </h2>
          <p className="prose m-0 whitespace-pre-line">{p.about}</p>
        </section>
      )}

      {primary && otherTariffs.length > 0 && (
        <section aria-labelledby="tarif">
          <h2 id="tarif" className="mt-12">
            {p.consultation ? t.doctors.otherTariffs : t.doctors.tariffs}
          </h2>
          <p className="text-muted">{t.doctors.tariffsFrom(primary.facility.name)}</p>
          <DisclaimerBanner />
          <Reveal className="grid gap-4">
            {otherTariffs.map((tariff) => (
              <TariffCard key={tariff.id} tariff={tariff} facilityId={primary.facility.id} city={primary.facility.city} />
            ))}
          </Reveal>
        </section>
      )}

      {p.articles.length > 0 && (
        <section aria-labelledby="artikel">
          <h2 id="artikel" className="mt-12">
            {t.doctors.articles}
          </h2>
          <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {p.articles.map((a) => (
              <li key={a.slug}>
                <ArticleCard article={fromPartnerSummary(a)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-12 rounded-2xl bg-surface px-4 py-3 text-sm text-muted">{t.doctors.disclaimer}</p>
    </div>
  );
}
