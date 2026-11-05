import 'server-only';
import { ApiError, apiGet, apiGetOrNull } from './api';
import { fromPartnerArticle, fromPartnerSummary, mergeArticles } from './article-merge';
import { getArticle as getEditorial, listArticles as listEditorial, type Article, type ArticleSummary } from './sanity';
import type { PublicArticle, PublicArticleSummary } from './types';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Artikel mitra terbit (Fase 4). Tag `articles` dan `article:<slug>` di-revalidate API saat disetujui atau ditarik. */
async function listPartner(): Promise<ArticleSummary[]> {
  const res = await apiGet<PublicArticleSummary[]>('/articles?limit=100', { tags: ['articles'] });
  return res.data.map(fromPartnerSummary);
}

async function getPartner(slug: string): Promise<Article | null> {
  if (!SLUG.test(slug)) return null;
  try {
    const a = await apiGetOrNull<PublicArticle>(`/articles/${slug}`, { tags: [`article:${slug}`, 'articles'] });
    return a ? fromPartnerArticle(a) : null;
  } catch (err) {
    // Slug yang ditolak validasi API (400) bukan artikel mitra; cari di Sanity.
    if (err instanceof ApiError && err.status === 400) return null;
    throw err;
  }
}

/** Editorial dan mitra, terbaru dulu. Satu sumber gagal tidak mengosongkan sumber lainnya. */
export async function listArticles(): Promise<ArticleSummary[]> {
  const [editorial, partner] = await Promise.allSettled([listEditorial(), listPartner()]);
  if (editorial.status === 'rejected' && partner.status === 'rejected') throw editorial.reason;
  return mergeArticles(editorial.status === 'fulfilled' ? editorial.value : [], partner.status === 'fulfilled' ? partner.value : []);
}

/** Artikel mitra dicari dulu (slug berakhiran acak), lalu Sanity. */
export async function getArticle(slug: string): Promise<Article | null> {
  return (await getPartner(slug)) ?? getEditorial(slug);
}
