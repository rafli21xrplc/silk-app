import { can, isPartnerRole, isStaffRole } from '@silk/shared';
import type { Me } from '@/lib/types';
import { t } from '@/messages/id';

export interface NavItem {
  href: string;
  label: string;
}

/** Navigasi samping area akun/portal per role (menu admin lengkap ada di AdminShell). */
export function accountNav(me: Me): NavItem[] {
  const nav: NavItem[] = [];
  if (isPartnerRole(me.user.role)) {
    const faskes = me.user.role === 'faskes';
    nav.push({ href: '/portal', label: faskes ? t.portal.myFacilities : t.portal.myProfiles });
    if (faskes) nav.push({ href: '/portal/klaim', label: t.portal.claims });
    if (can(me.user.role, 'portal.articles')) nav.push({ href: '/portal/artikel', label: t.articleEditor.nav });
    nav.push({ href: '/portal/mitra', label: t.partner.title });
  }
  if (isStaffRole(me.user.role)) nav.push({ href: '/admin', label: t.admin.title });
  nav.push({ href: '/akun', label: t.account.title });
  return nav;
}
