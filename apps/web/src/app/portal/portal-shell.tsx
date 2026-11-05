'use client';

import { accountNav } from '@/components/account-nav';
import { AppShell, Loading } from '@/components/app-shell';
import type { AreaRequirement } from '@/lib/role-home';
import type { Me } from '@/lib/types';
import { useMe } from '@/lib/use-me';
import { t } from '@/messages/id';

/**
 * Muat pengguna portal lalu render isinya. Sejak Fase 2 portal terbuka untuk semua jenis mitra;
 * halaman klaim memakai `faskes`. `facilityId` menambah tab per profil.
 */
export function PortalShell({
  facilityId,
  require = 'partner',
  title,
  children,
}: {
  facilityId?: string;
  require?: AreaRequirement;
  title?: string;
  children: (me: Me) => React.ReactNode;
}) {
  const { me, error } = useMe({ require });
  if (!me) return <Loading error={error} />;
  const facility = facilityId ? me.memberships.find((m) => m.id === facilityId) : undefined;
  const nav = accountNav(me);
  if (facility) {
    nav.splice(
      1,
      0,
      { href: `/portal/faskes/${facility.id}`, label: t.portal.tariffs },
      { href: `/portal/faskes/${facility.id}/impor`, label: t.portal.import },
      { href: `/portal/faskes/${facility.id}/profil`, label: t.portal.profile },
    );
  }
  return (
    <AppShell me={me} title={title ?? (facility ? facility.name : t.portal.title)} nav={nav}>
      {facilityId && !facility ? <p className="error">{t.portal.notMember}</p> : children(me)}
    </AppShell>
  );
}
