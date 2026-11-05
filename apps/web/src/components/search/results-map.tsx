'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import { MAP_STYLE_URL } from '@/lib/config';
import { t } from '@/messages/id';

export type MapPoint = { id: string; slug: string; name: string; typeLabel: string; priceText: string | null; lat: number; lng: number };

/** Isi popup dibangun lewat DOM (textContent), bukan HTML, agar nama faskes tidak bisa menyisipkan markup. */
function popupContent(p: MapPoint): HTMLElement {
  const root = document.createElement('div');
  root.className = 'grid gap-0.5 text-sm';
  const name = document.createElement('strong');
  name.textContent = p.name;
  const meta = document.createElement('span');
  meta.className = 'text-muted';
  meta.textContent = p.priceText ? `${p.typeLabel} · ${p.priceText}` : p.typeLabel;
  const link = document.createElement('a');
  link.href = `/faskes/${encodeURIComponent(p.slug)}`;
  link.textContent = t.search.mapOpen;
  root.append(name, meta, link);
  return root;
}

/**
 * Peta hasil halaman ini (bukan seluruh kota): satu penanda per faskes yang punya titik, plus titik pencarian.
 * MapLibre dimuat dinamis; tanpa NEXT_PUBLIC_MAP_STYLE_URL tidak dirender.
 */
export function ResultsMap({ points, center, className }: { points: MapPoint[]; center: { lat: number; lng: number } | null; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const key = JSON.stringify([points.map((p) => p.id), center]);

  useEffect(() => {
    if (!MAP_STYLE_URL || !ref.current) return;
    let map: { remove: () => void } | undefined;
    let cancelled = false;
    const el = ref.current;
    async function init() {
      const maplibre = (await import('maplibre-gl')).default;
      if (cancelled || !ref.current) return;
      const first = points[0];
      const start = center ?? (first ? { lat: first.lat, lng: first.lng } : { lat: -7.98, lng: 112.63 });
      const m = new maplibre.Map({ container: ref.current, style: MAP_STYLE_URL, center: [start.lng, start.lat], zoom: 12, attributionControl: { compact: true } });
      m.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');
      const bounds = new maplibre.LngLatBounds();
      for (const p of points) {
        new maplibre.Marker({ color: '#0b6b64' })
          .setLngLat([p.lng, p.lat])
          .setPopup(new maplibre.Popup({ offset: 24, closeButton: false }).setDOMContent(popupContent(p)))
          .addTo(m);
        bounds.extend([p.lng, p.lat]);
      }
      if (center) {
        new maplibre.Marker({ color: '#2563eb', scale: 0.8 }).setLngLat([center.lng, center.lat]).addTo(m);
        bounds.extend([center.lng, center.lat]);
      }
      if (!bounds.isEmpty() && points.length + (center ? 1 : 0) > 1) m.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 });
      map = m;
    }
    // Wadah tersembunyi (ponsel, tampilan daftar): tunda pemuatan sampai terlihat.
    let observer: ResizeObserver | undefined;
    if (el.offsetWidth > 0) void init();
    else {
      observer = new ResizeObserver(() => {
        if (el.offsetWidth === 0) return;
        observer?.disconnect();
        void init();
      });
      observer.observe(el);
    }
    return () => {
      cancelled = true;
      observer?.disconnect();
      map?.remove();
    };
    // `key` mewakili points dan center: array baru tiap render tidak memicu pemuatan ulang peta.
  }, [key]);

  if (!MAP_STYLE_URL) return null;
  return <div ref={ref} className={className ?? 'map'} role="region" aria-label={t.search.map} />;
}
