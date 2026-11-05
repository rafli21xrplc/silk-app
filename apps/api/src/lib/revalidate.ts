import { createHmac } from 'node:crypto';
import { env, isTest } from './env';
import { logger } from './logger';

/** Tag cache ISR Next.js (bagian 2, alur 1). */
export const tags = {
  /** Halaman faskes di-cache per slug (`/faskes/[slug]`). */
  facility: (slug: string) => `facility:${slug}`,
  facilities: 'facilities',
  service: (slug: string) => `service:${slug}`,
  compare: (serviceSlug: string) => `compare:${serviceSlug}`,
  sitemap: 'sitemap',
  articles: 'articles',
  article: (slug: string) => `article:${slug}`,
  /** Fase 4b: halaman dokter (`/dokter/[slug]`) dan daftar dokter (`/dokter`). */
  practitioner: (slug: string) => `practitioner:${slug}`,
  practitioners: 'practitioners',
};

export function signRevalidateBody(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

/**
 * Panggil webhook revalidate Next.js dengan tanda tangan HMAC. Percobaan ulang singkat;
 * kegagalan hanya dicatat karena TTL ISR (maks. 1 jam) menjadi jaring pengaman.
 */
export async function revalidate(tagList: string[]): Promise<void> {
  const secret = env().REVALIDATE_SECRET;
  if (isTest() || !secret || tagList.length === 0) return;
  const body = JSON.stringify({ tags: [...new Set(tagList)] });
  const signature = signRevalidateBody(body, secret);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${env().WEB_ORIGIN}/api/revalidate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-silk-signature': signature },
        body,
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) return;
      logger.warn({ status: res.status, attempt }, 'revalidate ditolak');
    } catch (err) {
      logger.warn({ err, attempt }, 'revalidate gagal');
    }
    await new Promise((r) => setTimeout(r, 200 * attempt));
  }
}
