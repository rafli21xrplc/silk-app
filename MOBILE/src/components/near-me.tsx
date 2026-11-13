'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, LocateFixed, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { t } from '@/messages/id';

/**
 * "Dekat saya": minta lokasi sekali, lalu urutkan menurut jarak. Koordinat hanya dikirim ke server SILK
 * sebagai parameter pencarian dan tidak disimpan. `?dekat=1` (dari beranda) langsung meminta lokasi.
 */
export function NearMe({ active }: { active: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [state, setState] = useState<'idle' | 'locating' | 'denied'>('idle');
  const asked = useRef(false);

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState('denied');
      return;
    }
    setState('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = new URLSearchParams(params.toString());
        next.delete('dekat');
        next.delete('cursor');
        next.set('lat', pos.coords.latitude.toFixed(5));
        next.set('lng', pos.coords.longitude.toFixed(5));
        next.set('sort', 'distance');
        setState('idle');
        router.replace(`${pathname}?${next.toString()}`);
      },
      () => setState('denied'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }, [params, pathname, router]);

  useEffect(() => {
    if (params.get('dekat') === '1' && !active && !asked.current) {
      asked.current = true;
      locate();
    }
  }, [params, active, locate]);

  const clear = () => {
    const next = new URLSearchParams(params.toString());
    for (const k of ['lat', 'lng', 'dekat', 'cursor']) next.delete(k);
    if (next.get('sort') === 'distance') next.delete('sort');
    router.replace(next.toString() ? `${pathname}?${next.toString()}` : pathname);
  };

  return (
    <>
      <button
        type="button"
        onClick={active ? clear : locate}
        aria-pressed={active}
        className={cn(
          'tap inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold shadow-soft',
          active ? 'border-primary-300 bg-primary-50 text-primary-800' : 'border-line bg-white text-ink',
        )}
      >
        {state === 'locating' ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <LocateFixed className="size-4" aria-hidden="true" />}
        {state === 'locating' ? t.search.locating : active ? t.search.nearMeOn : t.search.nearMe}
        {active && <X className="size-3.5" aria-hidden="true" />}
      </button>
      {state === 'denied' && (
        <p role="alert" className="m-0 w-full text-[0.75rem] text-warn">
          {t.search.geoDenied}
        </p>
      )}
    </>
  );
}
