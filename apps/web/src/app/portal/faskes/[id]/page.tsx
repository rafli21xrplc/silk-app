'use client';

import { useParams } from 'next/navigation';
import { Receipt } from 'lucide-react';
import { useState } from 'react';
import { formatPrice, type PriceType } from '@silk/shared';
import { FormError } from '@/components/app-shell';
import { ProofUpload } from '@/components/portal/proof-upload';
import { TariffForm, type PortalTariff } from '@/components/tariff-form';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingTable } from '@/components/ui/skeleton';
import { api, errorMessage } from '@/lib/client-api';
import { cn } from '@/lib/cn';
import { formatDate, formatDateTime } from '@/lib/format';
import { useQuery } from '@/lib/query-cache';
import { t } from '@/messages/id';
import { PortalShell } from '../../portal-shell';

/** Permintaan harga milik profil (GET /portal/facilities/:id/tariff-requests). */
interface TariffRequestRow {
  id: string;
  kind: 'tunggal' | 'impor';
  status: string;
  tariffId: string | null;
  serviceName: string | null;
  package: { name: string } | null;
  importRows: number | null;
  priceType: PriceType | null;
  priceMin: number | null;
  priceMax: number | null;
  sourceTitle: string | null;
  rejectionReason: string | null;
  documentCount: number;
  createdAt: string;
}

const REQUEST_BADGE: Record<string, string> = {
  pending: 'badge-status',
  approved: 'badge-diverifikasi_admin',
  rejected: 'badge-stale',
  superseded: 'badge-publik_belum_diverifikasi',
};

export default function PortalTariffsPage() {
  const { id } = useParams<{ id: string }>();
  return <PortalShell facilityId={id}>{() => <Tariffs facilityId={id} />}</PortalShell>;
}

