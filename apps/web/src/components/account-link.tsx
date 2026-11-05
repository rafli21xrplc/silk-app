'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { authApi } from '@/lib/client-api';
import { clearQueryCache, useQuery } from '@/lib/query-cache';
import type { Me } from '@/lib/types';
import { ME_STALE_MS } from '@/lib/use-me';
import { t } from '@/messages/id';
import { buttonVariants } from './ui/button';
import { isSheetViewport } from './ui/sheet-viewport';

const loadPanel = () => import('./account-menu-panel');
const AccountMenuPanel = dynamic(loadPanel, { ssr: false });

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

/**
 * Akun di header. Halaman publik tetap statis (ISR); status login dibaca di browser.
 * Belum masuk: tombol "Masuk". Sudah masuk: avatar yang membuka menu akun (popover / bottom sheet).
 */
export function AccountLink({ className }: { className?: string }) {
  // Dipakai bersama shell portal/admin lewat cache: satu permintaan /me per halaman.
  const { data: me } = useQuery<Me>('/me', { staleMs: ME_STALE_MS });
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState(false);
  const [sheet, setSheet] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  if (!me) {
    return (
      <Link href="/masuk" className={cn(buttonVariants({ variant: 'soft', size: 'sm' }), className)}>
        {t.nav.login}
      </Link>
    );
  }

  async function logout() {
    try {
      await authApi('/sign-out', {});
    } finally {
      setOpen(false);
      clearQueryCache();
      router.replace('/masuk');
    }
  }

  const initials = initialsOf(me.user.name);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${t.account.menu}: ${me.user.name}`}
        onPointerEnter={() => void loadPanel()}
        onFocus={() => void loadPanel()}
        onClick={() => {
          if (!open) setSheet(isSheetViewport());
          setUsed(true);
          setOpen((o) => !o);
        }}
        className={cn(
          'grid size-10 place-items-center rounded-full bg-gradient-to-br from-primary-100 to-sky text-sm font-bold text-primary-800 ring-2 ring-white shadow-soft transition-transform duration-200 hover:scale-105 aria-expanded:ring-primary-200',
          className,
        )}
      >
        {initials}
      </button>
      {used && <AccountMenuPanel me={me} initials={initials} open={open} onOpenChange={setOpen} sheet={sheet} triggerRef={trigger} onLogout={logout} />}
    </>
  );
}
