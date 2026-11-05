'use client';

import { Check, Link2 } from 'lucide-react';
import { useState } from 'react';
import { t } from '@/messages/id';
import { buttonVariants } from './ui/button';

/** Salin URL halaman saat ini (perbandingan bisa dibagikan, M3). */
export function ShareLinkButton() {
  const [copied, setCopied] = useState(false);
  return (
    <p className="mt-5 flex items-center gap-3">
      <button
        type="button"
        className={buttonVariants({ variant: 'secondary' })}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
          } catch {
            window.prompt(t.compare.share, window.location.href);
          }
        }}
      >
        {copied ? <Check className="size-4 text-ok" aria-hidden="true" /> : <Link2 className="size-4" aria-hidden="true" />}
        {t.compare.share}
      </button>
      <span role="status" aria-live="polite" className="text-sm text-ok">
        {copied ? t.compare.copied : ''}
      </span>
    </p>
  );
}
