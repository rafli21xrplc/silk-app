import 'server-only';
import { checkContent, type ContentRule } from '@silk/shared';
import { apiGet } from './api';
import { SAMPLE_ARTICLES } from './sample-articles';

/**
 * Artikel dari Sanity (M12) lewat GROQ HTTP API. Tanpa SANITY_PROJECT_ID: di dev tampil artikel contoh
 * (lib/sample-articles.ts), di produksi daftar kosong.
 * Artikel yang melanggar aturan konten `blokir` (M17) tidak ditampilkan.
 */
const PROJECT = process.env.SANITY_PROJECT_ID ?? '';
const DATASET = process.env.SANITY_DATASET ?? 'production';
const TOKEN = process.env.SANITY_READ_TOKEN ?? '';
const API_VERSION = '2025-02-19';

export interface PortableBlock {
  _type: string;
  _key?: string;
  style?: string;
  listItem?: 'bullet' | 'number';
  children?: { _key?: string; text?: string; marks?: string[] }[];
}

export interface ArticleSummary {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  updatedAt: string;
  /** Estimasi waktu baca (menit, minimal 1). */
  readingMinutes: number;
  /** Artikel contoh pengembangan (bukan dari CMS). */
  sample?: boolean;
}

export interface Article extends ArticleSummary {
  author: string | null;
  body: PortableBlock[];
}

export const sanityConfigured = () => PROJECT !== '';

/** Artikel contoh hanya untuk dev lokal tanpa Sanity; tidak pernah di produksi. */
const useSamples = () => !sanityConfigured() && process.env.NODE_ENV !== 'production';
const samples = (): Article[] => SAMPLE_ARTICLES;

async function groq<T>(
  query: string,
  params: Record<string, string>,
  tags: string[],
): Promise<T | null> {
  if (!sanityConfigured()) return null;
  const url = new URL(
    `https://${PROJECT}.${TOKEN ? 'api' : 'apicdn'}.sanity.io/v${API_VERSION}/data/query/${DATASET}`,
  );
  url.searchParams.set('query', query);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(`$${k}`, JSON.stringify(v));
  const res = await fetch(url, {
    headers: TOKEN ? { authorization: `Bearer ${TOKEN}` } : {},
    next: { tags, revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Sanity ${res.status}`);
  return ((await res.json()) as { result: T }).result;
}

// ±1.100 karakter ≈ 200 kata ≈ 1 menit baca.
const SUMMARY = `"slug": slug.current, title, description, publishedAt, "updatedAt": _updatedAt, "readingMinutes": round(length(pt::text(body)) / 1100)`;
const withMinutes = <T extends { readingMinutes: number | null }>(a: T): T => ({
  ...a,
  readingMinutes: Math.max(1, a.readingMinutes ?? 1),
});

export const plainText = (blocks: PortableBlock[]) =>
  blocks
    .filter((b) => b._type === 'block')
    .map((b) => (b.children ?? []).map((c) => c.text ?? '').join(''))
    .join('\n');

async function activeRules(): Promise<ContentRule[]> {
  // Tanpa aturan, artikel tidak bisa diperiksa: biarkan error naik agar artikel tidak tampil tanpa filter.
  return (
    await apiGet<ContentRule[]>('/content-rules/active', {
      tags: ['content-rules'],
      revalidate: 600,
    })
  ).data;
}

export async function listArticles(): Promise<ArticleSummary[]> {
  const rows = useSamples()
    ? samples().map(({ body: _body, author: _author, ...summary }) => summary)
    : await groq<ArticleSummary[]>(
        `*[_type == "article" && defined(slug.current) && !(_id in path("drafts.**"))] | order(publishedAt desc)[0...50]{${SUMMARY}}`,
        {},
        ['articles'],
      );
  if (!rows) return [];
  const rules = await activeRules();
  return rows
    .filter((a) => !checkContent({ title: a.title, description: a.description }, rules).blocked)
    .map(withMinutes);
}

export async function getArticle(slug: string): Promise<Article | null> {
  const a = useSamples()
    ? (samples().find((x) => x.slug === slug) ?? null)
    : await groq<Article | null>(
        `*[_type == "article" && slug.current == $slug && !(_id in path("drafts.**"))][0]{${SUMMARY}, "author": author->name, body}`,
        { slug },
        [`article:${slug}`, 'articles'],
      );
  if (!a) return null;
  const check = checkContent(
    { title: a.title, description: a.description, body: plainText(a.body ?? []) },
    await activeRules(),
  );
  return check.blocked ? null : withMinutes({ ...a, body: a.body ?? [] });
}
