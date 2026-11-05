'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { PortalArticle } from '@silk/shared';
import { ArticleEditor } from '@/components/portal/article-editor';
import { ArticleGate } from '@/components/portal/article-gate';
import { LoadingForm } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/client-api';
import { useQuery } from '@/lib/query-cache';
import { t } from '@/messages/id';
import { PortalShell } from '../../portal-shell';

export default function EditArticlePage() {
  const { id } = useParams<{ id: string }>();
  return (
    <PortalShell title={t.articleEditor.title}>
      {(me) => (
        <ArticleGate me={me}>
          <Edit id={id} />
        </ArticleGate>
      )}
    </PortalShell>
  );
}

function Edit({ id }: { id: string }) {
  const { data, error, refetch } = useQuery<PortalArticle>(`/portal/articles/${id}`);
  if (error) return <p className="error">{errorMessage(error)}</p>;
  if (!data) return <LoadingForm fields={3} />;
  return (
    <section className="stack">
      <p className="m-0">
        <Link href="/portal/artikel">← {t.common.back}</Link>
      </p>
      <ArticleEditor article={data} onChanged={refetch} />
    </section>
  );
}
