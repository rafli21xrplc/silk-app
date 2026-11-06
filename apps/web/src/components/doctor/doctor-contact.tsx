'use client';

import { Globe, MessageCircle, Navigation, Phone } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { track } from '@/lib/analytics';
import { telHref, whatsappUrl } from '@/lib/contact';
import { t } from '@/messages/id';

/**
 * Kontak profil praktik utama dokter: telepon, WhatsApp (hanya nomor HP), situs, dan rute.
 * Memakai peristiwa analitik yang sudah ada (contact_clicked, route_clicked) dengan id faskes praktik utama.
 */
export function DoctorContact(props: {
  facilityId: string;
  city: string;
  phone: string | null;
  website: string | null;
  location: { lat: number; lng: number } | null;
}) {
  const wa = whatsappUrl(props.phone);
  const contact = () => track('contact_clicked', { facility_id: props.facilityId, city: props.city });
  return (
    <div className="flex flex-wrap gap-2">
      {props.phone && (
        <a className={buttonVariants({ variant: 'primary' })} href={telHref(props.phone)} onClick={contact}>
          <Phone className="size-4" aria-hidden="true" />
          {t.doctors.call}
        </a>
      )}
      {wa && (
        <a className={buttonVariants({ variant: 'secondary' })} href={wa} target="_blank" rel="noopener noreferrer" onClick={contact}>
          <MessageCircle className="size-4" aria-hidden="true" />
          {t.doctors.whatsapp}
        </a>
      )}
      {props.website && (
        <a className={buttonVariants({ variant: 'secondary' })} href={props.website} target="_blank" rel="noopener noreferrer nofollow">
          <Globe className="size-4" aria-hidden="true" />
          {t.doctors.website}
        </a>
      )}
      {props.location && (
        <a
          className={buttonVariants({ variant: 'secondary' })}
          href={`https://www.google.com/maps/dir/?api=1&destination=${props.location.lat},${props.location.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('route_clicked', { facility_id: props.facilityId, city: props.city })}
        >
          <Navigation className="size-4" aria-hidden="true" />
          {t.facility.route}
        </a>
      )}
    </div>
  );
}
