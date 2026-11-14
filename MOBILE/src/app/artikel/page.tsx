import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { DemoNotice } from '@/components/demo-notice';
import { Empty } from '@/components/empty';
import { TopBar } from '@/components/top-bar';
import { formatShortDate } from '@/lib/format';
import { getArticles, snapshotDate } from '@/lib/silk/api';
import { t } from '@/messages/id';

// Dinamis: banner "data demo" harus mencerminkan status API saat ini, bukan saat build.
// Respons API yang berhasil tetap di-cache 5 menit oleh fetchApi.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: t.articles.title };

export default async function ArticlesPage() {
  const articles = await getArticles();
  return (
    <>
      <TopBar title={t.articles.title} backHref="/info" heading />
      <DemoNotice show={articles.source === 'demo'} date={snapshotDate()} />
      <p className="m-0 px-4 pt-4 pb-3 text-sm text-muted">{t.articles.intro}</p>
      {articles.data.length === 0 ? (
        <Empty text={t.articles.none} />
      ) : (
        <ul className="m-0 grid list-none gap-2.5 px-4">
          {articles.data.map((a) => (
            <li key={a.slug}>
              <Link href={`/artikel/${a.slug}`} className="tap flex items-center gap-3 rounded-2xl border border-line/70 bg-white p-4 text-ink no-underline">
                <span className="min-w-0 flex-1">
                  <span className="block font-bold leading-snug">{a.title}</span>
                  <span className="mt-1 line-clamp-2 block text-sm text-ink-soft">{a.description}</span>
                  <span className="mt-1.5 block text-xs text-muted">
                    {t.articles.by(a.author.name)} · {t.articles.minutes(a.readingMinutes)} · {formatShortDate(a.publishedAt)}
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
