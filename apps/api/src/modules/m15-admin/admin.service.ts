import type { AuditQuery, EntityStatus, VerificationLevel } from '@silk/shared';
import { db } from '../../lib/db';
import type { ActorContext } from '../../lib/context';
import { notFound } from '../../lib/errors';
import { decodeIdCursor, decodeOffsetCursor, encodeIdCursor, pageOf } from '../../lib/pagination';
import { revalidate, tags } from '../../lib/revalidate';
import { revalidatePractitionersOfFacilities } from '../m1-directory/practitioner-cache';
import * as writeRepo from '../m2-tariffs/tariff-write.repo';
import { afterAdminFacilityUpdate } from '../profiles/profiles.service';
import * as repo from './admin.repo';
import { recordAudit, searchAudit } from './audit.repo';

export async function listFacilities(q: { status?: EntityStatus; q?: string; limit: number; cursor?: string }) {
  const offset = decodeOffsetCursor(q.cursor);
  return pageOf(await repo.listFacilities(db(), { ...q, offset }), q.limit, offset);
}

export async function updateFacility(
  ctx: ActorContext,
  id: string,
  input: { status?: EntityStatus; verification?: VerificationLevel; lat?: number; lng?: number },
) {
  const after = await db().transaction(async (tx) => {
    const before = await repo.findFacility(tx, id);
    if (!before) throw notFound('FACILITY_NOT_FOUND', 'Faskes');
    await repo.updateFacility(tx, id, input);
    // Praktisi milik mitra ikut status profil; koreksi koordinat ikut ke lokasi utama (Fase 2).
    await afterAdminFacilityUpdate(tx, id, input);
    const updated = await repo.findFacility(tx, id);
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: 'facility.admin_update',
      entity: 'facility',
      entityId: id,
      before,
      after: updated,
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    return updated!;
  });
  await revalidate([tags.facility(after.slug), tags.facilities, tags.sitemap]);
  await revalidatePractitionersOfFacilities([id]);
  return after;
}

export async function tariffQueue(q: { status?: string; limit: number; cursor?: string }) {
  const offset = decodeOffsetCursor(q.cursor);
  const status = (q.status as EntityStatus | undefined) ?? 'menunggu_tinjauan';
  return pageOf(await repo.tariffQueue(db(), { status, limit: q.limit, offset }), q.limit, offset);
}

/** Moderator menerbitkan atau menarik tarif (status tarif; versi tidak diubah). */
export async function setTariffStatus(ctx: ActorContext, tariffId: string, status: 'terbit' | 'ditarik') {
  const result = await db().transaction(async (tx) => {
    const before = await writeRepo.findTariffWithFacility(tx, tariffId);
    if (!before) throw notFound('TARIFF_NOT_FOUND', 'Tarif');
    const after = await writeRepo.setTariffStatus(tx, tariffId, status);
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: status === 'terbit' ? 'tariff.publish' : 'tariff.withdraw',
      entity: 'tariff',
      entityId: tariffId,
      before: { status: before.status },
      after: { status: after?.status },
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    return { id: tariffId, status, facilitySlug: before.facilitySlug, facilityId: before.facilityId };
  });
  await revalidate([tags.facility(result.facilitySlug)]);
  await revalidatePractitionersOfFacilities([result.facilityId]);
  return { id: result.id, status: result.status };
}

export async function auditLogs(q: AuditQuery) {
  const rows = await searchAudit(db(), { ...q, beforeId: decodeIdCursor(q.cursor), limit: q.limit });
  const hasMore = rows.length > q.limit;
  const items = hasMore ? rows.slice(0, q.limit) : rows;
  return { items, nextCursor: hasMore ? encodeIdCursor(items[items.length - 1]!.id) : null };
}

export function overview() {
  return repo.queueCounts(db());
}
