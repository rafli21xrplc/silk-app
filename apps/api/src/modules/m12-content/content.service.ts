import { createHmac, timingSafeEqual } from 'node:crypto';
import { db } from '../../lib/db';
import { AppError } from '../../lib/errors';
import { env } from '../../lib/env';
import { revalidate, tags } from '../../lib/revalidate';
import { recordAudit } from '../m15-admin/audit.repo';
import { checkFields } from '../m17-content-rules/content-rules.service';

/**
 * Verifikasi header `sanity-webhook-signature` (format `t=<ms>,v1=<base64url HMAC-SHA256>`
 * atas `${t}.${body}`). Toleransi waktu 5 menit.
 */
export function verifySanitySignature(rawBody: string, header: string | undefined, secret: string, now = Date.now()): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.trim().split('=') as [string, string]));
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isFinite(t) || !v1 || Math.abs(now - t) > 5 * 60 * 1000) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('base64url');
  const a = Buffer.from(expected);
  const b = Buffer.from(v1.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'));
  return a.length === b.length && timingSafeEqual(a, b);
}

interface PortableBlock {
  _type?: string;
  children?: { text?: string }[];
}

/** Ambil teks polos dari Portable Text Sanity. */
export function portableTextToPlain(blocks: unknown): string {
  if (!Array.isArray(blocks)) return '';
  return (blocks as PortableBlock[])
    .filter((b) => b._type === 'block')
    .map((b) => (b.children ?? []).map((c) => c.text ?? '').join(''))
    .join('\n');
}

interface ArticlePayload {
  _id?: string;
  _type?: string;
  title?: string;
  description?: string;
  slug?: { current?: string } | string;
  body?: unknown;
}

/**
 * Webhook Sanity (M12): jalankan filter konten M17 pada artikel lalu picu revalidate.
 * Halaman artikel di web juga memeriksa filter sebelum render, jadi artikel yang melanggar tidak tampil.
 */
export async function handleSanityWebhook(rawBody: string, signature: string | undefined) {
  const secret = env().SANITY_WEBHOOK_SECRET;
  if (!secret || !verifySanitySignature(rawBody, signature, secret)) {
    throw new AppError('UNAUTHENTICATED', 'Tanda tangan webhook tidak valid');
  }
  let doc: ArticlePayload;
  try {
    doc = JSON.parse(rawBody) as ArticlePayload;
  } catch {
    throw new AppError('VALIDATION_FAILED', 'Body webhook bukan JSON');
  }
  const slug = typeof doc.slug === 'string' ? doc.slug : doc.slug?.current;
  const check = await checkFields({ title: doc.title, description: doc.description, body: portableTextToPlain(doc.body) });
  const status = check.blocked ? 'ditolak' : check.needsReview ? 'perlu_tinjauan' : 'lolos';
  await recordAudit(db(), {
    actorId: null,
    action: 'article.content_check',
    entity: 'article',
    entityId: doc._id ?? slug ?? 'tidak-diketahui',
    before: null,
    after: { status, violations: check.violations },
    ip: null,
    requestId: null,
  });
  await revalidate([tags.articles, ...(slug ? [tags.article(slug)] : [])]);
  return { status, violations: check.violations };
}
