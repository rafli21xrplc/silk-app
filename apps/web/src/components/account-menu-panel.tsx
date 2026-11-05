'use client';

// Isi menu akun (Radix). Dimuat lewat dynamic import saat avatar pertama kali dibuka.
import { LayoutDashboard, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';
import type { Me } from '@/lib/types';
import { t } from '@/messages/id';
import { Overlay } from './ui/overlay';

export default function AccountMenuPanel({
  me,
  initials,
  open,
  onOpenChange,
  sheet,
  triggerRef,
  onLogout,
}: {
  me: Me;
  initials: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sheet: boolean;
  triggerRef: React.RefObject<HTMLElement | null>;
  onLogout: () => void;
}) {
  const first = useRef<HTMLAnchorElement>(null);
  const home = me.user.role === 'faskes' ? '/portal' : '/admin';
  return (
    <Overlay open={open} onOpenChange={onOpenChange} sheet={sheet} triggerRef={triggerRef} title={t.account.menu} align="end" initialFocus={() => first.current} className="w-[280px] sm:p-2">
      <div className="flex items-center gap-3 rounded-xl bg-surface px-3 py-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white font-bold text-primary-800" aria-hidden="true">
          {initials}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold">{me.user.name}</span>
          <span className="block truncate text-sm text-muted">{me.user.email}</span>
        </span>
      </div>
      <nav className="mt-1.5 grid gap-0.5" aria-label={t.account.menu}>
        <Link
          ref={first}
          href={home}
          onClick={() => onOpenChange(false)}
          className="flex min-h-11 items-center gap-3 rounded-xl px-3 font-medium text-ink no-underline outline-none hover:bg-primary-50 hover:text-ink hover:no-underline focus-visible:bg-primary-50"
        >
          <LayoutDashboard className="size-[18px] text-primary-700" aria-hidden="true" />
          {t.account.open(me.user.role)}
        </Link>
        <button
          type="button"
          onClick={onLogout}
          className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-left font-medium text-ink-soft outline-none hover:bg-danger-soft hover:text-danger focus-visible:bg-danger-soft"
        >
          <LogOut className="size-[18px]" aria-hidden="true" />
          {t.nav.logout}
        </button>
      </nav>
    </Overlay>
  );
}
