'use client';

import { useId, useState } from 'react';
import { cn } from '@/lib/cn';

/** Tab bersegmen (pola aplikasi). Isi setiap tab dirender server; tab hanya mengatur yang tampil. */
export function Tabs({ tabs }: { tabs: { id: string; label: string; count?: number; content: React.ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? '');
  const base = useId();
  return (
    <div>
      <div role="tablist" className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 mx-4 mt-4 grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-surface p-1 shadow-soft">
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
              'tap h-10 rounded-full text-sm font-semibold transition-colors',
              active === tab.id ? 'bg-white text-primary-800 shadow-soft' : 'text-muted',
            )}
          >
            {tab.label}
            {tab.count !== undefined && <span className="ml-1 text-[0.75rem] font-medium opacity-70">{tab.count}</span>}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div key={tab.id} role="tabpanel" id={`${base}-${tab.id}`} aria-labelledby={`${base}-${tab.id}-tab`} hidden={active !== tab.id} className="pt-4">
          {tab.content}
        </div>
      ))}
    </div>
  );
}
