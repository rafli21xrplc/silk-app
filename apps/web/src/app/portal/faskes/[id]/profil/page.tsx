'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { FormError } from '@/components/app-shell';
import { api, errorMessage } from '@/lib/client-api';
import { queryCache, useQuery } from '@/lib/query-cache';
import { t } from '@/messages/id';
import { PortalShell } from '../../../portal-shell';
import { LoadingForm } from '@/components/ui/skeleton';

const DAYS = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'] as const;

interface PortalFacility {
  id: string;
  name: string;
  description: string | null;
  address: string;
  city: string;
  phone: string | null;
  website: string | null;
  hours: Record<string, string> | null;
  lat: number | null;
  lng: number | null;
  status: string;
}

export default function PortalProfilePage() {
  const { id } = useParams<{ id: string }>();
  return <PortalShell facilityId={id}>{() => <ProfileForm facilityId={id} />}</PortalShell>;
}

function ProfileForm({ facilityId }: { facilityId: string }) {
  const path = `/portal/facilities/${facilityId}`;
  const loaded = useQuery<PortalFacility>(path);
  // Setelah disimpan, tampilkan hasil dari server; cache dibuang agar kunjungan berikutnya memuat ulang.
  const [saved, setSaved] = useState<PortalFacility | null>(null);
  const f = saved ?? loaded.data ?? null;
  const [error, setError] = useState<string | null>(null);
  const loadError = loaded.error ? errorMessage(loaded.error) : null;
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = (k: string) => String(form.get(k) ?? '').trim() || null;
    const hours = Object.fromEntries(DAYS.flatMap((d) => (text(`hours.${d}`) ? [[d, text(`hours.${d}`)!]] : [])));
    const lat = text('lat');
    const lng = text('lng');
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { data } = await api<PortalFacility & { needsReview: boolean }>('PUT', `/portal/facilities/${facilityId}`, {
        name: text('name') ?? undefined,
        description: text('description'),
        address: text('address') ?? undefined,
        phone: text('phone'),
        website: text('website'),
        hours: Object.keys(hours).length ? hours : null,
        ...(lat && lng ? { lat: Number(lat.replace(',', '.')), lng: Number(lng.replace(',', '.')) } : {}),
      });
      setSaved(data);
      queryCache.invalidate(path);
      setNotice(data.needsReview ? t.portal.savedReview : t.portal.saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!f) return loadError ? <FormError error={loadError} /> : <LoadingForm fields={6} />;
  return (
    <form onSubmit={onSubmit} className="stack card" key={f.id}>
      <h2>{t.portal.profileTitle}</h2>
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      <FormError error={error} />
      <label>
        {t.auth.name}
        <input name="name" defaultValue={f.name} required minLength={3} maxLength={200} />
      </label>
      <label>
        {t.portal.description}
        <textarea name="description" defaultValue={f.description ?? ''} rows={4} maxLength={2000} aria-describedby="desc-help" />
        <span id="desc-help" className="small muted">
          {t.portal.descriptionHelp}
        </span>
      </label>
      <label>
        {t.facility.address}
        <input name="address" defaultValue={f.address} required minLength={5} maxLength={500} />
      </label>
      <div className="row">
        <label>
          {t.facility.phone}
          <input name="phone" type="tel" defaultValue={f.phone ?? ''} maxLength={40} />
        </label>
        <label>
          {t.facility.website}
          <input name="website" type="url" defaultValue={f.website ?? ''} maxLength={300} placeholder="https://" />
        </label>
      </div>
      <fieldset className="stack">
        <legend>{t.facility.hours}</legend>
        <p className="small muted">{t.portal.hoursHelp}</p>
        {DAYS.map((d) => (
          <label key={d} className="row">
            <span style={{ minWidth: '6rem' }}>{t.portal.days[d]}</span>
            <input name={`hours.${d}`} defaultValue={f.hours?.[d] ?? ''} maxLength={60} />
          </label>
        ))}
      </fieldset>
      <div className="row">
        <label>
          {t.portal.lat}
          <input name="lat" inputMode="decimal" defaultValue={f.lat ?? ''} />
        </label>
        <label>
          {t.portal.lng}
          <input name="lng" inputMode="decimal" defaultValue={f.lng ?? ''} />
        </label>
      </div>
      <button type="submit" className="btn-primary" disabled={busy}>
        {busy ? t.common.loading : t.portal.save}
      </button>
    </form>
  );
}
