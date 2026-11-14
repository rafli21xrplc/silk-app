'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ENTITY_STATUSES, VERIFICATION_LEVELS } from '@silk/shared';
import { Building2 } from 'lucide-react';
import { ListSearch, ListToolbar } from '@/components/ui/list-search';
import { DataPanel } from '@/components/ui/data-panel';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/select';
import { LoadingTable } from '@/components/ui/skeleton';
import { api } from '@/lib/client-api';
import { formatDate } from '@/lib/format';
import { t } from '@/messages/id';
import { AdminShell, useAdminList } from '../admin-shell';

interface FacilityRow {
  id: string;
  slug: string;
  name: string;
  type: string;
  city: string;
  status: string;
  verification: string;
  updatedAt: string;
}

export default function AdminFacilitiesPage() {
  return <AdminShell>{(me) => <Facilities isAdmin={me.user.role === 'admin'} />}</AdminShell>;
}

function Facilities({ isAdmin }: { isAdmin: boolean }) {
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (query) params.set('q', query);
  const { rows, busy, pagination, error, reload, handle } = useAdminList<FacilityRow>(
    `/admin/facilities?${params}`,
  );

  async function patch(id: string, body: object) {
    try {
      await api('PATCH', `/admin/facilities/${id}`, body);
      reload();
    } catch (err) {
      handle(err);
    }
  }

  return (
    <>
      <ListToolbar>
        <ListSearch placeholder={t.admin.search} onSearch={setQuery} />
        <label className="grid gap-1.5 text-[0.925rem] font-semibold text-ink-soft">
          {t.common.status}
          <Select
            value={status}
            onValueChange={setStatus}
            label={t.common.status}
            className="min-w-[200px]"
            options={[
              { value: '', label: '–' },
              ...ENTITY_STATUSES.map((s) => ({ value: s, label: t.portal.status[s] ?? s })),
            ]}
          />
        </label>
      </ListToolbar>
      {error && <p className="error">{error}</p>}
      {rows === null && !error && <LoadingTable cols={4} />}
      {rows?.length === 0 && (
        <EmptyState icon={Building2} title={t.admin.emptyState.facilities.title}>
          {t.admin.emptyState.facilities.body}
        </EmptyState>
      )}
      {rows && rows.length > 0 && (
        <DataPanel pagination={pagination} busy={busy} label={t.admin.facilities}>
          <table>
            <thead>
              <tr>
                <th scope="col">{t.admin.facilities}</th>
                <th scope="col">{t.common.status}</th>
                <th scope="col">{t.admin.verificationLabel}</th>
                <th scope="col">{t.common.date}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.id}>
                  <th scope="row">
                    <Link href={`/faskes/${f.slug}`}>{f.name}</Link>
                    <div className="small muted font-normal">
                      {t.facilityType[f.type]} · {f.city}
                    </div>
                  </th>
                  <td>
                    <Select
                      value={f.status}
                      label={`${t.common.status} ${f.name}`}
                      onValueChange={(v) => patch(f.id, { status: v })}
                      className="min-w-[150px]"
                      options={ENTITY_STATUSES.map((s) => ({
                        value: s,
                        label: t.portal.status[s] ?? s,
                      }))}
                    />
                  </td>
                  <td>
                    <Select
                      value={f.verification}
                      disabled={!isAdmin}
                      label={`${t.admin.verificationLabel} ${f.name}`}
                      onValueChange={(v) => patch(f.id, { verification: v })}
                      className="min-w-[190px]"
                      options={VERIFICATION_LEVELS.map((v) => ({
                        value: v,
                        label: t.verification[v] ?? v,
                      }))}
                    />
                  </td>
                  <td className="whitespace-nowrap">{formatDate(f.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataPanel>
      )}
    </>
  );
}
