import type { Tx } from '@silk/db';
import type { PriceType, VerificationLevel } from '@silk/shared';
import { AppError, notFound } from '../../lib/errors';
import * as repo from './tariff-write.repo';

export interface VersionInput {
  priceType: PriceType;
  priceMin?: number | null;
  priceMax?: number | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  inclusions?: string | null;
  exclusions?: string | null;
}

/**
 * Tambah versi baru dan perbarui `current_version_id` dalam transaksi yang sama (M2).
 * `expectedVersionNo` (opsional) mencegah penimpaan bersamaan: beda = TARIFF_VERSION_CONFLICT.
 */
export async function appendVersion(
  tx: Tx,
  args: {
    tariffId: string;
    input: VersionInput;
    verification: VerificationLevel;
    verifiedAt: Date | null;
    sourceId: string | null;
    createdBy: string | null;
    expectedVersionNo?: number;
    status?: 'draft' | 'menunggu_tinjauan' | 'terbit' | 'ditarik';
  },
) {
  const locked = await repo.lockTariff(tx, args.tariffId);
  if (!locked) throw notFound('TARIFF_NOT_FOUND', 'Tarif');
  const previous = await repo.latestVersion(tx, args.tariffId);
  const currentNo = previous?.versionNo ?? 0;
  if (args.expectedVersionNo !== undefined && args.expectedVersionNo !== currentNo) {
    throw new AppError(
      'TARIFF_VERSION_CONFLICT',
      `Tarif sudah diubah orang lain (versi ${currentNo}); muat ulang lalu coba lagi`,
    );
  }
  const isAsk = args.input.priceType === 'tanya';
  const created = await repo.insertVersion(tx, {
    tariffId: args.tariffId,
    versionNo: currentNo + 1,
    priceType: args.input.priceType,
    priceMin: isAsk ? null : args.input.priceMin ?? null,
    priceMax: isAsk ? null : args.input.priceMax ?? null,
    effectiveFrom: args.input.effectiveFrom,
    effectiveTo: args.input.effectiveTo ?? null,
    verifiedAt: args.verifiedAt,
    verification: args.verification,
    sourceId: args.sourceId,
    inclusions: args.input.inclusions ?? null,
    exclusions: args.input.exclusions ?? null,
    createdBy: args.createdBy,
  });
  await repo.setCurrentVersion(tx, args.tariffId, created.id, args.status);
  return { previous, created, tariff: locked };
}
