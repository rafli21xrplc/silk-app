import type { MetadataRoute } from 'next';
import { apiGet } from '@/lib/api';
import { listArticles } from '@/lib/articles';
import { absoluteUrl } from '@/lib/seo';
import type { SitemapData } from '@/lib/types';

export const revalidate = 3600;

/** Sitemap dinamis: hanya halaman terbit (M1-4). Direvalidasi lewat tag `sitemap`. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages = ['/', '/layanan', '/artikel', '/metodologi', '/tentang'].map((p) => ({ url: absoluteUrl(p) }));
  const { data } = await apiGet<SitemapData>('/sitemap', { tags: ['sitemap'] });
  const dynamicPages = [...data.facilities, ...data.practitioners, ...data.services, ...data.compare].map((e) => ({
    url: absoluteUrl(e.path),
    ...(e.lastModified ? { lastModified: e.lastModified } : {}),
  }));
  const articles = (await listArticles().catch(() => [])).map((a) => ({ url: absoluteUrl(`/artikel/${a.slug}`), lastModified: a.updatedAt }));
  return [...staticPages, ...dynamicPages, ...articles];
}
