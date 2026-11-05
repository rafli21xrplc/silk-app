'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import type { PortalArticle } from '@silk/shared';
import { ArticleGate } from '@/components/portal/article-gate';
import { ArticleStatusBadge } from '@/components/portal/article-status';
import { buttonVariants } from '@/components/ui/button';
import { LoadingTable } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/client-api';
import { formatDateTime } from '@/lib/format';
import { useQuery } from '@/lib/query-cache';
import type { Me } from '@/lib/types';
import { t } from '@/messages/id';
import { PortalShell } from '../portal-shell';

const m = t.articleEditor;

/** Daftar artikel milik mitra (F-05), semua status. */
export default function PortalArticlesPage() {
  return <PortalShell title={m.title}>{(me) => <ArticleList me={me} />}</PortalShell>;
}

function ArticleList({ me }: { me: Me }) {
  return (
    <ArticleGate me={me}>
      <Rows />
    </ArticleGate>
  );
}

function Rows() {
  const { data, error, loading } = useQuery<PortalArticle[]>('/portal/articles');
  return (
    <section className="stack">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 max-w-2xl text-ink-soft">{m.intro}</p>
        <Link href="/portal/artikel/baru" className={buttonVariants({ variant: 'primary' })}>
          <Plus className="size-4" aria-hidden="true" />
          {m.create}
        </Link>
      </div>
      {error ? <p className="error">{errorMessage(error)}</p> : null}
      {loading && <LoadingTable cols={3} />}
      {data?.length === 0 && <p className="card">{m.empty}</p>}
      {data && data.length > 0 && (
        <ul className="plain grid gap-3">
          {data.map((a) => (
            <li key={a.id} className="card flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="m-0 text-lg leading-snug">
                  <Link href={`/portal/artikel/${a.id}`}>{a.title}</Link>
                </h2>
                <p className="m-0 mt-1 text-sm text-muted">
                  {m.updated} {formatDateTime(a.updatedAt)}
                  {a.live && (
                    <>
                      {' · '}
                      <Link href={`/artikel/${a.slug}`}>{m.viewPublic}</Link>
                    </>
                  )}
                </p>
                {a.status === 'rejected' && a.rejectionReason && (
                  <p className="m-0 mt-1 text-sm text-danger">
                    {m.rejectionReason}: {a.rejectionReason}
                  </p>
                )}
              </div>
              <ArticleStatusBadge status={a.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
