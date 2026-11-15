'use client';

import Link from 'next/link';
import { Inbox } from 'lucide-react';
import { useState } from 'react';
import { CLAIM_STATUSES } from '@silk/shared';
import { ListSearch, ListToolbar, NoResults, withQuery } from '@/components/ui/list-search';
import { buttonVariants } from '@/components/ui/button';
import { DataPanel } from '@/components/ui/data-panel';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingTable } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/format';
import { t } from '@/messages/id';
import { AdminShell, StatusFilter, useAdminList } from '../admin-shell';

interface ClaimRow {
  id: string;
  status: string;
  createdAt: string;
  facilityName: string;
  facilityCity: string;
  userEmail: string;
  userName: string;
  documentCount: number;
}

export default function AdminClaimsPage() {
  return <AdminShell>{() => <Claims />}</AdminShell>;
}

function Claims() {
  const [status, setStatus] = useState('menunggu');
  const [q, setQ] = useState('');
  const { rows, busy, pagination, error } = useAdminList<ClaimRow>(
    withQuery(`/admin/claims?status=${status}`, q),
  );
  return (
    <>
      <ListToolbar>
        <ListSearch placeholder={t.listSearch.claims} onSearch={setQ} />
        <StatusFilter
          value={status}
          options={CLAIM_STATUSES}
          onChange={setStatus}
          labels={t.portal.claimStatus}
        />
      </ListToolbar>
      {error && <p className="error">{error}</p>}
      {rows === null && !error && <LoadingTable cols={4} />}
      {rows?.length === 0 && q && <NoResults q={q} />}
      {rows?.length === 0 && !q && (
        <EmptyState icon={Inbox} title={t.admin.emptyState.claims.title}>
          {t.admin.emptyState.claims.body(t.portal.claimStatus[status] ?? status)}
        </EmptyState>
      )}
      {rows && rows.length > 0 && (
        <DataPanel pagination={pagination} busy={busy} label={t.admin.claims}>
          <table>
            <thead>
              <tr>
                <th scope="col">{t.admin.facilities}</th>
                <th scope="col">{t.admin.applicant}</th>
                <th scope="col">{t.admin.documents}</th>
                <th scope="col">{t.common.date}</th>
                <th scope="col">
                  <span className="sr-only">{t.common.action}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <th scope="row">
                    {c.facilityName} <div className="small muted font-normal">{c.facilityCity}</div>
                  </th>
                  <td>
                    {c.userName}
                    <div className="small muted">{c.userEmail}</div>
                  </td>
                  <td className="tabular-nums">{c.documentCount}</td>
                  <td className="whitespace-nowrap">{formatDateTime(c.createdAt)}</td>
                  <td className="text-right">
                    <Link href={`/admin/klaim/${c.id}`} className={buttonVariants({ size: 'sm' })}>
                      {t.admin.view}
                    </Link>
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
