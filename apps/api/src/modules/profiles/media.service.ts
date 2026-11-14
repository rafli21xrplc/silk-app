import { randomUUID } from 'node:crypto';
import {
  CONSENT_DOC_ALLOWED_MIME,
  CONSENT_DOC_MAX_BYTES,
  VIDEO_CONSENT_TEXT_VERSION,
  VIDEO_MIN_SECONDS,
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
import { revalidatePractitionersOfFacilities } from '../m1-directory/practitioner-cache';
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
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

type MediaRow = Awaited<ReturnType<typeof repo.findMediaById>> & object;
type ConsentRow = Awaited<ReturnType<typeof repo.activeConsent>> & object;

/** Ringkasan persetujuan untuk pemilik profil dan moderator; formulir hanya lewat signed URL berumur pendek. */
async function consentView(c: ConsentRow | undefined | null) {
  if (!c) return null;
  return {
    subjectName: c.subjectName,
    method: c.method,
    scopes: c.scopes,
    textVersion: c.textVersion,
    grantedAt: c.grantedAt.toISOString(),
    document:
      c.documentObjectKey && c.documentConfirmedAt
        ? { fileName: c.documentFileName, mime: c.documentMime, url: await storage().presignGet(c.documentObjectKey, PREVIEW_TTL_SEC) }
        : null,
  };
}

async function previewUrl(m: MediaRow): Promise<string | null> {
  if (m.status === 'approved' && m.publicUrl) return m.publicUrl;
  if (m.status === 'pending' && m.confirmedAt) return storage().presignGet(m.objectKey, PREVIEW_TTL_SEC);
  return null;
}

function view(m: MediaRow, url: string | null, consent: Awaited<ReturnType<typeof consentView>> = null) {
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
    consent,
    createdAt: m.createdAt.toISOString(),
  };
}

async function revalidateIfPublic(facilityId: string) {
  const f = await repo.facilityStatus(db(), facilityId);
  if (f?.status !== 'terbit') return;
  await revalidate([tags.facility(f.slug)]);
  // Foto dan video profil praktik juga tampil di halaman dokter (Fase 4b).
  await revalidatePractitionersOfFacilities([facilityId]);
}

/* ---------- Portal ---------- */

