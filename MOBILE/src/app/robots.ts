import type { MetadataRoute } from 'next';
import { indexingAllowed } from '@/lib/indexing';

/** Bawaan: tidak diindeks (data demo berisi dokter fiktif dan foto ilustrasi). Buka dengan SILK_ALLOW_INDEXING=1. */
export default function robots(): MetadataRoute.Robots {
  return indexingAllowed() ? { rules: { userAgent: '*', allow: '/', disallow: '/api/' } } : { rules: { userAgent: '*', disallow: '/' } };
}
