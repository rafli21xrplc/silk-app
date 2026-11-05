'use client';

import { useEffect, useState } from 'react';
import { PRICE_TYPES, type PriceType } from '@silk/shared';
import { api, ClientApiError, errorMessage } from '@/lib/client-api';
import { useQuery } from '@/lib/query-cache';
import type { ServiceListItem } from '@/lib/types';
import { t } from '@/messages/id';
import { FormError } from './app-shell';
import { DatePicker } from './ui/date-picker';
import { Select } from './ui/select';

export interface PortalTariff {
  id: string;
  status: string;
  serviceId: string;
  serviceSlug: string;
  serviceName: string;
  packageId: string | null;
  packageName: string | null;
  versionNo: number | null;
  priceType: PriceType | null;
  priceMin: number | null;
  priceMax: number | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  verifiedAt: string | null;
  inclusions: string | null;
  exclusions: string | null;
  components: { label: string; included: boolean }[];
  /** Fase 2 (K5): layanan nonaktif disembunyikan dari publik. */
  active: boolean;
  /** Permintaan harga yang masih menunggu untuk tarif ini (K4). */
  pendingRequestId: string | null;
}

export interface TariffRequestResult {
  requestId: string;
  status: string;
  needsReview: boolean;
}

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' });
const toInt = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').replace(/[^\d]/g, '');
  return s === '' ? null : Number(s);
};
const textOrNull = (v: FormDataEntryValue | null) => String(v ?? '').trim() || null;

/**
 * Form usulan harga (M6, K4). Hasilnya permintaan harga yang menunggu moderator, bukan versi terbit.
 * Mode `create` dapat menyertakan paket; mode `update` membawa `expectedVersionNo` agar perubahan
 * bersamaan terdeteksi. Setiap usulan wajib menyebut sumber; dokumen bukti diunggah sesudahnya.
 */
