import type { Metadata } from 'next';
import { ListGroup, ListRow } from '@/components/list';
import { cn } from '@/lib/cn';
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
      <header className="pt-safe px-5">
        <h1 className="m-0 pt-5 text-2xl font-bold tracking-tight">{t.info.title}</h1>
        <p className="m-0 mt-2 text-base text-ink-soft">{t.info.intro}</p>
      </header>

      <ListGroup id="status" title={t.info.dataTitle} className="mt-7">
        <li className="flex items-center gap-3 px-4 py-3" data-data-status={live ? 'live' : 'demo'}>
          <span className={cn('size-2.5 shrink-0 rounded-full', live ? 'bg-ok' : 'bg-warn')} aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-base">{live ? t.demo.live : t.demo.offline}</span>
            {!live && <span className="block text-xs text-muted">{t.demo.bannerDate(formatShortDate(snapshotDate()))}</span>}
          </span>
        </li>
      </ListGroup>

      <ListGroup id="cara-baca" title={t.home.howTitle} className="mt-7">
        {t.home.how.map((h) => (
          <ListRow key={h.title} title={<span className="font-semibold">{h.title}</span>} sub={<span className="text-sm">{h.body}</span>} />
        ))}
      </ListGroup>

      <ListGroup id="metodologi" title={t.info.methodTitle} className="mt-7">
        {t.info.method.map((m, i) => (
          <ListRow
            key={m.title}
            align="start"
            leading={<span className="w-4 shrink-0 pt-0.5 text-sm font-semibold text-muted tabular-nums">{i + 1}</span>}
            title={<span className="font-semibold">{m.title}</span>}
            sub={<span className="text-sm">{m.body}</span>}
          />
        ))}
      </ListGroup>

      <section aria-labelledby="netral" className="mt-7 px-5">
        <h2 id="netral" className="m-0 text-base font-bold">
          {t.info.neutralTitle}
        </h2>
        <p className="m-0 mt-1.5 text-base text-ink-soft">{t.info.neutralBody}</p>
      </section>

      <section aria-labelledby="foto" className="mt-7 px-5">
        <h2 id="foto" className="m-0 text-base font-bold">
          {t.info.photosTitle}
        </h2>
        <p className="m-0 mt-1.5 text-sm text-ink-soft">{t.info.photosNote}</p>
      </section>

      <ListGroup id="tautan" title={t.info.linksTitle} className="mt-7">
        <ListRow href="/layanan" title={t.info.services} />
        <ListRow href="/artikel" title={t.info.articles} />
        <ListRow href="/mitra" title={t.info.partner} />
      </ListGroup>

      <section aria-labelledby="pasang" className="mt-7 px-5">
        <h2 id="pasang" className="m-0 text-base font-bold">
          {t.info.installTitle}
        </h2>
        <p className="m-0 mt-1.5 text-sm text-ink-soft">{t.info.installBody}</p>
      </section>

      <p className="m-0 mt-8 px-5 text-xs text-muted">{t.info.disclaimer}</p>
    </>
  );
}
