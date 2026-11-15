import Link from 'next/link';
import { BedDouble, ClipboardPlus, FlaskConical, LayoutGrid, MapPin, Pill, Salad, Stethoscope, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { SERVICE_SHORTCUTS, type ServiceShortcutKey } from '@/lib/home';
import { t } from '@/messages/id';

const ICONS: Record<ServiceShortcutKey, LucideIcon> = {
  doctor: Stethoscope,
  lab: FlaskConical,
  mcu: ClipboardPlus,
  inpatient: BedDouble,
  pharmacy: Pill,
  near: MapPin,
  lifestyle: Salad,
  all: LayoutGrid,
};

const TONES: Record<(typeof SERVICE_SHORTCUTS)[number]['tone'], string> = {
  mint: 'bg-mint text-mint-ink',
  sky: 'bg-sky text-sky-ink',
  peach: 'bg-peach text-peach-ink',
  lilac: 'bg-lilac text-lilac-ink',
  lemon: 'bg-lemon text-lemon-ink',
  surface: 'bg-surface-2 text-ink-soft',
};

/** Grid layanan 4 kolom dengan ikon bulat berwarna (pola aplikasi super seperti ojek daring). */
export function ServiceGrid() {
  return (
    <nav aria-label={t.home.servicesLabel}>
      <ul className="m-0 grid list-none grid-cols-4 gap-x-2 gap-y-4 p-0">
        {SERVICE_SHORTCUTS.map(({ key, href, tone }) => {
          const Icon = ICONS[key];
          return (
            <li key={key}>
              <Link href={href} data-service-shortcut={key} className="tap flex flex-col items-center gap-1.5 text-center text-ink no-underline">
                <span className={cn('grid size-14 place-items-center rounded-[1.4rem]', TONES[tone])}>
                  <Icon className="size-6" strokeWidth={2.1} aria-hidden="true" />
                </span>
                <span className="text-xs leading-tight font-semibold">{t.home.services[key]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