export function TariffForm({
  facilityId,
  tariff,
  onSaved,
  onCancel,
}: {
  facilityId: string;
  tariff?: PortalTariff;
  onSaved: (result: TariffRequestResult) => void;
  onCancel: () => void;
}) {
  const isUpdate = Boolean(tariff);
  // Katalog layanan jarang berubah: cache 5 menit, dipakai bersama antar-form.
  const servicesQuery = useQuery<ServiceListItem[]>(isUpdate ? null : '/services?limit=100', { staleMs: 300_000 });
  const services = servicesQuery.data ?? [];
  const [priceType, setPriceType] = useState<PriceType>(tariff?.priceType ?? 'tetap');
  const [withPackage, setWithPackage] = useState(false);
  const [components, setComponents] = useState<{ label: string; included: boolean }[]>([{ label: '', included: true }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (servicesQuery.error) setError(errorMessage(servicesQuery.error));
  }, [servicesQuery.error]);

  const hasPackage = isUpdate ? Boolean(tariff?.packageId) : withPackage;
  const allowedTypes = PRICE_TYPES.filter((p) => p !== 'paket' || hasPackage);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const fields = {
      priceType,
      priceMin: priceType === 'tanya' ? null : toInt(f.get('priceMin')),
      priceMax: priceType === 'rentang' ? toInt(f.get('priceMax')) : null,
      effectiveFrom: String(f.get('effectiveFrom')),
      effectiveTo: textOrNull(f.get('effectiveTo')),
      inclusions: textOrNull(f.get('inclusions')),
      exclusions: textOrNull(f.get('exclusions')),
      sourceTitle: String(f.get('sourceTitle') ?? '').trim(),
      sourceUrl: textOrNull(f.get('sourceUrl')),
    };
    setBusy(true);
    setError(null);
    try {
      const { data } = isUpdate
        ? await api<TariffRequestResult>('PUT', `/portal/tariffs/${tariff!.id}`, {
            ...fields,
            expectedVersionNo: tariff!.versionNo ?? 1,
          })
        : await api<TariffRequestResult>('POST', `/portal/facilities/${facilityId}/tariffs`, {
            ...fields,
            serviceId: String(f.get('serviceId')),
            ...(withPackage
              ? {
                  package: {
                    name: String(f.get('packageName')).trim(),
                    notes: textOrNull(f.get('packageNotes')),
                    components: components.filter((c) => c.label.trim()).map((c) => ({ label: c.label.trim(), included: c.included })),
                  },
                }
              : {}),
          });
      onSaved(data);
    } catch (err) {
      setError(err instanceof ClientApiError && err.body.code === 'TARIFF_VERSION_CONFLICT' ? t.portal.conflict : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card stack">
      <h2>{isUpdate ? `${t.priceRequest.submitChange}: ${tariff!.packageName ?? tariff!.serviceName}` : t.priceRequest.submitNew}</h2>
      <p className="small muted">{t.priceRequest.formHelp}</p>
      <FormError error={error} />
      {!isUpdate && (
        <>
          <label>
            {t.portal.service}
            <Select
              name="serviceId"
              required
              label={t.portal.service}
              searchable
              options={services.map((s) => ({ value: s.id, label: s.name, hint: s.category.name }))}
            />
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={withPackage} onChange={(e) => setWithPackage(e.target.checked)} /> {t.portal.asPackage}
          </label>
          {withPackage && (
            <fieldset className="stack">
              <legend>{t.price.package}</legend>
              <label>
                {t.portal.packageName}
                <input name="packageName" required minLength={3} maxLength={200} />
              </label>
              <label>
                {t.portal.notes}
                <textarea name="packageNotes" maxLength={1000} rows={2} />
              </label>
              <p className="small">{t.portal.components}</p>
              {components.map((c, i) => (
                <div key={i} className="row">
                  <input
                    aria-label={`${t.portal.componentLabel} ${i + 1}`}
                    value={c.label}
                    maxLength={120}
                    onChange={(e) => setComponents((cs) => cs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                  />
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={c.included}
                      onChange={(e) => setComponents((cs) => cs.map((x, j) => (j === i ? { ...x, included: e.target.checked } : x)))}
                    />{' '}
                    {t.portal.componentIncluded}
                  </label>
                  <button type="button" className="btn-link" onClick={() => setComponents((cs) => cs.filter((_, j) => j !== i))} disabled={components.length === 1}>
                    {t.portal.remove}
                  </button>
                </div>
              ))}
              <button type="button" className="btn" onClick={() => setComponents((cs) => [...cs, { label: '', included: true }])}>
                {t.portal.addComponent}
              </button>
            </fieldset>
          )}
        </>
      )}
      <label>
        {t.portal.priceType}
        <Select
          value={priceType}
          onValueChange={(v) => setPriceType(v as PriceType)}
          label={t.portal.priceType}
          options={allowedTypes.map((p) => ({ value: p, label: t.portal.priceTypes[p] ?? p }))}
        />
      </label>
      {priceType !== 'tanya' && (
        <label>
          {priceType === 'rentang' ? t.portal.priceMinRange : t.portal.priceMin}
          <input name="priceMin" inputMode="numeric" required defaultValue={tariff?.priceMin ?? ''} placeholder="150000" />
        </label>
      )}
      {priceType === 'rentang' && (
        <label>
          {t.portal.priceMax}
          <input name="priceMax" inputMode="numeric" required defaultValue={tariff?.priceMax ?? ''} />
        </label>
      )}
      <div className="row">
        <label>
          {t.portal.effectiveFrom}
          <DatePicker name="effectiveFrom" required defaultValue={today()} label={t.portal.effectiveFrom} />
        </label>
        <label>
          {t.portal.effectiveTo}
          <DatePicker name="effectiveTo" defaultValue={tariff?.effectiveTo ?? ''} label={t.portal.effectiveTo} />
        </label>
      </div>
      <label>
        {t.portal.inclusions}
        <textarea name="inclusions" rows={2} maxLength={1000} defaultValue={tariff?.inclusions ?? ''} />
      </label>
      <label>
        {t.portal.exclusions}
        <textarea name="exclusions" rows={2} maxLength={1000} defaultValue={tariff?.exclusions ?? ''} />
      </label>
      <div className="row">
        <label>
          {t.priceRequest.sourceTitle}
          <input name="sourceTitle" required minLength={3} maxLength={200} placeholder={t.priceRequest.sourceTitlePlaceholder} />
        </label>
        <label>
          {t.priceRequest.sourceUrl}
          <input name="sourceUrl" type="url" maxLength={500} placeholder="https://" />
        </label>
      </div>
      <p className="small muted">{t.portal.descriptionHelp}</p>
      <div className="actions">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? t.common.loading : isUpdate ? t.priceRequest.submitChange : t.priceRequest.submitNew}
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          {t.report.cancel}
        </button>
      </div>
    </form>
  );
}
