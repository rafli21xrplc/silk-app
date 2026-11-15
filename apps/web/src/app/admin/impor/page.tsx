'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CSV_COLUMNS, DATA_SOURCE_KINDS } from '@silk/shared';
import { FileUp } from 'lucide-react';
import { FormError } from '@/components/app-shell';
import { ListSearch, ListToolbar, NoResults, withQuery } from '@/components/ui/list-search';
import { DataPanel } from '@/components/ui/data-panel';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/select';
import { LoadingTable } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { api, errorMessage, uploadToSignedUrl } from '@/lib/client-api';
import { formatDateTime } from '@/lib/format';
import { t } from '@/messages/id';
import { AdminShell, useAdminList } from '../admin-shell';

interface BatchRow {
  id: string;
  status: string;
  fileName: string | null;
  sourceKind: string;
  rowsTotal: number | null;
  rowsValid: number;
  rowsInvalid: number;
  createdAt: string;
}

export default function AdminImportsPage() {
  return <AdminShell>{() => <Imports />}</AdminShell>;
}

function Imports() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const { rows, busy: paging, pagination, error } = useAdminList<BatchRow>(withQuery('/admin/imports', q));
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const file = f.get('file');
    if (!(file instanceof File) || file.size === 0) return;
    setBusy(true);
    setUploadError(null);
    try {
      const { data: upload } = await api<{
        uploadUrl: string;
        headers: Record<string, string>;
        objectKey: string;
      }>('POST', '/admin/imports/presign', {
        fileName: file.name,
        sizeBytes: file.size,
      });
      await uploadToSignedUrl(upload, file);
      const { data } = await api<{ batch: { id: string } }>('POST', '/admin/imports', {
        objectKey: upload.objectKey,
        fileName: file.name,
        sourceKind: String(f.get('sourceKind')),
      });
      router.push(`/admin/impor/${data.batch.id}`);
    } catch (err) {
      setUploadError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="card stack">
        <h2>{t.admin.importNew}</h2>
        <p className="small">
          {t.portal.csvFormat} <code>{CSV_COLUMNS.join(',')}</code>
        </p>
        <FormError error={uploadError} />
        <div className="row">
          <label className="grow">
            {t.admin.file}
            <input type="file" name="file" accept=".csv,text/csv" required />
          </label>
          <label>
            {t.admin.sourceKind}
            <Select
              name="sourceKind"
              defaultValue="perda"
              label={t.admin.sourceKind}
              options={DATA_SOURCE_KINDS.map((k) => ({ value: k, label: t.sourceKind[k] ?? k }))}
            />
          </label>
        </div>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? t.common.loading : t.portal.csvUpload}
        </button>
      </form>
      <ListToolbar>
        <ListSearch placeholder={t.listSearch.imports} onSearch={setQ} />
      </ListToolbar>
      {error && <p className="error">{error}</p>}
      {rows === null && !error && <LoadingTable cols={4} />}
      {rows?.length === 0 && q && <NoResults q={q} />}
      {rows?.length === 0 && !q && (
        <EmptyState icon={FileUp} title={t.admin.emptyState.imports.title}>
          {t.admin.emptyState.imports.body}
        </EmptyState>
      )}
      {rows && rows.length > 0 && (
        <DataPanel pagination={pagination} busy={paging} label={t.admin.imports}>
          <table>
            <thead>
              <tr>
                <th scope="col">{t.admin.file}</th>
                <th scope="col">{t.common.status}</th>
                <th scope="col" className="text-right">
                  {t.admin.rowsValid}
                </th>
                <th scope="col" className="text-right">
                  {t.admin.rowsInvalid}
                </th>
                <th scope="col">{t.common.date}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <th scope="row">
                    <Link href={`/admin/impor/${b.id}`}>{b.fileName ?? b.id.slice(0, 8)}</Link>
                    <div className="small muted font-normal">{t.sourceKind[b.sourceKind]}</div>
                  </th>
                  <td>
                    <span className="badge badge-status">
                      {t.admin.batchStatus[b.status] ?? b.status}
                    </span>
                  </td>
                  <td className="text-right tabular-nums">{b.rowsValid}</td>
                  <td
                    className={cn(
                      'text-right tabular-nums',
                      b.rowsInvalid > 0 && 'font-semibold text-danger',
                    )}
                  >
                    {b.rowsInvalid}
                  </td>
                  <td className="whitespace-nowrap">{formatDateTime(b.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataPanel>
      )}
    </>
  );
}
