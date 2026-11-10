'use client';

import { CONSENT_DOC_ALLOWED_MIME } from '@silk/shared';
import { formatDateTime } from '@/lib/format';
import type { MediaConsentView } from '@/lib/portal-types';
import type { ConsentDraft } from '@/lib/profile';
import { t } from '@/messages/id';

/**
 * Isian persetujuan tertulis orang yang tampil di video (evaluasi USP R6). Dokter yang tampil sendiri
 * cukup memberi pernyataan di akunnya; selain itu wajib formulir bertanda tangan.
 */
export function VideoConsentFields({
  draft,
  onChange,
  onFile,
  selfAllowed,
  disabled,
}: {
  draft: ConsentDraft;
  onChange: (next: ConsentDraft) => void;
  /** Berkas formulir disimpan pemanggil; draf hanya memuat nama, jenis, dan ukurannya. */
  onFile: (file: File | null) => void;
  selfAllowed: boolean;
  disabled?: boolean;
}) {
  const set = (patch: Partial<ConsentDraft>) => onChange({ ...draft, ...patch });
  const c = t.profile.consent;
  return (
    <fieldset className="grid gap-3 rounded-2xl border border-line bg-surface/60 p-4" disabled={disabled}>
      <legend className="px-1 font-semibold">{c.title}</legend>
      <p className="small muted m-0">{c.intro}</p>

      {selfAllowed && (
        <div className="grid gap-1.5" role="radiogroup" aria-label={c.methodLabel}>
          <span className="text-sm font-semibold">{c.methodLabel}</span>
          <label className="flex items-center gap-2 font-normal">
            <input type="radio" name="consent-method" checked={draft.method === 'pernyataan_akun'} onChange={() => set({ method: 'pernyataan_akun', document: null })} />
            {c.methodSelf}
          </label>
          <label className="flex items-center gap-2 font-normal">
            <input type="radio" name="consent-method" checked={draft.method === 'dokumen'} onChange={() => set({ method: 'dokumen' })} />
            {c.methodDoc}
          </label>
        </div>
      )}

      <label>
        {c.subject}
        <input value={draft.subjectName} maxLength={120} autoComplete="name" onChange={(e) => set({ subjectName: e.target.value })} />
      </label>

      {draft.method === 'dokumen' && (
        <label>
          {c.document}
          <input
            type="file"
            accept={CONSENT_DOC_ALLOWED_MIME.join(',')}
            onChange={(e) => {
              const f = e.target.files?.[0];
              set({ document: f ? { name: f.name, type: f.type, size: f.size } : null });
              onFile(f ?? null);
            }}
          />
          <span className="small muted">{c.documentHelp}</span>
        </label>
      )}

      <label className="flex items-start gap-2 font-normal">
        <input type="checkbox" className="mt-1" checked={draft.socialMedia} onChange={(e) => set({ socialMedia: e.target.checked })} />
        {c.socialMedia}
      </label>
      <label className="flex items-start gap-2 font-normal">
        <input type="checkbox" className="mt-1" checked={draft.declaration} onChange={(e) => set({ declaration: e.target.checked })} />
        <span>{draft.method === 'pernyataan_akun' ? c.declarationSelf : c.declarationDoc}</span>
      </label>
    </fieldset>
  );
}

/** Ringkasan persetujuan untuk pengelola profil dan moderator; `null` berarti video belum boleh disetujui. */
export function ConsentSummary({ consent }: { consent: MediaConsentView | null }) {
  const c = t.profile.consent;
  if (!consent) return <p className="small m-0 rounded-xl bg-warn-soft px-3 py-2">{c.missing}</p>;
  const scopes = consent.scopes.map((s) => c.scopes[s] ?? s).join(', ');
  return (
    <p className="small m-0 rounded-xl bg-surface px-3 py-2">
      <strong>{c.summary}:</strong> {consent.subjectName} · {c.via[consent.method] ?? consent.method} · {scopes} · {formatDateTime(consent.grantedAt)}
      {consent.document && (
        <>
          {' · '}
          <a href={consent.document.url} target="_blank" rel="noreferrer">
            {c.openDocument}
          </a>
        </>
      )}
    </p>
  );
}
