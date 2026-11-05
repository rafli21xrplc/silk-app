'use client';

import Link from 'next/link';
import { t } from '@/messages/id';
import { PortalShell } from './portal-shell';

export default function PortalHome() {
  return (
    <PortalShell>
      {(me) => (
        <>
          {!me.user.emailVerified && <p className="error">{t.portal.verifyEmail}</p>}
          {me.memberships.length === 0 ? (
            <p>
              {t.portal.none} <Link href="/portal/klaim">{t.portal.claimTitle}</Link>
            </p>
          ) : (
            <ul className="plain grid grid-2">
              {me.memberships.map((m) => (
                <li key={m.id} className="card">
                  <h2>
                    <Link href={`/portal/faskes/${m.id}`}>{m.name}</Link>
                  </h2>
                  <p className="small muted">
                    {m.city} · <span className={`badge badge-${m.verification}`}>{t.verification[m.verification]}</span> ·{' '}
                    <span className="badge badge-status">{t.portal.status[m.status]}</span>
                  </p>
                  <p className="small">
                    <Link href={`/portal/faskes/${m.id}`}>{t.portal.tariffs}</Link> · <Link href={`/portal/faskes/${m.id}/impor`}>{t.portal.import}</Link> ·{' '}
                    <Link href={`/portal/faskes/${m.id}/profil`}>{t.portal.profile}</Link> · <Link href={`/faskes/${m.slug}`}>{t.portal.viewPublic}</Link>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </PortalShell>
  );
}
