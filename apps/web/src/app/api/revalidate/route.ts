import { createHmac, timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';

export const runtime = 'nodejs';

/**
 * Dipanggil API setelah data berubah (bagian 2, alur 2). Body `{ tags: string[] }` ditandatangani
 * HMAC-SHA256 (hex) dengan REVALIDATE_SECRET di header `x-silk-signature`.
 */
export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return Response.json({ error: { code: 'NOT_CONFIGURED', message: 'REVALIDATE_SECRET belum diatur' } }, { status: 503 });
  const raw = await req.text();
  if (raw.length > 10_000) return Response.json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Body terlalu besar' } }, { status: 413 });
  const given = Buffer.from(req.headers.get('x-silk-signature') ?? '', 'utf8');
  const expected = Buffer.from(createHmac('sha256', secret).update(raw).digest('hex'), 'utf8');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ error: { code: 'UNAUTHENTICATED', message: 'Tanda tangan tidak valid' } }, { status: 401 });
  }
  let tags: unknown;
  try {
    tags = (JSON.parse(raw) as { tags?: unknown }).tags;
  } catch {
    return Response.json({ error: { code: 'VALIDATION_FAILED', message: 'Body bukan JSON' } }, { status: 400 });
  }
  if (!Array.isArray(tags) || tags.length > 50 || !tags.every((x) => typeof x === 'string' && /^[a-z0-9:_-]{1,120}$/.test(x))) {
    return Response.json({ error: { code: 'VALIDATION_FAILED', message: 'tags tidak valid' } }, { status: 400 });
  }
  for (const tag of tags as string[]) revalidateTag(tag);
  return Response.json({ data: { revalidated: tags } });
}
