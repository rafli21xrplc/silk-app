import { REVIEW_ASPECTS, type ReviewAspect, type ReviewAspectValue, type ReviewInput, type ReviewSummary } from '@silk/shared';

/** Draf formulir ulasan (evaluasi USP R8). `rating` 0 = belum dipilih. */
export interface ReviewDraft {
  rating: number;
  aspects: Partial<Record<ReviewAspect, ReviewAspectValue>>;
  comment: string;
  declaration: boolean;
}

export const emptyReviewDraft = (): ReviewDraft => ({ rating: 0, aspects: {}, comment: '', declaration: false });

export type ReviewDraftProblem = 'pickRating' | 'needDeclaration';

/** Body PUT /reviews/:slug, atau masalah pertama yang harus diperbaiki. Server memeriksa ulang semuanya. */
export function reviewBodyFromDraft(d: ReviewDraft): { body: ReviewInput } | { problem: ReviewDraftProblem } {
  if (!Number.isInteger(d.rating) || d.rating < 1 || d.rating > 5) return { problem: 'pickRating' };
  if (!d.declaration) return { problem: 'needDeclaration' };
  const comment = d.comment.trim();
  return { body: { rating: d.rating, aspects: { ...d.aspects }, comment: comment || null, declaration: true } };
}

/** Pilih/lepas nilai aspek: memilih nilai yang sama lagi menghapus jawabannya. */
export function toggleAspect(d: ReviewDraft, aspect: ReviewAspect, value: ReviewAspectValue): ReviewDraft {
  const aspects = { ...d.aspects };
  if (aspects[aspect] === value) delete aspects[aspect];
  else aspects[aspect] = value;
  return { ...d, aspects };
}

/** Baris ringkasan per aspek, urutan tetap; persen null bila belum ada yang menjawab. */
export function aspectRows(summary: ReviewSummary): { aspect: ReviewAspect; good: number; answered: number; percent: number | null }[] {
  return REVIEW_ASPECTS.map((aspect) => {
    const a = summary.aspects.find((x) => x.aspect === aspect) ?? { good: 0, answered: 0 };
    return { aspect, good: a.good, answered: a.answered, percent: a.answered ? Math.round((a.good / a.answered) * 100) : null };
  });
}
