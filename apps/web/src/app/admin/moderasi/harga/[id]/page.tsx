'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatPrice, type PriceType } from '@silk/shared';
import { FormError } from '@/components/app-shell';
import { LoadingForm } from '@/components/ui/skeleton';
import { track } from '@/lib/analytics';
import { api, errorMessage } from '@/lib/client-api';
import { formatDate, formatDateTime } from '@/lib/format';
import { queryCache } from '@/lib/query-cache';
import { t } from '@/messages/id';
import { AdminShell, useAdminData } from '../../../admin-shell';
import { RejectForm } from '../../reject-form';

interface PriceFields {
  priceType: PriceType | null;
  priceMin: number | null;
  priceMax: number | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  inclusions: string | null;
  exclusions: string | null;
}

interface RequestDetail extends PriceFields {
  id: string;
  kind: 'tunggal' | 'impor';
  status: string;
  facilityId: string;
  baseVersionNo: number | null;
  package: { name: string; notes?: string | null; components?: { label: string; included: boolean }[] } | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  rejectionReason: string | null;
  createdAt: string;
  facility: { id: string; name: string; slug: string; status: string } | null;
  service: { id: string; slug: string; name: string } | null;
  current: (PriceFields & { versionNo: number | null; verification: string | null; active: boolean }) | null;
  submitter: string | null;
  importBatch: { id: string; status: string; rowsValid: number; fileName: string } | null;
  importRows: { rowNo: number; raw: Record<string, string> }[];
  documents: { id: string; fileName: string; mime: string; sizeBytes: number; viewUrl: string; viewUrlExpiresInSec: number }[];
}

export default function AdminPriceRequestPage() {
  const { id } = useParams<{ id: string }>();
  return <AdminShell>{() => <Detail id={id} />}</AdminShell>;
}

const priceText = (p: PriceFields | null) => (p?.priceType ? formatPrice({ type: p.priceType, min: p.priceMin, max: p.priceMax }) : '–');

function Detail({ id }: { id: string }) {
  const router = useRouter();
  const { items: r, error, reload, handle } = useAdminData<RequestDetail>(`/admin/tariff-requests/${id}`);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function decide(kind: 'approve' | 'reject', body?: object) {
    setBusy(true);
    setActionError(null);
    try {
      await api('POST', `/admin/tariff-requests/${id}/${kind}`, body);
      if (kind === 'approve') track('tariff_published', { facility_id: r?.facilityId ?? null });
      queryCache.invalidate('/admin/tariff-requests');
      queryCache.invalidate('/admin/overview');
      reload();
      router.push('/admin/moderasi?tab=harga');
    } catch (err) {
      handle(err);
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!r) return error ? <p className="error">{error}</p> : <LoadingForm fields={4} />;
  const columns = r.importRows[0] ? Object.keys(r.importRows[0].raw) : [];
  return (
    <section className="stack">
      <p>
        <Link href="/admin/moderasi?tab=harga">← {t.common.back}</Link>
      </p>
      <h2>
        {r.facility?.name}
        {r.service && ` · ${r.package?.name ? `${r.package.name} (${r.service.name})` : r.service.name}`}
      </h2>
      <dl className="kv">
        <dt>{t.common.status}</dt>
        <dd>{t.priceRequest.status[r.status] ?? r.status}</dd>
        <dt>{t.moderation.submitter}</dt>
        <dd>{r.submitter ?? '–'}</dd>
        <dt>{t.common.date}</dt>
        <dd>{formatDateTime(r.createdAt)}</dd>
        <dt>{t.priceRequest.sourceTitle}</dt>
        <dd>
          {r.sourceTitle ?? '–'}
          {r.sourceUrl && (
            <>
              {' · '}
              <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">
                {r.sourceUrl}
              </a>
            </>
          )}
        </dd>
        {r.rejectionReason && (
          <>
            <dt>{t.admin.reasonLabel}</dt>
            <dd>{r.rejectionReason}</dd>
          </>
        )}
      </dl>
      {r.baseVersionNo !== null && <p className="small muted m-0">{t.moderation.baseVersion(r.baseVersionNo)}</p>}

      {r.kind === 'tunggal' ? (
        <div className="table-scroll" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th scope="col">{t.moderation.field}</th>
                <th scope="col">{t.moderation.oldPrice}</th>
                <th scope="col">{t.moderation.newPrice}</th>
              </tr>
            </thead>
            <tbody>
              <Row label={t.compare.price} before={r.current ? priceText(r.current) : t.moderation.newService} after={priceText(r)} />
              <Row label={t.portal.effectiveFrom} before={formatDate(r.current?.effectiveFrom ?? null)} after={formatDate(r.effectiveFrom)} />
              <Row label={t.portal.effectiveTo} before={formatDate(r.current?.effectiveTo ?? null)} after={formatDate(r.effectiveTo)} />
              <Row label={t.portal.inclusions} before={r.current?.inclusions ?? '–'} after={r.inclusions ?? '–'} />
              <Row label={t.portal.exclusions} before={r.current?.exclusions ?? '–'} after={r.exclusions ?? '–'} />
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <h3>
            {t.moderation.importRows}
            {r.importBatch && ` · ${r.importBatch.fileName} · ${t.priceRequest.rows(r.importBatch.rowsValid)}`}
          </h3>
          <div className="table-scroll" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  {columns.map((c) => (
                    <th key={c} scope="col">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.importRows.map((row) => (
                  <tr key={row.rowNo}>
                    <td className="tabular-nums">{row.rowNo}</td>
                    {columns.map((c) => (
                      <td key={c}>{row.raw[c]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h3>{t.admin.documents}</h3>
      {r.documents.length === 0 ? (
        <p className="error">{t.moderation.needsDoc}</p>
      ) : (
        <>
          <ul>
            {r.documents.map((d) => (
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
          <p className="small muted">{t.admin.linkExpires(r.documents[0]!.viewUrlExpiresInSec)}</p>
        </>
      )}
      <FormError error={actionError} />
      {r.status === 'pending' && (
        <div className="grid grid-2">
          <div className="card stack">
            <p className="small muted m-0">{t.moderation.approveHint}</p>
            <button type="button" className="btn-primary justify-self-start" disabled={busy || r.documents.length === 0} onClick={() => void decide('approve')}>
              {t.admin.approve}
            </button>
          </div>
          <RejectForm busy={busy} onReject={(reason) => void decide('reject', { reason })} />
        </div>
      )}
    </section>
  );
}

function Row({ label, before, after }: { label: string; before: string; after: string }) {
  const changed = before !== after;
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{before}</td>
      <td className={changed ? 'bg-warn-soft font-semibold' : undefined}>{after}</td>
    </tr>
  );
}
