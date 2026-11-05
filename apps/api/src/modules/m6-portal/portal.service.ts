import type { EntityStatus, FacilityUpdateInput, TariffCreateInput, TariffUpdateInput, VerificationLevel } from '@silk/shared';
import { db } from '../../lib/db';
import type { ActorContext } from '../../lib/context';
import { sendEmail } from '../../lib/email';
import { AppError, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { revalidate, tags } from '../../lib/revalidate';
import { recordAudit } from '../m15-admin/audit.repo';
import { assertContentAllowed } from '../m17-content-rules/content-rules.service';
import { appendVersion } from '../m2-tariffs/tariff-versions.service';
import * as writeRepo from '../m2-tariffs/tariff-write.repo';
import { findServiceById } from '../m2-tariffs/tariffs.repo';
import * as repo from './portal.repo';

/** Faskes dianggap terverifikasi setelah klaim disetujui admin (M7). */
export const isFacilityVerified = (v: VerificationLevel) => v === 'diverifikasi_admin';

export const FASKES_SOURCE = { kind: 'faskes', title: 'Papan tarif faskes' } as const;

/**
 * Status tarif dari portal (M6): langsung terbit bila faskes terverifikasi, selain itu menunggu
 * tinjauan. Teks yang cocok aturan `tinjau` (M17) juga menunggu tinjauan. Tarif yang ditarik admin
 * tetap ditarik.
 */
export function portalTariffStatus(
  facilityVerification: VerificationLevel,
  needsReview: boolean,
  currentStatus?: EntityStatus,
): EntityStatus {
  if (currentStatus === 'ditarik') return 'ditarik';
  return isFacilityVerified(facilityVerification) && !needsReview ? 'terbit' : 'menunggu_tinjauan';
}

async function assertMember(ctx: ActorContext, facilityId: string) {
  if (!ctx.actorId || !(await repo.isMember(db(), ctx.actorId, facilityId))) {
    throw new AppError('FORBIDDEN', 'Anda tidak mengelola faskes ini');
  }
}

export function listMyFacilities(ctx: ActorContext) {
  return repo.myFacilities(db(), ctx.actorId!);
}

export async function getFacility(ctx: ActorContext, facilityId: string) {
  await assertMember(ctx, facilityId);
  const f = await repo.findFacility(db(), facilityId);
  if (!f) throw notFound('FACILITY_NOT_FOUND', 'Faskes');
  return { ...f, updatedAt: f.updatedAt.toISOString() };
}

export async function updateFacility(ctx: ActorContext, facilityId: string, input: FacilityUpdateInput) {
  await assertMember(ctx, facilityId);
  const { needsReview } = await assertContentAllowed({ name: input.name, description: input.description });
  const result = await db().transaction(async (tx) => {
    const before = await repo.findFacility(tx, facilityId);
    if (!before) throw notFound('FACILITY_NOT_FOUND', 'Faskes');
    await repo.updateFacility(tx, facilityId, {
      ...input,
      ...(needsReview && before.status === 'terbit' ? { status: 'menunggu_tinjauan' as const } : {}),
    });
    const after = await repo.findFacility(tx, facilityId);
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: 'facility.update',
      entity: 'facility',
      entityId: facilityId,
      before,
      after,
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    return after!;
  });
  await revalidate([tags.facility(result.slug), tags.facilities, tags.sitemap]);
  return { ...result, updatedAt: result.updatedAt.toISOString(), needsReview };
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

function contentFieldsOf(input: {
  inclusions?: string | null;
  exclusions?: string | null;
  package?: { name: string; notes?: string | null; components: { label: string }[] };
}) {
  return {
    inclusions: input.inclusions,
    exclusions: input.exclusions,
    packageName: input.package?.name,
    packageNotes: input.package?.notes,
    components: input.package?.components.map((c) => c.label).join('; '),
  };
}

export async function createTariff(ctx: ActorContext, facilityId: string, input: TariffCreateInput) {
  await assertMember(ctx, facilityId);
  const service = await findServiceById(db(), input.serviceId);
  if (!service) throw notFound('SERVICE_NOT_FOUND', 'Layanan');
  const { needsReview } = await assertContentAllowed(contentFieldsOf(input));
  const facility = await repo.findFacility(db(), facilityId);
  if (!facility) throw notFound('FACILITY_NOT_FOUND', 'Faskes');

  const result = await db().transaction(async (tx) => {
    const pkg = input.package
      ? await writeRepo.insertPackage(tx, {
          facilityId,
          serviceId: service.id,
          name: input.package.name,
          notes: input.package.notes ?? null,
          components: input.package.components,
        })
      : null;
    if (!pkg && (await writeRepo.findTariffByKey(tx, facilityId, service.id, null))) {
      throw new AppError('CONFLICT', 'Tarif untuk layanan ini sudah ada; ubah tarif yang ada untuk membuat versi baru');
    }
    const status = portalTariffStatus(facility.verification, needsReview);
    const tariff = await writeRepo.insertTariff(tx, { facilityId, serviceId: service.id, packageId: pkg?.id ?? null, status: 'draft' });
    const sourceId = await writeRepo.upsertDataSource(tx, FASKES_SOURCE.kind, FASKES_SOURCE.title, null);
    const { created } = await appendVersion(tx, {
      tariffId: tariff.id,
      input,
      verification: 'diisi_faskes',
      verifiedAt: new Date(),
      sourceId,
      createdBy: ctx.actorId,
      status,
    });
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: 'tariff.create',
      entity: 'tariff',
      entityId: tariff.id,
      before: null,
      after: { tariff: { ...tariff, status }, version: created, package: input.package ?? null },
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    return { id: tariff.id, status, versionNo: created.versionNo, needsReview };
  });
  await revalidate([tags.facility(facility.slug), tags.service(service.slug), tags.compare(service.slug)]);
  return result;
}

export async function updateTariff(ctx: ActorContext, tariffId: string, input: TariffUpdateInput) {
  const tariff = await writeRepo.findTariffWithFacility(db(), tariffId);
  if (!tariff) throw notFound('TARIFF_NOT_FOUND', 'Tarif');
  await assertMember(ctx, tariff.facilityId);
  if (input.priceType === 'paket' && !tariff.packageId) {
    throw new AppError('VALIDATION_FAILED', 'Tarif ini tidak terkait paket', [
      { path: 'priceType', message: 'Tipe paket hanya untuk tarif yang terkait paket' },
    ]);
  }
  const { needsReview } = await assertContentAllowed(contentFieldsOf(input));
  const service = await findServiceById(db(), tariff.serviceId);

  const result = await db().transaction(async (tx) => {
    const status = portalTariffStatus(tariff.facilityVerification, needsReview, tariff.status);
    const sourceId = await writeRepo.upsertDataSource(tx, FASKES_SOURCE.kind, FASKES_SOURCE.title, null);
    const { previous, created } = await appendVersion(tx, {
      tariffId,
      input,
      verification: 'diisi_faskes',
      verifiedAt: new Date(),
      sourceId,
      createdBy: ctx.actorId,
      expectedVersionNo: input.expectedVersionNo,
      status,
    });
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: 'tariff.version.create',
      entity: 'tariff',
      entityId: tariffId,
      before: previous,
      after: created,
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    return { id: tariffId, status, versionNo: created.versionNo, needsReview };
  });

  await revalidate([
    tags.facility(tariff.facilitySlug),
    ...(service ? [tags.service(service.slug), tags.compare(service.slug)] : []),
  ]);
  // Notifikasi perubahan tarif ke semua pengelola (mitigasi akun diambil alih, bagian 8).
  try {
    const emails = await repo.memberEmails(db(), tariff.facilityId);
    await Promise.all(
      emails.map((to) =>
        sendEmail({
          kind: 'tariff-changed',
          to,
          subject: `Tarif ${service?.name ?? ''} di ${tariff.facilityName} diubah`,
          text: `Tarif ${service?.name ?? ''} di ${tariff.facilityName} baru saja diubah menjadi versi ${result.versionNo}.\n\nBila bukan Anda atau rekan Anda yang mengubahnya, segera ganti kata sandi dan hubungi tim SILK.`,
        }),
      ),
    );
  } catch (err) {
    logger.warn({ err }, 'gagal mengirim notifikasi perubahan tarif');
  }
  return result;
}
