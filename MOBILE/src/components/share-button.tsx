'use client';

import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import { t } from '@/messages/id';

/** Bagikan lewat menu bagikan ponsel; bila tidak didukung, salin tautan. */
export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const onClick = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Dibatalkan pengguna: tidak perlu pesan.
    }
  };
  return (
    <button type="button" onClick={onClick} aria-label={copied ? t.common.copied : t.common.share} className="tap grid size-11 place-items-center rounded-full hover:bg-surface">
      {copied ? <Check className="size-5 text-ok" aria-hidden="true" /> : <Share2 className="size-5" aria-hidden="true" />}
    </button>
  );
}
