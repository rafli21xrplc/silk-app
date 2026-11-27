'use client';

import { ChevronDown, History } from 'lucide-react';
import { useState } from 'react';
import { BROWSER_API_ORIGIN } from '@/lib/config';
import { formatDate, formatDateTime } from '@/lib/format';
import type { TariffHistoryItem } from '@/lib/types';
import { t } from '@/messages/id';
import { PriceDisplay } from './price-display';
import { Skeleton, SkeletonRegion } from './ui/skeleton';

/** Riwayat versi tarif (M4), dimuat saat dibuka. */
export function TariffHistoryDrawer({ tariffId }: { tariffId: string }) {
  const [items, setItems] = useState<TariffHistoryItem[] | null>(null);
  const [error, setError] = useState(false);
  const [opened, setOpened] = useState(false);

  async function load() {
    if (items) return;
    try {
      const res = await fetch(`${BROWSER_API_ORIGIN}/v1/tariffs/${tariffId}/history`);
      if (!res.ok) throw new Error();
      setItems(((await res.json()) as { data: TariffHistoryItem[] }).data);
    } catch {
      setError(true);
    }
  }

  return (
    <details className="group/history w-full" onToggle={(e) => {
        if (!(e.currentTarget as HTMLDetailsElement).open) return;
        setOpened(true);
        void load();
      }}
    >
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full px-1 py-1 font-semibold text-primary-700 select-none hover:text-primary-800 [&::-webkit-details-marker]:hidden">
        <History className="size-4" aria-hidden="true" />
        {t.trust.history}
        <ChevronDown className="size-4 transition-transform duration-300 ease-soft group-open/history:rotate-180" aria-hidden="true" />
      </summary>
      <div className="mt-3 animate-rise">
        {error && <p className="error">{t.common.error}</p>}
        {opened && !items && !error && (
          <SkeletonRegion className="grid gap-4 border-l-2 border-primary-100 pl-5">
            {[0, 1].map((i) => (
              <div key={i} className="grid gap-2">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </SkeletonRegion>
        )}
        {items && (
          <ol className="relative m-0 grid list-none gap-4 border-l-2 border-primary-100 p-0 pl-5">
            {items.map((v) => (
              <li key={v.versionNo} className="relative">
                <span
                  aria-hidden="true"
                  className={`absolute top-1.5 -left-[27px] size-3 rounded-full ring-4 ring-white ${v.current ? 'bg-primary-600' : 'bg-line-strong'}`}
                />
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <strong className={v.current ? 'text-primary-800' : 'text-ink-soft'}>v{v.versionNo}</strong>
                  <PriceDisplay price={v.price} />
                  <span className="text-sm text-muted">
                    · {t.trust.effectiveFrom} {formatDate(v.effectiveFrom)}
                  </span>
                </div>
                <div className="text-[0.82rem] text-muted">
                  {t.verification[v.verification]} · {v.createdBy?.name} · {formatDateTime(v.createdAt)}
                  {v.source && <> · {v.source.title}</>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </details>
  );
}
