'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AdminArticleDetail } from '@silk/shared';
import { FormError } from '@/components/app-shell';
import { ArticlePreview } from '@/components/article/article-preview';
import { ArticleStatusBadge } from '@/components/portal/article-status';
import { LoadingForm } from '@/components/ui/skeleton';
import { api, errorMessage } from '@/lib/client-api';
import { formatDateTime } from '@/lib/format';
import { queryCache } from '@/lib/query-cache';
import { t } from '@/messages/id';
import { AdminShell, useAdminData } from '../../../admin-shell';
import { RejectForm } from '../../reject-form';

export default function AdminArticlePage() {
  const { id } = useParams<{ id: string }>();
  return <AdminShell>{() => <Detail id={id} />}</AdminShell>;
}

function Detail({ id }: { id: string }) {
  const router = useRouter();
  const { items: a, error, reload, handle } = useAdminData<AdminArticleDetail>(`/admin/articles/${id}`);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function act(kind: 'approve' | 'reject' | 'withdraw', body?: object) {
    setBusy(true);
    setActionError(null);
    try {
      await api('POST', `/admin/articles/${id}/${kind}`, body);
      queryCache.invalidate('/admin/articles');
      queryCache.invalidate('/admin/overview');
      reload();
      if (kind !== 'withdraw') router.push('/admin/moderasi?tab=artikel');
    } catch (err) {
      handle(err);
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!a) return error ? <p className="error">{error}</p> : <LoadingForm fields={4} />;
  const pending = a.status === 'pending';
  return (
    <section className="stack">
      <p>
        <Link href="/admin/moderasi?tab=artikel">← {t.common.back}</Link>
      </p>
      <h2 className="m-0">{a.title}</h2>
      <dl className="kv">
        <dt>{t.common.status}</dt>
        <dd>
          <ArticleStatusBadge status={a.status} />
        </dd>
        <dt>{t.moderation.articleAuthor}</dt>
        <dd>
          {a.author.profilePath ? (
            <a href={a.author.profilePath} target="_blank" rel="noopener noreferrer">
              {a.author.name}
            </a>
          ) : (
            a.author.name
          )}{' '}
          · {t.partner.types[a.author.partnerType] ?? a.author.partnerType}
        </dd>
        <dt>{t.common.date}</dt>
        <dd>{formatDateTime(a.submittedAt ?? a.updatedAt)}</dd>
        {a.live && (
          <>
            <dt>{t.portal.viewPublic}</dt>
            <dd>
              <a href={`/artikel/${a.slug}`} target="_blank" rel="noopener noreferrer">
                /artikel/{a.slug}
              </a>
            </dd>
          </>
        )}
        {a.rejectionReason && (
          <>
            <dt>{t.admin.reasonLabel}</dt>
            <dd>{a.rejectionReason}</dd>
          </>
        )}
      </dl>

      <div className="card stack">
        <h3 className="m-0 text-base">{t.moderation.violations}</h3>
        {a.violations.length === 0 ? (
          <p className="m-0 small muted">{t.moderation.noViolations}</p>
        ) : (
          <ul className="m-0">
            {a.violations.map((v, i) => (
              <li key={i}>
                <strong>“{v.match}”</strong> · {v.field} · {v.level}
              </li>
            ))}
          </ul>
        )}
        <p className="m-0 small muted">{t.moderation.articleChecklist}</p>
      </div>

      <div className={a.published && pending ? 'grid items-start gap-6 lg:grid-cols-2' : 'grid gap-6'}>
        <div className="stack">
          <h3 className="m-0 text-base">{t.moderation.proposedVersion}</h3>
          <ArticlePreview title={a.title} summary={a.summary} body={a.body} />
        </div>
        {a.published && pending && (
          <div className="stack">
            <h3 className="m-0 text-base">{t.moderation.publishedVersion}</h3>
            <ArticlePreview title={a.published.title} summary={a.published.summary} body={a.published.body} />
          </div>
        )}
      </div>

      <FormError error={actionError} />
      {pending && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card stack">
            <button type="button" className="btn-primary justify-self-start" disabled={busy} onClick={() => void act('approve')}>
              {t.moderation.approveArticle}
            </button>
          </div>
          <RejectForm busy={busy} onReject={(reason) => void act('reject', { reason })} />
        </div>
      )}
      {a.live && (
        <form
          className="card stack"
          onSubmit={(e) => {
            e.preventDefault();
            void act('withdraw', { reason: String(new FormData(e.currentTarget).get('reason') ?? '').trim() });
          }}
        >
          <p className="m-0 small muted">{t.moderation.withdrawHint}</p>
          <label>
            {t.admin.reason}
            <textarea name="reason" rows={2} minLength={5} maxLength={1000} required />
          </label>
          <button type="submit" className="btn-danger justify-self-start" disabled={busy}>
            {t.moderation.withdrawArticle}
          </button>
        </form>
      )}
    </section>
  );
}
