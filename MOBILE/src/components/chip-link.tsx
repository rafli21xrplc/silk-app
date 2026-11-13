import Link from 'next/link';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Chip filter berupa tautan (berfungsi tanpa JavaScript; URL bisa dibagikan). */
export function ChipLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'tap inline-flex h-9 shrink-0 items-center gap-1 rounded-full border px-3.5 text-[0.8rem] font-semibold no-underline',
        active ? 'border-primary-600 bg-primary-600 text-white' : 'border-line bg-white text-ink-soft',
      )}
    >
      {active && <Check className="size-3.5" aria-hidden="true" />}
      {children}
    </Link>
  );
}
