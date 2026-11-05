import type { Article, ArticleSummary } from './sanity';
import type { PublicArticle, PublicArticleSummary } from './types';

/** Artikel mitra dari API → bentuk yang sama dengan artikel editorial agar komponen dipakai ulang. */
export function fromPartnerSummary(a: PublicArticleSummary): ArticleSummary {
  return {
    slug: a.slug,
    title: a.title,
    description: a.description,
    publishedAt: a.publishedAt,
    updatedAt: a.updatedAt,
    readingMinutes: a.readingMinutes,
    partner: a.author,
  };
}

export function fromPartnerArticle(a: PublicArticle): Article {
  return { ...fromPartnerSummary(a), author: a.author.name, body: a.body };
}

/**
 * Gabungan editorial (Sanity) dan artikel mitra, terbaru dulu. Slug kembar (seharusnya tidak terjadi karena
 * slug mitra berakhiran acak) memakai artikel mitra, sama dengan urutan pencarian di halaman detail.
 */
export function mergeArticles(editorial: ArticleSummary[], partner: ArticleSummary[]): ArticleSummary[] {
  const bySlug = new Map<string, ArticleSummary>();
  for (const a of [...editorial, ...partner]) bySlug.set(a.slug, a);
  return [...bySlug.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug));
}
