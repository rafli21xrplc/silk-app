'use client';

import { ArrowLeft, ArrowRight, ImagePlus, Trash2, Video } from 'lucide-react';
import { useState } from 'react';
import { PHOTO_ALLOWED_MIME, PHOTO_MAX_COUNT, VIDEO_ALLOWED_MIME, type MediaKind, type VideoConsentInput } from '@silk/shared';
import { FormError } from '@/components/app-shell';
import { api, errorMessage, uploadToSignedUrl } from '@/lib/client-api';
import { consentFromDraft, mediaFileProblem, type ConsentDraft } from '@/lib/profile';
import type { PortalMedia } from '@/lib/portal-types';
import { cn } from '@/lib/cn';
import { useQuery } from '@/lib/query-cache';
import { ME_STALE_MS } from '@/lib/use-me';
import type { Me } from '@/lib/types';
import { ConsentSummary, VideoConsentFields } from './video-consent-fields';
import { t } from '@/messages/id';

/** Durasi video dibaca dari metadata di browser; NaN bila tidak terbaca. */
function readDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    const done = (n: number) => {
      URL.revokeObjectURL(url);
      resolve(n);
    };
    v.onloadedmetadata = () => done(v.duration);
    v.onerror = () => done(Number.NaN);
    v.src = url;
  });
}

type PresignResult = {
  mediaId: string;
  uploadUrl: string;
  headers: Record<string, string>;
  consentUpload?: { uploadUrl: string; headers: Record<string, string> };
};

const emptyConsent = (method: ConsentDraft['method']): ConsentDraft => ({ method, subjectName: '', socialMedia: false, declaration: false, document: null });

const STATUS_CLASS: Record<string, string> = {
  pending: 'badge-status',
  approved: 'badge-diverifikasi_admin',
  rejected: 'badge-stale',
};

