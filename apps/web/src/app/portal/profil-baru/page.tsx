'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FormError } from '@/components/app-shell';
import { emptyLocation, fromDraft, LocationsEditor, type LocationDraft } from '@/components/portal/locations-editor';
import { api, errorMessage } from '@/lib/client-api';
import { canCreateProfile } from '@/lib/profile';
import { queryCache } from '@/lib/query-cache';
import type { Me } from '@/lib/types';
import { t } from '@/messages/id';
import { PortalShell } from '../portal-shell';

/** Buat profil layanan draft (K2): mitra terverifikasi; non-faskes maksimal satu profil. */
export default function NewProfilePage() {
  return <PortalShell title={t.profile.createTitle}>{(me) => <CreateForm me={me} />}</PortalShell>;
}

function CreateForm({ me }: { me: Me }) {
  const router = useRouter();
  const [locations, setLocations] = useState<LocationDraft[]>([emptyLocation(true)]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!canCreateProfile(me)) {
    return (
      <p className="card">
        {me.partner?.status === 'verified' ? t.profile.limitReached : t.profile.createNeedsVerified}{' '}
        <Link href={me.partner?.status === 'verified' ? '/portal' : '/portal/mitra'}>{me.partner?.status === 'verified' ? t.portal.myProfiles : t.partner.title}</Link>
      </p>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = (k: string) => String(form.get(k) ?? '').trim() || null;
    setBusy(true);
    setError(null);
    try {
      const { data } = await api<{ id: string }>('POST', '/portal/profiles', {
        name: text('name') ?? '',
        description: text('description'),
        phone: text('phone'),
        website: text('website'),
        locations: locations.map(fromDraft),
      });
      // Keanggotaan baru harus terlihat di /me sebelum membuka halaman profil.
      await queryCache.fetchQuery('/me');
      router.push(`/portal/faskes/${data.id}/profil`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="stack card">
      <p className="small muted">{t.profile.createHelp}</p>
      <FormError error={error} />
      <label>
        {t.profile.name}
        <input name="name" required minLength={3} maxLength={200} />
      </label>
      <label>
        {t.portal.description}
        <textarea name="description" rows={4} maxLength={2000} aria-describedby="desc-help" />
        <span id="desc-help" className="small muted">
          {t.portal.descriptionHelp}
        </span>
      </label>
      <div className="row">
        <label>
          {t.facility.phone}
          <input name="phone" type="tel" maxLength={40} />
        </label>
        <label>
          {t.facility.website}
          <input name="website" type="url" maxLength={300} placeholder="https://" />
        </label>
      </div>
      <LocationsEditor value={locations} onChange={setLocations} disabled={busy} />
      <button type="submit" className="btn-primary" disabled={busy}>
        {busy ? t.common.loading : t.profile.create}
      </button>
    </form>
  );
}
