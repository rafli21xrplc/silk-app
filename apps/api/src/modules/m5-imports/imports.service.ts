import { createHash, randomUUID } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import {
  CSV_COLUMNS,
  CSV_MAX_BYTES,
  IMPORT_CHUNK_SIZE,
  PORTAL_IMPORT_MAX_ROWS,
  csvRowSchema,
  type CsvPresignInput,
  type DataSourceKind,
  type ImportRowError,
} from '@silk/shared';
import type { Tx } from '@silk/db';
import { db } from '../../lib/db';
import type { ActorContext } from '../../lib/context';
import { AppError, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { decodeOffsetCursor, pageOf } from '../../lib/pagination';
import { revalidate, tags } from '../../lib/revalidate';
import { revalidatePractitionersOfFacilities } from '../m1-directory/practitioner-cache';
import { storage } from '../../lib/storage';
import { enqueueJob } from '../../jobs/jobs.repo';
import { recordAudit, recordAudits } from '../m15-admin/audit.repo';
import * as writeRepo from '../m2-tariffs/tariff-write.repo';
import { listServiceIdsBySlug } from '../m2-tariffs/tariffs.repo';
import { findFacility } from '../m6-portal/portal.repo';
import { FASKES_SOURCE } from '../m6-portal/portal.service';
import * as repo from './imports.repo';

const MAX_ROWS = 20_000;

/* ---------- Unggahan CSV lewat signed URL ---------- */

export async function presignCsv(prefix: string, input: CsvPresignInput) {
  const key = `${prefix}/${randomUUID()}.csv`;
  return storage().presignPut(key, 'text/csv', input.sizeBytes);
}

/* ---------- Tahap 1: staging ---------- */

function parseCsv(buf: Buffer): { header: string[]; rows: Record<string, string>[] } {
  let header: string[] = [];
  const rows = parse(buf, {
    bom: true,
    trim: true,
    skip_empty_lines: true,
    relax_column_count: true,
    columns: (h: string[]) => {
      header = h.map((c) => c.trim().toLowerCase());
      return header;
    },
  }) as Record<string, string>[];
  return { header, rows };
}

async function stageRows(batch: repo.BatchRow): Promise<boolean> {
  const head = await storage().head(batch.objectKey);
  if (!head) {
    await repo.updateBatch(db(), batch.id, { status: 'ditolak', error: 'Berkas tidak ditemukan di penyimpanan' });
    return false;
  }
  if (head.sizeBytes > CSV_MAX_BYTES) {
    await repo.updateBatch(db(), batch.id, { status: 'ditolak', error: 'Berkas melebihi batas ukuran' });
    return false;
  }
  const buf = await storage().readAll(batch.objectKey);
  const sha = createHash('sha256').update(buf).digest('hex');
  let parsed: ReturnType<typeof parseCsv>;
  try {
    parsed = parseCsv(buf);
  } catch (err) {
    await repo.updateBatch(db(), batch.id, {
      status: 'ditolak',
      error: `CSV tidak dapat dibaca: ${err instanceof Error ? err.message : 'format salah'}`,
    });
    return false;
  }
  const missing = CSV_COLUMNS.filter((c) => !parsed.header.includes(c));
  if (missing.length) {
    await repo.updateBatch(db(), batch.id, { status: 'ditolak', error: `Kolom wajib tidak ada: ${missing.join(', ')}` });
    return false;
  }
  const limit = batch.facilityId ? PORTAL_IMPORT_MAX_ROWS : MAX_ROWS;
  if (parsed.rows.length > limit) {
    await repo.updateBatch(db(), batch.id, { status: 'ditolak', error: `Maksimal ${limit} baris per berkas` });
    return false;
  }
  for (let i = 0; i < parsed.rows.length; i += IMPORT_CHUNK_SIZE) {
    const chunk = parsed.rows.slice(i, i + IMPORT_CHUNK_SIZE).map((raw, j) => ({
      rowNo: i + j + 2, // baris 1 = header, sesuai nomor baris di spreadsheet
      raw: Object.fromEntries(CSV_COLUMNS.map((c) => [c, raw[c] ?? ''])),
    }));
    await repo.insertRawRows(db(), batch.id, chunk);
  }
  await repo.updateBatch(db(), batch.id, { rowsTotal: parsed.rows.length, fileSha256: sha });
  return true;
}

/* ---------- Tahap 2: validasi per potongan ---------- */

async function validateChunk(batch: repo.BatchRow): Promise<number> {
  const rows = await repo.pendingRows(db(), batch.id, IMPORT_CHUNK_SIZE);
  if (rows.length === 0) return 0;

  const serviceIds = new Map((await listServiceIdsBySlug(db())).map((s) => [s.slug, s.id]));
  const seen = await repo.validKeys(db(), batch.id);

  const parsedRows = rows.map((row) => ({ row, result: csvRowSchema.safeParse(row.raw) }));
  const pairs = parsedRows.flatMap(({ row, result }) =>
    result.success ? [{ idx: row.id, name: result.data.facility_name, city: result.data.city }] : [],
  );
  const candidates = await repo.matchFacilities(db(), pairs, batch.facilityId);
  const byRow = new Map<number, repo.FacilityCandidate[]>();
  for (const c of candidates) byRow.set(c.idx, [...(byRow.get(c.idx) ?? []), c]);

  const updates: repo.RowUpdate[] = [];
  for (const { row, result } of parsedRows) {
    const errors: ImportRowError[] = [];
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({ field: String(issue.path[0] ?? 'baris'), code: 'IMPORT_ROW_INVALID', message: issue.message });
      }
      updates.push({ id: row.id, status: 'galat', errors, parsed: null, matchedFacilityId: null, matchedServiceId: null, candidates: null });
      continue;
    }
    const data = result.data;
    const serviceId = serviceIds.get(data.service_slug) ?? null;
    if (!serviceId) {
      errors.push({ field: 'service_slug', code: 'SERVICE_NOT_FOUND', message: `Layanan "${data.service_slug}" tidak dikenal` });
    }

    const cands = byRow.get(row.id) ?? [];
    const exact = cands.filter((c) => c.exact);
    let facilityId: string | null = null;
    let status: 'valid' | 'galat' | 'ambigu' = 'valid';
    if (exact.length === 1) {
      facilityId = exact[0]!.id;
    } else if (batch.facilityId) {
      // Impor portal: semua baris wajib milik faskes sendiri (M6).
      errors.push({ field: 'facility_name', code: 'FACILITY_MISMATCH', message: 'Baris ini bukan untuk faskes Anda' });
    } else if (cands.length === 0) {
      errors.push({ field: 'facility_name', code: 'FACILITY_NOT_FOUND', message: 'Faskes tidak ditemukan di kota tersebut' });
    } else {
      status = 'ambigu';
    }

    const key = facilityId && serviceId ? `${facilityId}|${serviceId}|${data.effective_from}` : null;
    if (key && seen.has(key)) {
      errors.push({ field: 'effective_from', code: 'DUPLICATE_ROW', message: 'Baris ganda: faskes, layanan, dan tanggal berlaku sama' });
    }
    if (errors.length) status = 'galat';
    if (status === 'valid' && key) seen.add(key);

    updates.push({
      id: row.id,
      status,
      errors: errors.length ? errors : null,
      parsed: {
        key,
        priceType: data.price_type,
        priceMin: data.price_min,
        priceMax: data.price_max,
        effectiveFrom: data.effective_from,
        sourceTitle: data.source_title,
        sourceUrl: data.source_url,
      },
      matchedFacilityId: facilityId,
      matchedServiceId: serviceId,
      candidates: status === 'ambigu' ? cands.map(({ id, name, city, score }) => ({ id, name, city, score: Number(score) })) : null,
    });
  }
  // Satu UPDATE per potongan, bukan per baris.
  await repo.updateRows(db(), updates);
  return rows.length;
}

