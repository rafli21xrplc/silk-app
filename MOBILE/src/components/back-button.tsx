'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { t } from '@/messages/id';

/** Kembali ke layar sebelumnya; bila dibuka langsung dari tautan (tanpa riwayat), ke `fallbackHref`. */
export function BackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label={t.nav.back}
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallbackHref))}
      className="tap grid size-11 place-items-center rounded-full text-ink hover:bg-surface"
    >
      <ChevronLeft className="size-6" aria-hidden="true" />
    </button>
  );
}
