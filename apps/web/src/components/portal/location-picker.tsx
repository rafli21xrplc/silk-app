'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import { MAP_STYLE_URL } from '@/lib/config';
import { t } from '@/messages/id';

/** Titik awal bila lokasi belum dipilih (Kota Malang). */
const FALLBACK: [number, number] = [112.63, -7.98];

/**
 * Pemilih titik lokasi: klik peta atau geser penanda. Tanpa gaya peta (NEXT_PUBLIC_MAP_STYLE_URL kosong)
 * tidak dirender; isian lintang/bujur tetap bisa dipakai.
 */
export function LocationPicker({
  lat,
  lng,
  onPick,
  label,
}: {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const markerRef = useRef<{ setLngLat: (p: [number, number]) => unknown } | null>(null);
  const hasPoint = lat !== null && lng !== null;

  useEffect(() => {
    if (!MAP_STYLE_URL || !ref.current) return;
    let map: { remove: () => void } | undefined;
    let cancelled = false;
    void (async () => {
      const maplibre = (await import('maplibre-gl')).default;
      if (cancelled || !ref.current) return;
      const start: [number, number] = hasPoint ? [lng!, lat!] : FALLBACK;
      const m = new maplibre.Map({ container: ref.current, style: MAP_STYLE_URL, center: start, zoom: hasPoint ? 15 : 11, attributionControl: { compact: true } });
      const marker = new maplibre.Marker({ draggable: true }).setLngLat(start).addTo(m);
      marker.on('dragend', () => {
        const p = marker.getLngLat();
        onPickRef.current(round(p.lat), round(p.lng));
      });
      m.on('click', (e) => {
        marker.setLngLat(e.lngLat);
        onPickRef.current(round(e.lngLat.lat), round(e.lngLat.lng));
      });
      markerRef.current = marker;
      map = m;
    })();
    return () => {
      cancelled = true;
      markerRef.current = null;
      map?.remove();
    };
    // Peta dibuat sekali; perubahan dari isian teks hanya memindahkan penanda (efek di bawah).
  }, []);

  useEffect(() => {
    if (hasPoint) markerRef.current?.setLngLat([lng!, lat!]);
  }, [hasPoint, lat, lng]);

  if (!MAP_STYLE_URL) return null;
  return (
    <div className="grid gap-1">
      <div ref={ref} className="map map-picker" role="application" aria-label={label} />
      <p className="small muted m-0">{t.profile.pickOnMap}</p>
    </div>
  );
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;
