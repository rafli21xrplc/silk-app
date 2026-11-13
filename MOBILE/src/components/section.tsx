import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { t } from '@/messages/id';

export function Section({ id, title, hint, href, children }: { id: string; title: string; hint?: string; href?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-7">
      <div className="mb-3 flex items-end justify-between gap-3 px-4">
        <div className="min-w-0">
          <h2 id={id} className="m-0 text-lg font-bold tracking-tight">
            {title}
          </h2>
          {hint && <p className="m-0 mt-0.5 text-[0.82rem] text-muted">{hint}</p>}
        </div>
        {href && (
          <Link href={href} className="inline-flex shrink-0 items-center text-sm font-semibold text-primary-700 no-underline">
            {t.common.seeAll}
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
