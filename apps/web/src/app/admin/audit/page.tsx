'use client';

import { ScrollText } from 'lucide-react';
import { useState } from 'react';
import { formatDateTime } from '@/lib/format';
import { t } from '@/messages/id';
import { DataPanel } from '@/components/ui/data-panel';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingTable } from '@/components/ui/skeleton';
import { AdminShell, useAdminList } from '../admin-shell';

interface AuditRow {
  id: number;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string;
  before: unknown;
  after: unknown;
  ip: string | null;
  requestId: string | null;
  createdAt: string;
}

export default function AdminAuditPage() {
  return <AdminShell>{() => <Audit />}</AdminShell>;
}

function Audit() {
  const [filters, setFilters] = useState({ entity: '', entityId: '', action: '', actorId: '' });
  const [applied, setApplied] = useState(filters);
  const params = new URLSearchParams(Object.entries(applied).filter(([, v]) => v));
  const { rows, busy, pagination, error } = useAdminList<AuditRow>(`/admin/audit-logs?${params}`);
  return (
    <>
      <form
        className="filters row"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(filters);
        }}
      >
        {(['entity', 'entityId', 'action', 'actorId'] as const).map((k) => (
          <label key={k}>
            {k}
            <input
              value={filters[k]}
              maxLength={100}
              onChange={(e) => setFilters((f) => ({ ...f, [k]: e.target.value.trim() }))}
            />
          </label>
        ))}
        <button type="submit" className="btn">
          {t.search.submit}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      {rows === null && !error && <LoadingTable cols={3} />}
      {rows?.length === 0 && (
        <EmptyState icon={ScrollText} title={t.admin.emptyState.audit.title}>
          {t.admin.emptyState.audit.body}
        </EmptyState>
      )}
      {rows && rows.length > 0 && (
        <DataPanel pagination={pagination} busy={busy} scroll={false}>
          <ul className="m-0 list-none divide-y divide-line p-0 text-sm">
            {rows.map((r) => (
              <li
                key={r.id}
                className="grid gap-1.5 px-4 py-3.5 transition-colors duration-150 hover:bg-primary-50/40 sm:px-5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="m-0">
                    <strong>{r.action}</strong> · {r.entity}{' '}
                    <code className="break-all">{r.entityId}</code>
                  </p>
                  <span className="muted whitespace-nowrap">{formatDateTime(r.createdAt)}</span>
                </div>
                <p className="muted m-0">
                  {t.admin.actor}: <code>{r.actorId ?? 'sistem'}</code>
                  {r.ip && ` · ${r.ip}`}
                  {r.requestId && ` · req ${r.requestId}`}
                </p>
                <details>
                  <summary className="cursor-pointer font-semibold text-primary-700">
                    {t.admin.change}
                  </summary>
                  <pre className="code">
                    {JSON.stringify({ before: r.before, after: r.after }, null, 2)}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        </DataPanel>
      )}
    </>
  );
}
