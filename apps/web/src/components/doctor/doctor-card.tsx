import Link from 'next/link';
import { ArrowRight, CalendarDays, MapPin, Navigation, PlayCircle } from 'lucide-react';
import type { ScheduleSlot } from '@/lib/schedule-today';
import type { PractitionerListItem } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { t } from '@/messages/id';
import { EstimateBadge } from '../estimate-badge';
import { PriceDisplay } from '../price-display';
import { DoctorAvatar } from './doctor-avatar';
import { DoctorBadges } from './doctor-badges';
import { TodaySchedule } from './today-schedule';

/**
 * Kartu hasil pencarian dokter. Tanpa iklan atau peringkat; seluruh kartu bisa diketuk.
 * `slots` (opsional, dari profil) menampilkan jadwal hari ini menggantikan penanda "Jadwal tersedia".
 */
export function DoctorCard({ doctor, slots }: { doctor: PractitionerListItem; slots?: readonly ScheduleSlot[] }) {
  const more = doctor.practiceCount - doctor.practices.length;
  return (
    <article className="group relative flex h-full flex-col gap-4 rounded-card border border-line/80 bg-white p-5 shadow-soft transition-[border-color,box-shadow,transform] duration-300 ease-soft focus-within:border-primary-200 hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-lift sm:p-6">
      <div className="flex min-w-0 items-start gap-4">
        <DoctorAvatar name={doctor.name} photoUrl={doctor.photoUrl} />
        <div className="min-w-0">
          <h3 className="mb-1 text-lg leading-snug">
            <Link
              href={`/dokter/${doctor.slug}`}
              className="text-ink no-underline after:absolute after:inset-0 after:rounded-card after:content-[''] hover:text-primary-800 hover:no-underline"
            >
              {doctor.name}
            </Link>
          </h3>
          {doctor.specialty && <p className="m-0 font-medium text-ink-soft">{doctor.specialty}</p>}
        </div>
      </div>
      <DoctorBadges verification={doctor.verification} compact />
      <div className="grid gap-1.5 text-sm text-ink-soft">
        {doctor.practices.length > 0 && (
          <p className="m-0 flex items-start gap-1.5">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
            <span>
              {doctor.practices.map((p) => p.name).join(' · ')}
              {more > 0 && <span className="text-muted"> {t.doctors.morePractices(more)}</span>}
              {doctor.cities.length > 0 && <span className="block text-muted">{doctor.cities.join(', ')}</span>}
            </span>
          </p>
        )}
        <p className="m-0 flex flex-wrap gap-1.5 text-[0.8rem]">
          {doctor.distanceM !== null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky px-2.5 py-0.5 font-medium text-sky-ink">
              <Navigation className="size-3" aria-hidden="true" />
              {t.search.distance(doctor.distanceM)}
            </span>
          )}
          {slots && slots.length > 0 ? (
            <TodaySchedule slots={slots} />
          ) : doctor.hasSchedule && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-0.5 font-medium text-ink-soft">
              <CalendarDays className="size-3" aria-hidden="true" />
              {t.doctors.hasSchedule}
            </span>
          )}
          {doctor.hasVideo && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-0.5 font-medium text-ink-soft">
              <PlayCircle className="size-3" aria-hidden="true" />
              {t.doctors.hasVideo}
            </span>
          )}
        </p>
      </div>
      {/* Evaluasi USP R3: biaya konsultasi di kartu, dengan label perkiraan dan tanggal berlaku. */}
      {doctor.consultation ? (
        <div className="grid gap-1 rounded-2xl bg-surface/80 px-4 py-3" data-consultation>
          <span className="text-[0.8rem] font-semibold text-muted">{doctor.consultation.serviceName}</span>
          <span className="flex flex-wrap items-center gap-2">
            <PriceDisplay price={doctor.consultation.price} />
            <EstimateBadge price={doctor.consultation.price} />
          </span>
          <span className="text-[0.8rem] text-muted">{`${t.trust.effectiveFrom} ${formatDate(doctor.consultation.trust.effectiveFrom)}`}</span>
        </div>
      ) : (
        // Evaluasi UI/UX A4: tanpa biaya, kartu tetap punya bagian biaya agar tinggi kartu seimbang dan
        // pasien tahu informasinya belum ada (bukan terlewat).
        <div className="grid gap-0.5 rounded-2xl border border-dashed border-line-strong px-4 py-3" data-consultation-missing>
          <span className="text-sm font-semibold text-ink-soft">{t.doctors.noConsultationShort}</span>
          <span className="text-[0.8rem] text-muted">{t.doctors.noConsultationHint}</span>
        </div>
      )}
      <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-primary-700" aria-hidden="true">
        {t.doctors.viewProfile} <ArrowRight className="size-4 transition-transform duration-300 ease-soft group-hover:translate-x-0.5" />
      </span>
    </article>
  );
}

/** Kartu ringkas dokter di halaman faskes. */
export function DoctorChip({ doctor }: { doctor: { slug: string; name: string; specialty: string | null; photoUrl: string | null } }) {
  return (
    <div className="group relative flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 shadow-soft transition-colors hover:border-primary-200">
      <DoctorAvatar name={doctor.name} photoUrl={doctor.photoUrl} size="sm" />
      <div className="min-w-0">
        <Link
          href={`/dokter/${doctor.slug}`}
          className="font-semibold text-ink no-underline after:absolute after:inset-0 after:rounded-2xl after:content-[''] hover:text-primary-800 hover:no-underline"
        >
          {doctor.name}
        </Link>
        {doctor.specialty && <span className="block text-sm text-muted">{doctor.specialty}</span>}
      </div>
    </div>
  );
}