function Tariffs({ facilityId }: { facilityId: string }) {
  const [editing, setEditing] = useState<PortalTariff | 'new' | null>(null);
  /** Permintaan yang baru dibuat: tampilkan langkah unggah bukti. */
  const [proofFor, setProofFor] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const tariffs = useQuery<PortalTariff[]>(`/portal/facilities/${facilityId}/tariffs`);
  const requests = useQuery<TariffRequestRow[]>(`/portal/facilities/${facilityId}/tariff-requests`);
  const rows = tariffs.data;
  const error = tariffs.error ? errorMessage(tariffs.error) : requests.error ? errorMessage(requests.error) : actionError;
  const reload = () => {
    void tariffs.refetch();
    void requests.refetch();
  };

  async function toggleActive(r: PortalTariff) {
    setActionError(null);
    try {
      await api('PATCH', `/portal/tariffs/${r.id}/active`, { active: !r.active });
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  return (
    <>
      <FormError error={error} />
      {proofFor && (
        <section className="card stack" aria-labelledby="proof-title">
          <h2 id="proof-title">{t.priceRequest.proofTitle}</h2>
          <p className="success" role="status">
            {t.priceRequest.created}
          </p>
          <ProofUpload requestId={proofFor} onUploaded={reload} />
          <p>
            <button type="button" className="btn" onClick={() => setProofFor(null)}>
              {t.priceRequest.proofDone}
            </button>
          </p>
        </section>
      )}
      {editing ? (
        <TariffForm
          facilityId={facilityId}
          tariff={editing === 'new' ? undefined : editing}
          onCancel={() => setEditing(null)}
          onSaved={(r) => {
            setEditing(null);
            setProofFor(r.requestId);
            reload();
          }}
        />
      ) : (
        <p>
          <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
            {t.priceRequest.submitNew}
          </button>
        </p>
      )}
      {rows === undefined ? (
        <LoadingTable rows={5} cols={3} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Receipt} title={t.portal.noTariffsTitle}>
          {t.portal.noTariffs}
        </EmptyState>
      ) : (
        <div className="table-scroll" tabIndex={0}>
          <table>
            <caption className="sr-only">{t.portal.tariffs}</caption>
            <thead>
              <tr>
                <th scope="col">{t.portal.service}</th>
                <th scope="col">{t.compare.price}</th>
                <th scope="col">{t.portal.effectiveFrom}</th>
                <th scope="col">{t.trust.verifiedAt}</th>
                <th scope="col">{t.common.status}</th>
                <th scope="col">{t.common.action}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={cn(!r.active && 'text-muted')}>
                  <th scope="row">
                    {r.packageName ? `${r.packageName} (${r.serviceName})` : r.serviceName}
                    {r.versionNo && <div className="small muted">{t.portal.version(r.versionNo)}</div>}
                  </th>
                  <td>{r.priceType ? formatPrice({ type: r.priceType, min: r.priceMin, max: r.priceMax }) : '–'}</td>
                  <td>{formatDate(r.effectiveFrom)}</td>
                  <td>{formatDate(r.verifiedAt)}</td>
                  <td>
                    <span className="badge badge-status">{t.portal.status[r.status] ?? r.status}</span>{' '}
                    <span className={cn('badge', r.active ? 'badge-diverifikasi_admin' : 'badge-stale')}>{r.active ? t.priceRequest.active : t.priceRequest.inactive}</span>
                    {r.pendingRequestId && (
                      <>
                        {' '}
                        <span className="badge badge-publik_belum_diverifikasi">{t.priceRequest.pendingBadge}</span>
                      </>
                    )}
                  </td>
                  <td>
                    {r.status !== 'ditarik' && (
                      <span className="flex flex-wrap gap-x-3 gap-y-1">
                        {r.versionNo && (
                          <button type="button" className="btn-link" onClick={() => setEditing(r)}>
                            {t.priceRequest.submitChange}
                          </button>
                        )}
                        <button type="button" className="btn-link" onClick={() => void toggleActive(r)} title={t.priceRequest.activeHelp}>
                          {r.active ? t.priceRequest.deactivate : t.priceRequest.activate}
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="small muted">{t.priceRequest.activeHelp}</p>
      <RequestList rows={requests.data} onChanged={reload} />
    </>
  );
}

function RequestList({ rows, onChanged }: { rows: TariffRequestRow[] | undefined; onChanged: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="stack" aria-labelledby="requests-title">
      <h2 id="requests-title">{t.priceRequest.requests}</h2>
      {rows === undefined ? (
        <LoadingTable rows={3} cols={3} />
      ) : rows.length === 0 ? (
        <p className="small muted">{t.priceRequest.noRequests}</p>
      ) : (
        <ul className="plain stack">
          {rows.map((r) => (
            <li key={r.id} className="card stack">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>
                  {r.kind === 'impor'
                    ? `${t.priceRequest.kind.impor}${r.importRows !== null ? ` · ${t.priceRequest.rows(r.importRows)}` : ''}`
                    : `${r.package?.name ? `${r.package.name} (${r.serviceName})` : (r.serviceName ?? '–')}${
                        r.priceType ? ` · ${formatPrice({ type: r.priceType, min: r.priceMin, max: r.priceMax })}` : ''
                      }`}
                </strong>
                <span className={cn('badge', REQUEST_BADGE[r.status])}>{t.priceRequest.status[r.status] ?? r.status}</span>
              </div>
              <p className="small muted m-0">
                {formatDateTime(r.createdAt)}
                {r.sourceTitle ? ` · ${r.sourceTitle}` : ''} · {t.priceRequest.docs(r.documentCount)}
              </p>
              {r.status === 'rejected' && r.rejectionReason && (
                <p className="small m-0">
                  <strong>{t.partner.reason}:</strong> {r.rejectionReason}
                </p>
              )}
              {r.status === 'pending' && (
                <>
                  {r.documentCount === 0 && <p className="small text-danger m-0">{t.priceRequest.needsProof}</p>}
                  {open === r.id ? (
                    <ProofUpload requestId={r.id} onUploaded={onChanged} />
                  ) : (
                    <button type="button" className="btn-link justify-self-start" onClick={() => setOpen(r.id)}>
                      {t.priceRequest.addProof}
                    </button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
