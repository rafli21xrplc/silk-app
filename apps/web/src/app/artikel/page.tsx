import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, Sparkles } from 'lucide-react';
import { ArticleBrowser } from '@/components/article/article-browser';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { listArticles } from '@/lib/articles';
import { t } from '@/messages/id';

export const revalidate = 3600;
export const metadata: Metadata = {
  title: t.articles.title,
  description: t.articles.intro,
  alternates: { canonical: '/artikel' },
};

export default async function ArticlesPage() {
  const articles = await listArticles();
  return (
    <div className="container">
      {/* Kepala halaman: panel pastel lembut, senada dengan beranda. */}
      <header className="relative isolate mb-8 overflow-hidden rounded-[2rem] border border-white bg-gradient-to-br from-primary-100 via-[#f1f8f7] to-sand-100 px-6 py-10 shadow-soft sm:px-10 sm:py-14">
        <span
          aria-hidden="true"
          className="absolute -top-16 -right-10 -z-10 size-64 rounded-full bg-white/50 blur-2xl"
        />
        <span
          aria-hidden="true"
          className="absolute -bottom-24 left-1/3 -z-10 size-72 rounded-full bg-sky/70 blur-3xl"
        />
        <BookOpen
          aria-hidden="true"
          className="absolute top-1/2 right-10 -z-10 hidden size-40 -translate-y-1/2 -rotate-6 text-primary-700/10 md:block"
          strokeWidth={1.25}
        />
        <p className="mb-4 inline-flex animate-rise items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-sm font-semibold text-primary-800 shadow-soft backdrop-blur">
          <Sparkles className="size-4" aria-hidden="true" />
          {t.articles.eyebrow}
        </p>
        <h1 className="max-w-2xl text-[clamp(1.9rem,1.3rem+2.6vw,3rem)] leading-[1.1] font-extrabold tracking-[-0.03em]">
          {t.articles.heading}
        </h1>
        <p className="m-0 max-w-xl animate-rise text-lg text-ink-soft [animation-delay:80ms]">
          {t.articles.intro}
        </p>
      </header>

      {articles.length === 0 ? (
        <EmptyState icon={BookOpen} title={t.articles.emptyTitle}>
          {t.articles.empty}
        </EmptyState>
      ) : (
        <ArticleBrowser articles={articles} />
      )}

      <section className="mt-14 flex flex-col items-start justify-between gap-5 rounded-card bg-primary-800 px-6 py-8 text-white shadow-lift sm:flex-row sm:items-center sm:px-10">
        <div>
          <h2 className="m-0 mb-1 text-xl text-white">{t.articles.ctaTitle}</h2>
          <p className="m-0 max-w-xl text-primary-100">{t.articles.ctaBody}</p>
        </div>
        <Link
          href="/cari"
          className={buttonVariants({ variant: 'secondary', className: 'shrink-0 border-white' })}
        >
          {t.articles.ctaButton}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
