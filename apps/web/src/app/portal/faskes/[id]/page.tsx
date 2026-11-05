'use client';

import { useParams } from 'next/navigation';
import { Receipt } from 'lucide-react';
import { useState } from 'react';
import { formatPrice } from '@silk/shared';
import { TariffForm, type PortalTariff } from '@/components/tariff-form';
import { FormError } from '@/components/app-shell';
import { track } from '@/lib/analytics';
import { errorMessage } from '@/lib/client-api';
import { useQuery } from '@/lib/query-cache';
import { formatDate } from '@/lib/format';
import { t } from '@/messages/id';
import { PortalShell } from '../../portal-shell';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingTable } from '@/components/ui/skeleton';

export default function PortalTariffsPage() {
  const { id } = useParams<{ id: string }>();
  return <PortalShell facilityId={id}>{() => <Tariffs facilityId={id} />}</PortalShell>;
}

function Tariffs({ facilityId }: { facilityId: string }) {
  const [editing, setEditing] = useState<PortalTariff | 'new' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const {
    data: rows,
    error: loadError,
    refetch,
  } = useQuery<PortalTariff[]>(`/portal/facilities/${facilityId}/tariffs`);
  const error = loadError ? errorMessage(loadError) : null;
  const load = () => void refetch();

  return (
    <>
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      <FormError error={error} />
      {editing ? (
        <TariffForm
          facilityId={facilityId}
          tariff={editing === 'new' ? undefined : editing}
          onCancel={() => setEditing(null)}
          onSaved={(r) => {
            setEditing(null);
            setNotice(r.status === 'terbit' ? t.portal.saved : t.portal.savedReview);
            if (r.status === 'terbit') track('tariff_published', { facility_id: facilityId });
            load();
          }}
        />
      ) : (
        <p>
          <button type="button" className="btn-primary" onClick={() => setEditing('new')}>
            {t.portal.addTariff}
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
                <tr key={r.id}>
                  <th scope="row">
                    {r.packageName ? `${r.packageName} (${r.serviceName})` : r.serviceName}
                    {r.versionNo && (
                      <div className="small muted">{t.portal.version(r.versionNo)}</div>
                    )}
                  </th>
                  <td>
                    {r.priceType
                      ? formatPrice({ type: r.priceType, min: r.priceMin, max: r.priceMax })
                      : '–'}
                  </td>
                  <td>{formatDate(r.effectiveFrom)}</td>
                  <td>{formatDate(r.verifiedAt)}</td>
                  <td>
                    <span className="badge badge-status">{t.portal.status[r.status]}</span>
                  </td>
                  <td>
                    {r.status !== 'ditarik' && (
                      <button type="button" className="btn-link" onClick={() => setEditing(r)}>
                        {t.portal.edit}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
