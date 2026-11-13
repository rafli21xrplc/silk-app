import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BadgeCheck, CalendarDays, ChevronRight, MapPin } from 'lucide-react';
import { Avatar } from '@/components/avatar';
import { ContactActions } from '@/components/contact-actions';
import { DemoNotice } from '@/components/demo-notice';
import { DoctorVideo } from '@/components/doctor-video';
import { PriceTag } from '@/components/price';
import { ShareButton } from '@/components/share-button';
import { TariffBrowser } from '@/components/tariff-browser';
import { TopBar } from '@/components/top-bar';
import { TrustLine } from '@/components/trust';
import { formatDate, formatShortDate } from '@/lib/format';
import { groupByWeekday } from '@/lib/schedule';
import { getPractitioner, snapshotDate } from '@/lib/silk/api';
import { t } from '@/messages/id';

export const revalidate = 300;

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const p = await getPractitioner((await params).slug);
  return p ? { title: p.data.name, description: [p.data.specialty, ...p.data.facilities.map((f) => f.name)].filter(Boolean).join(' · ') } : {};
}

function Block({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-6">
      <h2 id={id} className="m-0 mb-2.5 px-4 text-base font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function DoctorPage({ params }: { params: Params }) {
  const loaded = await getPractitioner((await params).slug);
  if (!loaded) notFound();
  const p = loaded.data;
  const primary = p.practices.find((x) => x.isPrimary) ?? null;
  const primaryPlace = primary?.locations.find((l) => l.isPrimary) ?? primary?.locations[0] ?? null;
  const cities = [...new Set(p.practices.flatMap((x) => (x.locations.length ? x.locations.map((l) => l.city) : [x.facility.city])))];
  const withSchedule = p.practices.filter((x) => x.schedules.length > 0);
  // Biaya konsultasi tampil di atas; daftar di bawah memuat layanan lain.
  const otherTariffs = p.tariffs.filter((x) => x.id !== p.consultation?.id);

  return (
    <>
      <TopBar title={p.name} backHref="/dokter" action={<ShareButton title={p.name} />} />
      <DemoNotice show={loaded.source === 'demo'} date={snapshotDate()} />

      {/* Di atas lipatan: siapa dokternya, biaya konsultasi, cara menghubungi (USP). */}
      <div className="flex items-start gap-4 px-4 pt-5">
        <Avatar name={p.name} photoUrl={p.photo?.url ?? null} size="lg" />
        <div className="min-w-0">
          <h1 className="m-0 text-[1.35rem] leading-tight font-extrabold tracking-tight">{p.name}</h1>
          {p.specialty && <p className="m-0 mt-0.5 font-medium text-ink-soft">{p.specialty}</p>}
          <p className="m-0 mt-2 flex flex-wrap gap-1.5 text-[0.7rem] font-semibold">
            {p.verification.str && (
              <span className="inline-flex items-center gap-1 rounded-full bg-ok-soft px-2 py-0.5 text-ok">
                <BadgeCheck className="size-3" aria-hidden="true" />
                {p.strVerifiedAt ? t.doctors.strVerifiedOn(formatShortDate(p.strVerifiedAt)) : t.doctors.strVerified}
              </span>
            )}
            {p.verification.partner && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-soft px-2 py-0.5 text-violet">
                <BadgeCheck className="size-3" aria-hidden="true" />
                {t.doctors.partnerVerified}
              </span>
            )}
          </p>
          {p.strNo && <p className="m-0 mt-1.5 text-[0.75rem] text-muted">{t.doctors.strNo(p.strNo)}</p>}
          {cities.length > 0 && (
            <p className="m-0 mt-1 flex items-center gap-1 text-[0.8rem] text-ink-soft">
              <MapPin className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
              {cities.join(', ')}
            </p>
          )}
        </div>
      </div>

      {p.video && (
        <div className="mt-5 px-4">
          <DoctorVideo video={p.video} name={p.name} posterUrl={p.photo?.url ?? null} />
        </div>
      )}

      <div className="mt-5 px-4">
        {p.consultation ? (
          <div className="grid gap-2 rounded-card border border-line/80 bg-white p-4 shadow-soft" data-consultation>
            <p className="m-0 text-[0.8rem] font-semibold text-muted">
              {t.doctors.consultation} · {p.consultation.service.name}
            </p>
            <PriceTag price={p.consultation.price} size="lg" />
            <TrustLine trust={p.consultation.trust} />
            {primary && <p className="m-0 text-[0.75rem] text-muted">{t.doctors.consultationFrom(primary.facility.name)}</p>}
          </div>
        ) : (
          <div className="grid gap-0.5 rounded-card border border-dashed border-line-strong px-4 py-3.5" data-consultation-missing>
            <span className="text-sm font-semibold text-ink-soft">{t.doctors.noConsultationShort}</span>
            <span className="text-[0.8rem] text-muted">{t.doctors.noConsultationHint}</span>
          </div>
        )}
      </div>

      <div className="mt-3">
        <ContactActions
          phone={p.contact?.phone ?? null}
          website={p.contact?.website ?? null}
          location={primaryPlace ? { lat: primaryPlace.lat, lng: primaryPlace.lng } : null}
        />
      </div>

      {p.about && (
        <Block id="tentang" title={t.doctors.about}>
          <p className="m-0 px-4 text-sm whitespace-pre-line text-ink-soft">{p.about}</p>
        </Block>
      )}

      <Block id="jadwal" title={t.doctors.schedule}>
        {withSchedule.length === 0 ? (
          <p className="m-0 px-4 text-sm text-muted">{t.doctors.noSchedule}</p>
        ) : (
          <div className="grid gap-2.5 px-4">
            {withSchedule.map((x) => (
              <div key={x.facility.slug} className="rounded-2xl bg-white p-3.5 shadow-soft">
                <p className="m-0 mb-1.5 flex items-center gap-1.5 text-sm font-bold text-primary-800">
                  <CalendarDays className="size-4" aria-hidden="true" />
                  {x.facility.name}
                </p>
                <dl className="m-0 grid grid-cols-[5rem_1fr] gap-y-1 text-sm">
                  {groupByWeekday(x.schedules).map((d) => (
                    <div key={d.weekday} className="contents">
                      <dt className="text-muted">{t.weekday[d.weekday]}</dt>
                      <dd className="m-0 font-medium tabular-nums">{d.times.join(', ')}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
            <p className="m-0 text-[0.75rem] text-muted">{t.doctors.scheduleHint}</p>
          </div>
        )}
      </Block>

      {p.practices.length > 0 && (
        <Block id="praktik" title={t.doctors.practices}>
          <ul className="m-0 grid list-none gap-2 px-4">
            {p.practices.map((x) => (
              <li key={x.facility.slug}>
                <Link href={`/faskes/${x.facility.slug}`} className="tap flex items-center gap-3 rounded-2xl border border-line/70 bg-white p-3.5 text-ink no-underline shadow-soft">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.72rem] font-semibold text-primary-700">{x.isPrimary ? t.doctors.primaryPractice : t.doctors.otherPractice}</span>
                    <span className="block text-sm font-bold">{x.facility.name}</span>
                    <span className="block text-[0.78rem] text-muted">
                      {t.facilityType[x.facility.type] ?? x.facility.type} · {x.locations[0]?.address ?? x.facility.city}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {otherTariffs.length > 0 && (
        <Block id="tarif" title={t.doctors.otherTariffs}>
          <TariffBrowser tariffs={otherTariffs} />
        </Block>
      )}

      {p.articles.length > 0 && (
        <Block id="artikel" title={t.doctors.articles}>
          <ul className="m-0 grid list-none gap-2 px-4">
            {p.articles.map((a) => (
              <li key={a.slug}>
                <Link href={`/artikel/${a.slug}`} className="tap block rounded-2xl bg-white p-3.5 text-ink no-underline shadow-soft">
                  <span className="block text-sm font-semibold">{a.title}</span>
                  <span className="text-[0.75rem] text-muted">
                    {t.articles.minutes(a.readingMinutes)} · {formatDate(a.publishedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Block>
      )}
    </>
  );
}
