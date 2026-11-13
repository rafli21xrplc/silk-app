import { AlertTriangle, BadgeCheck, CalendarDays, FileText } from 'lucide-react';
import type { Trust } from '@silk/shared';
import { cn } from '@/lib/cn';
import { formatDate, formatShortDate } from '@/lib/format';
import { t } from '@/messages/id';

const TONE: Record<string, string> = {
  diverifikasi_admin: 'bg-ok-soft text-ok',
  dari_dokumen_publik: 'bg-sky text-sky-ink',
  diisi_faskes: 'bg-violet-soft text-violet',
  publik_belum_diverifikasi: 'bg-surface text-muted',
};

export function VerificationBadge({ level, className }: { level: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold', TONE[level] ?? TONE.publik_belum_diverifikasi, className)}>
      <BadgeCheck className="size-3" aria-hidden="true" />
      {t.verification[level] ?? level}
    </span>
  );
}

/** Konteks kepercayaan satu baris: verifikasi, berlaku sejak, dan penanda tarif lama. */
export function TrustLine({ trust }: { trust: Trust }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem] text-muted">
      <VerificationBadge level={trust.verification} />
      <span>{`${t.trust.effectiveFrom} ${formatShortDate(trust.effectiveFrom)}`}</span>
      {trust.stale && (
        <span className="inline-flex items-center gap-1 font-semibold text-warn">
          <AlertTriangle className="size-3" aria-hidden="true" />
          {t.trust.stale}
        </span>
      )}
    </span>
  );
}

/** Rincian kepercayaan (lembar detail tarif). */
export function TrustDetail({ trust }: { trust: Trust }) {
  const rows: [React.ReactNode, string, string][] = [
    [<CalendarDays key="i" className="size-4" aria-hidden="true" />, t.trust.effectiveFrom, formatDate(trust.effectiveFrom)],
    [<CalendarDays key="i" className="size-4" aria-hidden="true" />, t.trust.verifiedAt, trust.verifiedAt ? formatDate(trust.verifiedAt) : t.trust.notVerified],
    [
      <FileText key="i" className="size-4" aria-hidden="true" />,
      t.trust.source,
      trust.source ? `${trust.source.title} (${t.sourceKind[trust.source.kind] ?? trust.source.kind})` : '–',
    ],
  ];
  if (trust.effectiveTo) rows.splice(1, 0, [<CalendarDays key="i" className="size-4" aria-hidden="true" />, t.trust.effectiveTo, formatDate(trust.effectiveTo)]);
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <VerificationBadge level={trust.verification} className="w-fit" />
        <p className="m-0 text-sm text-ink-soft">{t.trustHelp[trust.verification]}</p>
      </div>
      <dl className="m-0 grid gap-2">
        {rows.map(([icon, label, value]) => (
          <div key={label} className="flex items-start gap-2.5 text-sm">
            <span className="mt-0.5 text-muted">{icon}</span>
            <dt className="w-28 shrink-0 text-muted">{label}</dt>
            <dd className="m-0 font-medium text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      {trust.stale && <p className="m-0 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">{t.trust.staleHelp}</p>}
    </div>
  );
}
