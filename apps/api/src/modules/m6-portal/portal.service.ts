import { db } from '../../lib/db';
import type { ActorContext } from '../../lib/context';
import { assertMember } from '../profiles/profiles.guard';
import * as repo from './portal.repo';

/**
 * Sumber data untuk harga dari mitra. Sejak Fase 2 (K4) harga mitra tidak lagi terbit langsung:
 * profil dan harga diubah lewat modul `profiles` dan `tariff-requests`, lalu dimoderasi.
 */
export const FASKES_SOURCE = { kind: 'faskes', title: 'Papan tarif faskes' } as const;

export function listMyFacilities(ctx: ActorContext) {
  return repo.myFacilities(db(), ctx.actorId!);
}

export async function listTariffs(ctx: ActorContext, facilityId: string) {
  await assertMember(ctx, facilityId);
  const rows = await repo.facilityTariffs(db(), facilityId);
  return rows.map((r) => ({
    ...r,
    verifiedAt: r.verifiedAt ? r.verifiedAt.toISOString() : null,
    updatedAt: r.updatedAt ? r.updatedAt.toISOString() : null,
  }));
}
