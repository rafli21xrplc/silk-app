import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, ChevronRight, Cloud, CloudOff, Layers, Scale, Smartphone } from 'lucide-react';
import { formatShortDate } from '@/lib/format';
import { getCategories, snapshotDate } from '@/lib/silk/api';
import { t } from '@/messages/id';

export const metadata: Metadata = { title: t.info.title };
// Status koneksi diperiksa setiap kali halaman dibuka.
export const dynamic = 'force-dynamic';

export default async function InfoPage() {
  const probe = await getCategories();
  const live = probe.source === 'live';
  return (
    <>
      <header className="pt-safe px-4 pb-2">
        <h1 className="m-0 pt-4 text-xl font-extrabold tracking-tight">{t.info.title}</h1>
        <p className="m-0 mt-1.5 text-[0.88rem] text-ink-soft">{t.info.intro}</p>
      </header>

      <section aria-labelledby="status" className="mx-4 mt-4 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-soft" data-data-status={live ? 'live' : 'demo'}>
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${live ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'}`}>
          {live ? <Cloud className="size-5" aria-hidden="true" /> : <CloudOff className="size-5" aria-hidden="true" />}
        </span>
        <span>
          <h2 id="status" className="m-0 text-[0.75rem] font-semibold text-muted">
            {t.info.dataTitle}
          </h2>
          <span className="block text-sm font-bold">{live ? t.demo.live : t.demo.offline}</span>
          {!live && <span className="block text-[0.75rem] text-muted">{t.demo.bannerDate(formatShortDate(snapshotDate()))}</span>}
        </span>
      </section>

      <section aria-labelledby="metodologi" className="mt-6 px-4">
        <h2 id="metodologi" className="m-0 mb-2.5 text-base font-bold">
          {t.info.methodTitle}
        </h2>
        <ol className="m-0 grid list-none gap-2.5 p-0">
          {t.info.method.map((m, i) => (
            <li key={m.title} className="flex items-start gap-3 rounded-2xl bg-white p-3.5 shadow-soft">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-50 text-sm font-bold text-primary-700">{i + 1}</span>
              <span>
                <span className="block text-sm font-semibold">{m.title}</span>
                <span className="block text-[0.82rem] text-muted">{m.body}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="netral" className="mx-4 mt-6 flex items-start gap-3 rounded-card bg-gradient-to-br from-primary-600 to-primary-800 p-5 text-white shadow-lift">
        <Scale className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <span>
          <h2 id="netral" className="m-0 mb-1 text-base font-bold">
            {t.info.neutralTitle}
          </h2>
          <p className="m-0 text-[0.82rem] text-primary-50">{t.info.neutralBody}</p>
        </span>
      </section>

      <section aria-labelledby="tautan" className="mt-6 px-4">
        <h2 id="tautan" className="m-0 mb-2.5 text-base font-bold">
          {t.info.linksTitle}
        </h2>
        <ul className="m-0 grid list-none gap-2 p-0">
          {[
            { href: '/artikel', label: t.info.articles, icon: BookOpen },
            { href: '/layanan', label: t.info.services, icon: Layers },
          ].map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className="tap flex items-center gap-3 rounded-2xl bg-white p-3.5 font-semibold text-ink no-underline shadow-soft">
                <Icon className="size-5 text-primary-700" aria-hidden="true" />
                <span className="flex-1 text-sm">{label}</span>
                <ChevronRight className="size-5 text-muted" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="pasang" className="mx-4 mt-6 flex items-start gap-3 rounded-2xl border border-dashed border-line-strong p-4">
        <Smartphone className="mt-0.5 size-5 shrink-0 text-primary-700" aria-hidden="true" />
        <span>
          <h2 id="pasang" className="m-0 text-sm font-bold">
            {t.info.installTitle}
          </h2>
          <p className="m-0 mt-0.5 text-[0.8rem] text-muted">{t.info.installBody}</p>
        </span>
      </section>

      <p className="m-0 mt-6 px-4 text-center text-[0.72rem] text-muted">{t.info.disclaimer}</p>
    </>
  );
}
