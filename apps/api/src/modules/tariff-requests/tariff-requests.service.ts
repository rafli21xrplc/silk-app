import { randomUUID } from 'node:crypto';
import {
  DOCUMENT_ALLOWED_MIME,
  DOCUMENT_MAX_BYTES,
  type DocumentPresignInput,
  type ReviewStatus,
  type TariffCreateInput,
  type TariffUpdateInput,
} from '@silk/shared';
import { db } from '../../lib/db';
import type { ActorContext } from '../../lib/context';
import { sendEmail } from '../../lib/email';
import { AppError, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { decodeOffsetCursor, pageOf } from '../../lib/pagination';
import { revalidate, tags } from '../../lib/revalidate';
import { sniffMime, storage } from '../../lib/storage';
import { recordAudit } from '../m15-admin/audit.repo';
import { assertContentAllowed } from '../m17-content-rules/content-rules.service';
import { appendVersion } from '../m2-tariffs/tariff-versions.service';
import * as writeRepo from '../m2-tariffs/tariff-write.repo';
import { findServiceById } from '../m2-tariffs/tariffs.repo';
import { getBatch, processBatch, publishBatchTx, revalidateFacilities } from '../m5-imports/imports.service';
import * as importsRepo from '../m5-imports/imports.repo';
import { memberEmails } from '../m6-portal/portal.repo';
import { FASKES_SOURCE } from '../m6-portal/portal.service';
import { assertMember, assertVerifiedPartner } from '../profiles/profiles.guard';
import * as repo from './tariff-requests.repo';

/** Masa berlaku signed URL dokumen bukti untuk moderator. */
const VIEW_URL_TTL_SEC = 300;
/** Batas daftar permintaan per profil di portal. */
const PORTAL_LIST_LIMIT = 100;

type RequestRow = repo.RequestRow;

function contentFieldsOf(input: {
  inclusions?: string | null;
  exclusions?: string | null;
  package?: { name: string; notes?: string | null; components: { label: string }[] } | null;
}) {
  return {
    inclusions: input.inclusions,
    exclusions: input.exclusions,
    packageName: input.package?.name,
    packageNotes: input.package?.notes,
    components: input.package?.components.map((c) => c.label).join('; '),
  };
}

function view(r: RequestRow) {
  return {
    id: r.id,
    kind: r.kind,
    status: r.status,
    facilityId: r.facilityId,
    tariffId: r.tariffId,
    serviceId: r.serviceId,
    package: r.packagePayload as repo.PackagePayload | null,
    importBatchId: r.importBatchId,
    baseVersionNo: r.baseVersionNo,
    priceType: r.priceType,
    priceMin: r.priceMin,
    priceMax: r.priceMax,
    effectiveFrom: r.effectiveFrom,
    effectiveTo: r.effectiveTo,
    inclusions: r.inclusions,
    exclusions: r.exclusions,
    sourceTitle: r.sourceTitle,
    sourceUrl: r.sourceUrl,
    rejectionReason: r.rejectionReason,
    resultingVersionId: r.resultingVersionId,
    createdAt: r.createdAt.toISOString(),
    decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
  };
}

/** Pemberitahuan ke semua pengelola (mitigasi akun diambil alih, bagian 8 blueprint). */
async function notifyMembers(facilityId: string, subject: string, text: string) {
  try {
    const emails = await memberEmails(db(), facilityId);
    await Promise.all(emails.map((to) => sendEmail({ kind: 'tariff-request', to, subject, text })));
  } catch (err) {
    logger.warn({ err }, 'gagal mengirim pemberitahuan permintaan harga');
  }
}

/* ---------- Portal: ajukan harga ---------- */

/**
 * Harga untuk layanan baru di profil (K4). Tidak ada `tariff_versions` yang ditulis sampai moderator
 * menyetujui; publik tidak melihat apa pun sebelum itu.
 */
export async function requestNewTariff(ctx: ActorContext, facilityId: string, input: TariffCreateInput) {
  await assertMember(ctx, facilityId);
  await assertVerifiedPartner(ctx);
  const service = await findServiceById(db(), input.serviceId);
  if (!service) throw notFound('SERVICE_NOT_FOUND', 'Layanan');
  const { needsReview } = await assertContentAllowed(contentFieldsOf(input));

  const created = await db().transaction(async (tx) => {
    if (!input.package && (await writeRepo.findTariffByKey(tx, facilityId, service.id, null))) {
      throw new AppError('CONFLICT', 'Tarif untuk layanan ini sudah ada; ajukan perubahan pada tarif tersebut');
    }
    const superseded = await repo.pendingToSupersede(tx, { facilityId, tariffId: null, serviceId: service.id, isPackage: !!input.package });
    await repo.markSuperseded(tx, superseded.map((r) => r.id));
    const row = await repo.insertRequest(tx, {
      facilityId,
      kind: 'tunggal',
      tariffId: null,
      serviceId: service.id,
      packagePayload: input.package
        ? { name: input.package.name, notes: input.package.notes ?? null, components: input.package.components }
        : null,
      importBatchId: null,
      baseVersionNo: null,
      ...priceFields(input),
      sourceTitle: input.sourceTitle,
      sourceUrl: input.sourceUrl ?? null,
      submittedBy: ctx.actorId,
    });
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: 'tariff.request.create',
      entity: 'tariff_change_request',
      entityId: row.id,
      before: superseded.length ? { superseded: superseded.map((r) => r.id) } : null,
      after: view(row),
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    return row;
  });
  await notifyMembers(
    facilityId,
    `Permintaan harga ${service.name} diajukan`,
    `Permintaan harga baru untuk ${service.name} telah diajukan dan menunggu tinjauan moderator SILK.\n\nBila bukan Anda atau rekan Anda yang mengajukannya, segera ganti kata sandi dan hubungi tim SILK.`,
  );
  return { requestId: created.id, status: created.status, needsReview };
}

/** Perubahan harga tarif yang sudah ada (K4). `expectedVersionNo` dicek sekarang dan saat disetujui. */
export async function requestTariffChange(ctx: ActorContext, tariffId: string, input: TariffUpdateInput) {
  const tariff = await writeRepo.findTariffWithFacility(db(), tariffId);
  if (!tariff) throw notFound('TARIFF_NOT_FOUND', 'Tarif');
  await assertMember(ctx, tariff.facilityId);
  await assertVerifiedPartner(ctx);
  if (input.priceType === 'paket' && !tariff.packageId) {
    throw new AppError('VALIDATION_FAILED', 'Tarif ini tidak terkait paket', [
      { path: 'priceType', message: 'Tipe paket hanya untuk tarif yang terkait paket' },
    ]);
  }
  if (tariff.status === 'ditarik') throw new AppError('CONFLICT', 'Tarif ini ditarik admin dan tidak dapat diubah');
  const { needsReview } = await assertContentAllowed(contentFieldsOf(input));
  const service = await findServiceById(db(), tariff.serviceId);

  const created = await db().transaction(async (tx) => {
    const current = await writeRepo.latestVersion(tx, tariffId);
    const currentNo = current?.versionNo ?? 0;
    if (input.expectedVersionNo !== currentNo) {
      throw new AppError('TARIFF_VERSION_CONFLICT', `Tarif sudah berubah (versi ${currentNo}); muat ulang lalu coba lagi`);
    }
    const superseded = await repo.pendingToSupersede(tx, { facilityId: tariff.facilityId, tariffId, serviceId: null, isPackage: false });
    await repo.markSuperseded(tx, superseded.map((r) => r.id));
    const row = await repo.insertRequest(tx, {
      facilityId: tariff.facilityId,
      kind: 'tunggal',
      tariffId,
      serviceId: tariff.serviceId,
      packagePayload: null,
      importBatchId: null,
      baseVersionNo: currentNo,
      ...priceFields(input),
      sourceTitle: input.sourceTitle,
      sourceUrl: input.sourceUrl ?? null,
      submittedBy: ctx.actorId,
    });
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: 'tariff.request.create',
      entity: 'tariff_change_request',
      entityId: row.id,
      before: current,
      after: { request: view(row), superseded: superseded.map((r) => r.id) },
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    return row;
  });
  await notifyMembers(
    tariff.facilityId,
    `Perubahan harga ${service?.name ?? ''} di ${tariff.facilityName} diajukan`,
    `Perubahan harga ${service?.name ?? ''} di ${tariff.facilityName} telah diajukan dan menunggu tinjauan moderator SILK. Harga lama tetap tampil sampai disetujui.\n\nBila bukan Anda atau rekan Anda yang mengajukannya, segera ganti kata sandi dan hubungi tim SILK.`,
  );
  return { requestId: created.id, status: created.status, needsReview };
}

function priceFields(input: {
  priceType: TariffCreateInput['priceType'];
  priceMin?: number | null;
  priceMax?: number | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  inclusions?: string | null;
  exclusions?: string | null;
}) {
  const isAsk = input.priceType === 'tanya';
  return {
    priceType: input.priceType,
    priceMin: isAsk ? null : input.priceMin ?? null,
    priceMax: isAsk ? null : input.priceMax ?? null,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo ?? null,
    inclusions: input.inclusions ?? null,
    exclusions: input.exclusions ?? null,
  };
}

/**
 * Impor CSV portal (M6, K4): divalidasi langsung (maks. 2.000 baris, semua baris wajib milik profil
 * sendiri), lalu menjadi SATU permintaan harga. Batch baru terbit saat moderator menyetujui.
 */
export async function requestImport(
  ctx: ActorContext,
  facilityId: string,
  input: { objectKey: string; sourceTitle?: string; sourceUrl?: string | null },
) {
  await assertMember(ctx, facilityId);
  await assertVerifiedPartner(ctx);
  if (!input.objectKey.startsWith(`imports/facility/${facilityId}/`)) {
    // Kunci objek dari profil lain tidak boleh dipakai.
    throw new AppError('FORBIDDEN', 'Berkas bukan milik profil ini');
  }
  const batch = await db().transaction(async (tx) => {
    const b = await importsRepo.insertBatch(tx, { objectKey: input.objectKey, facilityId, sourceKind: FASKES_SOURCE.kind, uploadedBy: ctx.actorId });
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: 'import.create',
      entity: 'import_batch',
      entityId: b.id,
      before: null,
      after: b,
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    return b;
  });
  // Berkas portal kecil: diproses langsung dalam request.
  await processBatch(batch.id, { timeBudgetMs: 60_000 });
  const processed = await getBatch(batch.id, undefined, 200);
  if (processed.batch.status !== 'divalidasi') {
    throw new AppError(
      'IMPORT_ROW_INVALID',
      processed.batch.error ?? 'Berkas ditolak',
      processed.problemRows.flatMap((r) =>
        r.errors.map((e) => ({ path: `baris ${r.rowNo}.${e.field}`, message: e.message, code: e.code })),
      ),
    );
  }
  const rowsValid = processed.batch.rowsValid ?? 0;
  const created = await db().transaction(async (tx) => {
    const row = await repo.insertRequest(tx, {
      facilityId,
      kind: 'impor',
      tariffId: null,
      serviceId: null,
      packagePayload: null,
      importBatchId: batch.id,
      baseVersionNo: null,
      priceType: null,
      priceMin: null,
      priceMax: null,
      effectiveFrom: null,
      effectiveTo: null,
      inclusions: null,
      exclusions: null,
      sourceTitle: input.sourceTitle ?? `Impor CSV (${rowsValid} baris)`,
      sourceUrl: input.sourceUrl ?? null,
      submittedBy: ctx.actorId,
    });
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: 'tariff.request.create',
      entity: 'tariff_change_request',
      entityId: row.id,
      before: null,
      after: { ...view(row), rowsValid },
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    return row;
  });
  await notifyMembers(
    facilityId,
    'Impor harga diajukan',
    `Impor ${rowsValid} baris harga telah diajukan dan menunggu tinjauan moderator SILK.\n\nBila bukan Anda atau rekan Anda yang mengajukannya, segera ganti kata sandi dan hubungi tim SILK.`,
  );
  return { batchId: batch.id, requestId: created.id, status: created.status, rowsValid };
}

export async function listForFacility(ctx: ActorContext, facilityId: string) {
  await assertMember(ctx, facilityId);
  const rows = await repo.listForFacility(db(), facilityId, PORTAL_LIST_LIMIT);
  return rows.map((r) => ({
    ...r,
    package: r.packagePayload as repo.PackagePayload | null,
    packagePayload: undefined,
    createdAt: r.createdAt.toISOString(),
    decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
  }));
}

/** Layanan aktif/nonaktif (K5): hanya menyembunyikan info, jadi berlaku langsung. */
export async function setActive(ctx: ActorContext, tariffId: string, active: boolean) {
  const tariff = await writeRepo.findTariffWithFacility(db(), tariffId);
  if (!tariff) throw notFound('TARIFF_NOT_FOUND', 'Tarif');
  await assertMember(ctx, tariff.facilityId);
  const service = await findServiceById(db(), tariff.serviceId);
  const before = await repo.currentVersionOf(db(), tariffId);
  await db().transaction(async (tx) => {
    await repo.setTariffActive(tx, tariffId, active);
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: 'tariff.active.toggle',
      entity: 'tariff',
      entityId: tariffId,
      before: { active: before?.active ?? null },
      after: { active },
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
  });
  await revalidate([
    tags.facility(tariff.facilitySlug),
    ...(service ? [tags.service(service.slug), tags.compare(service.slug)] : []),
  ]);
  return { id: tariffId, active };
}

/* ---------- Dokumen bukti ---------- */

async function ownPendingRequest(ctx: ActorContext, requestId: string) {
  const r = await repo.findRequest(db(), requestId);
  if (!r) throw notFound('TARIFF_REQUEST_NOT_FOUND', 'Permintaan harga');
  await assertMember(ctx, r.facilityId);
  if (r.status !== 'pending') throw new AppError('CONFLICT', 'Permintaan sudah diputuskan');
  return r;
}

export async function presignDocument(ctx: ActorContext, requestId: string, input: DocumentPresignInput) {
  await ownPendingRequest(ctx, requestId);
  const objectKey = `tariff-requests/${requestId}/${randomUUID()}`;
  const upload = await storage().presignPut(objectKey, input.mime, input.sizeBytes);
  const doc = await repo.insertDocument(db(), {
    tariffChangeRequestId: requestId,
    objectKey,
    fileName: input.fileName,
    mime: input.mime,
    sizeBytes: input.sizeBytes,
  });
  await recordAudit(db(), {
    actorId: ctx.actorId,
    action: 'tariff.request.document.presign',
    entity: 'document',
    entityId: doc.id,
    before: null,
    after: { requestId, fileName: input.fileName, mime: input.mime, sizeBytes: input.sizeBytes },
    ip: ctx.ip,
    requestId: ctx.requestId,
  });
  return { documentId: doc.id, ...upload };
}

export async function confirmDocument(ctx: ActorContext, requestId: string, documentId: string) {
  await ownPendingRequest(ctx, requestId);
  const doc = await repo.findDocument(db(), requestId, documentId);
  if (!doc) throw notFound('NOT_FOUND', 'Dokumen');
  const info = await storage().head(doc.objectKey);
  if (!info) throw new AppError('DOCUMENT_INVALID', 'Berkas belum diunggah');
  const reject = async (reason: string): Promise<never> => {
    await storage().delete(doc.objectKey);
    await repo.deleteDocumentRow(db(), doc.id);
    throw new AppError('DOCUMENT_INVALID', reason);
  };
  if (info.sizeBytes > DOCUMENT_MAX_BYTES) await reject('Ukuran berkas melebihi 5 MB');
  const sniffed = sniffMime(await storage().readStart(doc.objectKey, 16));
  if (!sniffed || !(DOCUMENT_ALLOWED_MIME as readonly string[]).includes(sniffed) || sniffed !== doc.mime) {
    await reject('Isi berkas bukan PDF atau gambar yang diizinkan');
  }
  await repo.confirmDocument(db(), doc.id, info.sizeBytes);
  await recordAudit(db(), {
    actorId: ctx.actorId,
    action: 'tariff.request.document.confirm',
    entity: 'document',
    entityId: doc.id,
    before: null,
    after: { requestId, sizeBytes: info.sizeBytes, mime: sniffed },
    ip: ctx.ip,
    requestId: ctx.requestId,
  });
  return { id: doc.id, fileName: doc.fileName, mime: doc.mime, sizeBytes: info.sizeBytes, confirmed: true };
}

/* ---------- Admin: moderasi ---------- */

export async function queue(q: { status: ReviewStatus; limit: number; cursor?: string }) {
  const offset = decodeOffsetCursor(q.cursor);
  const rows = await repo.queue(db(), { status: q.status, limit: q.limit, offset });
  const page = pageOf(rows, q.limit, offset);
  return {
    items: page.items.map(({ packagePayload, ...r }) => ({
      ...r,
      package: packagePayload as repo.PackagePayload | null,
      createdAt: r.createdAt.toISOString(),
      decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
    })),
    nextCursor: page.nextCursor,
  };
}

/** Detail untuk moderator: harga lama vs usulan, dan dokumen bukti lewat signed URL berumur pendek. */
export async function detail(requestId: string) {
  const r = await repo.findRequest(db(), requestId);
  if (!r) throw notFound('TARIFF_REQUEST_NOT_FOUND', 'Permintaan harga');
  const [facility, service, current, docs, submitter, batch] = await Promise.all([
    repo.facilityOf(db(), r.facilityId),
    r.serviceId ? findServiceById(db(), r.serviceId) : Promise.resolve(null),
    r.tariffId ? repo.currentVersionOf(db(), r.tariffId) : Promise.resolve(null),
    repo.confirmedDocuments(db(), requestId),
    repo.submitterEmail(db(), r.submittedBy),
    r.importBatchId ? getBatch(r.importBatchId, undefined, 50) : Promise.resolve(null),
  ]);
  const importRows = r.importBatchId ? await importsRepo.validRowsForPublish(db(), r.importBatchId) : [];
  return {
    ...view(r),
    facility,
    service: service ? { id: service.id, slug: service.slug, name: service.name } : null,
    current,
    submitter,
    importBatch: batch ? { id: batch.batch.id, status: batch.batch.status, rowsValid: batch.batch.rowsValid, fileName: batch.batch.fileName } : null,
    importRows: importRows.slice(0, 200).map((row) => ({ rowNo: row.rowNo, raw: row.raw })),
    documents: await Promise.all(
      docs.map(async (d) => ({
        id: d.id,
        fileName: d.fileName,
        mime: d.mime,
        sizeBytes: d.sizeBytes,
        uploadedAt: d.uploadedAt.toISOString(),
        viewUrl: await storage().presignGet(d.objectKey, VIEW_URL_TTL_SEC),
        viewUrlExpiresInSec: VIEW_URL_TTL_SEC,
      })),
    ),
  };
}

/**
 * Setujui (K4): satu-satunya jalan harga mitra masuk `tariff_versions`. Dokumen bukti wajib.
 * Versi bertanda `diverifikasi_admin` dan tarif menjadi terbit, dalam satu transaksi.
 */
export async function approve(ctx: ActorContext, requestId: string) {
  const result = await db().transaction(async (tx) => {
    const locked = await repo.lockRequest(tx, requestId);
    if (!locked) throw notFound('TARIFF_REQUEST_NOT_FOUND', 'Permintaan harga');
    if (locked.status !== 'pending') throw new AppError('CONFLICT', 'Permintaan sudah diputuskan');
    const r = (await repo.findRequest(tx, requestId))!;
    if ((await repo.confirmedDocuments(tx, requestId)).length === 0) {
      throw new AppError('TARIFF_REQUEST_DOCUMENT_REQUIRED', 'Permintaan harga memerlukan minimal satu dokumen bukti');
    }

    if (r.kind === 'impor') {
      const published = await publishBatchTx(tx, ctx, r.importBatchId!, { viaRequest: true });
      const decided = await repo.decide(tx, requestId, { status: 'approved', decidedBy: ctx.actorId, resultingVersionId: null });
      await recordAudit(tx, {
        actorId: ctx.actorId,
        action: 'tariff.request.approve',
        entity: 'tariff_change_request',
        entityId: requestId,
        before: { status: 'pending' },
        after: { status: 'approved', importBatchId: r.importBatchId, created: published.created, skipped: published.skipped },
        ip: ctx.ip,
        requestId: ctx.requestId,
      });
      return { decided, affected: published.affected, serviceSlug: null as string | null };
    }

    const pkg = r.packagePayload as repo.PackagePayload | null;
    // Aturan M17 bisa berubah sejak diajukan: periksa ulang saat disetujui.
    await assertContentAllowed(contentFieldsOf({ inclusions: r.inclusions, exclusions: r.exclusions, package: pkg }), tx);
    const service = await findServiceById(tx, r.serviceId!);
    if (!service) throw notFound('SERVICE_NOT_FOUND', 'Layanan');

    let tariffId = r.tariffId;
    if (!tariffId) {
      const packageRow = pkg
        ? await writeRepo.insertPackage(tx, { facilityId: r.facilityId, serviceId: service.id, name: pkg.name, notes: pkg.notes ?? null, components: pkg.components })
        : null;
      if (!packageRow && (await writeRepo.findTariffByKey(tx, r.facilityId, service.id, null))) {
        throw new AppError('CONFLICT', 'Tarif untuk layanan ini sudah dibuat sejak permintaan diajukan; tolak permintaan ini');
      }
      tariffId = (await writeRepo.insertTariff(tx, { facilityId: r.facilityId, serviceId: service.id, packageId: packageRow?.id ?? null, status: 'draft' })).id;
    } else {
      const t = await writeRepo.lockTariff(tx, tariffId);
      if (!t) throw notFound('TARIFF_NOT_FOUND', 'Tarif');
      if (t.status === 'ditarik') throw new AppError('CONFLICT', 'Tarif sudah ditarik admin; tolak permintaan ini');
    }
    const sourceId = await writeRepo.upsertDataSource(tx, FASKES_SOURCE.kind, r.sourceTitle, r.sourceUrl);
    const { previous, created } = await appendVersion(tx, {
      tariffId,
      input: {
        priceType: r.priceType!,
        priceMin: r.priceMin,
        priceMax: r.priceMax,
        effectiveFrom: r.effectiveFrom!,
        effectiveTo: r.effectiveTo,
        inclusions: r.inclusions,
        exclusions: r.exclusions,
      },
      verification: 'diverifikasi_admin',
      verifiedAt: new Date(),
      sourceId,
      createdBy: ctx.actorId,
      // Harga berubah sejak diajukan = TARIFF_VERSION_CONFLICT; mitra perlu mengajukan ulang.
      ...(r.tariffId ? { expectedVersionNo: r.baseVersionNo ?? 0 } : {}),
      status: 'terbit',
    });
    const decided = await repo.decide(tx, requestId, { status: 'approved', decidedBy: ctx.actorId, resultingVersionId: created.id });
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: 'tariff.request.approve',
      entity: 'tariff_change_request',
      entityId: requestId,
      before: previous,
      after: { request: { id: requestId, status: 'approved' }, tariffId, version: created },
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    return { decided, affected: [r.facilityId], serviceSlug: service.slug };
  });

  await revalidateFacilities(result.affected);
  if (result.serviceSlug) await revalidate([tags.service(result.serviceSlug), tags.compare(result.serviceSlug)]);
  await notifyMembers(result.decided.facilityId, 'Permintaan harga disetujui', 'Permintaan harga Anda telah disetujui moderator dan kini tampil di SILK.');
  return view(result.decided);
}

export async function reject(ctx: ActorContext, requestId: string, reason: string) {
  const decided = await db().transaction(async (tx) => {
    const locked = await repo.lockRequest(tx, requestId);
    if (!locked) throw notFound('TARIFF_REQUEST_NOT_FOUND', 'Permintaan harga');
    if (locked.status !== 'pending') throw new AppError('CONFLICT', 'Permintaan sudah diputuskan');
    const row = await repo.decide(tx, requestId, { status: 'rejected', decidedBy: ctx.actorId, rejectionReason: reason });
    if (row.importBatchId) {
      await importsRepo.updateBatch(tx, row.importBatchId, { status: 'ditolak', error: `Ditolak moderator: ${reason}` });
    }
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: 'tariff.request.reject',
      entity: 'tariff_change_request',
      entityId: requestId,
      before: { status: 'pending' },
      after: { status: 'rejected', rejectionReason: reason },
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    return row;
  });
  await notifyMembers(decided.facilityId, 'Permintaan harga ditolak', `Permintaan harga Anda ditolak moderator.\n\nAlasan: ${reason}\n\nAnda dapat mengajukan ulang dengan data dan dokumen yang sesuai.`);
  return view(decided);
}
