import { Star } from 'lucide-react';
import type { PublicReview, ReviewSummary } from '@silk/shared';
import { InfoPopover } from '@/components/ui/info-popover';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { aspectRows } from '@/lib/reviews';
import { t } from '@/messages/id';

/** Bintang 1–5 (dibulatkan); label teks untuk pembaca layar. */
export function Stars({ value, className }: { value: number; className?: string }) {
  const filled = Math.round(value);
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-amber-500', className)} role="img" aria-label={t.reviews.starsLabel(filled)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className="size-4" fill={n <= filled ? 'currentColor' : 'none'} aria-hidden="true" />
      ))}
    </span>
  );
}

/** Label wajib "tidak diverifikasi" (Fase 6) dengan penjelasan singkat. */
export function UnverifiedLabel() {
  return (
    <InfoPopover content={t.reviews.unverifiedHelp}>
      <span className="badge badge-estimate">{t.reviews.unverified}</span>
    </InfoPopover>
  );
}

/** Ringkas untuk atas lipatan profil dokter: bintang, rata-rata, jumlah, label, tautan ke daftar. */
export function ReviewHeadline({ summary, href }: { summary: ReviewSummary; href: string }) {
  if (summary.count === 0 || summary.average === null) return null;
  return (
    <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <Stars value={summary.average} />
      <strong>{t.reviews.average(summary.average)}</strong>
      <a href={href} className="font-semibold">
        {t.reviews.count(summary.count)}
      </a>
      <UnverifiedLabel />
      {summary.sampleCount > 0 && <span className="badge">{t.reviews.sample}</span>}
    </p>
  );
}

/** Rata-rata, sebaran, dan per aspek "x dari y menilai baik". */
export function ReviewSummaryPanel({ summary }: { summary: ReviewSummary }) {
  return (
    <div className="grid gap-4 rounded-2xl border border-line bg-white p-4 sm:grid-cols-[auto_1fr] sm:gap-8 sm:p-5">
      <div className="grid content-start gap-1">
        {summary.average !== null && (
          <>
            <p className="m-0 text-3xl font-semibold tabular-nums">{summary.average.toLocaleString('id-ID', { minimumFractionDigits: 1 })}</p>
            <Stars value={summary.average} />
          </>
        )}
        <p className="m-0 text-sm text-muted">{t.reviews.count(summary.count)}</p>
      </div>
      <ul className="plain grid gap-2">
        {aspectRows(summary).map((a) => (
          <li key={a.aspect} className="grid gap-1 text-sm">
            <span className="flex justify-between gap-3">
              <span>{t.reviews.aspects[a.aspect]}</span>
              <span className="text-muted">{a.answered ? t.reviews.aspectGood(a.good, a.answered) : t.reviews.aspectNone}</span>
            </span>
            <span className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
              <span className="block h-full rounded-full bg-primary-600" style={{ width: `${a.percent ?? 0}%` }} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReviewItem({ review }: { review: PublicReview }) {
  const aspects = Object.entries(review.aspects);
  return (
    <li className="grid gap-2 rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Stars value={review.rating} />
        <span className="font-semibold">{review.sample ? t.reviews.sample : (review.authorName ?? '')}</span>
        {review.sample && <span className="badge">{t.reviews.sample}</span>}
        <span className="text-muted">{formatDate(review.createdAt)}</span>
      </div>
      {aspects.length > 0 && (
        <ul className="plain flex flex-wrap gap-1.5">
          {aspects.map(([aspect, value]) => (
            <li key={aspect} className={cn('badge', value === 'kurang' && 'badge-stale')}>
              {t.reviews.aspects[aspect]}: {t.reviews.aspectValue[value]}
            </li>
          ))}
        </ul>
      )}
      {review.comment && <p className="m-0 whitespace-pre-line">{review.comment}</p>}
    </li>
  );
}
