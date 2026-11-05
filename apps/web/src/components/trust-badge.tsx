import { CalendarDays, Clock3, ShieldCheck, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import type { Trust } from '@/lib/types';
import { t } from '@/messages/id';
import { InfoPopover } from './ui/info-popover';

/** Konteks setiap angka (M4): tanggal berlaku, verifikasi, sumber, penanda usang. Badge membuka penjelasan. */
export function TrustBadge({ trust, compact = false }: { trust: Trust; compact?: boolean }) {
  const level = trust.verifiedAt ? trust.verification : 'publik_belum_diverifikasi';
  return (
    <div className={cn('trust grid gap-2', compact && 'trust-compact')}>
      <div className="flex flex-wrap gap-1.5">
        <InfoPopover content={t.trustHelp[level] ?? t.trustHelp.publik_belum_diverifikasi ?? ''}>
          <span className={`badge badge-${level}`}>
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            {trust.verifiedAt ? t.verification[trust.verification] : t.trust.notVerified}
          </span>
        </InfoPopover>
        {trust.stale && (
          <InfoPopover content={t.trust.staleHelp}>
            <span className="badge badge-stale">
              <TriangleAlert className="size-3.5" aria-hidden="true" />
              {t.trust.stale}
            </span>
          </InfoPopover>
        )}
      </div>
      <dl className={cn('trust-meta m-0 flex flex-wrap gap-x-4 gap-y-1 text-[0.85rem] text-ink-soft', compact && 'gap-x-3 text-[0.8rem]')}>
        <div className="flex items-center gap-1.5">
          <CalendarDays className="size-3.5 text-muted" aria-hidden="true" />
          <dt className="text-muted after:content-[':']">{t.trust.effectiveFrom}</dt>
          <dd className="m-0">{formatDate(trust.effectiveFrom)}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock3 className="size-3.5 text-muted" aria-hidden="true" />
          <dt className="text-muted after:content-[':']">{t.trust.verifiedAt}</dt>
          <dd className="m-0">{trust.verifiedAt ? formatDate(trust.verifiedAt) : t.trust.notVerified}</dd>
        </div>
        {!compact && trust.source && (
          <div className="flex flex-wrap items-center gap-1.5">
            <dt className="text-muted after:content-[':']">{t.trust.source}</dt>
            <dd className="m-0">
              {trust.source.url ? (
                <a href={trust.source.url} rel="noopener noreferrer nofollow" target="_blank">
                  {trust.source.title}
                </a>
              ) : (
                trust.source.title
              )}{' '}
              <span className="text-muted">({t.sourceKind[trust.source.kind] ?? trust.source.kind})</span>
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
