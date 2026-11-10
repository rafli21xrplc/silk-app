import { randomUUID } from 'node:crypto';
import {
  CONSENT_DOC_ALLOWED_MIME,
  CONSENT_DOC_MAX_BYTES,
  VIDEO_CONSENT_TEXT_VERSION,
  VIDEO_MAX_BYTES,
  VIDEO_MAX_COUNT,
  VIDEO_MAX_SECONDS,
  VIDEO_MIN_SECONDS,
  mp4DurationSeconds,
  sniffVideo,
  type ConsentScope,
} from '@silk/shared';
import { db } from '../../lib/db';
import { AppError, notFound } from '../../lib/errors';
import { sniffMime, storage } from '../../lib/storage';
import { recordAudit } from '../m15-admin/audit.repo';
import { findPublishedPractitioner } from '../m1-directory/directory.repo';
import { assertContentAllowed } from '../m17-content-rules/content-rules.service';
import * as repo from './media.repo';

/** Toleransi pembulatan durasi dari header MP4 (sama dengan konfirmasi unggahan portal). */
const DURATION_TOLERANCE_SEC = 0.5;
const DOC_EXT: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };

export interface DemoVideoImport {
  practitionerSlug: string;
  video: { fileName: string; bytes: Buffer };
  consent: { fileName: string; bytes: Buffer; subjectName: string; socialMedia: boolean };
  caption: string | null;
}

export type DemoVideoResult = { status: 'diimpor'; mediaId: string; facilityId: string; durationSec: number } | { status: 'dilewati'; reason: string };

/**
 * Durasi MP4 dari isi berkas, atau galat yang menjelaskan masalahnya. Aturannya sama dengan unggahan
 * portal: MP4 asli (magic bytes), maks. 50 MB, 20–90 detik.
 */
export async function checkDemoVideo(bytes: Buffer): Promise<number> {
  if (sniffVideo(bytes.subarray(0, 16)) !== 'video/mp4') throw new AppError('MEDIA_INVALID', 'Isi berkas bukan video MP4');
  if (bytes.length > VIDEO_MAX_BYTES) throw new AppError('MEDIA_INVALID', 'Ukuran video maksimal 50 MB');
  const measured = await mp4DurationSeconds(async (start, length) => bytes.subarray(start, start + length), bytes.length);
  if (measured === null) throw new AppError('MEDIA_INVALID', 'Durasi video tidak terbaca dari header MP4');
  if (measured > VIDEO_MAX_SECONDS + DURATION_TOLERANCE_SEC) throw new AppError('MEDIA_INVALID', `Durasi video maksimal ${VIDEO_MAX_SECONDS} detik`);
  if (measured < VIDEO_MIN_SECONDS - DURATION_TOLERANCE_SEC) throw new AppError('MEDIA_INVALID', `Durasi video minimal ${VIDEO_MIN_SECONDS} detik`);
  return Math.min(VIDEO_MAX_SECONDS, Math.ceil(measured));
}

/** MIME formulir persetujuan dari isi berkas (PDF, JPEG, PNG; maks. 5 MB). */
export function checkConsentDocument(bytes: Buffer): (typeof CONSENT_DOC_ALLOWED_MIME)[number] {
  const mime = sniffMime(bytes.subarray(0, 16));
  if (!mime || !(CONSENT_DOC_ALLOWED_MIME as readonly string[]).includes(mime)) {
    throw new AppError('DOCUMENT_INVALID', 'Formulir persetujuan harus PDF, JPEG, atau PNG');
  }
  if (bytes.length > CONSENT_DOC_MAX_BYTES) throw new AppError('DOCUMENT_INVALID', 'Ukuran formulir persetujuan maksimal 5 MB');
  return mime as (typeof CONSENT_DOC_ALLOWED_MIME)[number];
}

/**
 * Impor video perkenalan dokter dari tim (evaluasi USP R7) ke profil praktik utama dokter yang sudah terbit.
 * Video masuk antrean moderasi seperti unggahan portal, lengkap dengan formulir persetujuan yang sudah
 * diperiksa; persetujuan tayang tetap lewat `approveMedia`. Idempoten: profil yang sudah punya video
 * aktif dilewati. Dipakai skrip operator `demo-videos`, bukan rute API.
 */
export async function importDemoVideo(input: DemoVideoImport): Promise<DemoVideoResult> {
  const p = await findPublishedPractitioner(db(), input.practitionerSlug);
  if (!p) throw notFound('PRACTITIONER_NOT_FOUND', 'Tenaga medis');
  const facilityId = p.primary_id;
  if (!facilityId) throw new AppError('CONFLICT', 'Dokter belum punya profil praktik terbit untuk menampung video');
  if ((await repo.countActive(db(), facilityId, 'video')) >= VIDEO_MAX_COUNT) {
    return { status: 'dilewati', reason: 'Profil praktik sudah punya video aktif' };
  }
  await assertContentAllowed({ caption: input.caption });
  const durationSec = await checkDemoVideo(input.video.bytes);
  const docMime = checkConsentDocument(input.consent.bytes);
  const subjectName = input.consent.subjectName.trim();
  const scopes: ConsentScope[] = input.consent.socialMedia ? ['profil_web', 'media_sosial'] : ['profil_web'];

  const objectKey = `profiles/${facilityId}/${randomUUID()}.mp4`;
  const docKey = `consents/${facilityId}/${randomUUID()}.${DOC_EXT[docMime]}`;
  await storage().put(objectKey, input.video.bytes, 'video/mp4');
  await storage().put(docKey, input.consent.bytes, docMime);

  try {
    const media = await db().transaction(async (tx) => {
      const inserted = await repo.insertMedia(tx, {
        facilityId,
        kind: 'video',
        objectKey,
        fileName: input.video.fileName,
        mime: 'video/mp4',
        sizeBytes: input.video.bytes.length,
        durationSec,
        caption: input.caption,
        uploadedBy: null,
      });
      await repo.markConfirmed(tx, inserted.id, { sizeBytes: input.video.bytes.length, durationSec });
      const consent = await repo.insertConsent(tx, {
        mediaId: inserted.id,
        facilityId,
        subjectName,
        method: 'dokumen',
        scopes,
        textVersion: VIDEO_CONSENT_TEXT_VERSION,
        document: { objectKey: docKey, fileName: input.consent.fileName, mime: docMime, sizeBytes: input.consent.bytes.length },
        grantedBy: null,
      });
      await repo.confirmConsentDocument(tx, consent.id, input.consent.bytes.length);
      await recordAudit(tx, {
        actorId: null,
        action: 'media.import_demo',
        entity: 'profile_media',
        entityId: inserted.id,
        before: null,
        after: {
          facilityId,
          practitionerSlug: input.practitionerSlug,
          fileName: input.video.fileName,
          durationSec,
          consent: { id: consent.id, subjectName, method: 'dokumen', scopes, textVersion: VIDEO_CONSENT_TEXT_VERSION },
        },
        ip: null,
        requestId: null,
      });
      return inserted;
    });
    return { status: 'diimpor', mediaId: media.id, facilityId, durationSec };
  } catch (err) {
    // Transaksi gagal: jangan tinggalkan berkas yatim di penyimpanan privat.
    await Promise.allSettled([storage().delete(objectKey), storage().delete(docKey)]);
    throw err;
  }
}
