'use client';

import { MapPin, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { PROFILE_MAX_LOCATIONS } from '@silk/shared';
import { parseCoord } from '@/lib/profile';
import type { PortalLocation } from '@/lib/portal-types';
import { cn } from '@/lib/cn';
import { t } from '@/messages/id';
import { LocationPicker } from './location-picker';

/** Lokasi dalam bentuk isian (lintang/bujur berupa teks agar bisa diketik bebas). */
export interface LocationDraft {
  label: string;
  address: string;
  city: string;
  province: string;
  lat: string;
  lng: string;
  isPrimary: boolean;
}

export const toDraft = (l: PortalLocation): LocationDraft => ({
  label: l.label ?? '',
  address: l.address,
  city: l.city,
  province: l.province,
  lat: String(l.lat),
  lng: String(l.lng),
  isPrimary: l.isPrimary,
});

export const emptyLocation = (isPrimary: boolean): LocationDraft => ({ label: '', address: '', city: '', province: '', lat: '', lng: '', isPrimary });

/** Bentuk body API; koordinat kosong dikirim sebagai NaN agar validasi server menyebutnya. */
export const fromDraft = (l: LocationDraft) => ({
  label: l.label.trim() || null,
  address: l.address.trim(),
  city: l.city.trim(),
  province: l.province.trim(),
  lat: parseCoord(l.lat) ?? Number.NaN,
  lng: parseCoord(l.lng) ?? Number.NaN,
  isPrimary: l.isPrimary,
});

export function LocationsEditor({ value, onChange, disabled }: { value: LocationDraft[]; onChange: (v: LocationDraft[]) => void; disabled?: boolean }) {
  const [active, setActive] = useState(0);
  const current = value[Math.min(active, value.length - 1)];
  const set = (i: number, patch: Partial<LocationDraft>) => onChange(value.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const setPrimary = (i: number) => onChange(value.map((l, j) => ({ ...l, isPrimary: j === i })));
  const remove = (i: number) => {
    const next = value.filter((_, j) => j !== i);
    if (!next.some((l) => l.isPrimary) && next[0]) next[0] = { ...next[0], isPrimary: true };
    onChange(next);
    setActive(0);
  };

  return (
    <fieldset className="stack" disabled={disabled}>
      <legend>{t.profile.locations}</legend>
      <p className="small muted">{t.profile.locationsHelp}</p>
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <ol className="plain grid gap-3">
          {value.map((l, i) => (
            <li
              key={i}
              className={cn('rounded-2xl border bg-white p-4', i === active ? 'border-primary-300 ring-2 ring-primary-100' : 'border-line')}
              onFocusCapture={() => setActive(i)}
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <strong>{l.label.trim() || t.profile.location(i + 1)}</strong>
                <div className="flex items-center gap-3">
                  <label className="checkbox">
                    <input type="radio" name="primary-location" checked={l.isPrimary} onChange={() => setPrimary(i)} /> {t.profile.primary}
                  </label>
                  {value.length > 1 && (
                    <button type="button" className="btn-link inline-flex items-center gap-1" onClick={() => remove(i)}>
                      <Trash2 className="size-4" aria-hidden="true" />
                      {t.portal.remove}
                    </button>
                  )}
                </div>
              </div>
              <div className="stack">
                <label>
                  {t.profile.label}
                  <input value={l.label} maxLength={80} placeholder={t.profile.labelPlaceholder} onChange={(e) => set(i, { label: e.target.value })} />
                </label>
                <label>
                  {t.facility.address}
                  <input value={l.address} required minLength={5} maxLength={500} onChange={(e) => set(i, { address: e.target.value })} />
                </label>
                <div className="row">
                  <label>
                    {t.profile.city}
                    <input value={l.city} required minLength={2} maxLength={100} placeholder="Kota Malang" onChange={(e) => set(i, { city: e.target.value })} />
                  </label>
                  <label>
                    {t.profile.province}
                    <input value={l.province} required minLength={2} maxLength={100} placeholder="Jawa Timur" onChange={(e) => set(i, { province: e.target.value })} />
                  </label>
                </div>
                <div className="row">
                  <label>
                    {t.portal.lat}
                    <input value={l.lat} required inputMode="decimal" onChange={(e) => set(i, { lat: e.target.value })} />
                  </label>
                  <label>
                    {t.portal.lng}
                    <input value={l.lng} required inputMode="decimal" onChange={(e) => set(i, { lng: e.target.value })} />
                  </label>
                </div>
                {i !== active && (
                  <button type="button" className="btn-link inline-flex items-center gap-1 justify-self-start" onClick={() => setActive(i)}>
                    <MapPin className="size-4" aria-hidden="true" />
                    {t.profile.pickOnMap}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
        {current && (
          <div className="lg:sticky lg:top-24 lg:self-start">
            <LocationPicker
              key={active}
              label={`${t.facility.map}: ${current.label.trim() || t.profile.location(active + 1)}`}
              lat={parseCoord(current.lat)}
              lng={parseCoord(current.lng)}
              onPick={(lat, lng) => set(active, { lat: String(lat), lng: String(lng) })}
            />
          </div>
        )}
      </div>
      {value.length < PROFILE_MAX_LOCATIONS && (
        <button
          type="button"
          className="btn inline-flex items-center gap-1.5 justify-self-start"
          onClick={() => {
            onChange([...value, emptyLocation(value.length === 0)]);
            setActive(value.length);
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          {t.profile.addLocation}
        </button>
      )}
    </fieldset>
  );
}
