'use client';

import { Navigation, Phone } from 'lucide-react';
import { track } from '@/lib/analytics';
import { t } from '@/messages/id';
import { buttonVariants } from './ui/button';

/** Tautan kontak dan rute (peristiwa contact_clicked dan route_clicked, M18). */
export function ContactLinks(props: { facilityId: string; city: string; phone: string | null; lat: number | null; lng: number | null; address: string; sticky?: boolean }) {
  const routeUrl =
    props.lat !== null && props.lng !== null
      ? `https://www.google.com/maps/dir/?api=1&destination=${props.lat},${props.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(props.address)}`;
  return (
    <div
      className={
        props.sticky
          ? // Ponsel: bilah aksi tetap di bawah layar, mudah dijangkau jempol.
            'fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-line bg-white/90 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgb(14_60_56/0.18)] backdrop-blur-md md:hidden [&>a]:flex-1 [&>a]:px-3 [&>a]:whitespace-nowrap'
          : 'mt-5 hidden flex-wrap gap-2 md:flex'
      }
    >
      {props.phone && (
        <a
          className={buttonVariants({ variant: 'primary' })}
          href={`tel:${props.phone.replace(/[^\d+]/g, '')}`}
          onClick={() => track('contact_clicked', { facility_id: props.facilityId, city: props.city })}
        >
          <Phone className="size-4" aria-hidden="true" />
          {t.facility.call}
        </a>
      )}
      <a
        className={buttonVariants({ variant: 'secondary' })}
        href={routeUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track('route_clicked', { facility_id: props.facilityId, city: props.city })}
      >
        <Navigation className="size-4" aria-hidden="true" />
        {t.facility.route}
      </a>
    </div>
  );
}
