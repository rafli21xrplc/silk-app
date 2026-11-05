import Link from 'next/link';
import { cn } from '@/lib/cn';
import { t } from '@/messages/id';

/** Tanda SILK: daun/garis nadi sederhana dalam kotak membulat + wordmark. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label={t.nav.home} className={cn('group inline-flex items-center gap-2.5 text-ink no-underline hover:text-ink hover:no-underline', className)}>
      <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-[0_8px_18px_-8px_rgb(14_124_116/0.7)] transition-transform duration-300 ease-soft group-hover:-rotate-6">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 12h4l2.5-5 4 10 2.5-5H21" />
        </svg>
      </span>
      <span className="text-[1.2rem] font-extrabold tracking-[0.04em]">
        SI<span className="text-primary-700">LK</span>
      </span>
    </Link>
  );
}
