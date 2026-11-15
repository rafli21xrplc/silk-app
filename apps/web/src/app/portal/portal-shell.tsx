'use client';

import { usePathname } from 'next/navigation';
import { Store, Tags, Upload } from 'lucide-react';
import { accountNav } from '@/components/account-nav';
import { activeHref, AppShell, Loading } from '@/components/app-shell';
import { usePortalFlags } from '@/components/portal/portal-flags';
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
  const pathname = usePathname() ?? '/portal';
  const flags = usePortalFlags();
  if (!me) return <Loading error={error} />;
  const facility = facilityId ? me.memberships.find((m) => m.id === facilityId) : undefined;
  const nav = accountNav(me, flags);
  if (facility) {
    nav.splice(
      1,
      0,
      { href: `/portal/faskes/${facility.id}`, label: t.portal.tariffs, icon: Tags, group: 'partner' },
      { href: `/portal/faskes/${facility.id}/impor`, label: t.portal.import, icon: Upload, group: 'partner' },
      { href: `/portal/faskes/${facility.id}/profil`, label: t.portal.profile, icon: Store, group: 'partner' },
    );
  }
  return (
    <AppShell me={me} area={t.portal.title} title={title ?? (facility ? facility.name : (nav.find((n) => n.href === activeHref(pathname, nav))?.label ?? t.portal.title))} nav={nav}>
      {facilityId && !facility ? <p className="error">{t.portal.notMember}</p> : children(me)}
    </AppShell>
  );
}