async function finalize(batch: repo.BatchRow) {
  const counts = await repo.countRows(db(), batch.id);
  const invalid = counts.galat + counts.ambigu;
  const rejectPortal = batch.facilityId !== null && invalid > 0;
  await repo.updateBatch(db(), batch.id, {
    rowsProcessed: counts.valid + invalid,
    rowsValid: counts.valid,
    rowsInvalid: invalid,
    status: rejectPortal ? 'ditolak' : 'divalidasi',
    error: rejectPortal ? `${invalid} baris tidak valid; seluruh berkas ditolak` : null,
  });
}

/**
 * Proses batch per potongan (500 baris) sampai selesai atau anggaran waktu habis.
 * Aman diulang: setiap tahap idempoten, sehingga Cron berikutnya melanjutkan dari sisa baris.
 */
export async function processBatch(batchId: string, opts: { timeBudgetMs?: number } = {}): Promise<{ done: boolean }> {
  const started = Date.now();
  const budget = opts.timeBudgetMs ?? 20_000;
  let batch = await repo.findBatch(db(), batchId);
  if (!batch || batch.status !== 'diunggah') return { done: true };
  if (batch.rowsTotal === null) {
    if (!(await stageRows(batch))) return { done: true };
    batch = (await repo.findBatch(db(), batchId))!;
  }
  while (Date.now() - started < budget) {
    const n = await validateChunk(batch);
    if (n === 0) {
      await finalize(batch);
      return { done: true };
    }
    const counts = await repo.countRows(db(), batchId);
    await repo.updateBatch(db(), batchId, { rowsProcessed: (batch.rowsTotal ?? 0) - counts.pending });
  }
  return { done: false };
}

