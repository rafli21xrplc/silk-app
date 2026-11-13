import type { MetadataRoute } from 'next';
import { t } from '@/messages/id';

/** PWA: bisa dipasang di layar utama dan terbuka tanpa bilah peramban. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${t.site.name}: ${t.site.tagline}`,
    short_name: t.site.name,
    description: t.site.description,
    lang: 'id',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f6faf9',
    theme_color: '#0e7c74',
    categories: ['health', 'medical'],
    icons: [
      { src: '/icons/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
