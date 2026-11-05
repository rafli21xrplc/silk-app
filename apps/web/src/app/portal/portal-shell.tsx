'use client';

import { AppShell, Loading } from '@/components/app-shell';
import type { Me } from '@/lib/types';
import { useMe } from '@/lib/use-me';
import { t } from '@/messages/id';

/** Muat pengguna faskes lalu render isi portal. `facilityId` menambah tab per faskes. */
export function PortalShell({ facilityId, children }: { facilityId?: string; children: (me: Me) => React.ReactNode }) {
  const { me, error } = useMe({ require: 'faskes' });
  if (!me) return <Loading error={error} />;
  const facility = facilityId ? me.memberships.find((m) => m.id === facilityId) : undefined;
  const nav = [{ href: '/portal', label: t.portal.myFacilities }];
  if (facility) {
    nav.push(
      { href: `/portal/faskes/${facility.id}`, label: t.portal.tariffs },
      { href: `/portal/faskes/${facility.id}/impor`, label: t.portal.import },
      { href: `/portal/faskes/${facility.id}/profil`, label: t.portal.profile },
    );
  }
  nav.push({ href: '/portal/klaim', label: t.portal.claims });
  return (
    <AppShell me={me} title={facility ? facility.name : t.portal.title} nav={nav}>
      {facilityId && !facility ? <p className="error">{t.portal.notMember}</p> : children(me)}
    </AppShell>
  );
}
