import type { TariffHistoryItem } from '@silk/shared';
import { db } from '../../lib/db';
import { notFound } from '../../lib/errors';
import { toPrice } from './trust.mapper';
import * as repo from './trust.repo';

/** Label pembuat tanpa data pribadi: publik melihat peran, bukan nama orang. */
function creatorLabel(role: string | null, createdBy: string | null): string {
  if (!createdBy) return 'Sistem SILK';
  if (role === 'admin' || role === 'moderator') return 'Tim SILK';
  return 'Pengelola faskes';
}

/** Riwayat versi tarif terbit (M4). Tarif yang tidak terbit = 404. */
export async function history(tariffId: string): Promise<TariffHistoryItem[]> {
  // Paralel agar hanya satu round-trip; versi dibuang bila tarif tidak terbit.
  const [current, versions] = await Promise.all([repo.findPublishedTariff(db(), tariffId), repo.listVersions(db(), tariffId)]);
  if (!current) throw notFound('TARIFF_NOT_FOUND', 'Tarif');
  return versions.map((v) => ({
    versionNo: v.versionNo,
    price: toPrice(v),
    effectiveFrom: v.effectiveFrom,
    effectiveTo: v.effectiveTo,
    verifiedAt: v.verifiedAt ? v.verifiedAt.toISOString() : null,
    verification: v.verification,
    source: v.sourceTitle ? { kind: v.sourceKind ?? 'lainnya', title: v.sourceTitle, url: v.sourceUrl } : null,
    createdBy: { name: creatorLabel(v.creatorRole, v.createdBy) },
    createdAt: v.createdAt.toISOString(),
    current: v.id === current.versionId,
  }));
}
