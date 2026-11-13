import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Clock, MapPin, Navigation } from 'lucide-react';
import { Avatar } from '@/components/avatar';
import { ContactActions } from '@/components/contact-actions';
import { DemoNotice } from '@/components/demo-notice';
import { Empty } from '@/components/empty';
import { ShareButton } from '@/components/share-button';
import { Tabs } from '@/components/tabs';
import { TariffBrowser } from '@/components/tariff-browser';
import { TopBar } from '@/components/top-bar';
import { VerificationBadge } from '@/components/trust';
import { directionsUrl } from '@/lib/contact';
import { formatDate } from '@/lib/format';
import { groupByWeekday } from '@/lib/schedule';
import { getFacility, snapshotDate } from '@/lib/silk/api';
import { t } from '@/messages/id';

export const revalidate = 300;

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const f = await getFacility((await params).slug);
  return f ? { title: f.data.name, description: `${t.facilityType[f.data.type] ?? ''} · ${f.data.address}` } : {};
}

export default async function FacilityPage({ params }: { params: Params }) {
  const loaded = await getFacility((await params).slug);
  if (!loaded) notFound();
  const f = loaded.data;
  const primary = f.locations.find((l) => l.isPrimary) ?? null;
  const point = primary ? { lat: primary.lat, lng: primary.lng } : f.location;
  const others = f.locations.filter((l) => !l.isPrimary);
  const hours = t.facility.hoursDays.map((day, i) => ({ day: t.weekday[i + 1]!, value: f.hours?.[day] ?? null }));
  const hasHours = hours.some((h) => h.value);

  const doctorsPanel =
    f.practitioners.length === 0 ? (
      <Empty text={t.facility.noDoctors} />
    ) : (
      <ul className="m-0 grid list-none gap-2.5 px-4">
        {f.practitioners.map((d) => {
          const days = groupByWeekday(f.schedules.filter((s) => s.practitioner?.slug === d.slug));
          return (
            <li key={d.slug}>
              <Link href={`/dokter/${d.slug}`} className="tap flex items-start gap-3 rounded-2xl border border-line/70 bg-white p-3.5 text-ink no-underline shadow-soft">
                <Avatar name={d.name} photoUrl={d.photoUrl} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{d.name}</span>
                  {d.specialty && <span className="block text-[0.8rem] text-ink-soft">{d.specialty}</span>}
                  {days.length > 0 && (
                    <span className="mt-1.5 grid gap-0.5 text-[0.75rem] text-muted">
                      {days.map((x) => (
                        <span key={x.weekday}>
                          <span className="font-semibold text-ink-soft">{t.weekday[x.weekday]}</span> {x.times.join(', ')}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
                <ChevronRight className="mt-2 size-5 shrink-0 text-muted" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    );

  const infoPanel = (
    <div className="grid gap-4 px-4">
      {f.description && (
        <section className="rounded-2xl bg-white p-4 shadow-soft">
          <h2 className="m-0 mb-1.5 text-sm font-bold">{t.facility.about}</h2>
          <p className="m-0 text-sm whitespace-pre-line text-ink-soft">{f.description}</p>
        </section>
      )}
      <section className="rounded-2xl bg-white p-4 shadow-soft">
        <h2 className="m-0 mb-2 flex items-center gap-1.5 text-sm font-bold">
          <Clock className="size-4 text-primary-700" aria-hidden="true" />
          {t.facility.hours}
        </h2>
        {hasHours ? (
          <dl className="m-0 grid grid-cols-[6rem_1fr] gap-y-1 text-sm">
            {hours.map((h) => (
              <div key={h.day} className="contents">
                <dt className="text-muted">{h.day}</dt>
                <dd className="m-0 font-medium tabular-nums">{h.value ?? t.facility.hoursNotListed}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="m-0 text-sm text-muted">{t.facility.noHours}</p>
        )}
      </section>
      <section className="rounded-2xl bg-white p-4 shadow-soft">
        <h2 className="m-0 mb-2 flex items-center gap-1.5 text-sm font-bold">
          <MapPin className="size-4 text-primary-700" aria-hidden="true" />
          {t.facility.address}
        </h2>
        <p className="m-0 text-sm text-ink-soft">
          {f.address}, {f.city}
        </p>
        {others.length > 0 && (
          <>
            <h3 className="m-0 mt-3 mb-1.5 text-[0.8rem] font-bold text-muted">{t.facility.otherLocations}</h3>
            <ul className="m-0 grid list-none gap-2 p-0">
              {others.map((l) => (
                <li key={`${l.lat},${l.lng}`} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-ink-soft">{[l.label, l.address, l.city].filter(Boolean).join(' · ')}</span>
                  <a href={directionsUrl(l.lat, l.lng)} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary-700">
                    <Navigation className="size-3.5" aria-hidden="true" />
                    {t.facility.directions}
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <p className="m-0 text-center text-[0.75rem] text-muted">{t.facility.updatedAt(formatDate(f.updatedAt))}</p>
    </div>
  );

  return (
    <>
      <TopBar title={f.name} backHref="/cari" action={<ShareButton title={f.name} />} />
      <DemoNotice show={loaded.source === 'demo'} date={snapshotDate()} />
      <div className="px-4 pt-4 pb-4">
        <p className="m-0 mb-2 flex flex-wrap items-center gap-1.5 text-[0.72rem] font-semibold">
          <span className="rounded-full bg-mint px-2 py-0.5 text-mint-ink">{t.facilityType[f.type] ?? f.type}</span>
          <span className="rounded-full bg-surface px-2 py-0.5 text-ink-soft">{f.city}</span>
          <VerificationBadge level={f.verification} />
        </p>
        <h1 className="m-0 text-[1.45rem] leading-tight font-extrabold tracking-tight">{f.name}</h1>
        <p className="m-0 mt-1.5 flex items-start gap-1 text-[0.85rem] text-muted">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {f.address}
        </p>
      </div>
      <ContactActions phone={f.phone} website={f.website} location={point} />
      <Tabs
        tabs={[
          {
            id: 'tarif',
            label: t.facility.tabs.tariffs,
            count: f.tariffs.length,
            content: (
              <>
                <p className="m-0 mx-4 mb-3 rounded-xl bg-warn-soft px-3 py-2 text-[0.75rem] text-warn">{t.facility.disclaimer}</p>
                <TariffBrowser tariffs={f.tariffs} />
              </>
            ),
          },
          { id: 'dokter', label: t.facility.tabs.doctors, count: f.practitioners.length, content: doctorsPanel },
          { id: 'info', label: t.facility.tabs.info, content: infoPanel },
        ]}
      />
    </>
  );
}