/** Foto dan video profil (K8): unggah lewat signed URL, konfirmasi di API, tampil setelah dimoderasi. */
export function MediaManager({
  facilityId,
  media,
  onChanged,
  disabled,
  photoHint,
}: {
  facilityId: string;
  media: PortalMedia[];
  onChanged: () => void;
  disabled?: boolean;
  /** Fase 4b: profil praktik dokter memakai foto pertama sebagai foto profil dokter. */
  photoHint?: string;
}) {
  const photos = media.filter((m) => m.kind === 'foto');
  const videos = media.filter((m) => m.kind === 'video');
  const activePhotos = photos.filter((m) => m.status !== 'rejected').length;
  const [busy, setBusy] = useState<MediaKind | 'order' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  // Pernyataan di akun hanya untuk dokter yang tampil sendiri; API menegakkan aturan yang sama (USP R6).
  const { data: me } = useQuery<Me>('/me', { staleMs: ME_STALE_MS });
  const selfAllowed = me?.user.role === 'tenaga_medis';
  const [consent, setConsent] = useState<ConsentDraft>(emptyConsent('pernyataan_akun'));
  const [consentDoc, setConsentDoc] = useState<File | null>(null);
  // Default pernyataan di akun; akun selain tenaga medis selalu memakai formulir.
  const draft: ConsentDraft = !selfAllowed && consent.method === 'pernyataan_akun' ? { ...consent, method: 'dokumen' } : consent;

  async function upload(kind: MediaKind, file: File) {
    setError(null);
    let consentBody: { consent: VideoConsentInput } | null = null;
    if (kind === 'video') {
      const c = consentFromDraft(draft, selfAllowed);
      if ('problem' in c) {
        setError(t.profile.consent.problems[c.problem] ?? t.common.error);
        return;
      }
      consentBody = c;
    }
    const durationSec = kind === 'video' ? await readDuration(file) : null;
    const problem = mediaFileProblem(kind, file, durationSec);
    if (problem) {
      setError(t.profile.mediaProblem[problem] ?? t.common.error);
      return;
    }
    setBusy(kind);
    try {
      const { data } = await api<PresignResult>('POST', `/portal/facilities/${facilityId}/media/presign`, {
        kind,
        fileName: file.name,
        mime: file.type,
        sizeBytes: file.size,
        caption: caption.trim() || null,
        ...(kind === 'video' ? { durationSec, ...consentBody } : {}),
      });
      await uploadToSignedUrl(data, file);
      if (data.consentUpload) {
        if (!consentDoc) throw new Error(t.profile.consent.problems.document);
        await uploadToSignedUrl(data.consentUpload, consentDoc);
      }
      await api('POST', `/portal/facilities/${facilityId}/media/${data.mediaId}/confirm`);
      setCaption('');
      if (kind === 'video') {
        setConsent(emptyConsent('pernyataan_akun'));
        setConsentDoc(null);
      }
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function remove(m: PortalMedia) {
    if (!window.confirm(t.profile.confirmDelete)) return;
    setError(null);
    try {
      await api('DELETE', `/portal/facilities/${facilityId}/media/${m.id}`);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function move(index: number, delta: -1 | 1) {
    const ids = photos.map((p) => p.id);
    const j = index + delta;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j]!, ids[index]!];
    setBusy('order');
    setError(null);
    try {
      await api('PUT', `/portal/facilities/${facilityId}/media/order`, { ids: [...ids, ...videos.map((v) => v.id)] });
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const fileInput = (kind: MediaKind) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void upload(kind, file);
  };

  return (
    <section className="stack card" aria-labelledby="media-title">
      <h2 id="media-title">{t.profile.media}</h2>
      <p className="small muted">{t.profile.mediaHelp}</p>
      {photoHint && <p className="small rounded-xl bg-sky px-3 py-2 text-sky-ink">{photoHint}</p>}
      <FormError error={error} />

      <h3>{t.profile.photos}</h3>
      {photos.length === 0 ? (
        <p className="small muted">{t.profile.noPhotos}</p>
      ) : (
        <ul className="plain grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((m, i) => (
            <li key={m.id} className="overflow-hidden rounded-2xl border border-line bg-white">
              <div className="aspect-[4/3] bg-surface-2">
                {m.url ? (
                  <img src={m.url} alt={m.caption ?? m.fileName} className="size-full object-cover" loading="lazy" />
                ) : null}
              </div>
              <div className="grid gap-1 p-2 text-sm">
                <span className={cn('badge justify-self-start', STATUS_CLASS[m.status])}>{t.profile.mediaStatus[m.status] ?? m.status}</span>
                {m.caption && <span className="truncate">{m.caption}</span>}
                {m.rejectionReason && <span className="small text-danger">{m.rejectionReason}</span>}
                <div className="flex items-center justify-between gap-1">
                  <span className="flex gap-1">
                    <button type="button" className="btn-link" aria-label={t.profile.moveEarlier} disabled={disabled || busy !== null || i === 0} onClick={() => void move(i, -1)}>
                      <ArrowLeft className="size-4" aria-hidden="true" />
                    </button>
                    <button type="button" className="btn-link" aria-label={t.profile.moveLater} disabled={disabled || busy !== null || i === photos.length - 1} onClick={() => void move(i, 1)}>
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </button>
                  </span>
                  <button type="button" className="btn-link inline-flex items-center gap-1" disabled={disabled} onClick={() => void remove(m)}>
                    <Trash2 className="size-4" aria-hidden="true" />
                    {t.profile.deleteMedia}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {activePhotos < PHOTO_MAX_COUNT && (
        <div className="row items-end">
          <label>
            {t.profile.caption}
            <input value={caption} maxLength={200} onChange={(e) => setCaption(e.target.value)} disabled={disabled} />
          </label>
          <label className={cn('btn inline-flex cursor-pointer items-center gap-1.5', (disabled || busy) && 'pointer-events-none opacity-55')}>
            <ImagePlus className="size-4" aria-hidden="true" />
            {busy === 'foto' ? t.profile.uploading : t.profile.addPhoto}
            <input type="file" className="sr-only" accept={PHOTO_ALLOWED_MIME.join(',')} onChange={fileInput('foto')} disabled={disabled || busy !== null} />
          </label>
        </div>
      )}

      <h3>{t.profile.video}</h3>
      {videos.length === 0 ? (
        <p className="small muted">{t.profile.noVideo}</p>
      ) : (
        videos.map((m) => (
          <div key={m.id} className="grid gap-2 rounded-2xl border border-line bg-white p-3 sm:grid-cols-[minmax(0,320px)_1fr]">
            {m.url ? (
              <video controls preload="none" src={m.url} className="w-full rounded-xl bg-ink" aria-label={m.caption ?? m.fileName} />
            ) : (
              <div className="grid aspect-video place-items-center rounded-xl bg-surface-2">
                <Video className="size-6 text-muted" aria-hidden="true" />
              </div>
            )}
            <div className="grid content-start gap-1 text-sm">
              <span className={cn('badge justify-self-start', STATUS_CLASS[m.status])}>{t.profile.mediaStatus[m.status] ?? m.status}</span>
              <span>
                {m.fileName}
                {m.durationSec ? ` · ${t.moderation.duration(m.durationSec)}` : ''}
              </span>
              {m.rejectionReason && <span className="small text-danger">{m.rejectionReason}</span>}
              {m.status !== 'rejected' && <ConsentSummary consent={m.consent} />}
              {m.consent && <span className="small muted">{t.profile.consent.revokeNote}</span>}
              <button type="button" className="btn-link inline-flex items-center gap-1 justify-self-start" disabled={disabled} onClick={() => void remove(m)}>
                <Trash2 className="size-4" aria-hidden="true" />
                {t.profile.deleteMedia}
              </button>
            </div>
          </div>
        ))
      )}
      {!videos.some((v) => v.status !== 'rejected') && (
        <VideoConsentFields draft={draft} onChange={setConsent} onFile={setConsentDoc} selfAllowed={selfAllowed} disabled={disabled || busy !== null} />
      )}
      {!videos.some((v) => v.status !== 'rejected') && (
        <label className={cn('btn inline-flex cursor-pointer items-center gap-1.5 justify-self-start', (disabled || busy) && 'pointer-events-none opacity-55')}>
          <Video className="size-4" aria-hidden="true" />
          {busy === 'video' ? t.profile.uploading : t.profile.addVideo}
          <input type="file" className="sr-only" accept={VIDEO_ALLOWED_MIME.join(',')} onChange={fileInput('video')} disabled={disabled || busy !== null} />
        </label>
      )}
    </section>
  );
}
