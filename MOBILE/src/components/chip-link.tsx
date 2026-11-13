import Link from 'next/link';
import { cn } from '@/lib/cn';

/** Chip filter berupa tautan (berfungsi tanpa JavaScript; URL bisa dibagikan). */
export function ChipLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1 rounded-full border px-3.5 text-sm font-medium no-underline transition-colors',
        active ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-soft active:bg-surface',
      )}
    >
      {children}
    </Link>
  );
}
