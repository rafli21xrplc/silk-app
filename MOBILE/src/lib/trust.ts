/** Tingkat verifikasi yang paling banyak dipakai; disebut sekali di kepala daftar. */
export function commonVerification(trusts: readonly { verification: string }[]): string | null {
  const counts = new Map<string, number>();
  for (const x of trusts) counts.set(x.verification, (counts.get(x.verification) ?? 0) + 1);
  let best: string | null = null;
  let n = 0;
  for (const [level, c] of counts) if (c > n) [best, n] = [level, c];
  return best;
}

export type TrustFlag = 'stale' | 'verification';

/**
 * Penanda per baris: hanya yang berbeda dari keterangan kepala daftar.
 * Tarif lama selalu ditandai; tingkat verifikasi ditandai bila tidak sama dengan `common`.
 */
export function trustFlags(trust: { verification: string; stale: boolean }, common: string | null): TrustFlag[] {
  const flags: TrustFlag[] = [];
  if (trust.stale) flags.push('stale');
  if (trust.verification !== common) flags.push('verification');
  return flags;
}
