'use client';

import { RotateCw } from 'lucide-react';
import { t } from '@/messages/id';

/** Galat tak terduga di satu layar: bilah tab tetap ada, pengguna bisa mencoba lagi. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="grid min-h-[70dvh] place-items-center px-6 text-center">
      <div className="grid justify-items-center gap-3">
        <p className="m-0 text-base font-semibold">{t.common.error}</p>
        <button type="button" onClick={reset} className="tap inline-flex h-12 items-center gap-2 rounded-full bg-primary-600 px-6 font-semibold text-white shadow-soft">
          <RotateCw className="size-4" aria-hidden="true" />
          {t.common.retry}
        </button>
      </div>
    </div>
  );
}
