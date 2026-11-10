import { REVIEW_ASPECTS, type ReviewAspect, type ReviewAspectValue } from './constants';
import type { ReviewSummary } from './schemas/review';

export interface ReviewForSummary {
  rating: number;
  aspects: Partial<Record<ReviewAspect, ReviewAspectValue>>;
  sample: boolean;
}

/**
 * Ringkasan ulasan yang sudah disetujui: rata-rata satu desimal, sebaran bintang, dan per aspek berapa yang
 * menilai "baik" dari yang menjawab. Aspek yang tidak dijawab tidak dihitung sebagai "kurang".
 */
export function summarizeReviews(rows: ReviewForSummary[]): ReviewSummary {
  const distribution = [0, 0, 0, 0, 0];
  let total = 0;
  for (const r of rows) {
    distribution[r.rating - 1]! += 1;
    total += r.rating;
  }
  const aspects = REVIEW_ASPECTS.map((aspect) => {
    let good = 0;
    let answered = 0;
    for (const r of rows) {
      const v = r.aspects[aspect];
      if (!v) continue;
      answered += 1;
      if (v === 'baik') good += 1;
    }
    return { aspect, good, answered };
  });
  return {
    count: rows.length,
    average: rows.length ? Math.round((total / rows.length) * 10) / 10 : null,
    distribution,
    aspects,
    sampleCount: rows.filter((r) => r.sample).length,
  };
}

/** "Rina Susanti Putri" → "Rina S."; nama satu kata tetap. Nama lengkap penulis tidak pernah tampil publik. */
export function shortAuthorName(full: string | null): string | null {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  return parts.length === 1 ? parts[0]! : `${parts[0]} ${parts[1]![0]!.toUpperCase()}.`;
}
