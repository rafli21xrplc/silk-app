'use client';

import { useDeferredValue, useMemo } from 'react';
import { parseArticleBody } from '@silk/shared';
import { PortableText } from '@/components/portable-text';
import { t } from '@/messages/id';

/** Pratinjau isi artikel mitra memakai parser dan renderer yang sama dengan halaman publik. */
export function ArticlePreview({ title, summary, body }: { title: string; summary: string; body: string }) {
  const deferred = useDeferredValue(body);
  const blocks = useMemo(() => parseArticleBody(deferred), [deferred]);
  return (
    <div className="rounded-card border border-line bg-white p-5 shadow-soft">
      <p className="m-0 mb-3 text-xs font-bold tracking-wider text-muted uppercase">{t.articleEditor.preview}</p>
      {title && <h2 className="mt-0 mb-2 text-xl leading-snug">{title}</h2>}
      {summary && <p className="mt-0 text-ink-soft">{summary}</p>}
      {blocks.length ? <PortableText blocks={blocks} className="max-w-none" /> : <p className="m-0 text-sm text-muted">{t.articleEditor.previewEmpty}</p>}
    </div>
  );
}