export async function mediaForOwner(facilityId: string) {
  const rows = await repo.listForFacility(db(), facilityId);
  const consents = await repo.activeConsentsFor(
    db(),
    rows.filter((m) => m.kind === 'video').map((m) => m.id),
  );
  return Promise.all(rows.map(async (m) => view(m, await previewUrl(m), await consentView(consents.find((c) => c.mediaId === m.id)))));
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
  const consent = input.kind === 'video' ? input.consent : null;
  // Pernyataan di akun hanya sah bila orang yang tampil adalah pemilik akun: dokter (tenaga medis) itu sendiri.
  if (consent?.method === 'pernyataan_akun' && ctx.role !== 'tenaga_medis') {
    throw new AppError(
      'CONSENT_METHOD_NOT_ALLOWED',
      'Pernyataan di akun hanya untuk dokter yang tampil sendiri di videonya. Unggah formulir persetujuan bertanda tangan dari orang yang tampil.',
    );
  }
  const objectKey = `profiles/${facilityId}/${randomUUID()}.${EXT[input.mime]}`;
  const docKey = consent?.method === 'dokumen' ? `consents/${facilityId}/${randomUUID()}.${EXT[consent.document.mime]}` : null;
  const upload = await storage().presignPut(objectKey, input.mime, input.sizeBytes);
  const consentUpload = consent?.method === 'dokumen' && docKey ? await storage().presignPut(docKey, consent.document.mime, consent.document.sizeBytes) : null;

  const row = await db().transaction(async (tx) => {
    const media = await repo.insertMedia(tx, {
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
    if (consent) {
      const granted = await repo.insertConsent(tx, {
        mediaId: media.id,
        facilityId,
        subjectName: consent.subjectName,
        method: consent.method,
        scopes: consent.scopes,
        textVersion: VIDEO_CONSENT_TEXT_VERSION,
        document:
          consent.method === 'dokumen' && docKey
            ? { objectKey: docKey, fileName: consent.document.fileName, mime: consent.document.mime, sizeBytes: consent.document.sizeBytes }
            : null,
        grantedBy: ctx.actorId,
      });
      await recordAudit(tx, {
        actorId: ctx.actorId,
        action: 'media.consent.grant',
        entity: 'media_consent',
        entityId: granted.id,
        before: null,
        after: { mediaId: media.id, facilityId, subjectName: consent.subjectName, method: consent.method, scopes: consent.scopes, textVersion: VIDEO_CONSENT_TEXT_VERSION },
        ip: ctx.ip,
        requestId: ctx.requestId,
      });
    }
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: 'media.presign',
      entity: 'profile_media',
      entityId: media.id,
      before: null,
      after: { facilityId, kind: input.kind, fileName: input.fileName, mime: input.mime, sizeBytes: input.sizeBytes },
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    return media;
  });
  return { mediaId: row.id, ...upload, ...(consentUpload ? { consentUpload } : {}) };
}

/** Setelah unggah: periksa ukuran nyata, magic bytes, dan durasi MP4. Berkas tidak sah dihapus. */
export async function confirmMedia(ctx: ActorContext, facilityId: string, mediaId: string) {
  await assertMember(ctx, facilityId);
  const m = await repo.findMedia(db(), facilityId, mediaId);
  if (!m) throw notFound('MEDIA_NOT_FOUND', 'Media');
  if (m.confirmedAt) return view(m, await previewUrl(m));
  const info = await storage().head(m.objectKey);
  if (!info) throw new AppError('MEDIA_INVALID', 'Berkas belum diunggah');

  const consent = m.kind === 'video' ? await repo.activeConsent(db(), m.id) : null;
  const reject = async (reason: string): Promise<never> => {
    await storage().delete(m.objectKey);
    if (consent) {
      // Unggahan gagal: persetujuan belum pernah berlaku, jadi dihapus bersama medianya (bukan dicabut).
      if (consent.documentObjectKey) await storage().delete(consent.documentObjectKey);
      await repo.deleteConsentRow(db(), consent.id);
    }
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
    if (info.sizeBytes > VIDEO_MAX_BYTES) await reject('Ukuran video melebihi 50 MB');
    const sniffed = sniffVideo(await storage().readStart(m.objectKey, 16));
    if (!sniffed || sniffed !== m.mime) await reject('Isi berkas bukan video MP4 atau WebM');
    if (m.mime === 'video/mp4') {
      const measured = await mp4DurationSeconds((start, length) => storage().readRange(m.objectKey, start, length), info.sizeBytes);
      if (measured === null) await reject('Durasi video tidak dapat dibaca');
      if (measured! > VIDEO_MAX_SECONDS + DURATION_TOLERANCE_SEC) await reject(`Durasi video maksimal ${VIDEO_MAX_SECONDS} detik`);
      if (measured! < VIDEO_MIN_SECONDS - DURATION_TOLERANCE_SEC) await reject(`Durasi video minimal ${VIDEO_MIN_SECONDS} detik`);
      durationSec = Math.min(VIDEO_MAX_SECONDS, Math.ceil(measured!));
    } else {
      // WebM tidak bisa diukur andal tanpa ffprobe; durasi dari browser dicek moderator (K8).
      durationSec = m.durationSec;
    }
    // Persetujuan wajib ada; formulir (metode dokumen) diperiksa seperti dokumen lain: ukuran nyata dan magic bytes.
    if (!consent) await reject('Persetujuan orang yang tampil di video belum diberikan');
    if (consent!.method === 'dokumen') {
      const doc = consent!.documentObjectKey ? await storage().head(consent!.documentObjectKey) : null;
      if (!doc) await reject('Formulir persetujuan belum diunggah');
      if (doc!.sizeBytes > CONSENT_DOC_MAX_BYTES) await reject('Ukuran formulir persetujuan melebihi 5 MB');
      const sniffedDoc = sniffMime(await storage().readStart(consent!.documentObjectKey!, 16));
      if (!sniffedDoc || !(CONSENT_DOC_ALLOWED_MIME as readonly string[]).includes(sniffedDoc) || sniffedDoc !== consent!.documentMime) {
        await reject('Isi formulir persetujuan bukan PDF, JPEG, atau PNG');
      }
      await repo.confirmConsentDocument(db(), consent!.id, doc!.sizeBytes);
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
  return view(confirmed, await previewUrl(confirmed), await consentView(consent ? await repo.activeConsent(db(), m.id) : null));
}

export async function deleteMedia(ctx: ActorContext, facilityId: string, mediaId: string) {
  await assertMember(ctx, facilityId);
  const m = await repo.findMedia(db(), facilityId, mediaId);
  if (!m) throw notFound('MEDIA_NOT_FOUND', 'Media');
  await db().transaction(async (tx) => {
    // Menghapus video = mencabut persetujuan; barisnya tetap sebagai jejak (evaluasi USP R6).
    const revoked = await repo.revokeConsent(tx, m.id, { revokedBy: ctx.actorId, reason: 'Video dihapus oleh pengelola profil' });
    if (revoked) {
      await recordAudit(tx, {
        actorId: ctx.actorId,
        action: 'media.consent.revoke',
        entity: 'media_consent',
        entityId: revoked.id,
        before: { mediaId: m.id },
        after: { revoked: true },
        ip: ctx.ip,
        requestId: ctx.requestId,
      });
    }
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

export async function mediaQueue(q: { status: ReviewStatus; q?: string; limit: number; cursor?: string }) {
  const offset = decodeOffsetCursor(q.cursor);
  const rows = await repo.queue(db(), { status: q.status, q: q.q, limit: q.limit, offset });
  const page = pageOf(rows, q.limit, offset);
  const consents = await repo.activeConsentsFor(
    db(),
    page.items.filter((m) => m.kind === 'video').map((m) => m.id),
  );
  return {
    items: await Promise.all(
      page.items.map(async ({ objectKey, ...m }) => ({
        ...m,
        consent: await consentView(consents.find((c) => c.mediaId === m.id)),
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
    // Evaluasi USP R6: video hanya boleh tampil dengan persetujuan tertulis orang yang tampil.
    if (m.kind === 'video') {
      const consent = await repo.activeConsent(tx, mediaId);
      if (!consent || (consent.method === 'dokumen' && !consent.documentConfirmedAt)) {
        throw new AppError('MEDIA_CONSENT_REQUIRED', 'Video belum punya persetujuan tertulis dari orang yang tampil');
      }
    }
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
