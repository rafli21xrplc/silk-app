import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticleBody } from '@/components/article-body';
import { DemoNotice } from '@/components/demo-notice';
import { ShareButton } from '@/components/share-button';
import { TopBar } from '@/components/top-bar';
import { formatDate } from '@/lib/format';
import { getArticle, snapshotDate } from '@/lib/silk/api';
import { t } from '@/messages/id';

export const revalidate = 300;

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const a = await getArticle((await params).slug);
  return a ? { title: a.data.title, description: a.data.description } : {};
}

export default async function ArticlePage({ params }: { params: Params }) {
  const loaded = await getArticle((await params).slug);
  if (!loaded) notFound();
  const a = loaded.data;
  return (
    <>
      <TopBar title={t.articles.title} backHref="/artikel" action={<ShareButton title={a.title} />} />
      <DemoNotice show={loaded.source === 'demo'} date={snapshotDate()} />
      <article className="px-4 pt-5">
        <h1 className="m-0 text-2xl leading-tight font-extrabold tracking-tight">{a.title}</h1>
        <p className="m-0 mt-2 text-sm text-muted">
          {t.articles.by(a.author.name)} · {formatDate(a.publishedAt)} · {t.articles.minutes(a.readingMinutes)}
        </p>
        <p className="m-0 mt-4 mb-4 text-base font-medium text-ink">{a.description}</p>
        <ArticleBody blocks={a.body} />
        <p className="m-0 mt-6 rounded-xl bg-surface px-3.5 py-2.5 text-xs text-muted">{t.articles.note}</p>
      </article>
    </>
  );
}
