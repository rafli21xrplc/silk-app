'use client';

import { useState } from 'react';
import { DOCUMENT_ALLOWED_MIME, DOCUMENT_MAX_BYTES } from '@silk/shared';
import { FormError } from '@/components/app-shell';
import { api, errorMessage, uploadToSignedUrl } from '@/lib/client-api';
import { t } from '@/messages/id';

/** Unggah dokumen bukti untuk permintaan harga (K4); wajib sebelum moderator menyetujui. */
export function ProofUpload({ requestId, onUploaded }: { requestId: string; onUploaded?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setDone(false);
    if (!(DOCUMENT_ALLOWED_MIME as readonly string[]).includes(file.type) || file.size > DOCUMENT_MAX_BYTES) {
      setError(t.priceRequest.proofHelp);
      return;
    }
    setBusy(true);
    try {
      const { data } = await api<{ documentId: string; uploadUrl: string; headers: Record<string, string> }>(
        'POST',
        `/portal/tariff-requests/${requestId}/documents/presign`,
        { fileName: file.name, mime: file.type, sizeBytes: file.size },
      );
      await uploadToSignedUrl(data, file);
      await api('POST', `/portal/tariff-requests/${requestId}/documents/${data.documentId}/confirm`);
      setDone(true);
      onUploaded?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <label>
        {t.priceRequest.proofTitle}
        <input type="file" accept={DOCUMENT_ALLOWED_MIME.join(',')} onChange={onChange} disabled={busy} />
      </label>
      <p className="small muted">{t.priceRequest.proofHelp}</p>
      {busy && <p aria-busy="true">{t.common.loading}</p>}
      {done && (
        <p className="success" role="status">
          {t.priceRequest.proofUploaded}
        </p>
      )}
      <FormError error={error} />
    </div>
  );
}
