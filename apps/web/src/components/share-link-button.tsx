'use client';

import { Check, Link2 } from 'lucide-react';
import { useState } from 'react';
import { t } from '@/messages/id';
import { buttonVariants } from './ui/button';

/** Salin URL halaman saat ini (perbandingan M3, profil dokter Fase 4b). */
export function ShareLinkButton({ label = t.compare.share, copiedLabel = t.compare.copied, className = 'mt-5' }: { label?: string; copiedLabel?: string; className?: string } = {}) {
  const [copied, setCopied] = useState(false);
  return (
    <p className={`${className} flex items-center gap-3`}>
      <button
        type="button"
        className={buttonVariants({ variant: 'secondary' })}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
          } catch {
            window.prompt(label, window.location.href);
          }
        }}
      >
        {copied ? <Check className="size-4 text-ok" aria-hidden="true" /> : <Link2 className="size-4" aria-hidden="true" />}
        {label}
      </button>
      <span role="status" aria-live="polite" className="text-sm text-ok">
        {copied ? copiedLabel : ''}
      </span>
    </p>
  );
}
