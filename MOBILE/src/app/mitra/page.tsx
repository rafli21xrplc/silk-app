import type { Metadata } from 'next';
import { Check, Hospital, Leaf, Pill, Stethoscope, type LucideIcon } from 'lucide-react';
import { formatRupiah, parseFeatureFlags, SUBSCRIPTION_MONTHS, subscriptionPrice, type PartnerType } from '@silk/shared';
import { BackButton } from '@/components/back-button';
import { ListGroup } from '@/components/list';
import { registerUrl } from '@/lib/web-origin';
import { t } from '@/messages/id';

const m = t.partner;

export const metadata: Metadata = { title: m.title };

const TYPES: { type: PartnerType; icon: LucideIcon }[] = [
  { type: 'tenaga_medis', icon: Stethoscope },
  { type: 'fasilitas', icon: Hospital },
  { type: 'apotek', icon: Pill },
  { type: 'gaya_hidup', icon: Leaf },
];

/**
 * "Jadi mitra" (dari SILK versi lama: /mitra/daftar dan /mitra/harga). Pendaftaran berlangsung di situs web.
 * Harga tampil hanya bila langganan aktif (FEATURE_FLAGS memuat subscriptions_enabled), sama dengan situs web.
 */
export default function PartnerPage() {
  const pricing = parseFeatureFlags(process.env.FEATURE_FLAGS).enabled.has('subscriptions_enabled');
  return (
    <>
      <header className="pt-safe px-5">
        <div className="pt-3">
          <BackButton fallbackHref="/info" />
        </div>
        <h1 className="m-0 pt-3 text-2xl font-bold tracking-tight">{m.title}</h1>
        <p className="m-0 mt-2 text-base text-ink-soft">{m.intro}</p>
        <ul className="m-0 mt-4 grid list-none gap-2 p-0 text-sm">
          {m.points.map((p) => (
            <li key={p} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-primary-700" aria-hidden="true" />
              {p}
            </li>
          ))}
        </ul>
      </header>

      <ListGroup id="jenis" title={m.typesTitle} className="mt-7">
        {TYPES.map(({ type, icon: Icon }) => {
          const href = registerUrl(type);
          return (
            <li key={type} className="flex items-center gap-3 px-4 py-3" data-partner-type={type}>
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-700">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base leading-snug font-semibold">{m.types[type]!.title}</span>
                <span className="block text-xs text-muted">{m.types[type]!.body}</span>
              </span>
              {href && (
                <a
                  href={href}
                  className="tap inline-flex h-9 shrink-0 items-center rounded-full border border-line bg-white px-3.5 text-sm font-semibold text-primary-700 no-underline"
                >
                  {m.register}
                </a>
              )}
            </li>
          );
        })}
      </ListGroup>
      {!registerUrl('pasien') && <p className="m-0 mt-2 px-5 text-xs text-muted">{m.registerOnWeb}</p>}

      {pricing && (
        <>
          <ListGroup id="harga" title={m.pricingTitle} className="mt-7">
            {TYPES.map(({ type }) => (
              <li key={type} className="flex items-center justify-between gap-3 px-4 py-3" data-price-type={type}>
                <span className="text-base">{m.types[type]!.title}</span>
                <span className="shrink-0 text-base font-bold tabular-nums">
                  {formatRupiah(subscriptionPrice(type))}{' '}
                  <span className="text-xs font-normal text-muted">{m.perYear.replace('12', String(SUBSCRIPTION_MONTHS))}</span>
                </span>
              </li>
            ))}
          </ListGroup>
          <div className="mt-2 px-5 text-sm text-ink-soft">
            <p className="m-0">{m.pricingBody}</p>
            <ul className="m-0 mt-2 grid gap-1 pl-5">
              {m.pricingNotes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </>
  );
}
