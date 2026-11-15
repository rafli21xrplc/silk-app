import { BadgeCheck, Building2, CreditCard, FileCheck2, PenLine, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react';
import { can, isPartnerRole, isStaffRole } from '@silk/shared';
import type { Me } from '@/lib/types';
import { t } from '@/messages/id';

export interface NavItem {
  href: string;
  label: string;
  icon?: LucideIcon;
  /** Kunci kelompok di sidebar (t.shell.groups). */
  group?: string;
  /** Angka kecil di kanan menu (mis. item antrean yang menunggu). */
  badge?: number;
}

/** Navigasi samping area akun/portal per role (menu admin lengkap ada di AdminShell). */
export function accountNav(me: Me, opts: { subscriptions?: boolean } = {}): NavItem[] {
  const nav: NavItem[] = [];
  if (isPartnerRole(me.user.role)) {
    const faskes = me.user.role === 'faskes';
    const group = 'partner';
    nav.push({ href: '/portal', label: faskes ? t.portal.myFacilities : t.portal.myProfiles, icon: Building2, group });
    if (faskes) nav.push({ href: '/portal/klaim', label: t.portal.claims, icon: FileCheck2, group });
    if (can(me.user.role, 'portal.articles')) nav.push({ href: '/portal/artikel', label: t.articleEditor.nav, icon: PenLine, group });
    nav.push({ href: '/portal/mitra', label: t.partner.title, icon: BadgeCheck, group });
    // Fase 11: hanya bila flag subscriptions_enabled menyala (dibaca di server, diteruskan lewat layout portal).
    if (opts.subscriptions) nav.push({ href: '/portal/langganan', label: t.subscription.nav, icon: CreditCard, group });
  }
  if (isStaffRole(me.user.role)) nav.push({ href: '/admin', label: t.admin.title, icon: ShieldCheck, group: 'account' });
  nav.push({ href: '/akun', label: t.account.title, icon: UserRound, group: 'account' });
  return nav;
}
