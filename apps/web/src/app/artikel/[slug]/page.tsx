import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, Clock, Info, ListOrdered } from 'lucide-react';
import { ArticleCard } from '@/components/article/article-card';
import { ArticleCover, articleTheme } from '@/components/article/article-cover';
import { ArticleToc, CopyLinkButton, ReadingProgress } from '@/components/article/article-reading';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { JsonLd } from '@/components/json-ld';
import { PortableText } from '@/components/portable-text';
import { buttonVariants } from '@/components/ui/button';
import { tocOf } from '@/lib/article-meta';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { getArticle, listArticles } from '@/lib/sanity';
import { articleLd } from '@/lib/seo';
import { t } from '@/messages/id';

type Params = Promise<{ slug: string }>;
export const revalidate = 3600;

/** Tidak ada prerender saat build; halaman dibuat saat diminta pertama kali lalu di-cache (ISR). */
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const a = await getArticle((await params).slug);
  if (!a) return { title: t.notFound.title, robots: { index: false } };
  return {
    title: a.title,
    description: a.description,
    alternates: { canonical: `/artikel/${a.slug}` },
    openGraph: {
      type: 'article',
      title: a.title,
      description: a.description,
      publishedTime: a.publishedAt,
    },
  };
}

const BODY_ID = 'isi-artikel';

