import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BadgeCheck } from 'lucide-react';
import { Avatar } from '@/components/avatar';
import { ContactActions } from '@/components/contact-actions';
import { DemoNotice } from '@/components/demo-notice';
import { DoctorVideo } from '@/components/doctor-video';
import { ListGroup, ListRow } from '@/components/list';
import { HeroPhoto } from '@/components/photo';
import { PriceValue } from '@/components/price';
import { NextSessionFact, ScheduleRows, WeekStrip } from '@/components/schedule';
import { ShareButton } from '@/components/share-button';
import { TariffBrowser } from '@/components/tariff-browser';
import { TopBar } from '@/components/top-bar';
import { TrustNote } from '@/components/trust';
import { formatDate, formatShortDate } from '@/lib/format';
import { doctorPhoto } from '@/lib/photos';
import { getPractitioner, snapshotDate } from '@/lib/silk/api';
import { t } from '@/messages/id';

export const revalidate = 300;

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const p = await getPractitioner((await params).slug);
  return p
    ? {
        title: p.data.name,
        description: [p.data.specialty, ...p.data.facilities.map((f) => f.name)].filter(Boolean).join(' · '),
      }
    : {};
}

/** Satu sel fakta kunci: label kecil di atas, nilai di bawah. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 px-3.5">
      <dt className="truncate text-xs text-muted">{label}</dt>
      <dd className="m-0 mt-1">{children}</dd>
    </div>
  );
}

export default async function DoctorPage({ params }: { params: Params }) {
  const loaded = await getPractitioner((await params).slug);
  if (!loaded) notFound();
  const p = loaded.data;
  const primary = p.practices.find((x) => x.isPrimary) ?? null;
  const primaryPlace = primary?.locations.find((l) => l.isPrimary) ?? primary?.locations[0] ?? null;
  const cities = [...new Set(p.practices.flatMap((x) => (x.locations.length ? x.locations.map((l) => l.city) : [x.facility.city])))];
  const allSlots = p.practices.flatMap((x) => x.schedules);
  const fee = p.consultation;
  const photo = doctorPhoto(p.slug, p.photo?.url, p.name);
  // Biaya konsultasi tampil di atas; daftar di bawah memuat layanan lain.
  const otherTariffs = p.tariffs.filter((x) => x.id !== fee?.id);

  return (
    <>
      <TopBar title={p.name} backHref="/dokter" action={<ShareButton title={p.name} />} />
      <DemoNotice show={loaded.source === 'demo'} date={snapshotDate()} />

      {/* Siapa dokternya: identitas, lalu kredensial sebagai teks (bukan tumpukan pil). */}
      {/* Wajah dokter dulu (USP "kenal dokternya"); tanpa foto: inisial di samping nama. */}
      {photo && <HeroPhoto photo={photo} ratio="portrait" className="mx-4 mt-3" />}
      <header className="px-5 pt-5">
        <div className="flex items-center gap-4">
          {!photo && <Avatar name={p.name} photoUrl={null} size="lg" />}
          <div className="min-w-0">
            <h1 className="m-0 text-2xl leading-tight font-bold tracking-tight">{p.name}</h1>
            {p.specialty && <p className="m-0 mt-1 text-base text-ink-soft">{p.specialty}</p>}
          </div>
        </div>
        <p className="m-0 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {p.verification.str && (
            <span className="inline-flex items-center gap-1 font-medium text-ok">
              <BadgeCheck className="size-4" aria-hidden="true" />
              {t.doctors.strVerified}
            </span>
          )}
          {p.verification.partner && (
            <span className="inline-flex items-center gap-1 font-medium text-violet">
              <BadgeCheck className="size-4" aria-hidden="true" />
              {t.doctors.partnerVerified}
            </span>
          )}
          {cities.length > 0 && <span className="text-muted">{cities.join(', ')}</span>}
        </p>
      </header>

      {/* Tiga hal yang dicari pasien sebelum datang: biaya, kapan, di mana. */}
      <dl className="mx-4 mt-5 grid grid-cols-3 divide-x divide-line/80 rounded-2xl bg-white py-3.5" data-doctor-facts>
        <Fact label={t.doctors.factFee}>
          {fee ? (
            <>
              <PriceValue price={fee.price} className="block" />
              <span className="block text-xs text-muted">{t.price.estimate}</span>
            </>
          ) : (
            <span className="block text-base font-semibold text-muted">{t.doctors.feeMissing}</span>
          )}
        </Fact>
        <Fact label={t.doctors.factNext}>
          <NextSessionFact slots={allSlots} fallback={t.doctors.noNext} />
        </Fact>
        <Fact label={t.doctors.factPlaces}>
          <span className="block text-base font-semibold">{p.practices.length}</span>
          <span className="block text-xs text-muted">{t.doctors.placesUnit}</span>
        </Fact>
      </dl>

      <div className="mt-4">
        <ContactActions
          phone={p.contact?.phone ?? null}
          website={p.contact?.website ?? null}
          location={primaryPlace ? { lat: primaryPlace.lat, lng: primaryPlace.lng } : null}
        />
      </div>

      {p.video && (
        <div className="mt-6 px-4">
          <DoctorVideo video={p.video} name={p.name} posterUrl={p.photo?.url ?? null} />
        </div>
      )}

      <ListGroup
        id="konsultasi"
        title={t.doctors.consultation}
        note={fee && primary ? `${t.price.estimate}. ${t.doctors.consultationFrom(primary.facility.name)}` : undefined}
      >
        {fee ? (
          <ListRow
            marker="consultation"
            title={fee.service.name}
            sub={<TrustNote trust={fee.trust} common={null} />}
            trailing={<PriceValue price={fee.price} />}
          />
        ) : (
          <li className="px-4 py-3.5 text-sm text-muted" data-consultation-missing>
            {t.doctors.consultationEmpty}
          </li>
        )}
      </ListGroup>

      <section aria-labelledby="jadwal" className="mt-8">
        <h2 id="jadwal" className="m-0 px-5 text-base font-bold">
          {t.doctors.schedulePlaces}
        </h2>
        {allSlots.length > 0 && <WeekStrip slots={allSlots} className="mt-2.5 px-5" />}
        {p.practices.map((x, i) => (
          <ListGroup
            key={x.facility.slug}
            id={`praktik-${x.facility.slug}`}
            level={3}
            title={x.isPrimary ? t.doctors.primaryPractice : t.doctors.otherPractice}
            className={i === 0 ? 'mt-3' : 'mt-5'}
          >
            <ListRow
              href={`/faskes/${x.facility.slug}`}
              title={<span className="font-semibold">{x.facility.name}</span>}
              sub={`${t.facilityType[x.facility.type] ?? x.facility.type} · ${x.locations[0]?.address ?? x.facility.city}`}
            />
            {x.schedules.length > 0 ? <ScheduleRows slots={x.schedules} /> : <li className="px-4 py-2.5 text-sm text-muted">{t.facility.noScheduleHere}</li>}
          </ListGroup>
        ))}
        <p className="m-0 px-5 pt-2 text-xs text-muted">{allSlots.length > 0 ? t.doctors.scheduleHint : t.doctors.noSchedule}</p>
      </section>

      {(p.about || p.strNo) && (
        <section aria-labelledby="tentang" className="mt-8">
          <h2 id="tentang" className="m-0 px-5 text-base font-bold">
            {t.doctors.about}
          </h2>
          {p.about && <p className="m-0 mt-2 px-5 text-base whitespace-pre-line text-ink-soft">{p.about}</p>}
          {p.strNo && (
            <ListGroup id="kredensial" level={3} title={t.doctors.credentials} className="mt-4">
              <ListRow title={t.doctors.strLabel} trailing={<span className="text-sm tabular-nums">{p.strNo}</span>} />
              {p.strVerifiedAt && <ListRow title={t.doctors.strVerifiedLabel} trailing={<span className="text-sm">{formatShortDate(p.strVerifiedAt)}</span>} />}
            </ListGroup>
          )}
        </section>
      )}

      {otherTariffs.length > 0 && (
        <section aria-labelledby="tarif" className="mt-8">
          <h2 id="tarif" className="m-0 mb-3 px-5 text-base font-bold">
            {t.doctors.otherTariffs}
          </h2>
          <TariffBrowser tariffs={otherTariffs} />
        </section>
      )}

      {p.articles.length > 0 && (
        <ListGroup id="artikel" title={t.doctors.articles} className="mt-8">
          {p.articles.map((a) => (
            <ListRow key={a.slug} href={`/artikel/${a.slug}`} title={a.title} sub={`${t.articles.minutes(a.readingMinutes)} · ${formatDate(a.publishedAt)}`} />
          ))}
        </ListGroup>
      )}
    </>
  );
}
