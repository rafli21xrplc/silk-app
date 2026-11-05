'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { FormError } from '@/components/app-shell';
import { LoadingForm } from '@/components/ui/skeleton';
import { api, errorMessage } from '@/lib/client-api';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { describeProfileField } from '@/lib/profile';
import { queryCache } from '@/lib/query-cache';
import { t } from '@/messages/id';
import { AdminShell, useAdminData } from '../../../admin-shell';
import { RejectForm } from '../../reject-form';

interface RevisionDetail {
  id: string;
  status: string;
  payload: Record<string, unknown>;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  facilityId: string;
  current: (Record<string, unknown> & { name: string; slug: string; status: string }) | null;
}

export default function AdminRevisionPage() {
  const { id } = useParams<{ id: string }>();
  return <AdminShell>{() => <Detail id={id} />}</AdminShell>;
}

function Detail({ id }: { id: string }) {
  const router = useRouter();
  const { items: rev, error, reload, handle } = useAdminData<RevisionDetail>(`/admin/profile-revisions/${id}`);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function decide(kind: 'approve' | 'reject', body?: object) {
    setBusy(true);
    setActionError(null);
    try {
      await api('POST', `/admin/profile-revisions/${id}/${kind}`, body);
      queryCache.invalidate('/admin/profile-revisions');
      queryCache.invalidate('/admin/overview');
      reload();
      router.push('/admin/moderasi?tab=revisi');
    } catch (err) {
      handle(err);
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!rev) return error ? <p className="error">{error}</p> : <LoadingForm fields={4} />;
  const keys = Object.keys(rev.payload);
  return (
    <section className="stack">
      <p>
        <Link href="/admin/moderasi?tab=revisi">← {t.common.back}</Link>
      </p>
      <h2>{rev.current?.name}</h2>
      <dl className="kv">
        <dt>{t.common.status}</dt>
        <dd>{t.priceRequest.status[rev.status] ?? rev.status}</dd>
        <dt>{t.common.date}</dt>
        <dd>{formatDateTime(rev.createdAt)}</dd>
        {rev.current?.status === 'terbit' && (
          <>
            <dt>{t.portal.viewPublic}</dt>
            <dd>
              <a href={`/faskes/${rev.current.slug}`} target="_blank" rel="noopener noreferrer">
                /faskes/{rev.current.slug}
              </a>
            </dd>
          </>
        )}
        {rev.rejectionReason && (
          <>
            <dt>{t.admin.reasonLabel}</dt>
            <dd>{rev.rejectionReason}</dd>
          </>
        )}
      </dl>
      <div className="table-scroll" tabIndex={0}>
        <table>
          <caption className="sr-only">{t.moderation.tabs.revisi}</caption>
          <thead>
            <tr>
              <th scope="col">{t.moderation.field}</th>
              <th scope="col">{t.moderation.current}</th>
              <th scope="col">{t.moderation.proposed}</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => {
              const before = describeProfileField(k, rev.current?.[k]);
              const after = describeProfileField(k, rev.payload[k]);
              const same = before.join('\n') === after.join('\n');
              return (
                <tr key={k} className={cn(same && 'text-muted')}>
                  <th scope="row">{t.moderation.fields[k] ?? k}</th>
                  <td>
                    <Lines lines={before} />
                  </td>
                  <td className={cn(!same && 'bg-warn-soft')}>{same ? <span className="small">{t.moderation.unchanged}</span> : <Lines lines={after} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <FormError error={actionError} />
      {rev.status === 'pending' && (
        <div className="grid grid-2">
          <div className="card stack">
            <button type="button" className="btn-primary justify-self-start" disabled={busy} onClick={() => void decide('approve')}>
              {t.admin.approve}
            </button>
          </div>
          <RejectForm busy={busy} onReject={(reason) => void decide('reject', { reason })} />
        </div>
      )}
    </section>
  );
}

function Lines({ lines }: { lines: string[] }) {
  if (lines.length === 0) return <span className="muted">–</span>;
  if (lines.length === 1) return <span className="whitespace-pre-wrap">{lines[0]}</span>;
  return (
    <ul className="m-0 pl-4">
      {lines.map((l, i) => (
        <li key={i}>{l}</li>
      ))}
    </ul>
  );
}
