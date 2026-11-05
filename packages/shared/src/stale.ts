import { DEFAULT_STALE_AFTER_DAYS } from './constants';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Tarif dianggap usang bila `verifiedAt` lebih lama dari `staleAfterDays` (M4).
 * Tarif tanpa `verifiedAt` tidak dihitung usang; ia tampil sebagai "belum diverifikasi".
 * Dihitung saat dibaca, tidak pernah disimpan.
 */
export function isStale(
  verifiedAt: Date | string | null | undefined,
  now: Date = new Date(),
  staleAfterDays: number = DEFAULT_STALE_AFTER_DAYS,
): boolean {
  if (!verifiedAt) return false;
  const verified = typeof verifiedAt === 'string' ? new Date(verifiedAt) : verifiedAt;
  return now.getTime() - verified.getTime() > staleAfterDays * DAY_MS;
}
