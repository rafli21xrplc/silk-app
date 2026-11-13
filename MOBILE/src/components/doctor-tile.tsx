import Link from 'next/link';
import type { PractitionerListItem } from '@silk/shared';
import { cn } from '@/lib/cn';
import { avatarTone, doctorInitials } from '@/lib/doctor';
import { doctorPhoto } from '@/lib/photos';
import { t } from '@/messages/id';
import { PriceValue } from './price';
import { NextSession } from './schedule';

type Slot = { weekday: number; start: string; end: string };

/**
 * Kartu dokter tegak untuk karusel beranda: wajah dulu, lalu nama, spesialisasi,
 * jadwal terdekat (dihitung di peramban), dan biaya konsultasi.
 */
export function DoctorTile({ doctor: d, slots }: { doctor: PractitionerListItem; slots: readonly Slot[] }) {
  const photo = doctorPhoto(d.slug, d.photoUrl, d.name);
  return (
    <Link href={`/dokter/${d.slug}`} data-doctor-tile className="flex w-36 flex-col text-ink no-underline">
      <span className="relative block aspect-[4/5] overflow-hidden rounded-2xl bg-surface-2">
        {photo ? (
          <>
            <img src={photo.square} alt="" className="size-full object-cover" loading="lazy" decoding="async" />
            {photo.illustrative && (
              <span className="absolute right-1.5 bottom-1.5 rounded bg-black/55 px-1 py-px text-[11px] font-medium text-white">
                {t.common.illustrativeShort}
              </span>
            )}
          </>
        ) : (
          <span className={cn('grid size-full place-items-center text-3xl font-bold', avatarTone(d.name))} aria-hidden="true">
            {doctorInitials(d.name)}
          </span>
        )}
      </span>
      <span className="mt-2 line-clamp-2 text-sm leading-5 font-semibold">{d.name}</span>
      {d.specialty && <span className="truncate text-xs text-muted">{d.specialty}</span>}
      {slots.length > 0 && <NextSession slots={slots} className="mt-1 text-xs" />}
      <span className="mt-1 text-sm">
        {d.consultation ? (
          <>
            <PriceValue price={d.consultation.price} className="text-sm" /> <span className="text-xs text-muted">{t.doctors.feeShort}</span>
          </>
        ) : (
          <span className="text-xs text-muted">{t.doctors.feeMissingShort}</span>
        )}
      </span>
    </Link>
  );
}
