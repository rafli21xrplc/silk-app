import { isPartnerRole, isStaffRole } from '@silk/shared';
import type { Me } from '@/lib/types';
import { t } from '@/messages/id';

export interface NavItem {
  href: string;
  label: string;
}

/** Navigasi samping area akun/portal per role (menu admin lengkap ada di AdminShell). */
export function accountNav(me: Me): NavItem[] {
  const nav: NavItem[] = [];
  if (me.user.role === 'faskes') {
    nav.push({ href: '/portal', label: t.portal.myFacilities }, { href: '/portal/klaim', label: t.portal.claims });
  }
  if (isPartnerRole(me.user.role)) nav.push({ href: '/portal/mitra', label: t.partner.title });
  if (isStaffRole(me.user.role)) nav.push({ href: '/admin', label: t.admin.title });
  nav.push({ href: '/akun', label: t.account.title });
  return nav;
}
