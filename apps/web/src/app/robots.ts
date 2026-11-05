import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  const isProd = process.env.VERCEL_ENV === 'production' || (!process.env.VERCEL_ENV && process.env.NODE_ENV === 'production');
  // Preview dan staging tidak boleh diindeks.
  if (!isProd || process.env.VERCEL_ENV === 'preview') return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/portal', '/admin', '/masuk', '/daftar', '/lupa-sandi', '/atur-ulang-sandi', '/cari', '/api/'] },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
