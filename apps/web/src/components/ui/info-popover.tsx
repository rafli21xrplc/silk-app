'use client';

import dynamic from 'next/dynamic';
import { useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

const loadPanel = () => import('./info-panel');
const InfoPanel = dynamic(loadPanel, { ssr: false });

/**
 * Pemicu kecil (mis. badge) yang membuka penjelasan singkat dalam popover.
 * Penjelasan juga dibacakan pembaca layar lewat aria-describedby, tanpa perlu membuka popover.
 */
export function InfoPopover({ children, content, className }: { children: React.ReactNode; content: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [used, setUsed] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const descId = useId();
  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-describedby={descId}
        onPointerEnter={() => void loadPanel()}
        onFocus={() => void loadPanel()}
        onClick={() => {
          setUsed(true);
          setOpen((o) => !o);
        }}
        className={cn(
          'relative z-10 cursor-help rounded-full outline-none focus-visible:shadow-[var(--shadow-focus)] aria-expanded:ring-2 aria-expanded:ring-primary-200',
          className,
        )}
      >
        {children}
      </button>
      <span id={descId} className="sr-only">
        {content}
      </span>
      {used && <InfoPanel open={open} onOpenChange={setOpen} triggerRef={trigger} content={content} />}
    </>
  );
}
