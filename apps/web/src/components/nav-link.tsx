'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

/** Tautan navigasi dengan penanda halaman aktif (aria-current). */
export function NavLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-full px-3.5 py-2 text-[0.95rem] font-medium text-ink-soft no-underline transition-colors duration-200 hover:bg-surface-2 hover:text-ink hover:no-underline',
        'aria-[current=page]:bg-primary-100 aria-[current=page]:text-primary-800',
        className,
      )}
    >
      {children}
    </Link>
  );
}
