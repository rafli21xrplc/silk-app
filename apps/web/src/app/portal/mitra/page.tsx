'use client';

import { BadgeCheck, Clock, FileText, XCircle, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { FACILITY_TYPES, partnerTypeForRole, type Partner, type PartnerRole, type PartnerType } from '@silk/shared';
import { FormError } from '@/components/app-shell';
import { buttonVariants } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { api, errorMessage } from '@/lib/client-api';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { queryCache } from '@/lib/query-cache';
import type { Me } from '@/lib/types';
import { t } from '@/messages/id';
import { PortalShell } from '../portal-shell';

export default function PartnerPage() {
  return (
    <PortalShell require="partner" title={t.partner.title}>
      {(me) => <PartnerForm me={me} />}
    </PortalShell>
  );
}

const STATUS_STYLE: Record<string, { icon: LucideIcon; className: string }> = {
  none: { icon: FileText, className: 'border-line bg-surface' },
  pending: { icon: Clock, className: 'border-warn-line bg-warn-soft' },
  verified: { icon: BadgeCheck, className: 'border-primary-200 bg-primary-50' },
  rejected: { icon: XCircle, className: 'border-danger/25 bg-danger-soft' },
};

function StatusBanner({ partner }: { partner: Partner | null }) {
  const key = partner?.status ?? 'none';
  const copy = t.partner.status[key]!;
  const { icon: Icon, className } = STATUS_STYLE[key]!;
  return (
    <div role="status" className={cn('mb-6 flex items-start gap-3 rounded-2xl border p-4', className)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="m-0 font-semibold">{copy.title}</p>
        <p className="m-0 text-ink-soft">{copy.body}</p>
        {partner?.status === 'rejected' && partner.rejectionReason && (
          <p className="mt-2 mb-0">
            <strong>{t.partner.reason}:</strong> {partner.rejectionReason}
          </p>
        )}
        {partner?.verifiedAt && <p className="mt-1 mb-0 text-sm text-muted">{formatDateTime(partner.verifiedAt)}</p>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      {label}
      {children}
    </label>
  );
}

/** Ambil isian form sesuai jenis mitra; validasi akhir tetap di API (Zod). */
function bodyFor(type: PartnerType, f: FormData) {
  const s = (k: string) => String(f.get(k) ?? '').trim();
  const base = { partnerType: type, businessName: s('businessName'), licenseNo: s('licenseNo') };
  switch (type) {
    case 'tenaga_medis':
      return { ...base, specialty: s('specialty'), strNo: s('strNo') };
    case 'fasilitas':
      return { ...base, facilityKind: s('facilityKind'), roomCount: s('roomCount') ? Number(s('roomCount')) : null };
    case 'gaya_hidup':
      return { ...base, field: s('field') };
    case 'apotek':
      return { ...base, siaNo: s('siaNo') };
  }
}

function PartnerForm({ me }: { me: Me }) {
  const type = partnerTypeForRole(me.user.role as PartnerRole);
  const p = me.partner;
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api('PUT', '/partners/me', bodyFor(type, new FormData(e.currentTarget)));
      queryCache.invalidate('/me');
      await queryCache.fetchQuery<Me>('/me');
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <StatusBanner partner={p} />
      <p className="mt-0 text-ink-soft">{t.partner.intro}</p>
      <form onSubmit={onSubmit} className="grid gap-4 rounded-2xl border border-line bg-white p-5 shadow-soft sm:p-6">
        <FormError error={error} />
        {saved && <p role="status" className="m-0 text-primary-700">{t.partner.saved}</p>}
        <p className="m-0">
          <span className="text-muted">{t.partner.type}:</span> <strong>{t.partner.types[type]}</strong>
        </p>
        <Field label={t.partner.businessName}>
          <input name="businessName" defaultValue={p?.businessName ?? ''} required minLength={2} maxLength={150} />
        </Field>
        <Field label={t.partner.licenseNo}>
          <input name="licenseNo" defaultValue={p?.licenseNo ?? ''} required minLength={3} maxLength={100} />
        </Field>
        {type === 'tenaga_medis' && (
          <>
            <Field label={t.partner.specialty}>
              <input name="specialty" defaultValue={p?.specialty ?? ''} required minLength={2} maxLength={100} />
            </Field>
            <Field label={t.partner.strNo}>
              <input name="strNo" defaultValue={p?.strNo ?? ''} required minLength={5} maxLength={50} />
            </Field>
          </>
        )}
        {type === 'fasilitas' && (
          <>
            <div className="grid gap-1.5">
              <span>{t.partner.facilityKind}</span>
              <Select
                name="facilityKind"
                defaultValue={p?.facilityKind ?? FACILITY_TYPES[0]}
                label={t.partner.facilityKind}
                options={FACILITY_TYPES.map((v) => ({ value: v, label: t.facilityType[v] ?? v }))}
              />
            </div>
            <Field label={t.partner.roomCount}>
              <input name="roomCount" type="number" min={0} max={10000} defaultValue={p?.roomCount ?? ''} />
            </Field>
          </>
        )}
        {type === 'gaya_hidup' && (
          <Field label={t.partner.field}>
            <input name="field" defaultValue={p?.field ?? ''} required minLength={2} maxLength={100} />
          </Field>
        )}
        {type === 'apotek' && (
          <Field label={t.partner.siaNo}>
            <input name="siaNo" defaultValue={p?.siaNo ?? ''} required minLength={3} maxLength={100} />
          </Field>
        )}
        <p className="m-0 text-sm text-muted">{t.partner.docsLater}</p>
        {p && <p className="m-0 text-sm text-muted">{t.partner.resubmitNote}</p>}
        <div>
          <button type="submit" className={buttonVariants({ variant: 'primary' })} disabled={busy} aria-busy={busy}>
            {busy ? t.common.loading : p ? t.partner.resubmit : t.partner.submit}
          </button>
        </div>
      </form>
    </div>
  );
}
