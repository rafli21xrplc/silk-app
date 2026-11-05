import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import type { ArticleSummary } from '@/lib/sanity';
import { t } from '@/messages/id';
import { ArticleCover } from './article-cover';

/** Tanggal · waktu baca (+ penanda contoh dev). */
export function ArticleMeta({
  article,
  className,
}: {
  article: ArticleSummary;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'm-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted',
        className,
      )}
    >
      <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
      <span aria-hidden="true">·</span>
      <span className="inline-flex items-center gap-1">
        <Clock className="size-3.5" aria-hidden="true" />
        {t.articles.minutes(article.readingMinutes)}
      </span>
      {article.sample && <span className="badge badge-stale">{t.articles.sample}</span>}
    </p>
  );
}

/** Kartu artikel: seluruh kartu dapat diklik lewat tautan judul (satu tautan per kartu untuk pembaca layar). */
export function ArticleCard({
  article,
  headingLevel: H = 'h3',
}: {
  article: ArticleSummary;
  headingLevel?: 'h2' | 'h3';
}) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-card border border-line/80 bg-white shadow-soft transition-[box-shadow,transform,border-color] duration-300 ease-soft hover:-translate-y-1 hover:border-primary-200 hover:shadow-lift">
      <ArticleCover slug={article.slug} className="aspect-[16/9]" />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <ArticleMeta article={article} />
        <H className="m-0 text-[1.1rem] leading-snug">
          <Link
            href={`/artikel/${article.slug}`}
            className="text-ink no-underline after:absolute after:inset-0 after:content-[''] group-hover:text-primary-800 hover:no-underline"
          >
            {article.title}
          </Link>
        </H>
        <p className="m-0 line-clamp-3 text-[0.95rem] text-muted">{article.description}</p>
        <span
          className="mt-auto inline-flex items-center gap-1.5 pt-1 text-sm font-semibold text-primary-700"
          aria-hidden="true"
        >
          {t.articles.readMore}
          <ArrowRight className="size-4 transition-transform duration-300 ease-soft group-hover:translate-x-1" />
        </span>
      </div>
    </article>
  );
}

/** Artikel terbaru: kartu lebar dengan sampul besar di samping. */
export function FeaturedArticle({ article }: { article: ArticleSummary }) {
  return (
    <article className="group relative grid overflow-hidden rounded-[2rem] border border-line/80 bg-white shadow-soft transition-[box-shadow,transform,border-color] duration-300 ease-soft hover:-translate-y-1 hover:border-primary-200 hover:shadow-lift md:grid-cols-[1.1fr_1fr]">
      <ArticleCover
        slug={article.slug}
        size="feature"
        className="aspect-[16/9] md:order-2 md:aspect-auto md:min-h-[320px]"
      />
      <div className="flex flex-col justify-center gap-4 p-6 sm:p-8 lg:p-10">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary-100 px-3 py-1 text-xs font-bold tracking-wide text-primary-800 uppercase">
          <span className="size-1.5 rounded-full bg-primary-600" aria-hidden="true" />
          {t.articles.latest}
        </span>
        <h2 className="m-0 text-[clamp(1.4rem,1.1rem+1.2vw,2rem)] leading-tight tracking-[-0.02em]">
          <Link
            href={`/artikel/${article.slug}`}
            className="text-ink no-underline after:absolute after:inset-0 after:content-[''] group-hover:text-primary-800 hover:no-underline"
          >
            {article.title}
          </Link>
        </h2>
        <p className="m-0 text-[1.02rem] text-ink-soft">{article.description}</p>
        <ArticleMeta article={article} />
        <span
          className="inline-flex w-fit items-center gap-2 rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgb(14_124_116/0.6)] transition-colors group-hover:bg-primary-700"
          aria-hidden="true"
        >
          {t.articles.readMore}
          <ArrowRight className="size-4 transition-transform duration-300 ease-soft group-hover:translate-x-1" />
        </span>
      </div>
    </article>
  );
}
