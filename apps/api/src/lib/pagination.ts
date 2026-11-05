import { AppError } from './errors';

/** Kursor offset yang dienkode base64url. Cukup untuk hasil berperingkat (relevansi, jarak, harga). */
export function decodeOffsetCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { o?: unknown };
    if (typeof parsed.o === 'number' && Number.isInteger(parsed.o) && parsed.o >= 0 && parsed.o <= 10_000) {
      return parsed.o;
    }
  } catch {
    // jatuh ke error di bawah
  }
  throw new AppError('VALIDATION_FAILED', 'Kursor tidak valid', [{ path: 'cursor', message: 'Kursor tidak valid' }]);
}

export function encodeOffsetCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset }), 'utf8').toString('base64url');
}

/** Ambil `limit + 1` baris; bila lebih, ada halaman berikutnya. */
export function pageOf<T>(rows: T[], limit: number, offset: number): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  return {
    items: hasMore ? rows.slice(0, limit) : rows,
    nextCursor: hasMore ? encodeOffsetCursor(offset + limit) : null,
  };
}

export function decodeIdCursor(cursor: string | undefined): number | null {
  if (!cursor) return null;
  const n = Number(Buffer.from(cursor, 'base64url').toString('utf8'));
  if (!Number.isSafeInteger(n) || n < 1) {
    throw new AppError('VALIDATION_FAILED', 'Kursor tidak valid', [{ path: 'cursor', message: 'Kursor tidak valid' }]);
  }
  return n;
}

export function encodeIdCursor(id: number): string {
  return Buffer.from(String(id), 'utf8').toString('base64url');
}
