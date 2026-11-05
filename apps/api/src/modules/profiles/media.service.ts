import { randomUUID } from 'node:crypto';
import {
  PHOTO_ALLOWED_MIME,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_COUNT,
  VIDEO_MAX_BYTES,
  VIDEO_MAX_COUNT,
  VIDEO_MAX_SECONDS,
  mp4DurationSeconds,
  sniffVideo,
  type MediaPresignInput,
  type ReviewStatus,
} from '@silk/shared';
import { db } from '../../lib/db';
import type { ActorContext } from '../../lib/context';
import { AppError, notFound } from '../../lib/errors';
import { decodeOffsetCursor, pageOf } from '../../lib/pagination';
import { revalidate, tags } from '../../lib/revalidate';
import { sniffMime, storage } from '../../lib/storage';
import { recordAudit } from '../m15-admin/audit.repo';
import { assertContentAllowed } from '../m17-content-rules/content-rules.service';
import * as repo from './media.repo';
import { assertMember, assertVerifiedPartner } from './profiles.guard';

/** Masa berlaku URL pratinjau media yang belum disetujui (pemilik dan moderator). */
const PREVIEW_TTL_SEC = 600;
/** Toleransi pembulatan durasi dari header MP4. */
const DURATION_TOLERANCE_SEC = 0.5;

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

type MediaRow = Awaited<ReturnType<typeof repo.findMediaById>> & object;

async function previewUrl(m: MediaRow): Promise<string | null> {
  if (m.status === 'approved' && m.publicUrl) return m.publicUrl;
  if (m.status === 'pending' && m.confirmedAt) return storage().presignGet(m.objectKey, PREVIEW_TTL_SEC);
  return null;
}

function view(m: MediaRow, url: string | null) {
  return {
    id: m.id,
    kind: m.kind,
    fileName: m.fileName,
    mime: m.mime,
    sizeBytes: m.sizeBytes,
    durationSec: m.durationSec,
    caption: m.caption,
    status: m.status,
    rejectionReason: m.rejectionReason,
    url,
    createdAt: m.createdAt.toISOString(),
  };
}

async function revalidateIfPublic(facilityId: string) {
  const f = await repo.facilityStatus(db(), facilityId);
  if (f?.status === 'terbit') await revalidate([tags.facility(f.slug)]);
}

/* ---------- Portal ---------- */

export async function mediaForOwner(facilityId: string) {
  const rows = await repo.listForFacility(db(), facilityId);
  return Promise.all(rows.map(async (m) => view(m, await previewUrl(m))));
}

/**
 * Signed URL unggah foto/video (K8). MIME dan ukuran sudah dibatasi skema; keduanya ikut ditandatangani.
 * Nama objek acak di bawah `profiles/{facilityId}/`.
 */
export async function presignMedia(ctx: ActorContext, facilityId: string, input: MediaPresignInput) {
  await assertMember(ctx, facilityId);
  await assertVerifiedPartner(ctx);
  await assertContentAllowed({ caption: input.caption });
  const max = input.kind === 'foto' ? PHOTO_MAX_COUNT : VIDEO_MAX_COUNT;
  if ((await repo.countActive(db(), facilityId, input.kind)) >= max) {
    throw new AppError(
      'MEDIA_LIMIT_REACHED',
      input.kind === 'foto' ? `Maksimal ${PHOTO_MAX_COUNT} foto per profil` : `Maksimal ${VIDEO_MAX_COUNT} video per profil`,
    );
  }
  const objectKey = `profiles/${facilityId}/${randomUUID()}.${EXT[input.mime]}`;
  const upload = await storage().presignPut(objectKey, input.mime, input.sizeBytes);
  const row = await repo.insertMedia(db(), {
    facilityId,
    kind: input.kind,
    objectKey,
    fileName: input.fileName,
    mime: input.mime,
    sizeBytes: input.sizeBytes,
    durationSec: input.kind === 'video' ? Math.ceil(input.durationSec) : null,
    caption: input.caption ?? null,
    uploadedBy: ctx.actorId,
  });
  await recordAudit(db(), {
    actorId: ctx.actorId,
    action: 'media.presign',
    entity: 'profile_media',
    entityId: row.id,
    before: null,
    after: { facilityId, kind: input.kind, fileName: input.fileName, mime: input.mime, sizeBytes: input.sizeBytes },
    ip: ctx.ip,
    requestId: ctx.requestId,
  });
  return { mediaId: row.id, ...upload };
}

