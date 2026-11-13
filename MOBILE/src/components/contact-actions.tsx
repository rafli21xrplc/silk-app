import { Globe, MessageCircle, Navigation, Phone, type LucideIcon } from 'lucide-react';
import { directionsUrl, safeWebsite, telHref, whatsappUrl } from '@/lib/contact';
import { t } from '@/messages/id';

/** Tombol aksi besar: telepon, WhatsApp, rute, situs. Hanya yang datanya ada. */
export function ContactActions({ phone, website, location }: { phone: string | null; website: string | null; location: { lat: number; lng: number } | null }) {
  const wa = whatsappUrl(phone);
  const site = safeWebsite(website);
  const actions: { href: string; label: string; icon: LucideIcon; external: boolean; primary?: boolean }[] = [];
  if (phone) actions.push({ href: telHref(phone), label: t.facility.call, icon: Phone, external: false, primary: true });
  if (wa) actions.push({ href: wa, label: t.facility.whatsapp, icon: MessageCircle, external: true });
  if (location) actions.push({ href: directionsUrl(location.lat, location.lng), label: t.facility.directions, icon: Navigation, external: true });
  if (site) actions.push({ href: site, label: t.facility.website, icon: Globe, external: true });
  if (actions.length === 0) return <p className="m-0 px-4 text-sm text-muted">{t.facility.noContact}</p>;
  return (
    <ul className="m-0 grid list-none gap-2 px-4" style={{ gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))` }} data-contact-actions>
      {actions.map(({ href, label, icon: Icon, external, primary }) => (
        <li key={label}>
          <a
            href={href}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className={
              primary
                ? 'tap flex flex-col items-center gap-1 rounded-2xl bg-primary-600 py-2.5 text-[0.75rem] font-semibold text-white no-underline shadow-soft'
                : 'tap flex flex-col items-center gap-1 rounded-2xl border border-line bg-white py-2.5 text-[0.75rem] font-semibold text-ink no-underline shadow-soft'
            }
          >
            <Icon className="size-5" aria-hidden="true" />
            {label}
          </a>
        </li>
      ))}
    </ul>
  );
}
