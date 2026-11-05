'use client';

import { Cookie } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getConsent, initAnalytics, setConsent } from '@/lib/analytics';
import { t } from '@/messages/id';
import { buttonVariants } from './ui/button';

export function ConsentBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
    const c = getConsent();
    if (c === null) setShow(true);
    else void initAnalytics();
  }, []);
  if (!show) return null;
  return (
    <div
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-[560px] animate-rise rounded-[1.5rem] border border-line bg-white/95 p-5 shadow-lift backdrop-blur-md"
      role="region"
      aria-label="Persetujuan cookie"
    >
      <div className="flex items-start gap-3">
        <Cookie className="mt-0.5 size-5 shrink-0 text-primary-700" aria-hidden="true" />
        <p className="m-0 text-[0.925rem] text-ink-soft">{t.consent.text}</p>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button className={buttonVariants({ variant: 'secondary', size: 'sm' })} onClick={() => (setConsent('tidak'), setShow(false))}>
          {t.consent.decline}
        </button>
        <button className={buttonVariants({ variant: 'primary', size: 'sm' })} onClick={() => (setConsent('ya'), setShow(false))}>
          {t.consent.accept}
        </button>
      </div>
    </div>
  );
}
