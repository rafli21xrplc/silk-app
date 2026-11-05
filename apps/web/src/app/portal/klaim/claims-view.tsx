'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Inbox } from 'lucide-react';
import { useState } from 'react';
import { DOCUMENT_ALLOWED_MIME, DOCUMENT_MAX_BYTES } from '@silk/shared';
import { FormError } from '@/components/app-shell';
import { track } from '@/lib/analytics';
import { api, errorMessage, uploadToSignedUrl } from '@/lib/client-api';
import { useQuery } from '@/lib/query-cache';
import { formatDate } from '@/lib/format';
import type { FacilityListItem } from '@/lib/types';
import { t } from '@/messages/id';
import { PortalShell } from '../portal-shell';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingTable } from '@/components/ui/skeleton';

interface MyClaim {
  id: string;
  status: string;
  note: string | null;
  rejectionReason: string | null;
  createdAt: string;
  facilityId: string;
  facilityName: string;
  facilitySlug: string;
  documentCount: number;
}

export function ClaimsView() {
  return <PortalShell>{() => <Claims />}</PortalShell>;
}

function Claims() {
  const params = useSearchParams();
  const { data: claims, error: loadError, refetch } = useQuery<MyClaim[]>('/portal/claims');
  const error = loadError ? errorMessage(loadError) : null;
  const load = () => void refetch();

  const preset = params.get('faskes');
  return (
    <>
      <FormError error={error} />
      <NewClaim
        preset={preset ? { id: preset, name: params.get('nama') ?? '' } : null}
        onCreated={load}
      />
      <h2>{t.portal.claimMine}</h2>
      {claims === undefined ? (
        <LoadingTable rows={3} cols={2} />
      ) : claims.length === 0 ? (
        <EmptyState icon={Inbox} title={t.portal.noClaimsTitle}>
          {t.portal.noClaims}
        </EmptyState>
      ) : (
        <ul className="plain stack">
          {claims.map((c) => (
            <li key={c.id} className="card">
              <h3>
                <Link href={`/faskes/${c.facilitySlug}`}>{c.facilityName}</Link>
              </h3>
              <p className="small muted">
                {formatDate(c.createdAt)} ·{' '}
                <span className="badge badge-status">{t.portal.claimStatus[c.status]}</span> ·{' '}
                {t.portal.claimDocsCount(c.documentCount)}
              </p>
              {c.status === 'ditolak' && c.rejectionReason && (
                <p className="small">
                  <strong>{t.admin.reasonLabel}:</strong> {c.rejectionReason}
                </p>
              )}
              {c.status === 'menunggu' && (
                <>
                  {c.documentCount === 0 && <p className="small error">{t.portal.claimNeedsDoc}</p>}
                  <DocumentUpload claimId={c.id} onUploaded={load} />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function NewClaim({
  preset,
  onCreated,
}: {
  preset: { id: string; name: string } | null;
  onCreated: () => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<FacilityListItem[]>([]);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(preset);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    try {
      const { data } = await api<FacilityListItem[]>(
        'GET',
        `/facilities?q=${encodeURIComponent(q.trim())}&limit=10`,
      );
      setResults(data);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const note = String(new FormData(e.currentTarget).get('note') ?? '').trim();
    setBusy(true);
    setError(null);
    try {
      await api('POST', '/portal/claims', { facilityId: selected.id, note: note || null });
      track('claim_started', { facility_id: selected.id });
      setSelected(null);
      setResults([]);
      onCreated();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card stack">
      <h2>{t.portal.claimTitle}</h2>
      <FormError error={error} />
      {!selected && (
        <form onSubmit={search} className="row">
          <label className="grow">
            {t.portal.claimSearch}
            <input value={q} onChange={(e) => setQ(e.target.value)} minLength={2} required />
          </label>
          <button type="submit" className="btn">
            {t.search.submit}
          </button>
        </form>
      )}
      {!selected && results.length > 0 && (
        <ul className="plain">
          {results.map((r) => (
            <li key={r.id} className="row">
              <span className="grow">
                {r.name} <span className="small muted">· {r.city}</span>
              </span>
              <button
                type="button"
                className="btn-link"
                onClick={() => setSelected({ id: r.id, name: r.name })}
              >
                {t.portal.claimPick}
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <form onSubmit={submit} className="stack">
          <p>
            <strong>{selected.name || selected.id}</strong>{' '}
            <button type="button" className="btn-link" onClick={() => setSelected(null)}>
              {t.portal.remove}
            </button>
          </p>
          <label>
            {t.portal.claimNote}
            <textarea name="note" rows={3} maxLength={1000} />
          </label>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? t.common.loading : t.portal.claimSubmit}
          </button>
        </form>
      )}
    </section>
  );
}

function DocumentUpload({ claimId, onUploaded }: { claimId: string; onUploaded: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setDone(false);
    if (
      !(DOCUMENT_ALLOWED_MIME as readonly string[]).includes(file.type) ||
      file.size > DOCUMENT_MAX_BYTES
    ) {
      setError(t.portal.claimDocs);
      return;
    }
    setBusy(true);
    try {
      const { data } = await api<{
        documentId: string;
        uploadUrl: string;
        headers: Record<string, string>;
      }>('POST', `/portal/claims/${claimId}/documents/presign`, {
        fileName: file.name,
        mime: file.type,
        sizeBytes: file.size,
      });
      await uploadToSignedUrl(data, file);
      await api('POST', `/portal/claims/${claimId}/documents/${data.documentId}/confirm`);
      setDone(true);
      onUploaded();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <label>
        {t.portal.claimDocs}
        <input
          type="file"
          accept={DOCUMENT_ALLOWED_MIME.join(',')}
          onChange={onChange}
          disabled={busy}
        />
      </label>
      {busy && <p aria-busy="true">{t.common.loading}</p>}
      {done && (
        <p className="success" role="status">
          {t.portal.claimUploaded}
        </p>
      )}
      <FormError error={error} />
    </div>
  );
}
