'use client';

import { ClipboardCheck } from 'lucide-react';
import { useState } from 'react';
import { ENTITY_STATUSES, formatPrice, type PriceType } from '@silk/shared';
import { buttonVariants } from '@/components/ui/button';
import { DataPanel } from '@/components/ui/data-panel';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingTable } from '@/components/ui/skeleton';
import { api } from '@/lib/client-api';
import { formatDate, formatDateTime } from '@/lib/format';
import { t } from '@/messages/id';
import { AdminShell, StatusFilter, useAdminList } from '../admin-shell';

interface QueueRow {
  id: string;
  status: string;
  facilityName: string;
  serviceName: string;
  versionNo: number | null;
  priceType: PriceType | null;
  priceMin: number | null;
  priceMax: number | null;
  effectiveFrom: string | null;
  inclusions: string | null;
  exclusions: string | null;
  createdAt: string | null;
}

export default function AdminTariffsPage() {
  return <AdminShell>{() => <Queue />}</AdminShell>;
}

function Queue() {
  const [status, setStatus] = useState('menunggu_tinjauan');
  const { rows, busy, pagination, error, reload, handle } = useAdminList<QueueRow>(
    `/admin/tariffs?status=${status}`,
  );
  const [acting, setActing] = useState<string | null>(null);
  async function act(id: string, action: 'publish' | 'withdraw') {
    setActing(id);
    try {
      await api('POST', `/admin/tariffs/${id}/${action}`);
      reload();
    } catch (err) {
      handle(err);
    } finally {
      setActing(null);
    }
  }
  return (
    <>
      <StatusFilter
        value={status}
        options={ENTITY_STATUSES}
        onChange={setStatus}
        labels={t.portal.status}
      />
      {error && <p className="error">{error}</p>}
      {rows === null && !error && <LoadingTable cols={4} />}
      {rows?.length === 0 && (
        <EmptyState icon={ClipboardCheck} title={t.admin.emptyState.tariffs.title}>
          {t.admin.emptyState.tariffs.body(t.portal.status[status] ?? status)}
        </EmptyState>
      )}
      {rows && rows.length > 0 && (
        <DataPanel pagination={pagination} busy={busy} label={t.admin.tariffs}>
          <table>
            <thead>
              <tr>
                <th scope="col">{t.portal.service}</th>
                <th scope="col">{t.compare.price}</th>
                <th scope="col">{t.trust.effectiveFrom}</th>
                <th scope="col">{t.common.date}</th>
                <th scope="col">
                  <span className="sr-only">{t.common.action}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row" className="max-w-[360px]">
                    {r.serviceName}
                    <div className="small muted font-normal">{r.facilityName}</div>
                    {(r.inclusions || r.exclusions) && (
                      <div className="mt-1.5 grid gap-0.5 text-[0.82rem] font-normal text-ink-soft">
                        {r.inclusions && (
                          <span>
                            <strong className="font-semibold">{t.facility.includes}:</strong>{' '}
                            {r.inclusions}
                          </span>
                        )}
                        {r.exclusions && (
                          <span>
                            <strong className="font-semibold">{t.facility.excludes}:</strong>{' '}
                            {r.exclusions}
                          </span>
                        )}
                      </div>
                    )}
                  </th>
                  <td className="whitespace-nowrap">
                    <strong className="tabular-nums">
                      {r.priceType
                        ? formatPrice({ type: r.priceType, min: r.priceMin, max: r.priceMax })
                        : '–'}
                    </strong>
                    {r.versionNo && (
                      <div className="small muted">{t.portal.version(r.versionNo)}</div>
                    )}
                  </td>
                  <td className="whitespace-nowrap">{formatDate(r.effectiveFrom)}</td>
                  <td className="whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                  <td>
                    <div className="flex justify-end gap-2">
                      {r.status !== 'terbit' && (
                        <button
                          type="button"
                          className={buttonVariants({ variant: 'primary', size: 'sm' })}
                          disabled={acting === r.id}
                          onClick={() => act(r.id, 'publish')}
                        >
                          {t.admin.publish}
                        </button>
                      )}
                      {r.status !== 'ditarik' && (
                        <button
                          type="button"
                          className={buttonVariants({
                            variant: 'ghost',
                            size: 'sm',
                            className: 'text-danger hover:bg-danger-soft hover:text-danger',
                          })}
                          disabled={acting === r.id}
                          onClick={() => act(r.id, 'withdraw')}
                        >
                          {t.admin.withdraw}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataPanel>
      )}
    </>
  );
}
