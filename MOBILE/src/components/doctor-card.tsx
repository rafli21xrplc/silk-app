import { BadgeCheck, PlayCircle } from 'lucide-react';
import type { PractitionerListItem } from '@silk/shared';
import { doctorPhoto } from '@/lib/photos';
import { t } from '@/messages/id';
import { Avatar } from './avatar';
import { ListRow } from './list';
import { PriceValue } from './price';

/**
 * Baris dokter: siapa (nama, spesialisasi, kredensial), di mana, dan biaya konsultasi rata kanan.
 * Dipakai di daftar dokter dan beranda, di dalam ListGroup/ListBox.
 */
export function DoctorRow({ doctor: d }: { doctor: PractitionerListItem }) {
  const more = d.practiceCount - d.practices.length;
  const place = d.practices.map((p) => p.name).join(' · ');
  return (
    <ListRow
      marker="doctor-card"
      href={`/dokter/${d.slug}`}
      align="start"
      chevron={false}
      leading={<Avatar name={d.name} photoUrl={doctorPhoto(d.slug, d.photoUrl, d.name)?.square} size="md" />}
      title={<span className="font-semibold">{d.name}</span>}
      sub={
        <>
          {d.specialty && <span className="block text-sm text-ink-soft">{d.specialty}</span>}
          {place && (
            <span className="mt-0.5 block truncate">
              {place}
              {more > 0 && ` ${t.doctors.morePractices(more)}`}
            </span>
          )}
          {(d.verification.str || d.hasVideo) && (
            <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-medium">
              {d.verification.str && (
                <span className="inline-flex items-center gap-1 text-ok">
                  <BadgeCheck className="size-3.5" aria-hidden="true" />
                  {t.doctors.strVerified}
                </span>
              )}
              {d.hasVideo && (
                <span className="inline-flex items-center gap-1 text-lilac-ink">
                  <PlayCircle className="size-3.5" aria-hidden="true" />
                  {t.doctors.hasVideo}
                </span>
              )}
            </span>
          )}
        </>
      }
      trailing={
        d.consultation ? (
          <span className="block" data-consultation>
            <PriceValue price={d.consultation.price} className="block" />
            <span className="block text-xs text-muted">{t.doctors.feeShort}</span>
          </span>
        ) : (
          <span className="block max-w-20 text-xs leading-tight text-muted" data-consultation-missing>
            {t.doctors.feeMissingShort}
          </span>
        )
      }
    />
  );
}