/* ---------- Admin: buat batch, tinjau, terbitkan ---------- */

export async function createAdminBatch(
  ctx: ActorContext,
  input: { objectKey: string; fileName?: string; sourceKind: DataSourceKind },
) {
  if (!input.objectKey.startsWith('imports/admin/')) {
    throw new AppError('VALIDATION_FAILED', 'Kunci objek tidak valid', [{ path: 'objectKey', message: 'Gunakan kunci dari presign' }]);
  }
  const batch = await db().transaction(async (tx) => {
    const b = await repo.insertBatch(tx, {
      objectKey: input.objectKey,
      fileName: input.fileName ?? null,
      sourceKind: input.sourceKind,
      uploadedBy: ctx.actorId,
    });
    await enqueueJob(tx, { type: 'import.process', payload: { batchId: b.id }, dedupeKey: `import:${b.id}` });
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
  // Proses langsung sebisanya; sisanya dilanjutkan job Cron.
  try {
    await processBatch(batch.id);
  } catch (err) {
    logger.error({ err, batchId: batch.id }, 'proses impor awal gagal; dilanjutkan job');
  }
  return getBatch(batch.id, undefined);
}

export async function getBatch(batchId: string, cursor: string | undefined, limit = 50) {
  const batch = await repo.findBatch(db(), batchId);
  if (!batch) throw notFound('IMPORT_NOT_FOUND', 'Batch impor');
  const counts = await repo.countRows(db(), batchId);
  const offset = decodeOffsetCursor(cursor);
  const rows = await repo.rowsByStatus(db(), batchId, ['galat', 'ambigu'], limit + 1, offset);
  const page = pageOf(rows, limit, offset);
  return {
    batch: {
      ...batch,
      counts,
    },
    problemRows: page.items.map((r) => ({
      id: r.id,
      rowNo: r.rowNo,
      status: r.status,
      raw: r.raw,
      errors: r.errors ?? [],
      candidates: r.candidates ?? [],
    })),
    nextCursor: page.nextCursor,
  };
}

export async function listAdminBatches(q: { status?: string; limit: number; cursor?: string }) {
  const offset = decodeOffsetCursor(q.cursor);
  const rows = await repo.listBatches(db(), { status: q.status, facilityId: null, limit: q.limit, offset });
  return pageOf(rows, q.limit, offset);
}

/** Admin memilih faskes untuk baris ambigu. */
export async function resolveRow(ctx: ActorContext, batchId: string, rowId: number, facilityId: string) {
  return db().transaction(async (tx) => {
    const lockedBatch = await repo.lockBatch(tx, batchId);
    if (!lockedBatch) throw notFound('IMPORT_NOT_FOUND', 'Batch impor');
    if (lockedBatch.status !== 'divalidasi' && lockedBatch.status !== 'ditinjau') {
      throw new AppError('IMPORT_NOT_READY', 'Batch tidak dalam tahap tinjauan');
    }
    const row = await repo.findRow(tx, batchId, rowId);
    if (!row || row.status !== 'ambigu') throw new AppError('VALIDATION_FAILED', 'Baris tidak dalam status ambigu');
    if (!row.candidates?.some((c) => c.id === facilityId)) {
      throw new AppError('VALIDATION_FAILED', 'Faskes bukan salah satu kandidat');
    }
    const parsed = row.parsed ?? {};
    const key = row.matchedServiceId ? `${facilityId}|${row.matchedServiceId}|${String(parsed.effectiveFrom)}` : null;
    const duplicate = key ? (await repo.validKeys(tx, batchId)).has(key) : false;
    await repo.updateRow(tx, row.id, {
      status: duplicate ? 'galat' : 'valid',
      errors: duplicate ? [{ field: 'effective_from', code: 'DUPLICATE_ROW', message: 'Baris ganda setelah pencocokan' }] : null,
      parsed: { ...parsed, key },
      matchedFacilityId: facilityId,
      matchedServiceId: row.matchedServiceId,
      candidates: row.candidates,
    });
    const counts = await repo.countRows(tx, batchId);
    await repo.updateBatch(tx, batchId, { status: 'ditinjau', rowsValid: counts.valid, rowsInvalid: counts.galat + counts.ambigu });
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: 'import.row.resolve',
      entity: 'import_row',
      entityId: String(row.id),
      before: { status: row.status, matchedFacilityId: row.matchedFacilityId },
      after: { status: duplicate ? 'galat' : 'valid', matchedFacilityId: facilityId },
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    return { status: duplicate ? 'galat' : 'valid' };
  });
}

/**
 * Terbitkan batch dalam SATU transaksi (M5): gagal sebagian = tidak ada yang terbit.
 * Idempoten: versi dengan (faskes, layanan, tanggal berlaku) yang sudah ada dilewati.
 * Batch portal mitra hanya terbit lewat persetujuan permintaan harga (Fase 2, K4).
 */
export async function publishBatch(ctx: ActorContext, batchId: string) {
  const result = await db().transaction((tx) => publishBatchTx(tx, ctx, batchId));
  await revalidateFacilities(result.affected);
  return { created: result.created, skipped: result.skipped };
}

export async function revalidateFacilities(facilityIds: string[]) {
  const slugs = await repo.facilitySlugs(db(), facilityIds);
  await revalidate([...slugs.map(tags.facility), tags.facilities, tags.sitemap]);
  await revalidatePractitionersOfFacilities(facilityIds);
}

/**
 * Inti penerbitan di dalam transaksi pemanggil. `viaRequest` = dipanggil saat moderator menyetujui
 * permintaan harga impor portal: versi bertanda `diverifikasi_admin` dan tarif langsung terbit.
 */
export async function publishBatchTx(tx: Tx, ctx: ActorContext, batchId: string, opts: { viaRequest?: boolean } = {}) {
  const locked = await repo.lockBatch(tx, batchId);
  if (!locked) throw notFound('IMPORT_NOT_FOUND', 'Batch impor');
  if (locked.status !== 'divalidasi' && locked.status !== 'ditinjau') {
    throw new AppError('IMPORT_NOT_READY', `Batch berstatus "${locked.status}" tidak dapat diterbitkan`);
  }
  const batch = (await repo.findBatch(tx, batchId))!;
  if (batch.facilityId && !opts.viaRequest) {
    throw new AppError('IMPORT_NOT_READY', 'Batch dari portal mitra diterbitkan lewat persetujuan permintaan harga');
  }
  const portalFacility = batch.facilityId ? await findFacility(tx, batch.facilityId) : null;
  const rows = await repo.validRowsForPublish(tx, batchId);
  type Parsed = {
    priceType: 'tetap' | 'rentang' | 'mulai_dari' | 'paket' | 'tanya';
    priceMin: number | null;
    priceMax: number | null;
    effectiveFrom: string;
    sourceTitle: string;
    sourceUrl: string | null;
  };
  const items = rows.map((row) => ({
    rowNo: row.rowNo,
    facilityId: row.matchedFacilityId!,
    serviceId: row.matchedServiceId!,
    p: row.parsed as Parsed,
  }));
  const sourceKind = portalFacility ? FASKES_SOURCE.kind : batch.sourceKind;
  // Batch admin dan batch portal yang sudah disetujui moderator sama-sama langsung terbit.
  const newStatus = 'terbit' as const;
  const pairKey = (f: string, s: string) => `${f}|${s}`;

  // Semua langkah berbasis himpunan: jumlah query tetap, tidak bertambah per baris.
  const sources = await writeRepo.upsertDataSources(
    tx,
    items.map((it) => ({ kind: sourceKind, title: it.p.sourceTitle, url: it.p.sourceUrl })),
  );
  const pairs = [...new Map(items.map((it) => [pairKey(it.facilityId, it.serviceId), { facilityId: it.facilityId, serviceId: it.serviceId }])).values()];
  const tariffByPair = new Map((await writeRepo.lockTariffsByKeys(tx, pairs)).map((t) => [pairKey(t.facilityId, t.serviceId), t]));
  const existingDates = await writeRepo.existingVersionDates(tx, [...tariffByPair.values()].map((t) => t.id));

  // Lewati baris yang tanggal berlakunya sudah ada (unggah ulang berkas yang sama = idempoten).
  const seenKeys = new Set<string>();
  const todo = items.filter((it) => {
    const t = tariffByPair.get(pairKey(it.facilityId, it.serviceId));
    const key = `${pairKey(it.facilityId, it.serviceId)}|${it.p.effectiveFrom}`;
    if ((t && existingDates.has(`${t.id}|${it.p.effectiveFrom}`)) || seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });
  const skipped = items.length - todo.length;

  const missing = [...new Map(todo.filter((it) => !tariffByPair.has(pairKey(it.facilityId, it.serviceId))).map((it) => [pairKey(it.facilityId, it.serviceId), it])).values()];
  for (const t of await writeRepo.insertTariffs(
    tx,
    missing.map((it) => ({ facilityId: it.facilityId, serviceId: it.serviceId, packageId: null, status: 'draft' as const })),
  )) {
    tariffByPair.set(pairKey(t.facilityId, t.serviceId), t);
  }

  const latest = new Map((await writeRepo.latestVersions(tx, [...new Set(todo.map((it) => tariffByPair.get(pairKey(it.facilityId, it.serviceId))!.id))])).map((v) => [v.tariffId, v]));
  const nextNo = new Map([...latest].map(([id, v]) => [id, v.versionNo]));
  const verifiedAt = new Date();
  const planned = todo.map((it) => {
    const tariff = tariffByPair.get(pairKey(it.facilityId, it.serviceId))!;
    const versionNo = (nextNo.get(tariff.id) ?? 0) + 1;
    nextNo.set(tariff.id, versionNo);
    const isAsk = it.p.priceType === 'tanya';
    return {
      it,
      tariff,
      version: {
        tariffId: tariff.id,
        versionNo,
        priceType: it.p.priceType,
        priceMin: isAsk ? null : it.p.priceMin,
        priceMax: isAsk ? null : it.p.priceMax,
        effectiveFrom: it.p.effectiveFrom,
        effectiveTo: null,
        verifiedAt,
        verification: portalFacility ? ('diverifikasi_admin' as const) : ('dari_dokumen_publik' as const),
        sourceId: sources.get(`${sourceKind}|${it.p.sourceTitle}|${it.p.sourceUrl ?? ''}`) ?? null,
        inclusions: null,
        exclusions: null,
        createdBy: ctx.actorId,
      },
    };
  });
  const inserted = await writeRepo.insertVersions(tx, planned.map((x) => x.version));
  const insertedByKey = new Map(inserted.map((v) => [`${v.tariffId}|${v.versionNo}`, v]));

  // Versi terakhir yang disisipkan per tarif menjadi versi saat ini (sama seperti appendVersion berurutan).
  const current = new Map<string, { tariffId: string; versionId: string; status: 'terbit' | 'menunggu_tinjauan' | 'ditarik' }>();
  const audits: Parameters<typeof recordAudits>[1] = [];
  const previousOf = new Map(latest);
  for (const x of planned) {
    const v = insertedByKey.get(`${x.tariff.id}|${x.version.versionNo}`)!;
    current.set(x.tariff.id, { tariffId: x.tariff.id, versionId: v.id, status: x.tariff.status === 'ditarik' ? 'ditarik' : newStatus });
    audits.push({
      actorId: ctx.actorId,
      action: 'tariff.version.import',
      entity: 'tariff',
      entityId: x.tariff.id,
      before: previousOf.get(x.tariff.id) ?? null,
      after: { ...v, importBatchId: batchId, rowNo: x.it.rowNo },
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    previousOf.set(x.tariff.id, v);
  }
  await writeRepo.setCurrentVersions(tx, [...current.values()]);
  await recordAudits(tx, audits);
  const created = planned.length;
  const affected = new Set(planned.map((x) => x.it.facilityId));

  await repo.updateBatch(tx, batchId, { status: 'diterbitkan', publishedAt: new Date(), publishedBy: ctx.actorId });
  await recordAudit(tx, {
    actorId: ctx.actorId,
    action: 'import.publish',
    entity: 'import_batch',
    entityId: batchId,
    before: { status: locked.status },
    after: { status: 'diterbitkan', created, skipped },
    ip: ctx.ip,
    requestId: ctx.requestId,
  });
  return { created, skipped, affected: [...affected] };
}