/** Setelah unggah: periksa ukuran nyata, magic bytes, dan durasi MP4. Berkas tidak sah dihapus. */
export async function confirmMedia(ctx: ActorContext, facilityId: string, mediaId: string) {
  await assertMember(ctx, facilityId);
  const m = await repo.findMedia(db(), facilityId, mediaId);
  if (!m) throw notFound('MEDIA_NOT_FOUND', 'Media');
  if (m.confirmedAt) return view(m, await previewUrl(m));
  const info = await storage().head(m.objectKey);
  if (!info) throw new AppError('MEDIA_INVALID', 'Berkas belum diunggah');

  const reject = async (reason: string): Promise<never> => {
    await storage().delete(m.objectKey);
    await repo.deleteMediaRow(db(), m.id);
    throw new AppError('MEDIA_INVALID', reason);
  };

  let durationSec: number | null = null;
  if (m.kind === 'foto') {
    if (info.sizeBytes > PHOTO_MAX_BYTES) await reject('Ukuran foto melebihi 5 MB');
    const sniffed = sniffMime(await storage().readStart(m.objectKey, 16));
    if (!sniffed || !(PHOTO_ALLOWED_MIME as readonly string[]).includes(sniffed) || sniffed !== m.mime) {
      await reject('Isi berkas bukan foto JPEG, PNG, atau WebP');
    }
  } else {
    if (info.sizeBytes > VIDEO_MAX_BYTES) await reject('Ukuran video melebihi 100 MB');
    const sniffed = sniffVideo(await storage().readStart(m.objectKey, 16));
    if (!sniffed || sniffed !== m.mime) await reject('Isi berkas bukan video MP4 atau WebM');
    if (m.mime === 'video/mp4') {
      const measured = await mp4DurationSeconds((start, length) => storage().readRange(m.objectKey, start, length), info.sizeBytes);
      if (measured === null) await reject('Durasi video tidak dapat dibaca');
      if (measured! > VIDEO_MAX_SECONDS + DURATION_TOLERANCE_SEC) await reject(`Durasi video maksimal ${VIDEO_MAX_SECONDS} detik`);
      durationSec = Math.min(VIDEO_MAX_SECONDS, Math.ceil(measured!));
    } else {
      // WebM tidak bisa diukur andal tanpa ffprobe; durasi dari browser dicek moderator (K8).
      durationSec = m.durationSec;
    }
  }

  const confirmed = await repo.markConfirmed(db(), m.id, { sizeBytes: info.sizeBytes, durationSec });
  await recordAudit(db(), {
    actorId: ctx.actorId,
    action: 'media.upload',
    entity: 'profile_media',
    entityId: m.id,
    before: null,
    after: { facilityId, kind: m.kind, mime: m.mime, sizeBytes: info.sizeBytes, durationSec },
    ip: ctx.ip,
    requestId: ctx.requestId,
  });
  return view(confirmed, await previewUrl(confirmed));
}

export async function deleteMedia(ctx: ActorContext, facilityId: string, mediaId: string) {
  await assertMember(ctx, facilityId);
  const m = await repo.findMedia(db(), facilityId, mediaId);
  if (!m) throw notFound('MEDIA_NOT_FOUND', 'Media');
  await db().transaction(async (tx) => {
    await repo.deleteMediaRow(tx, m.id);
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: 'media.delete',
      entity: 'profile_media',
      entityId: m.id,
      before: { facilityId, kind: m.kind, status: m.status, objectKey: m.objectKey, publicUrl: m.publicUrl },
      after: null,
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
  });
  if (m.status === 'approved') await storage().unpublish(m.objectKey);
  await storage().delete(m.objectKey);
  if (m.status === 'approved') await revalidateIfPublic(facilityId);
  return { id: m.id, deleted: true };
}

