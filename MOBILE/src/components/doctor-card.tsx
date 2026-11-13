import Link from 'next/link';
import { BadgeCheck, CalendarDays, ChevronRight, MapPin, PlayCircle } from 'lucide-react';
import type { PractitionerListItem } from '@silk/shared';
import { cn } from '@/lib/cn';
import { formatShortDate } from '@/lib/format';
import { t } from '@/messages/id';
import { Avatar } from './avatar';
import { PriceTag } from './price';

/** Kartu dokter: siapa, di mana, dan biaya konsultasinya (atau keterangan bila belum dicantumkan). */
export function DoctorCard({ doctor: d, compact = false }: { doctor: PractitionerListItem; compact?: boolean }) {
  const more = d.practiceCount - d.practices.length;
  return (
    <Link
      href={`/dokter/${d.slug}`}
      className={cn('tap flex h-full flex-col gap-3 rounded-card border border-line/80 bg-white p-4 text-ink no-underline shadow-soft', compact && 'w-[17.5rem]')}
      data-doctor-card
    >
      <span className="flex items-start gap-3">
        <Avatar name={d.name} photoUrl={d.photoUrl} />
        <span className="min-w-0 flex-1">
          <span className="block leading-snug font-bold">{d.name}</span>
          {d.specialty && <span className="block text-sm text-ink-soft">{d.specialty}</span>}
          <span className="mt-1 flex flex-wrap gap-1 text-[0.68rem] font-semibold">
            {d.verification.str && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-ok-soft px-1.5 py-0.5 text-ok">
                <BadgeCheck className="size-3" aria-hidden="true" />
                {t.doctors.strVerified}
              </span>
            )}
            {d.hasVideo && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-lilac px-1.5 py-0.5 text-lilac-ink">
                <PlayCircle className="size-3" aria-hidden="true" />
                {t.doctors.hasVideo}
              </span>
            )}
            {!compact && d.hasSchedule && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-surface px-1.5 py-0.5 text-ink-soft">
                <CalendarDays className="size-3" aria-hidden="true" />
                {t.doctors.hasSchedule}
              </span>
            )}
          </span>
        </span>
        {!compact && <ChevronRight className="mt-3 size-5 shrink-0 text-muted" aria-hidden="true" />}
      </span>
      {!compact && d.practices.length > 0 && (
        <span className="flex items-start gap-1 text-[0.8rem] text-muted">
          <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            {d.practices.map((p) => p.name).join(' · ')}
            {more > 0 && ` ${t.doctors.morePractices(more)}`}
          </span>
        </span>
      )}
      {d.consultation ? (
        <span className="mt-auto grid gap-1 rounded-2xl bg-surface/80 px-3.5 py-2.5" data-consultation>
          <span className="text-[0.72rem] font-semibold text-muted">{d.consultation.serviceName}</span>
          <PriceTag price={d.consultation.price} size="sm" />
          <span className="text-[0.7rem] text-muted">{`${t.trust.effectiveFrom} ${formatShortDate(d.consultation.trust.effectiveFrom)}`}</span>
        </span>
      ) : (
        <span className="mt-auto grid gap-0.5 rounded-2xl border border-dashed border-line-strong px-3.5 py-2.5" data-consultation-missing>
          <span className="text-[0.8rem] font-semibold text-ink-soft">{t.doctors.noConsultationShort}</span>
          <span className="text-[0.72rem] text-muted">{t.doctors.noConsultationHint}</span>
        </span>
      )}
    </Link>
  );
}
