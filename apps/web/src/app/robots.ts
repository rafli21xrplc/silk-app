import type { MetadataRoute } from 'next';
import { absoluteUrl, siteNoIndex } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  const isProd = process.env.VERCEL_ENV === 'production' || (!process.env.VERCEL_ENV && process.env.NODE_ENV === 'production');
  // Preview, staging, dan situs dengan SILK_NOINDEX=1 tidak boleh diindeks.
  if (!isProd || process.env.VERCEL_ENV === 'preview' || siteNoIndex()) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/portal', '/admin', '/masuk', '/daftar', '/lupa-sandi', '/atur-ulang-sandi', '/cari', '/api/'] },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