export async function reorderMedia(ctx: ActorContext, facilityId: string, ids: string[]) {
  await assertMember(ctx, facilityId);
  const own = new Set((await repo.listForFacility(db(), facilityId)).map((m) => m.id));
  if (new Set(ids).size !== ids.length || ids.some((id) => !own.has(id))) {
    throw new AppError('VALIDATION_FAILED', 'Daftar media tidak sesuai dengan media profil ini', [{ path: 'ids', message: 'ID media tidak valid' }]);
  }
  await db().transaction(async (tx) => {
    await repo.reorder(tx, facilityId, ids);
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: 'media.reorder',
      entity: 'facility',
      entityId: facilityId,
      before: null,
      after: { ids },
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
  });
  await revalidateIfPublic(facilityId);
  return mediaForOwner(facilityId);
}

/* ---------- Admin: moderasi ---------- */

export async function mediaQueue(q: { status: ReviewStatus; limit: number; cursor?: string }) {
  const offset = decodeOffsetCursor(q.cursor);
  const rows = await repo.queue(db(), { status: q.status, limit: q.limit, offset });
  const page = pageOf(rows, q.limit, offset);
  return {
    items: await Promise.all(
      page.items.map(async ({ objectKey, ...m }) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
        url: m.status === 'approved' ? m.publicUrl : m.status === 'pending' ? await storage().presignGet(objectKey, PREVIEW_TTL_SEC) : null,
      })),
    ),
    nextCursor: page.nextCursor,
  };
}

/** Setujui: salin ke penyimpanan media publik lalu tandai approved, dalam satu transaksi (K8). */
export async function approveMedia(ctx: ActorContext, mediaId: string) {
  const row = await db().transaction(async (tx) => {
    const locked = await repo.lockMedia(tx, mediaId);
    if (!locked) throw notFound('MEDIA_NOT_FOUND', 'Media');
    const m = (await repo.findMediaById(tx, mediaId))!;
    if (!m.confirmedAt) throw new AppError('CONFLICT', 'Media belum selesai diunggah');
    if (m.status !== 'pending') throw new AppError('CONFLICT', 'Media sudah diputuskan');
    const publicUrl = await storage().publish(m.objectKey);
    const decided = await repo.decide(tx, mediaId, { status: 'approved', reviewedBy: ctx.actorId, publicUrl });
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: 'media.approve',
      entity: 'profile_media',
      entityId: mediaId,
      before: { status: 'pending' },
      after: { status: 'approved', publicUrl },
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    return decided;
  });
  await revalidateIfPublic(row.facilityId);
  return view(row, row.publicUrl);
}

export async function rejectMedia(ctx: ActorContext, mediaId: string, reason: string) {
  const row = await db().transaction(async (tx) => {
    const locked = await repo.lockMedia(tx, mediaId);
    if (!locked) throw notFound('MEDIA_NOT_FOUND', 'Media');
    if (locked.status !== 'pending') throw new AppError('CONFLICT', 'Media sudah diputuskan');
    const decided = await repo.decide(tx, mediaId, { status: 'rejected', reviewedBy: ctx.actorId, rejectionReason: reason });
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: 'media.reject',
      entity: 'profile_media',
      entityId: mediaId,
      before: { status: 'pending' },
      after: { status: 'rejected', rejectionReason: reason },
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    return decided;
  });
  // Berkas yang ditolak tidak pernah masuk penyimpanan publik; salinan privat juga dibuang.
  await storage().delete(row.objectKey);
  return view(row, null);
}

/* ---------- Publik ---------- */

export function publicMedia(facilityId: string) {
  return repo.publicMedia(db(), facilityId);
}
