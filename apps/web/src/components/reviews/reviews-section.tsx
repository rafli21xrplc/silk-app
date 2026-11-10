import type { PublicReview, ReviewSummary } from '@silk/shared';
import { t } from '@/messages/id';
import { ReviewForm } from './review-form';
import { ReviewItem, ReviewSummaryPanel, UnverifiedLabel } from './review-parts';

export interface FacilityReviews {
  summary: ReviewSummary;
  items: PublicReview[];
}

/**
 * Bagian "Pengalaman pasien" (USP P3, evaluasi R8). Hanya dirender halaman bila flag reviews_enabled menyala.
 * Label "tidak diverifikasi" selalu tampil; data contoh diberi catatan dan label per ulasan.
 */
export function ReviewsSection({ data, facilitySlug, note }: { data: FacilityReviews; facilitySlug: string; note?: string }) {
  return (
    <section aria-labelledby="ulasan-judul" id="ulasan" className="scroll-mt-24">
      <h2 id="ulasan-judul" className="mt-12 mb-2">
        {t.reviews.title}
      </h2>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <UnverifiedLabel />
        {note && <span className="text-sm text-muted">{note}</span>}
      </div>
      {data.summary.sampleCount > 0 && <p className="small m-0 mb-3 rounded-xl bg-warn-soft px-3 py-2">{t.reviews.sampleNote(data.summary.sampleCount)}</p>}
      <div className="grid gap-4">
        {data.summary.count > 0 ? <ReviewSummaryPanel summary={data.summary} /> : <p className="m-0 text-muted">{t.reviews.empty}</p>}
        {data.items.length > 0 && (
          <ul className="plain grid gap-3">
            {data.items.map((r) => (
              <ReviewItem key={r.id} review={r} />
            ))}
          </ul>
        )}
        <ReviewForm facilitySlug={facilitySlug} />
      </div>
    </section>
  );
}
