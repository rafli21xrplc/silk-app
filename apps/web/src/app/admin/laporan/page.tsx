'use client';

import Link from 'next/link';
import { Flag } from 'lucide-react';
import { useState } from 'react';
import { REPORT_STATUSES } from '@silk/shared';
import { DataPanel } from '@/components/ui/data-panel';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/select';
import { LoadingTable } from '@/components/ui/skeleton';
import { api } from '@/lib/client-api';
import { formatDateTime } from '@/lib/format';
import { t } from '@/messages/id';
import { AdminShell, StatusFilter, useAdminList } from '../admin-shell';

interface ReportRow {
  id: string;
  status: string;
  reason: string;
  note: string | null;
  createdAt: string;
  facilityName: string;
  facilitySlug: string;
  serviceName: string;
  hasContact: boolean;
}

export default function AdminReportsPage() {
  return <AdminShell>{() => <Reports />}</AdminShell>;
}

function Reports() {
  const [status, setStatus] = useState('baru');
  const { rows, busy, pagination, error, reload, handle } = useAdminList<ReportRow>(
    `/admin/reports?status=${status}`,
  );
  async function update(id: string, next: string, note: string) {
    try {
      await api('PATCH', `/admin/reports/${id}`, { status: next, ...(note ? { note } : {}) });
      reload();
    } catch (err) {
      handle(err);
    }
  }
  return (
    <>
      <StatusFilter
        value={status}
        options={REPORT_STATUSES}
        onChange={setStatus}
        labels={t.admin.reportStatus}
      />
      {error && <p className="error">{error}</p>}
      {rows === null && !error && <LoadingTable cols={3} />}
      {rows?.length === 0 && (
        <EmptyState icon={Flag} title={t.admin.emptyState.reports.title}>
          {t.admin.emptyState.reports.body(t.admin.reportStatus[status] ?? status)}
        </EmptyState>
      )}
      {rows && rows.length > 0 && (
        <DataPanel pagination={pagination} busy={busy} scroll={false}>
          <ul className="m-0 list-none divide-y divide-line p-0">
            {rows.map((r) => (
              <li
                key={r.id}
                className="grid gap-3 px-4 py-4 transition-colors duration-150 hover:bg-primary-50/40 sm:px-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="m-0 text-base font-semibold">
                    <Link href={`/faskes/${r.facilitySlug}`}>{r.facilityName}</Link>
                    <span className="font-normal text-muted"> · {r.serviceName}</span>
                  </h3>
                  <span className="small muted whitespace-nowrap">
                    {formatDateTime(r.createdAt)}
                    {r.hasContact && ` · ${t.admin.hasContact}`}
                  </span>
                </div>
                <p className="m-0">{r.reason}</p>
                {r.note && (
                  <p className="m-0 rounded-xl bg-surface px-3 py-2 text-sm">
                    <strong>{t.admin.note}:</strong> {r.note}
                  </p>
                )}
                <form
                  className="row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void update(r.id, String(f.get('status')), String(f.get('note') ?? '').trim());
                  }}
                >
                  <span className="min-w-[180px]">
                    <Select
                      name="status"
                      defaultValue={r.status}
                      label={t.common.status}
                      options={REPORT_STATUSES.map((s) => ({
                        value: s,
                        label: t.admin.reportStatus[s] ?? s,
                      }))}
                    />
                  </span>
                  <input
                    name="note"
                    placeholder={t.admin.note}
                    maxLength={1000}
                    className="grow"
                    aria-label={t.admin.note}
                  />
                  <button type="submit" className="btn">
                    {t.common.save}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </DataPanel>
      )}
    </>
  );
}
