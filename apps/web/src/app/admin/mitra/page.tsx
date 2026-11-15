'use client';

import { UserCheck } from 'lucide-react';
import { useState } from 'react';
import { PARTNER_STATUSES, PARTNER_TYPES, type Partner } from '@silk/shared';
import { ListSearch, ListToolbar, NoResults, withQuery } from '@/components/ui/list-search';
import { buttonVariants } from '@/components/ui/button';
import { DataPanel } from '@/components/ui/data-panel';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/select';
import { LoadingTable } from '@/components/ui/skeleton';
import { api } from '@/lib/client-api';
import { formatDateTime } from '@/lib/format';
import { t } from '@/messages/id';
import { AdminShell, StatusFilter, useAdminList } from '../admin-shell';

type PartnerRow = Partner & { userEmail: string; userName: string };

export default function AdminPartnersPage() {
  return <AdminShell>{() => <Partners />}</AdminShell>;
}

/** Atribut per jenis dalam satu baris ringkas untuk pemeriksa. */
function details(r: PartnerRow): string {
  const parts: string[] = [`${t.partner.licenseNo}: ${r.licenseNo ?? '-'}`];
  if (r.partnerType === 'tenaga_medis') parts.push(`${t.partner.specialty}: ${r.specialty}`, `${t.partner.strNo}: ${r.strNo}`);
  if (r.partnerType === 'fasilitas') {
    parts.push(`${t.partner.facilityKind}: ${(r.facilityKind && t.facilityType[r.facilityKind]) ?? r.facilityKind}`);
    if (r.roomCount !== null) parts.push(`${t.partner.roomCount}: ${r.roomCount}`);
  }
  if (r.partnerType === 'gaya_hidup') parts.push(`${t.partner.field}: ${r.field}`);
  if (r.partnerType === 'apotek') parts.push(`${t.partner.siaNo}: ${r.siaNo}`);
  return parts.join(' · ');
}

function Partners() {
  const [status, setStatus] = useState('pending');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const { rows, busy, pagination, error, reload, handle } = useAdminList<PartnerRow>(
    withQuery(`/admin/partners?status=${status}${type ? `&type=${type}` : ''}`, q),
  );
  const [working, setWorking] = useState<string | null>(null);

  async function decide(id: string, action: 'approve' | 'reject', reason?: string) {
    setWorking(id);
    try {
      await api('POST', `/admin/partners/${id}/${action}`, action === 'reject' ? { reason } : undefined);
      reload();
    } catch (err) {
      handle(err);
    } finally {
      setWorking(null);
    }
  }

  return (
    <>
      <ListToolbar>
        <ListSearch placeholder={t.listSearch.partners} onSearch={setQ} />
        <StatusFilter value={status} options={PARTNER_STATUSES} onChange={setStatus} labels={t.partner.statusLabel} />
        <label className="grid gap-1.5 text-[0.925rem] font-semibold text-ink-soft">
          {t.admin.partnerType}
          <Select
            value={type}
            onValueChange={setType}
            label={t.admin.partnerType}
            className="min-w-[220px]"
            options={[{ value: '', label: t.admin.allTypes }, ...PARTNER_TYPES.map((v) => ({ value: v, label: t.partner.types[v] ?? v }))]}
          />
        </label>
      </ListToolbar>
      {error && <p className="error">{error}</p>}
      {rows === null && !error && <LoadingTable cols={3} />}
      {rows?.length === 0 && q && <NoResults q={q} />}
      {rows?.length === 0 && !q && (
        <EmptyState icon={UserCheck} title={t.admin.emptyState.partners.title}>
          {t.admin.emptyState.partners.body(t.partner.statusLabel[status] ?? status)}
        </EmptyState>
      )}
      {rows && rows.length > 0 && (
        <DataPanel pagination={pagination} busy={busy} scroll={false}>
          <ul className="m-0 list-none divide-y divide-line p-0">
            {rows.map((r) => (
              <li key={r.id} className="grid gap-3 px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="m-0 text-base font-semibold">
                    {r.businessName}
                    <span className="font-normal text-muted"> · {t.partner.types[r.partnerType]}</span>
                  </h3>
                  <span className="small muted whitespace-nowrap">
                    {t.admin.submittedAt} {formatDateTime(r.updatedAt)}
                  </span>
                </div>
                <p className="m-0 text-sm">
                  {t.admin.applicant}: {r.userName} ({r.userEmail})
                </p>
                <p className="m-0 text-sm text-ink-soft">{details(r)}</p>
                {r.rejectionReason && (
                  <p className="m-0 rounded-xl bg-surface px-3 py-2 text-sm">
                    <strong>{t.partner.reason}:</strong> {r.rejectionReason}
                  </p>
                )}
                {r.status === 'pending' && (
                  <form
                    className="row"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const reason = String(new FormData(e.currentTarget).get('reason') ?? '').trim();
                      void decide(r.id, 'reject', reason);
                    }}
                  >
                    <button
                      type="button"
                      className={buttonVariants({ variant: 'primary', size: 'sm' })}
                      disabled={working === r.id}
                      onClick={() => void decide(r.id, 'approve')}
                    >
                      {t.admin.approve}
                    </button>
                    <input name="reason" placeholder={t.admin.reason} aria-label={t.admin.reason} required minLength={5} maxLength={1000} className="grow" />
                    <button type="submit" className={buttonVariants({ variant: 'secondary', size: 'sm' })} disabled={working === r.id}>
                      {t.admin.reject}
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </DataPanel>
      )}
    </>
  );
}
