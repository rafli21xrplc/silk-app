'use client';

import { useId, useState } from 'react';
import { cn } from '@/lib/cn';

/** Tab bergaris bawah (pola aplikasi). Isi setiap tab dirender server; tab hanya mengatur yang tampil. */
export function Tabs({ tabs }: { tabs: { id: string; label: string; count?: number; content: React.ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? '');
  const base = useId();
  return (
    <div>
      <div role="tablist" className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 mt-6 flex gap-6 border-b border-line bg-canvas/95 px-5 backdrop-blur">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${base}-${tab.id}-tab`}
            aria-selected={active === tab.id}
            aria-controls={`${base}-${tab.id}`}
            onClick={() => setActive(tab.id)}
            className={cn(
              '-mb-px h-11 border-b-2 text-base font-semibold transition-colors',
              active === tab.id ? 'border-ink text-ink' : 'border-transparent text-muted',
            )}
          >
            {tab.label}
            {tab.count !== undefined && <span className="ml-1 text-sm font-normal text-muted">{tab.count}</span>}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div key={tab.id} role="tabpanel" id={`${base}-${tab.id}`} aria-labelledby={`${base}-${tab.id}-tab`} hidden={active !== tab.id} className="pt-5">
          {tab.content}
        </div>
      ))}
    </div>
  );
}
