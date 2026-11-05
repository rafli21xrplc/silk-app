import { and, asc, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import {
  documents,
  facilities,
  importBatches,
  services,
  tariffChangeRequests,
  tariffs,
  tariffVersions,
  user,
  type DbOrTx,
} from '@silk/db';
import type { PriceType, ReviewStatus, TariffRequestKind } from '@silk/shared';

export interface PackagePayload {
  name: string;
  notes?: string | null;
  components: { label: string; included: boolean }[];
}

export type RequestRow = typeof tariffChangeRequests.$inferSelect;

export async function insertRequest(
  db: DbOrTx,
  v: {
    facilityId: string;
    kind: TariffRequestKind;
    tariffId: string | null;
    serviceId: string | null;
    packagePayload: PackagePayload | null;
    importBatchId: string | null;
    baseVersionNo: number | null;
    priceType: PriceType | null;
    priceMin: number | null;
    priceMax: number | null;
    effectiveFrom: string | null;
    effectiveTo: string | null;
    inclusions: string | null;
    exclusions: string | null;
    sourceTitle: string;
    sourceUrl: string | null;
    submittedBy: string | null;
  },
) {
  const [row] = await db.insert(tariffChangeRequests).values(v).returning();
  return row!;
}

/**
 * Permintaan menunggu yang akan digantikan permintaan baru: tarif yang sama, atau layanan baru
 * tanpa paket yang sama di profil yang sama.
 */
export async function pendingToSupersede(
  db: DbOrTx,
  k: { facilityId: string; tariffId: string | null; serviceId: string | null; isPackage: boolean },
) {
  if (k.isPackage) return [];
  const where = k.tariffId
    ? eq(tariffChangeRequests.tariffId, k.tariffId)
    : and(
        eq(tariffChangeRequests.facilityId, k.facilityId),
        isNull(tariffChangeRequests.tariffId),
        eq(tariffChangeRequests.serviceId, k.serviceId!),
        isNull(tariffChangeRequests.packagePayload),
      );
  return db
    .select({ id: tariffChangeRequests.id })
    .from(tariffChangeRequests)
    .where(and(where, eq(tariffChangeRequests.kind, 'tunggal'), eq(tariffChangeRequests.status, 'pending')))
    .for('update');
}

export async function markSuperseded(db: DbOrTx, ids: string[]) {
  if (ids.length === 0) return;
  await db.execute(sql`
    UPDATE tariff_change_requests SET status = 'superseded'
    WHERE id IN (SELECT (jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb))::uuid)
  `);
}

export async function findRequest(db: DbOrTx, id: string) {
  const [row] = await db.select().from(tariffChangeRequests).where(eq(tariffChangeRequests.id, id));
  return row ?? null;
}

export async function lockRequest(db: DbOrTx, id: string) {
  const result = await db.execute<{ id: string; status: ReviewStatus }>(
    sql`SELECT id, status FROM tariff_change_requests WHERE id = ${id} FOR UPDATE`,
  );
  return result.rows[0] ?? null;
}

export async function decide(
  db: DbOrTx,
  id: string,
  v: { status: 'approved' | 'rejected'; decidedBy: string | null; rejectionReason?: string; resultingVersionId?: string | null },
) {
  const [row] = await db
    .update(tariffChangeRequests)
    .set({ ...v, decidedAt: new Date() })
    .where(eq(tariffChangeRequests.id, id))
    .returning();
  return row!;
}

const documentCount = sql<number>`(SELECT count(*)::int FROM documents d
  WHERE d.tariff_change_request_id = ${tariffChangeRequests.id} AND d.confirmed_at IS NOT NULL AND d.deleted_at IS NULL)`;

const listColumns = {
  id: tariffChangeRequests.id,
  kind: tariffChangeRequests.kind,
  status: tariffChangeRequests.status,
  tariffId: tariffChangeRequests.tariffId,
  serviceId: tariffChangeRequests.serviceId,
  serviceName: services.name,
  serviceSlug: services.slug,
  packagePayload: tariffChangeRequests.packagePayload,
  importBatchId: tariffChangeRequests.importBatchId,
  importRows: importBatches.rowsValid,
  baseVersionNo: tariffChangeRequests.baseVersionNo,
  priceType: tariffChangeRequests.priceType,
  priceMin: tariffChangeRequests.priceMin,
  priceMax: tariffChangeRequests.priceMax,
  effectiveFrom: tariffChangeRequests.effectiveFrom,
  effectiveTo: tariffChangeRequests.effectiveTo,
  inclusions: tariffChangeRequests.inclusions,
  exclusions: tariffChangeRequests.exclusions,
  sourceTitle: tariffChangeRequests.sourceTitle,
  sourceUrl: tariffChangeRequests.sourceUrl,
  rejectionReason: tariffChangeRequests.rejectionReason,
  createdAt: tariffChangeRequests.createdAt,
  decidedAt: tariffChangeRequests.decidedAt,
  documentCount,
};

export function listForFacility(db: DbOrTx, facilityId: string, limit: number) {
  return db
    .select(listColumns)
    .from(tariffChangeRequests)
    .leftJoin(services, eq(services.id, tariffChangeRequests.serviceId))
    .leftJoin(importBatches, eq(importBatches.id, tariffChangeRequests.importBatchId))
    .where(eq(tariffChangeRequests.facilityId, facilityId))
    .orderBy(desc(tariffChangeRequests.createdAt), desc(tariffChangeRequests.id))
    .limit(limit);
}

export function queue(db: DbOrTx, f: { status: ReviewStatus; limit: number; offset: number }) {
  return db
    .select({
      ...listColumns,
      facilityId: facilities.id,
      facilityName: facilities.name,
      facilitySlug: facilities.slug,
      submitterEmail: user.email,
    })
    .from(tariffChangeRequests)
    .innerJoin(facilities, eq(facilities.id, tariffChangeRequests.facilityId))
    .leftJoin(services, eq(services.id, tariffChangeRequests.serviceId))
    .leftJoin(importBatches, eq(importBatches.id, tariffChangeRequests.importBatchId))
    .leftJoin(user, eq(user.id, tariffChangeRequests.submittedBy))
    .where(eq(tariffChangeRequests.status, f.status))
    .orderBy(asc(tariffChangeRequests.createdAt), asc(tariffChangeRequests.id))
    .limit(f.limit + 1)
    .offset(f.offset);
}

/** Harga yang sedang berlaku untuk tarif (versi saat ini), untuk perbandingan lama/baru. */
export async function currentVersionOf(db: DbOrTx, tariffId: string) {
  const [row] = await db
    .select({
      versionNo: tariffVersions.versionNo,
      priceType: tariffVersions.priceType,
      priceMin: tariffVersions.priceMin,
      priceMax: tariffVersions.priceMax,
      effectiveFrom: tariffVersions.effectiveFrom,
      effectiveTo: tariffVersions.effectiveTo,
      inclusions: tariffVersions.inclusions,
      exclusions: tariffVersions.exclusions,
      verification: tariffVersions.verification,
      tariffStatus: tariffs.status,
      active: tariffs.active,
    })
    .from(tariffs)
    .leftJoin(tariffVersions, eq(tariffVersions.id, tariffs.currentVersionId))
    .where(eq(tariffs.id, tariffId));
  return row ?? null;
}

export async function facilityOf(db: DbOrTx, facilityId: string) {
  const [row] = await db
    .select({ id: facilities.id, name: facilities.name, slug: facilities.slug, status: facilities.status, type: facilities.type })
    .from(facilities)
    .where(eq(facilities.id, facilityId));
  return row ?? null;
}

export async function submitterEmail(db: DbOrTx, userId: string | null) {
  if (!userId) return null;
  const [row] = await db.select({ email: user.email, name: user.name }).from(user).where(eq(user.id, userId));
  return row ?? null;
}

export async function setTariffActive(db: DbOrTx, tariffId: string, active: boolean) {
  await db.update(tariffs).set({ active }).where(eq(tariffs.id, tariffId));
}

/* ---------- Dokumen bukti (K10) ---------- */

export async function insertDocument(
  db: DbOrTx,
  v: { tariffChangeRequestId: string; objectKey: string; fileName: string; mime: string; sizeBytes: number },
) {
  const [row] = await db.insert(documents).values(v).returning();
  return row!;
}

export async function findDocument(db: DbOrTx, requestId: string, documentId: string) {
  const [row] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.tariffChangeRequestId, requestId), isNull(documents.deletedAt)));
  return row ?? null;
}

export async function confirmDocument(db: DbOrTx, id: string, sizeBytes: number) {
  await db.update(documents).set({ confirmedAt: new Date(), sizeBytes }).where(eq(documents.id, id));
}

export async function deleteDocumentRow(db: DbOrTx, id: string) {
  await db.update(documents).set({ deletedAt: new Date() }).where(eq(documents.id, id));
}

export function confirmedDocuments(db: DbOrTx, requestId: string) {
  return db
    .select()
    .from(documents)
    .where(and(eq(documents.tariffChangeRequestId, requestId), isNotNull(documents.confirmedAt), isNull(documents.deletedAt)))
    .orderBy(asc(documents.uploadedAt));
}
