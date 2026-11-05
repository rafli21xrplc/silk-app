'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { canCreateProfile } from '@/lib/profile';
import { t } from '@/messages/id';
import { PortalShell } from './portal-shell';

export default function PortalHome() {
  return (
    <PortalShell>
      {(me) => {
        const faskes = me.user.role === 'faskes';
        const canCreate = canCreateProfile(me);
        return (
          <>
            {!me.user.emailVerified && <p className="error">{t.portal.verifyEmail}</p>}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="m-0">{faskes ? t.portal.myFacilities : t.portal.myProfiles}</h2>
              {canCreate && (
                <Link href="/portal/profil-baru" className={cn(buttonVariants({ variant: 'primary' }), 'inline-flex items-center gap-1.5')}>
                  <Plus className="size-4" aria-hidden="true" />
                  {t.profile.create}
                </Link>
              )}
            </div>
            {me.partner?.status !== 'verified' && (
              <p className="small muted">
                {t.profile.createNeedsVerified} <Link href="/portal/mitra">{t.partner.title}</Link>
              </p>
            )}
            {me.memberships.length === 0 ? (
              <p>
                {faskes ? (
                  <>
                    {t.portal.none} <Link href="/portal/klaim">{t.portal.claimTitle}</Link>
                  </>
                ) : (
                  t.portal.noProfiles
                )}
              </p>
            ) : (
              <ul className="plain grid grid-2">
                {me.memberships.map((m) => (
                  <li key={m.id} className="card">
                    <h2>
                      <Link href={`/portal/faskes/${m.id}/profil`}>{m.name}</Link>
                    </h2>
                    <p className="small muted">
                      {t.facilityType[m.type] ?? m.type} · {m.city} · <span className={`badge badge-${m.verification}`}>{t.verification[m.verification]}</span> ·{' '}
                      <span className="badge badge-status">{t.portal.status[m.status]}</span>
                    </p>
                    <p className="small">
                      <Link href={`/portal/faskes/${m.id}/profil`}>{t.portal.profile}</Link> · <Link href={`/portal/faskes/${m.id}`}>{t.portal.tariffs}</Link> ·{' '}
                      <Link href={`/portal/faskes/${m.id}/impor`}>{t.portal.import}</Link>
                      {m.status === 'terbit' && (
                        <>
                          {' '}
                          · <Link href={`/faskes/${m.slug}`}>{t.portal.viewPublic}</Link>
                        </>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </>
        );
      }}
    </PortalShell>
  );
}
