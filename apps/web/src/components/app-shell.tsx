'use client';

import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { authApi } from '@/lib/client-api';
import { clearQueryCache } from '@/lib/query-cache';
import { AppShellSkeleton } from './ui/skeleton';
import type { Me } from '@/lib/types';
import { t } from '@/messages/id';

/** Kerangka halaman portal/admin: navigasi samping + tombol keluar. */
export function AppShell({ me, title, nav, children }: { me: Me; title: string; nav: { href: string; label: string }[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  async function logout() {
    try {
      await authApi('/sign-out', {});
    } finally {
      clearQueryCache();
      router.replace('/masuk');
    }
  }
  const initials = me.user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <div className="container app-shell grid gap-6 lg:grid-cols-[240px_1fr] lg:gap-10">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-line bg-white p-3 shadow-soft">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-100 font-bold text-primary-800" aria-hidden="true">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate font-semibold">{me.user.name}</p>
            <p className="m-0 truncate text-sm text-muted">{me.user.email}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            title={t.nav.logout}
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-danger-soft hover:text-danger"
          >
            <LogOut className="size-[18px]" aria-hidden="true" />
            <span className="sr-only">{t.nav.logout}</span>
          </button>
        </div>
        <nav aria-label={title} className="tabs lg:mb-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:border-0 lg:pb-0">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={pathname === n.href ? 'page' : undefined}
              className="lg:rounded-xl lg:px-3.5 lg:after:hidden lg:hover:bg-surface-2 lg:aria-[current=page]:bg-primary-100"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">
        <div className="app-head">
          <h1 className="m-0">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Selagi sesi dimuat: kerangka portal/admin; bila gagal: pesan galat. */
export function Loading({ error }: { error?: string | null }) {
  if (!error) return <AppShellSkeleton />;
  return (
    <div className="container">
      <p className="error" role="alert">
        {error}
      </p>
    </div>
  );
}

export function FormError({ error }: { error: string | null }) {
  return error ? (
    <p className="error" role="alert">
      {error}
    </p>
  ) : null;
}
