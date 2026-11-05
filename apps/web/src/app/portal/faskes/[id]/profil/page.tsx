'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { FormError } from '@/components/app-shell';
import { fromDraft, LocationsEditor, toDraft, type LocationDraft } from '@/components/portal/locations-editor';
import { MediaManager } from '@/components/portal/media-manager';
import { ScheduleEditor, type ScheduleDraft } from '@/components/portal/schedule-editor';
import { LoadingForm } from '@/components/ui/skeleton';
import { api, errorMessage } from '@/lib/client-api';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import type { PortalLocation, PortalProfile, PortalSchedule } from '@/lib/portal-types';
import { queryCache, useQuery } from '@/lib/query-cache';
import { t } from '@/messages/id';
import { PortalShell } from '../../../portal-shell';

export default function PortalProfilePage() {
  const { id } = useParams<{ id: string }>();
  return <PortalShell facilityId={id}>{() => <ProfileEditor facilityId={id} />}</PortalShell>;
}

/** Nilai yang ditampilkan di formulir: data profil, ditimpa usulan revisi yang masih menunggu. */
interface FormValues {
  name: string;
  description: string | null;
  phone: string | null;
  website: string | null;
  locations: PortalLocation[];
  schedules: PortalSchedule[];
}

function formValuesOf(p: PortalProfile): FormValues {
  const base: FormValues = {
    name: p.name,
    description: p.description,
    phone: p.phone,
    website: p.website,
    locations: p.locations,
    schedules: p.schedules,
  };
  // Usulan berikutnya digabung ke revisi menunggu, jadi formulir harus memuat isi usulan itu.
  const pending = p.pendingRevision?.payload as Partial<FormValues> | undefined;
  return pending ? { ...base, ...pending } : base;
}

const toScheduleDraft = (s: PortalSchedule): ScheduleDraft => ({
  kind: s.kind,
  weekday: s.weekday,
  start: s.start,
  end: s.end,
  timezone: s.timezone,
  practitionerId: s.practitionerId ?? null,
  note: s.note ?? null,
});

const STATUS_BANNER: Record<PortalProfile['status'], { text: string; className: string }> = {
  draft: { text: t.profile.statusDraft, className: 'border-line bg-surface' },
  menunggu_tinjauan: { text: t.profile.statusReview, className: 'border-warn-line bg-warn-soft' },
  terbit: { text: t.profile.statusLive, className: 'border-primary-200 bg-primary-50' },
  ditarik: { text: t.profile.statusWithdrawn, className: 'border-danger/25 bg-danger-soft' },
};

function ProfileEditor({ facilityId }: { facilityId: string }) {
  const path = `/portal/facilities/${facilityId}`;
  const { data: profile, error: loadError, refetch } = useQuery<PortalProfile>(path);
  // Disimpan di sini karena formulir dipasang ulang setelah data dimuat ulang.
  const [notice, setNotice] = useState<string | null>(null);

  if (!profile) return loadError ? <FormError error={errorMessage(loadError)} /> : <LoadingForm fields={6} />;
  return (
    <div className="stack">
      <StatusPanel profile={profile} onChanged={refetch} />
      {/* key: formulir dimuat ulang dari server setelah data berubah (simpan, ajukan, revisi diputus). */}
      <ProfileForm
        key={`${profile.updatedAt}-${profile.pendingRevision?.id ?? ''}`}
        profile={profile}
        path={path}
        notice={notice}
        onSaved={async (message) => {
          setNotice(message);
          await refetch();
        }}
      />
      <MediaManager facilityId={facilityId} media={profile.media} onChanged={refetch} disabled={profile.status === 'ditarik'} />
    </div>
  );
}

function StatusPanel({ profile, onChanged }: { profile: PortalProfile; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const banner = STATUS_BANNER[profile.status];
  const last = profile.lastRevision;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api('POST', `/portal/facilities/${profile.id}/submit`);
      setNotice(t.profile.submitted);
      queryCache.invalidate('/me');
      await onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div role="status" className={cn('flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4', banner.className)}>
        <p className="m-0">
          <span className="badge badge-status mr-2">{t.portal.status[profile.status] ?? profile.status}</span>
          {banner.text}
        </p>
        {profile.status === 'draft' && (
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void submit()}>
            {busy ? t.common.loading : t.profile.submit}
          </button>
        )}
      </div>
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      <FormError error={error} />
      {profile.pendingRevision && (
        <p className="rounded-2xl border border-warn-line bg-warn-soft p-4 m-0" role="status">
          {t.profile.pendingRevision(formatDateTime(profile.pendingRevision.createdAt))}
        </p>
      )}
      {!profile.pendingRevision && last?.status === 'rejected' && (
        <p className="rounded-2xl border border-danger/25 bg-danger-soft p-4 m-0" role="status">
          {t.profile.rejectedRevision}
          {last.rejectionReason && (
            <>
              {' '}
              <strong>{t.partner.reason}:</strong> {last.rejectionReason}
            </>
          )}
        </p>
      )}
    </div>
  );
}

function ProfileForm({
  profile,
  path,
  notice,
  onSaved,
}: {
  profile: PortalProfile;
  path: string;
  notice: string | null;
  onSaved: (message: string) => Promise<void>;
}) {
  const initial = formValuesOf(profile);
  const [locations, setLocations] = useState<LocationDraft[]>(() => initial.locations.map(toDraft));
  const [schedules, setSchedules] = useState<ScheduleDraft[]>(() => initial.schedules.map(toScheduleDraft));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = profile.status === 'ditarik';

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = (k: string) => String(form.get(k) ?? '').trim() || null;
    setBusy(true);
    setError(null);
    try {
      const { data } = await api<{ needsReview: boolean }>('PUT', path, {
        name: text('name') ?? undefined,
        description: text('description'),
        phone: text('phone'),
        website: text('website'),
        locations: locations.map(fromDraft),
        schedules: schedules.map((s) => ({ ...s, note: s.note?.trim() || null })),
      });
      queryCache.invalidate('/me');
      await onSaved(data.needsReview ? t.profile.savedRevision : t.profile.savedDraft);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="stack card">
      <h2>{t.profile.basics}</h2>
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      <FormError error={error} />
      <fieldset className="stack" disabled={locked || busy}>
        <label>
          {t.profile.name}
          <input name="name" defaultValue={initial.name} required minLength={3} maxLength={200} />
        </label>
        <label>
          {t.portal.description}
          <textarea name="description" defaultValue={initial.description ?? ''} rows={4} maxLength={2000} aria-describedby="desc-help" />
          <span id="desc-help" className="small muted">
            {t.portal.descriptionHelp}
          </span>
        </label>
        <div className="row">
          <label>
            {t.facility.phone}
            <input name="phone" type="tel" defaultValue={initial.phone ?? ''} maxLength={40} />
          </label>
          <label>
            {t.facility.website}
            <input name="website" type="url" defaultValue={initial.website ?? ''} maxLength={300} placeholder="https://" />
          </label>
        </div>
      </fieldset>
      <LocationsEditor value={locations} onChange={setLocations} disabled={locked || busy} />
      <ScheduleEditor value={schedules} onChange={setSchedules} practitioners={profile.practitioners} disabled={locked || busy} />
      <button type="submit" className="btn-primary" disabled={locked || busy}>
        {busy ? t.common.loading : t.portal.save}
      </button>
    </form>
  );
}
