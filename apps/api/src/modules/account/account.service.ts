import { isPartnerRole, type ProfileUpdateInput } from '@silk/shared';
import type { ActorContext } from '../../lib/context';
import { db } from '../../lib/db';
import { notFound } from '../../lib/errors';
import type { SessionUser } from '../../middleware/auth';
import { recordAudit } from '../m15-admin/audit.repo';
import { myFacilities } from '../m6-portal/portal.repo';
import { findByUser } from '../partners/partners.repo';
import * as repo from './account.repo';

export async function me(u: SessionUser) {
  const [profile, memberships, partner] = await Promise.all([
    repo.findProfile(db(), u.id),
    // Fase 2 (K1): semua jenis mitra mengelola profil layanan lewat memberships.
    isPartnerRole(u.role) ? myFacilities(db(), u.id) : Promise.resolve([]),
    isPartnerRole(u.role) ? findByUser(db(), u.id) : Promise.resolve(null),
  ]);
  return {
    user: {
      id: u.id,
      email: u.email,
      name: profile?.name ?? u.name,
      phone: profile?.phone ?? null,
      role: u.role,
      emailVerified: u.emailVerified,
      twoFactorEnabled: u.twoFactorEnabled,
    },
    memberships,
    partner,
  };
}

export async function updateProfile(ctx: ActorContext, input: ProfileUpdateInput) {
  const userId = ctx.actorId!;
  return db().transaction(async (tx) => {
    const before = await repo.findProfile(tx, userId);
    if (!before) throw notFound('NOT_FOUND', 'Akun');
    const after = await repo.updateProfile(tx, userId, input);
    await recordAudit(tx, {
      actorId: userId,
      action: 'account.profile.update',
      entity: 'user',
      entityId: userId,
      before,
      after,
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    return after;
  });
}
