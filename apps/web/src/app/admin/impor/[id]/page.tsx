'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FormError } from '@/components/app-shell';
import { api, errorMessage } from '@/lib/client-api';
import { formatDateTime } from '@/lib/format';
import { t } from '@/messages/id';
import { AdminShell, useAdminData } from '../../admin-shell';
import { LoadingTable } from '@/components/ui/skeleton';

interface BatchDetail {
  batch: {
    id: string;
    status: string;
    fileName: string | null;
    sourceKind: string;
    rowsTotal: number | null;
    rowsProcessed: number;
    error: string | null;
    createdAt: string;
    publishedAt: string | null;
    counts: { valid: number; galat: number; ambigu: number; pending: number };
  };
  problemRows: {
    id: number;
    rowNo: number;
    status: string;
    raw: Record<string, string>;
    errors: { field: string; code: string; message: string }[];
    candidates: { id: string; name: string; city: string; score: number }[];
  }[];
}

export default function AdminImportDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <AdminShell>{() => <Detail id={id} />}</AdminShell>;
}

function Detail({ id }: { id: string }) {
  const { items: data, error, reload, handle } = useAdminData<BatchDetail>(`/admin/imports/${id}`);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Batch besar diproses bertahap oleh job; segarkan selama masih diunggah.
  const processing = data?.batch.status === 'diunggah';
  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(reload, 5000);
    return () => clearInterval(timer);
  }, [processing, reload]);

  async function call(fn: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      reload();
    } catch (err) {
      handle(err);
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!data) return error ? <p className="error">{error}</p> : <LoadingTable rows={6} cols={4} />;
  const { batch, problemRows } = data;
  const canPublish =
    (batch.status === 'divalidasi' || batch.status === 'ditinjau') &&
    batch.counts.ambigu === 0 &&
    batch.counts.valid > 0;
  return (
    <section className="stack">
      <p>
        <Link href="/admin/impor">← {t.common.back}</Link>
      </p>
      <h2>{batch.fileName ?? batch.id}</h2>
      <dl className="kv">
        <dt>{t.common.status}</dt>
        <dd>
          {t.admin.batchStatus[batch.status] ?? batch.status}
          {processing && ` (${batch.rowsProcessed}/${batch.rowsTotal ?? '?'})`}
        </dd>
        <dt>{t.admin.sourceKind}</dt>
        <dd>{t.sourceKind[batch.sourceKind]}</dd>
        <dt>{t.admin.rows}</dt>
        <dd>
          {t.admin.rowsValid}: {batch.counts.valid} · {t.admin.rowsInvalid}: {batch.counts.galat} ·{' '}
          {t.admin.resolve}: {batch.counts.ambigu}
        </dd>
        <dt>{t.common.date}</dt>
        <dd>{formatDateTime(batch.createdAt)}</dd>
        {batch.publishedAt && (
          <>
            <dt>{t.admin.publish}</dt>
            <dd>{formatDateTime(batch.publishedAt)}</dd>
          </>
        )}
      </dl>
      {batch.error && <p className="error">{batch.error}</p>}
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      <FormError error={actionError} />
      {canPublish && (
        <p>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() =>
              call(async () => {
                const { data: r } = await api<{ created: number; skipped: number }>(
                  'POST',
                  `/admin/imports/${id}/publish`,
                );
                setNotice(t.admin.published(r.created, r.skipped));
              })
            }
          >
            {t.admin.publish} ({batch.counts.valid})
          </button>
        </p>
      )}
      {problemRows.length > 0 && (
        <>
          <h3>{t.admin.problems}</h3>
          <div className="table-scroll" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">{t.admin.rows}</th>
                  <th scope="col">{t.common.status}</th>
                  <th scope="col">{t.admin.candidates}</th>
                </tr>
              </thead>
              <tbody>
                {problemRows.map((r) => (
                  <tr key={r.id}>
                    <th scope="row">{r.rowNo}</th>
                    <td className="small">
                      {r.raw.facility_name} · {r.raw.city} · {r.raw.service_slug} ·{' '}
                      {r.raw.price_min}
                      {r.errors.map((e, i) => (
                        <div key={i} className="error">
                          {e.field}: {e.message}
                        </div>
                      ))}
                    </td>
                    <td>{r.status}</td>
                    <td>
                      {r.status === 'ambigu' &&
                        r.candidates.map((c) => (
                          <div key={c.id}>
                            <button
                              type="button"
                              className="btn-link"
                              disabled={busy}
                              onClick={() =>
                                call(() =>
                                  api('PATCH', `/admin/imports/${id}/rows/${r.id}`, {
                                    facilityId: c.id,
                                  }),
                                )
                              }
                            >
                              {c.name} ({c.city}, {Math.round(c.score * 100)}%)
                            </button>
                          </div>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
