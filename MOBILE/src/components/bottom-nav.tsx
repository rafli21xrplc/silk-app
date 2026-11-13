'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Info, Layers, Search, Stethoscope, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { t } from '@/messages/id';

const TABS: { href: string; label: string; icon: LucideIcon; match: (p: string) => boolean }[] = [
  { href: '/', label: t.nav.home, icon: Home, match: (p) => p === '/' },
  { href: '/cari', label: t.nav.search, icon: Search, match: (p) => p.startsWith('/cari') || p.startsWith('/faskes') },
  { href: '/dokter', label: t.nav.doctors, icon: Stethoscope, match: (p) => p.startsWith('/dokter') },
  { href: '/layanan', label: t.nav.services, icon: Layers, match: (p) => p.startsWith('/layanan') },
  { href: '/info', label: t.nav.info, icon: Info, match: (p) => p.startsWith('/info') || p.startsWith('/artikel') },
];

/** Bilah tab bawah (pola aplikasi ponsel); jangkauan jempol, target sentuh ≥ 48 px. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label={t.nav.main}
      className="pb-safe fixed bottom-0 left-1/2 z-40 w-full max-w-[440px] -translate-x-1/2 border-t border-line/70 bg-white/95 shadow-bar backdrop-blur"
    >
      <ul className="m-0 grid list-none grid-cols-5 p-0">
        {TABS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 pt-1.5 text-[0.7rem] font-semibold no-underline transition-colors',
                  active ? 'text-primary-700' : 'text-muted hover:text-ink',
                )}
              >
                <span className={cn('grid h-7 w-12 place-items-center rounded-full transition-colors', active && 'bg-primary-100')}>
                  <Icon className="size-[1.15rem]" strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
