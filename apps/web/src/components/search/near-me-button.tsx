'use client';

import { LocateFixed } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { searchHref, type SearchPath } from '@/lib/search-params';
import { t } from '@/messages/id';

/** Dibulatkan ke 4 desimal (~11 m): cukup untuk jarak, tidak menyimpan titik persis di URL. */
const round = (n: number) => (Math.round(n * 1e4) / 1e4).toString();

/**
 * "Dekat saya": minta lokasi peramban lalu buka `/cari` (atau `/dokter`) dengan lat/lng (urut jarak bila belum memilih urutan).
 * Tanpa JavaScript tombol ini tidak tampil; pencarian kota tetap berjalan.
 */
export function NearMeButton({ state, path = '/cari' }: { state: Partial<Record<string, string>>; path?: SearchPath }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function locate() {
    if (!('geolocation' in navigator)) {
      setError(t.search.geoUnavailable);
      return;
    }
    setBusy(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        router.push(
          searchHref(state, { lat: round(pos.coords.latitude), lng: round(pos.coords.longitude), sort: state.sort ?? 'distance' }, path),
        );
        setBusy(false);
      },
      (err) => {
        setBusy(false);
        setError(err.code === err.PERMISSION_DENIED ? t.search.geoDenied : t.search.geoUnavailable);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  return (
    <>
      <button type="button" onClick={locate} disabled={busy} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
        <LocateFixed className="size-4" aria-hidden="true" />
        {busy ? t.search.locating : t.search.nearMe}
      </button>
      {error && (
        <p className="m-0 basis-full text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
