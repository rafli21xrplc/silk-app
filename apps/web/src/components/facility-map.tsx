'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import { MAP_STYLE_URL } from '@/lib/config';
import { t } from '@/messages/id';

/**
 * Peta MapLibre dimuat dinamis hanya di halaman yang butuh (bagian 7). Tanpa gaya peta
 * (NEXT_PUBLIC_MAP_STYLE_URL kosong) tidak dirender; halaman tetap berguna lewat alamat dan tautan rute.
 */
export function FacilityMap({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!MAP_STYLE_URL || !ref.current) return;
    let map: { remove: () => void } | undefined;
    let cancelled = false;
    void (async () => {
      const maplibre = (await import('maplibre-gl')).default;
      if (cancelled || !ref.current) return;
      const m = new maplibre.Map({ container: ref.current, style: MAP_STYLE_URL, center: [lng, lat], zoom: 15, attributionControl: { compact: true } });
      new maplibre.Marker().setLngLat([lng, lat]).addTo(m);
      map = m;
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [lat, lng]);
  if (!MAP_STYLE_URL) return null;
  return <div ref={ref} className="map" role="img" aria-label={`${t.facility.map}: ${name}`} />;
}
