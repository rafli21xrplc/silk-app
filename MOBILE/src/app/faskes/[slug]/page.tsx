import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Navigation } from 'lucide-react';
import { Avatar } from '@/components/avatar';
import { ContactActions } from '@/components/contact-actions';
import { DemoNotice } from '@/components/demo-notice';
import { Empty } from '@/components/empty';
import { ListGroup, ListRow } from '@/components/list';
import { HeroPhoto } from '@/components/photo';
import { PriceValue } from '@/components/price';
import { NextSession, WeekStrip } from '@/components/schedule';
import { ShareButton } from '@/components/share-button';
import { Tabs } from '@/components/tabs';
import { TariffBrowser } from '@/components/tariff-browser';
import { TopBar } from '@/components/top-bar';
import { TrustNote } from '@/components/trust';
import { directionsUrl } from '@/lib/contact';
import { formatDate } from '@/lib/format';
import { doctorPhoto, facilityPhoto } from '@/lib/photos';
import { groupHours } from '@/lib/schedule';
import { getFacility, snapshotDate } from '@/lib/silk/api';
import { commonVerification } from '@/lib/trust';
import { t } from '@/messages/id';

export const revalidate = 300;

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const f = await getFacility((await params).slug);
  return f
    ? {
        title: f.data.name,
        description: `${t.facilityType[f.data.type] ?? ''} · ${f.data.address}`,
      }
    : {};
}

export default async function FacilityPage({ params }: { params: Params }) {
  const loaded = await getFacility((await params).slug);
  if (!loaded) notFound();
  const f = loaded.data;
  const primary = f.locations.find((l) => l.isPrimary) ?? null;
  const point = primary ? { lat: primary.lat, lng: primary.lng } : f.location;
  const others = f.locations.filter((l) => !l.isPrimary);
  const rawHours = t.facility.hoursDays.map((day) => f.hours?.[day] ?? null);
  const hasHours = rawHours.some(Boolean);
  const hours = groupHours(rawHours, t.weekday.slice(1), t.facility.everyDay);
  // Biaya konsultasi faskes ini (tarif kategori konsultasi): menjawab "berapa biayanya" langsung di tab Dokter.
  const photo = facilityPhoto(f.slug, f.media, f.name);
  const fees = f.tariffs.filter((x) => x.service.categorySlug === 'konsultasi');
  const feeCommon = commonVerification(fees.map((x) => x.trust));

  const doctorsPanel =
    f.practitioners.length === 0 ? (
      <Empty text={t.facility.noDoctors} />
    ) : (
      <>
        {fees.length > 0 && (
          <ListGroup
            id="biaya-konsultasi"
            title={t.facility.feesHere}
            className="mt-0"
            note={`${t.price.groupNote(feeCommon ? (t.verification[feeCommon] ?? null) : null)} ${t.facility.feesHereNote}`}
          >
            {fees.map((x) => (
              <ListRow
                key={x.id}
                title={x.package?.name ?? x.service.name}
                sub={<TrustNote trust={x.trust} common={feeCommon} />}
                trailing={<PriceValue price={x.price} />}
              />
            ))}
          </ListGroup>
        )}
        <ListGroup id="dokter-di-sini" title={t.facility.doctorsHere} className={fees.length > 0 ? 'mt-7' : 'mt-0'}>
          {f.practitioners.map((d) => {
            const slots = f.schedules.filter((s) => s.practitioner?.slug === d.slug);
            return (
              <ListRow
                key={d.slug}
                marker="facility-doctor"
                href={`/dokter/${d.slug}`}
                align="start"
                leading={<Avatar name={d.name} photoUrl={doctorPhoto(d.slug, d.photoUrl, d.name)?.square} size="md" />}
                title={<span className="font-semibold">{d.name}</span>}
                sub={
                  <>
                    {d.specialty && <span className="block text-sm text-ink-soft">{d.specialty}</span>}
                    {slots.length > 0 ? (
                      <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <WeekStrip slots={slots} />
                        <NextSession slots={slots} className="text-xs" />
                      </span>
                    ) : (
                      <span className="mt-1 block">{t.facility.noScheduleHere}</span>
                    )}
                  </>
                }
              />
            );
          })}
        </ListGroup>
        {f.schedules.length > 0 && <p className="m-0 px-5 pt-2 text-xs text-muted">{t.doctors.scheduleHint}</p>}
      </>
    );

  const infoPanel = (
    <>
      {f.description && (
        <section aria-labelledby="tentang-faskes" className="px-5">
          <h2 id="tentang-faskes" className="m-0 text-base font-bold">
            {t.facility.about}
          </h2>
          <p className="m-0 mt-2 text-base whitespace-pre-line text-ink-soft">{f.description}</p>
        </section>
      )}
      <ListGroup id="jam-buka" title={t.facility.hours} className={f.description ? 'mt-7' : 'mt-0'}>
        {hasHours ? (
          hours.map((h) => (
            <li key={h.days} className="flex items-baseline gap-3 px-4 py-2.5 text-sm">
              <span className="w-28 shrink-0 text-muted">{h.days}</span>
              <span className="tabular-nums">{h.value ?? t.facility.hoursNotListed}</span>
            </li>
          ))
        ) : (
          <li className="px-4 py-3 text-sm text-muted">{t.facility.noHours}</li>
        )}
      </ListGroup>
      <ListGroup id="alamat" title={t.facility.address} className="mt-7">
        <ListRow title={f.address} sub={f.city} />
        {others.map((l) => (
          <ListRow
            key={`${l.lat},${l.lng}`}
            title={[l.label, l.address].filter(Boolean).join(' · ')}
            sub={`${t.facility.otherLocations} · ${l.city}`}
            trailing={
              <a
                href={directionsUrl(l.lat, l.lng)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700"
              >
                <Navigation className="size-3.5" aria-hidden="true" />
                {t.facility.directions}
              </a>
            }
          />
        ))}
      </ListGroup>
      <p className="m-0 px-5 pt-4 text-xs text-muted">{t.facility.updatedAt(formatDate(f.updatedAt))}</p>
    </>
  );

  return (
    <>
      <TopBar title={f.name} backHref="/cari" action={<ShareButton title={f.name} />} />
      <DemoNotice show={loaded.source === 'demo'} date={snapshotDate()} />
      {/* Nama dulu; jenis dan wilayah sebagai keterangan teks, bukan tumpukan pil (evaluasi A6). */}
      {photo && <HeroPhoto photo={photo} className="mx-4 mt-3" />}
      <header className="px-5 pt-5 pb-4">
        <p className="m-0 text-xs font-semibold tracking-wide text-muted uppercase">
          {t.facilityType[f.type] ?? f.type} · {f.city}
        </p>
        <h1 className="m-0 mt-1 text-2xl leading-tight font-bold tracking-tight">{f.name}</h1>
        <p className="m-0 mt-1.5 text-sm text-ink-soft">{f.address}</p>
        <p className="m-0 mt-1.5 text-xs text-muted">{t.facility.verifiedProfile(t.verification[f.verification] ?? f.verification)}</p>
      </header>
      <ContactActions phone={f.phone} website={f.website} location={point} />
      <Tabs
        tabs={[
          {
            id: 'tarif',
            label: t.facility.tabs.tariffs,
            count: f.tariffs.length,
            content: <TariffBrowser tariffs={f.tariffs} />,
          },
          {
            id: 'dokter',
            label: t.facility.tabs.doctors,
            count: f.practitioners.length,
            content: doctorsPanel,
          },
          { id: 'info', label: t.facility.tabs.info, content: infoPanel },
        ]}
      />
    </>
  );
}
