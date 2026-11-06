import { BadgeCheck, ShieldCheck } from 'lucide-react';
import { InfoPopover } from '@/components/ui/info-popover';
import { t } from '@/messages/id';

/** Lencana STR dan mitra terverifikasi. Tanpa lencana bila belum diverifikasi (tidak ada peringkat). */
export function DoctorBadges({ verification, strDate, compact }: { verification: { str: boolean; partner: boolean }; strDate?: string | null; compact?: boolean }) {
  if (!verification.str && !verification.partner) return null;
  const strLabel = strDate ? t.doctors.strVerifiedOn(strDate) : t.doctors.strVerified;
  const chip = 'inline-flex items-center gap-1 rounded-full font-semibold';
  const size = compact ? 'px-2.5 py-0.5 text-[0.8rem]' : 'px-3 py-1 text-sm';
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {verification.str &&
        (compact ? (
          <span className={`${chip} ${size} bg-mint text-mint-ink`}>
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            {strLabel}
          </span>
        ) : (
          <InfoPopover content={t.doctors.strHelp}>
            <span className={`${chip} ${size} bg-mint text-mint-ink`}>
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              {strLabel}
            </span>
          </InfoPopover>
        ))}
      {verification.partner &&
        (compact ? (
          <span className={`${chip} ${size} bg-sky text-sky-ink`}>
            <BadgeCheck className="size-3.5" aria-hidden="true" />
            {t.doctors.partnerVerified}
          </span>
        ) : (
          <InfoPopover content={t.doctors.partnerHelp}>
            <span className={`${chip} ${size} bg-sky text-sky-ink`}>
              <BadgeCheck className="size-3.5" aria-hidden="true" />
              {t.doctors.partnerVerified}
            </span>
          </InfoPopover>
        ))}
    </span>
  );
}
