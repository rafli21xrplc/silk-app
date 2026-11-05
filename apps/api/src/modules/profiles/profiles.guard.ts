import type { DbOrTx } from '@silk/db';
import { db } from '../../lib/db';
import type { ActorContext } from '../../lib/context';
import { AppError } from '../../lib/errors';
import { isMember } from '../m6-portal/portal.repo';
import { partnerOfUser } from './profiles.repo';

/** Membuat profil, revisi, harga, dan media mensyaratkan mitra terverifikasi (K11). */
export async function assertVerifiedPartner(ctx: ActorContext, database: DbOrTx = db()) {
  const partner = ctx.actorId ? await partnerOfUser(database, ctx.actorId) : null;
  if (!partner || partner.status !== 'verified') {
    throw new AppError('PARTNER_NOT_VERIFIED', 'Data mitra Anda belum diverifikasi admin');
  }
  return partner;
}

/** Pengelola profil = anggota `memberships`. Rute juga memakai requireFacilityAccess; ini lapis kedua. */
export async function assertMember(ctx: ActorContext, facilityId: string) {
  if (!ctx.actorId || !(await isMember(db(), ctx.actorId, facilityId))) {
    throw new AppError('FORBIDDEN', 'Anda tidak mengelola profil ini');
  }
}