export default async function ArticlePage({ params }: { params: Params }) {
  const { slug } = await params;
  const [a, all] = await Promise.all([getArticle(slug), listArticles().catch(() => [])]);
  if (!a) notFound();
  const toc = tocOf(a.body);
  const related = all.filter((x) => x.slug !== a.slug).slice(0, 3);
  const theme = articleTheme(a.slug);
  const initials = (a.author ?? t.site.name)
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <>
      <ReadingProgress targetId={BODY_ID} />
      <JsonLd data={articleLd({ ...a, author: a.author ?? undefined })} />
      <div className="container">
        <Breadcrumbs
          items={[
            { name: 'Beranda', path: '/' },
            { name: t.articles.title, path: '/artikel' },
            { name: a.title, path: `/artikel/${a.slug}` },
          ]}
        />

        {/* Kepala artikel: teks di kiri, sampul topik di kanan (warna sama dengan kartunya). */}
        <header
          className={cn(
            'relative isolate grid overflow-hidden rounded-[2rem] border border-white shadow-soft md:grid-cols-[1.5fr_1fr]',
            theme.bg,
          )}
        >
          <div className="relative z-10 bg-white/70 px-6 py-8 backdrop-blur-sm sm:px-10 sm:py-12">
            <p className="m-0 mb-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 font-semibold text-ink-soft shadow-soft">
                <Clock className="size-3.5" aria-hidden="true" />
                {t.articles.minutes(a.readingMinutes)}
              </span>
              {a.sample && (
                <span className="badge badge-stale" title={t.articles.sampleNote}>
                  {t.articles.sample}
                </span>
              )}
            </p>
            <h1 className="animate-rise text-[clamp(1.8rem,1.2rem+2.4vw,2.75rem)] leading-[1.12] font-extrabold tracking-[-0.03em]">
              {a.title}
            </h1>
            <p className="m-0 max-w-2xl animate-rise text-lg text-ink-soft [animation-delay:80ms]">
              {a.description}
            </p>
            <div className="mt-6 flex items-center gap-3 border-t border-line/70 pt-5">
              <span
                className={cn(
                  'grid size-11 shrink-0 place-items-center rounded-full bg-white font-bold shadow-soft',
                  theme.ink,
                )}
                aria-hidden="true"
              >
                {initials}
              </span>
              <div className="min-w-0 text-sm">
                {a.author && (
                  <p className="m-0 font-semibold text-ink">
                    <span className="sr-only">{t.articles.writtenBy} </span>
                    {a.author}
                  </p>
                )}
                <p className="m-0 text-muted">
                  <time dateTime={a.publishedAt}>{formatDate(a.publishedAt)}</time>
                  {a.updatedAt.slice(0, 10) !== a.publishedAt.slice(0, 10) && (
                    <>
                      {' · '}
                      {t.articles.updated}{' '}
                      <time dateTime={a.updatedAt}>{formatDate(a.updatedAt)}</time>
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
          <ArticleCover
            slug={a.slug}
            size="hero"
            className="order-first aspect-[21/9] md:order-none md:aspect-auto"
          />
        </header>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-14">
          <div className="mx-auto w-full min-w-0 max-w-3xl lg:mx-0">
            {/* Ponsel/tablet: daftar isi bisa dibuka-tutup di atas isi. */}
            {toc.length > 1 && (
              <details className="group/toc mb-8 rounded-card border border-line bg-white px-5 py-4 shadow-soft lg:hidden">
                <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold [&::-webkit-details-marker]:hidden">
                  <ListOrdered className="size-[18px] text-primary-700" aria-hidden="true" />
                  {t.articles.toc}
                  <span className="ml-auto text-sm font-normal text-muted">{toc.length}</span>
                </summary>
                <ArticleToc items={toc} className="mt-4" />
              </details>
            )}

            <div id={BODY_ID}>
              <PortableText
                blocks={a.body}
                className="prose-lg max-w-none prose-headings:scroll-mt-24 prose-h2:mt-10 prose-blockquote:rounded-r-2xl prose-blockquote:border-l-4 prose-blockquote:bg-primary-50/70 prose-blockquote:px-5 prose-blockquote:py-1 prose-blockquote:font-medium prose-blockquote:not-italic"
              />
            </div>

            <aside className="mt-10 flex items-start gap-3 rounded-2xl border border-sand-200 bg-sand-50 px-5 py-4 text-sm text-ink-soft">
              <Info className="mt-0.5 size-[18px] shrink-0 text-warn" aria-hidden="true" />
              <p className="m-0">{t.articles.medicalNote}</p>
            </aside>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
              <Link href="/artikel" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                <ArrowLeft className="size-4" aria-hidden="true" />
                {t.articles.allArticles}
              </Link>
              <CopyLinkButton />
            </div>
          </div>

          {/* Desktop: daftar isi + bagikan + ajakan, lengket saat menggulir. */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 grid gap-5">
              {toc.length > 0 && (
                <nav
                  aria-label={t.articles.toc}
                  className="rounded-card border border-line bg-white p-5 shadow-soft"
                >
                  <p className="m-0 mb-3 flex items-center gap-2 text-xs font-bold tracking-wider text-muted uppercase">
                    <ListOrdered className="size-4" aria-hidden="true" />
                    {t.articles.toc}
                  </p>
                  <ArticleToc items={toc} />
                </nav>
              )}
              <div className="rounded-card bg-gradient-to-br from-primary-700 to-primary-900 p-5 text-white shadow-lift">
                <p className="m-0 mb-1 font-semibold">{t.articles.ctaTitle}</p>
                <p className="m-0 mb-4 text-sm text-primary-100">{t.articles.ctaBody}</p>
                <Link
                  href="/cari"
                  className={buttonVariants({
                    variant: 'secondary',
                    size: 'sm',
                    className: 'w-full border-white',
                  })}
                >
                  {t.articles.ctaButton}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </aside>
        </div>

        {related.length > 0 && (
          <section aria-labelledby="artikel-lainnya" className="mt-16 border-t border-line pt-10">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <h2 id="artikel-lainnya" className="m-0">
                {t.articles.related}
              </h2>
              <Link
                href="/artikel"
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold no-underline shadow-soft hover:bg-primary-50 hover:no-underline"
              >
                {t.articles.allArticles} <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            <ul className="m-0 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((r) => (
                <li key={r.slug}>
                  <ArticleCard article={r} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
