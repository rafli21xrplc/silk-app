'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { CSV_COLUMNS, CSV_MAX_BYTES } from '@silk/shared';
import { FormError } from '@/components/app-shell';
import { ProofUpload } from '@/components/portal/proof-upload';
import { api, ClientApiError, errorMessage, uploadToSignedUrl } from '@/lib/client-api';
import { t } from '@/messages/id';
import { PortalShell } from '../../../portal-shell';

interface ImportResult {
  batchId: string;
  requestId: string;
  status: string;
  rowsValid: number;
}

interface Presigned {
  uploadUrl: string;
  headers: Record<string, string>;
  objectKey: string;
}

/**
 * Wizard impor CSV (M6): presign → unggah langsung ke penyimpanan → API memvalidasi. Sejak Fase 2 (K4)
 * seluruh berkas menjadi satu permintaan harga yang terbit setelah moderator memeriksa dokumen bukti.
 */
export default function PortalImportPage() {
  const { id } = useParams<{ id: string }>();
  return <PortalShell facilityId={id}>{() => <ImportWizard facilityId={id} />}</PortalShell>;
}

function ImportWizard({ facilityId }: { facilityId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<{ path?: string; message: string }[]>([]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return;
    const form = new FormData(e.currentTarget);
    const sourceTitle = String(form.get('sourceTitle') ?? '').trim();
    setBusy(true);
    setError(null);
    setRowErrors([]);
    setResult(null);
    try {
      if (file.size > CSV_MAX_BYTES) throw new Error(`Berkas melebihi ${Math.round(CSV_MAX_BYTES / 1024 / 1024)} MB`);
      const { data: upload } = await api<Presigned>('POST', `/portal/facilities/${facilityId}/tariffs/import/presign`, {
        fileName: file.name,
        sizeBytes: file.size,
      });
      await uploadToSignedUrl(upload, file);
      const { data } = await api<ImportResult>('POST', `/portal/facilities/${facilityId}/tariffs/import`, {
        objectKey: upload.objectKey,
        ...(sourceTitle ? { sourceTitle } : {}),
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof ClientApiError && err.body.code === 'IMPORT_ROW_INVALID' ? t.portal.csvRejected : errorMessage(err));
      if (err instanceof ClientApiError) setRowErrors(err.body.details ?? []);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack">
      <h2>{t.portal.csvTitle}</h2>
      <p>
        {t.portal.csvFormat} <code>{CSV_COLUMNS.join(',')}</code>
      </p>
      <p className="small muted">{t.portal.csvSize}</p>
      <form onSubmit={onSubmit} className="stack card">
        <label>
          {t.portal.csvChoose}
          <input type="file" accept=".csv,text/csv" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <label>
          {t.priceRequest.importSource}
          <input name="sourceTitle" minLength={3} maxLength={200} placeholder={t.priceRequest.sourceTitlePlaceholder} />
        </label>
        <p className="small muted">{t.priceRequest.formHelp}</p>
        <button type="submit" className="btn-primary" disabled={busy || !file}>
          {busy ? t.common.loading : t.portal.csvUpload}
        </button>
      </form>
      {result && (
        <div className="stack card">
          <p className="success" role="status">
            {t.priceRequest.importDone(result.rowsValid)}
          </p>
          <ProofUpload requestId={result.requestId} />
        </div>
      )}
      <FormError error={error} />
      {rowErrors.length > 0 && (
        <ul className="small">
          {rowErrors.slice(0, 200).map((r, i) => (
            <li key={i}>
              {r.path && <strong>{r.path}: </strong>}
              {r.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
