'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { FormError } from '@/components/app-shell';
import { api } from '@/lib/client-api';
import { formatDateTime } from '@/lib/format';
import { t } from '@/messages/id';
import { AdminShell, useAdminData } from '../../admin-shell';
import { LoadingForm } from '@/components/ui/skeleton';

interface ClaimDetail {
  id: string;
  status: string;
  note: string | null;
  rejectionReason: string | null;
  createdAt: string;
  facility: { id: string; name: string; slug: string; status: string } | null;
  applicant: { email: string; name: string } | null;
  documents: {
    id: string;
    fileName: string;
    mime: string;
    sizeBytes: number;
    uploadedAt: string;
    viewUrl: string;
    viewUrlExpiresInSec: number;
  }[];
}

export default function AdminClaimDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <AdminShell>{() => <Detail id={id} />}</AdminShell>;
}

function Detail({ id }: { id: string }) {
  const { items: claim, error, reload, handle } = useAdminData<ClaimDetail>(`/admin/claims/${id}`);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function decide(kind: 'approve' | 'reject', body: object) {
    setBusy(true);
    setActionError(null);
    try {
      await api('POST', `/admin/claims/${id}/${kind}`, body);
      reload();
    } catch (err) {
      handle(err);
      setActionError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setBusy(false);
    }
  }

  if (!claim) return error ? <p className="error">{error}</p> : <LoadingForm fields={4} />;
  return (
    <section className="stack">
      <p>
        <Link href="/admin/klaim">← {t.common.back}</Link>
      </p>
      <h2>{claim.facility?.name}</h2>
      <dl className="kv">
        <dt>{t.common.status}</dt>
        <dd>{t.portal.claimStatus[claim.status]}</dd>
        <dt>{t.admin.applicant}</dt>
        <dd>
          {claim.applicant?.name} ({claim.applicant?.email})
        </dd>
        <dt>{t.common.date}</dt>
        <dd>{formatDateTime(claim.createdAt)}</dd>
        {claim.note && (
          <>
            <dt>{t.admin.note}</dt>
            <dd>{claim.note}</dd>
          </>
        )}
        {claim.rejectionReason && (
          <>
            <dt>{t.admin.reasonLabel}</dt>
            <dd>{claim.rejectionReason}</dd>
          </>
        )}
      </dl>
      <h3>{t.admin.documents}</h3>
      {claim.documents.length === 0 ? (
        <p>{t.admin.noDocs}</p>
      ) : (
        <>
          <ul>
            {claim.documents.map((d) => (
              <li key={d.id}>
                <a href={d.viewUrl} target="_blank" rel="noopener noreferrer">
                  {d.fileName}
                </a>{' '}
                <span className="small muted">
                  ({d.mime}, {Math.round(d.sizeBytes / 1024)} KB)
                </span>
              </li>
            ))}
          </ul>
          <p className="small muted">
            {t.admin.linkExpires(claim.documents[0]!.viewUrlExpiresInSec)}
          </p>
        </>
      )}
      <FormError error={actionError} />
      {claim.status === 'menunggu' && (
        <div className="grid grid-2">
          <form
            className="card stack"
            onSubmit={(e) => {
              e.preventDefault();
              const note = String(new FormData(e.currentTarget).get('note') ?? '').trim();
              void decide('approve', note ? { note } : {});
            }}
          >
            <label>
              {t.admin.note}
              <textarea name="note" rows={2} maxLength={1000} />
            </label>
            <button
              type="submit"
              className="btn-primary"
              disabled={busy || claim.documents.length === 0}
            >
              {t.admin.approve}
            </button>
          </form>
          <form
            className="card stack"
            onSubmit={(e) => {
              e.preventDefault();
              void decide('reject', {
                reason: String(new FormData(e.currentTarget).get('reason') ?? '').trim(),
              });
            }}
          >
            <label>
              {t.admin.reason}
              <textarea name="reason" rows={2} minLength={5} maxLength={1000} required />
            </label>
            <button type="submit" className="btn-danger" disabled={busy}>
              {t.admin.reject}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
