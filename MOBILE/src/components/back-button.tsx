'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { t } from '@/messages/id';

/**
 * Kedalaman riwayat di dalam SILK pada tab ini. `history.length` tidak bisa dipakai: halaman yang dibuka dari
 * Google atau WhatsApp punya riwayat situs lain, dan `router.back()` akan membawa pengguna keluar dari SILK.
 * Pindah halaman menambah 1, tombol kembali peramban (popstate) mengurangi 1. Bila ragu, nilainya condong ke 0
 * sehingga tombol membuka `fallbackHref` (aman), bukan keluar dari aplikasi.
 */
let depth = 0;
let popped = false;

/** Dipasang sekali di layout: mencatat perpindahan halaman di dalam aplikasi. */
export function NavTracker() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    const onPop = () => {
      popped = true;
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    depth = popped ? Math.max(0, depth - 1) : depth + 1;
    popped = false;
  }, [pathname]);
  return null;
}

/** Kembali ke layar SILK sebelumnya; bila dibuka langsung dari tautan luar, ke `fallbackHref`. */
export function BackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label={t.nav.back}
      onClick={() => (depth > 0 ? router.back() : router.push(fallbackHref))}
      className="tap grid size-11 place-items-center rounded-full text-ink hover:bg-surface"
    >
      <ChevronLeft className="size-6" aria-hidden="true" />
    </button>
  );
}
