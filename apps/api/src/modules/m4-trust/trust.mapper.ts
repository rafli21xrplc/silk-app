import { isStale, type Price, type PriceType, type Trust, type VerificationLevel } from '@silk/shared';
import { env } from '../../lib/env';

export interface VersionLike {
  priceType: PriceType;
  priceMin: number | null;
  priceMax: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  verifiedAt: Date | null;
  verification: VerificationLevel;
  sourceKind: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  sourceDocumentDate: string | null;
}

export function toPrice(v: Pick<VersionLike, 'priceType' | 'priceMin' | 'priceMax'>): Price {
  // Tarif `tanya` tidak pernah membawa angka (M2).
  if (v.priceType === 'tanya') return { type: 'tanya', min: null, max: null, currency: 'IDR' };
  return { type: v.priceType, min: v.priceMin, max: v.priceMax, currency: 'IDR' };
}

/**
 * Konteks kepercayaan (M4). `stale` dihitung saat dibaca dari `verified_at` dan batas hari
 * yang dikonfigurasi; tidak disimpan. Jam sistem yang dimajukan langsung memengaruhi hasil.
 */
export function toTrust(v: VersionLike, now: Date = new Date()): Trust {
  return {
    effectiveFrom: v.effectiveFrom,
    effectiveTo: v.effectiveTo,
    verifiedAt: v.verifiedAt ? v.verifiedAt.toISOString() : null,
    verification: v.verification,
    stale: isStale(v.verifiedAt, now, env().STALE_AFTER_DAYS),
    source: v.sourceTitle
      ? { kind: v.sourceKind ?? 'lainnya', title: v.sourceTitle, url: v.sourceUrl, documentDate: v.sourceDocumentDate }
      : null,
  };
}
