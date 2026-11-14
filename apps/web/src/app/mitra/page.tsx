import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Check, Hospital, Leaf, Pill, Stethoscope, type LucideIcon } from 'lucide-react';
import { formatRupiah, SUBSCRIPTION_MONTHS, subscriptionPrice, type PartnerType } from '@silk/shared';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { featureEnabled } from '@/lib/flags';
import { t } from '@/messages/id';

const m = t.partnerLanding;

export const metadata: Metadata = { title: m.metaTitle, description: m.metaDescription, alternates: { canonical: '/mitra' } };

/** Urutan tampilan: dokter dulu seperti versi lama, lalu faskes, apotek, gaya hidup. */
const TYPES: { type: PartnerType; icon: LucideIcon }[] = [
  { type: 'tenaga_medis', icon: Stethoscope },
  { type: 'fasilitas', icon: Hospital },
  { type: 'apotek', icon: Pill },
  { type: 'gaya_hidup', icon: Leaf },
];

/**
 * Halaman "Jadi mitra" (dari SILK versi lama: /mitra/daftar dan /mitra/harga). Bagian harga hanya tampil bila
 * langganan aktif (`subscriptions_enabled`); tanpa flag, halaman tetap berguna sebagai pintu pendaftaran.
 */
export default function PartnerLandingPage() {
  const pricing = featureEnabled('subscriptions_enabled');
  return (
    <div className="container">
      <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary-700 to-primary-900 px-6 py-10 text-white shadow-lift sm:px-10 sm:py-14">
        <p className="m-0 text-sm font-semibold text-amber-300">{m.eyebrow}</p>
        <h1 className="mt-2 mb-3 max-w-2xl text-white">{m.title}</h1>
        <p className="m-0 max-w-2xl text-primary-50">{m.body}</p>
        <ul className="mt-6 grid list-none gap-2 p-0 text-sm sm:grid-cols-3">
          {m.points.map((p) => (
            <li key={p} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden="true" />
              {p}
            </li>
          ))}
        </ul>
        <div className="mt-7 flex flex-wrap gap-3">
          <a href="#jenis" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-amber-400 px-5 font-semibold text-ink no-underline hover:bg-amber-300 hover:text-ink hover:no-underline">
            {m.ctaRegister} <ArrowRight className="size-4" aria-hidden="true" />
          </a>
          <Link href="/masuk" className="inline-flex min-h-11 items-center rounded-full border border-white/40 px-5 font-semibold text-white no-underline hover:bg-white/10 hover:text-white hover:no-underline">
            {m.ctaLogin}
          </Link>
        </div>
      </section>

      <section id="jenis" aria-labelledby="jenis-judul" className="mt-12 scroll-mt-24">
        <h2 id="jenis-judul" className="mt-0 mb-1">
          {m.typesTitle}
        </h2>
        <p className="m-0 max-w-2xl text-muted">{m.typesHint}</p>
        <ul className="mt-6 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {TYPES.map(({ type, icon: Icon }) => {
            const c = m.types[type]!;
            return (
              <li key={type} className="flex flex-col rounded-card border border-line/80 bg-white p-5 shadow-soft" data-partner-type={type}>
                <span className="grid size-11 place-items-center rounded-2xl bg-primary-50 text-primary-700">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 mb-1 text-lg">{c.title}</h3>
                <p className="m-0 mb-5 text-sm text-muted">{c.body}</p>
                <Link href={`/daftar?jenis=${type}`} className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'mt-auto self-start')}>
                  {c.cta}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="langkah" className="mt-12">
        <h2 id="langkah" className="mt-0">
          {m.stepsTitle}
        </h2>
        <ol className="mt-5 grid list-none gap-3 p-0 md:grid-cols-4">
          {m.steps.map((s, i) => (
            <li key={s.title} className="rounded-card bg-white p-5 shadow-soft">
              <span className="grid size-8 place-items-center rounded-full bg-primary-600 text-sm font-bold text-white" aria-hidden="true">
                {i + 1}
              </span>
              <h3 className="mt-3 mb-1 text-base">{s.title}</h3>
              <p className="m-0 text-sm text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {pricing && (
        <section id="harga" aria-labelledby="harga-judul" className="mt-12 scroll-mt-24 rounded-card border border-line/80 bg-white shadow-soft">
          <div className="p-6 sm:p-8">
            <p className="m-0 text-sm font-semibold text-primary-700">{m.pricingEyebrow}</p>
            <h2 id="harga-judul" className="mt-1 mb-2">
              {m.pricingTitle}
            </h2>
            <p className="m-0 max-w-2xl text-muted">{m.pricingBody}</p>
          </div>
          <ul className="m-0 list-none border-t border-line p-0">
            {TYPES.map(({ type, icon: Icon }) => (
              <li key={type} className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4 last:border-b-0 sm:px-8" data-price-type={type}>
                <span className="flex items-center gap-3">
                  <Icon className="size-5 text-primary-700" aria-hidden="true" />
                  <span>
                    <span className="block font-semibold">{m.types[type]!.title}</span>
                    <span className="block text-lg font-bold tabular-nums">
                      {formatRupiah(subscriptionPrice(type))} <span className="text-sm font-normal text-muted">{m.perYear.replace('12', String(SUBSCRIPTION_MONTHS))}</span>
                    </span>
                  </span>
                </span>
                <Link href={`/daftar?jenis=${type}`} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                  {m.types[type]!.cta}
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-t border-line p-6 sm:px-8">
            <ul className="m-0 grid gap-1.5 pl-5 text-sm text-ink-soft">
              {m.pricingNotes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <p className="m-0 mt-4 text-sm text-muted">{m.renewHint}</p>
          </div>
        </section>
      )}
    </div>
  );
}
