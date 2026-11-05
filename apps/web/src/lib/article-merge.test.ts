import { describe, expect, it } from 'vitest';
import { fromPartnerArticle, mergeArticles } from './article-merge';
import type { ArticleSummary } from './sanity';

const a = (slug: string, publishedAt: string, partner = false): ArticleSummary => ({
  slug,
  title: slug,
  description: '',
  publishedAt,
  updatedAt: publishedAt,
  readingMinutes: 1,
  ...(partner ? { partner: { name: 'Mitra', partnerType: 'gaya_hidup', profilePath: null } } : {}),
});

describe('mergeArticles', () => {
  it('urut terbaru dulu lintas sumber; seri diurutkan slug', () => {
    const out = mergeArticles([a('ed-1', '2026-01-01T00:00:00Z'), a('ed-2', '2026-03-01T00:00:00Z')], [a('mitra-b', '2026-02-01T00:00:00Z', true), a('mitra-a', '2026-02-01T00:00:00Z', true)]);
    expect(out.map((x) => x.slug)).toEqual(['ed-2', 'mitra-a', 'mitra-b', 'ed-1']);
  });

  it('slug kembar memakai artikel mitra', () => {
    const out = mergeArticles([a('sama', '2026-01-01T00:00:00Z')], [a('sama', '2026-01-02T00:00:00Z', true)]);
    expect(out).toHaveLength(1);
    expect(out[0]?.partner?.name).toBe('Mitra');
  });
});

describe('fromPartnerArticle', () => {
  it('penulis menjadi nama tampilan; blok dipakai langsung', () => {
    const art = fromPartnerArticle({
      slug: 's',
      title: 'T',
      description: 'D',
      publishedAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      readingMinutes: 2,
      author: { name: 'Studio', partnerType: 'gaya_hidup', profilePath: '/faskes/studio' },
      body: [{ _type: 'block', _key: 'b0', style: 'normal', children: [{ _key: 'b0s0', text: 'x', marks: [] }] }],
    });
    expect(art.author).toBe('Studio');
    expect(art.partner?.profilePath).toBe('/faskes/studio');
    expect(art.body).toHaveLength(1);
  });
});
