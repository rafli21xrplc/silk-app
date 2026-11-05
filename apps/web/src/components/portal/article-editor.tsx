'use client';

import { ExternalLink, Info } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ARTICLE_BODY_MAX,
  ARTICLE_BODY_MIN,
  ARTICLE_SUMMARY_MAX,
  ARTICLE_SUMMARY_MIN,
  ARTICLE_TITLE_MAX,
  ARTICLE_TITLE_MIN,
  type PortalArticle,
} from '@silk/shared';
import { FormError } from '@/components/app-shell';
import { ArticlePreview } from '@/components/article/article-preview';
import { buttonVariants } from '@/components/ui/button';
import { api, errorMessage } from '@/lib/client-api';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { queryCache } from '@/lib/query-cache';
import { t } from '@/messages/id';
import { ArticleStatusBadge } from './article-status';

const m = t.articleEditor;

function Counter({ n, min, max }: { n: number; min: number; max: number }) {
  return <span className={cn('text-xs', n < min || n > max ? 'text-warn' : 'text-muted')}>{m.chars(n, min, max)}</span>;
}

/**
 * Formulir artikel mitra. Tombol mengikuti status (rencana fase 4 A3):
 * draf/ditolak/ditarik → simpan atau ajukan; menunggu → simpan perubahan; terbit → ajukan perubahan
 * (versi terbit tetap tampil). Pernyataan bebas promosi wajib saat mengajukan.
 */
export function ArticleEditor({ article, onChanged }: { article: PortalArticle | null; onChanged?: () => Promise<void> | void }) {
  const router = useRouter();
  const [title, setTitle] = useState(article?.title ?? '');
  const [summary, setSummary] = useState(article?.summary ?? '');
  const [body, setBody] = useState(article?.body ?? '');
  const [declaration, setDeclaration] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const status = article?.status ?? 'draft';
  const canSubmit = !article || status === 'draft' || status === 'rejected' || status === 'withdrawn';
  const isPublished = status === 'published';
  const canWithdraw = !!article && (status === 'pending' || (article.live && article.published !== null));
  const canDelete = !!article && article.firstPublishedAt === null;
  const needsDeclaration = canSubmit || isPublished;

  async function run(action: () => Promise<PortalArticle | null>, message: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const saved = await action();
      // Daftar dihapus dari cache; detail artikel ini diambil ulang oleh halaman lewat onChanged.
      queryCache.invalidate('/portal/articles', article ? `/portal/articles/${article.id}` : undefined);
      if (saved && !article) {
        router.replace(`/portal/artikel/${saved.id}`);
        return;
      }
      await onChanged?.();
      setNotice(message);
      setDeclaration(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const content = { title, summary, body };
  const save = async (extra: object = {}) =>
    article
      ? (await api<PortalArticle>('PUT', `/portal/articles/${article.id}`, { ...content, ...extra })).data
      : (await api<PortalArticle>('POST', '/portal/articles', content)).data;

  const onSaveDraft = () => run(() => save(), m.saved);
  const onSubmit = () =>
    run(async () => {
      const saved = await save();
      return (await api<PortalArticle>('POST', `/portal/articles/${saved.id}/submit`, { declaration: true })).data;
    }, m.submitted);
  const onSubmitChanges = () => run(() => save({ declaration: true }), m.submitted);
  const onWithdraw = () => {
    if (!article || !window.confirm(m.withdrawConfirm)) return;
    void run(async () => (await api<PortalArticle>('POST', `/portal/articles/${article.id}/withdraw`, {})).data, m.withdrawnDone);
  };
  const onDelete = async () => {
    if (!article || !window.confirm(m.deleteConfirm)) return;
    setBusy(true);
    try {
      await api('DELETE', `/portal/articles/${article.id}`);
      queryCache.invalidate('/portal/articles');
      router.push('/portal/artikel');
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6">
      {article && (
        <div role="status" className="grid gap-2 rounded-2xl border border-line bg-surface p-4 text-sm">
          <p className="m-0 flex flex-wrap items-center gap-2">
            <ArticleStatusBadge status={status} />
            <span className="text-ink-soft">{m.statusHint[status]}</span>
            {article.live && (
              <Link href={`/artikel/${article.slug}`} className="ml-auto inline-flex items-center gap-1 font-semibold" target="_blank">
                {m.viewPublic} <ExternalLink className="size-3.5" aria-hidden="true" />
              </Link>
            )}
          </p>
          {article.live && status !== 'published' && <p className="m-0 text-ink-soft">{m.liveVersionKept}</p>}
          {status === 'rejected' && article.rejectionReason && (
            <p className="m-0">
              <strong>{m.rejectionReason}:</strong> {article.rejectionReason}
            </p>
          )}
          {status === 'withdrawn' && article.withdrawnReason && (
            <p className="m-0">
              <strong>{m.withdrawnReason}:</strong> {article.withdrawnReason}
            </p>
          )}
          {status === 'pending' && article.needsReview && <p className="m-0 text-warn">{m.needsReview}</p>}
          <p className="m-0 text-xs text-muted">
            {m.updated} {formatDateTime(article.updatedAt)}
          </p>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void onSaveDraft();
          }}
        >
          <label className="grid gap-1">
            <span className="font-semibold">{m.fieldTitle}</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={ARTICLE_TITLE_MAX} required />
            <Counter n={title.trim().length} min={ARTICLE_TITLE_MIN} max={ARTICLE_TITLE_MAX} />
          </label>
          <label className="grid gap-1">
            <span className="font-semibold">{m.fieldSummary}</span>
            <span className="text-sm text-muted">{m.summaryHint}</span>
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} maxLength={ARTICLE_SUMMARY_MAX} />
            <Counter n={summary.trim().length} min={ARTICLE_SUMMARY_MIN} max={ARTICLE_SUMMARY_MAX} />
          </label>
          <label className="grid gap-1">
            <span className="font-semibold">{m.fieldBody}</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={18} maxLength={ARTICLE_BODY_MAX} className="font-mono text-sm leading-relaxed" />
            <Counter n={body.trim().length} min={ARTICLE_BODY_MIN} max={ARTICLE_BODY_MAX} />
          </label>
          <details className="rounded-2xl border border-line bg-white px-4 py-3 text-sm">
            <summary className="cursor-pointer font-semibold">{m.formatTitle}</summary>
            <table className="mt-3 w-full">
              <tbody>
                {m.formatRows.map(([code, label]) => (
                  <tr key={code}>
                    <td className="py-1 pr-4">
                      <code>{code}</code>
                    </td>
                    <td className="py-1 text-ink-soft">{label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 mb-0 flex items-start gap-1.5 text-muted">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {m.formatNote}
            </p>
          </details>

          {needsDeclaration && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={declaration} onChange={(e) => setDeclaration(e.target.checked)} />
              <span>{m.declaration}</span>
            </label>
          )}

          <FormError error={error} />
          {notice && (
            <p className="m-0 text-sm font-semibold text-primary-700" role="status">
              {notice}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {canSubmit && (
              <>
                <button type="button" className={buttonVariants({ variant: 'primary' })} disabled={busy || !declaration} onClick={() => void onSubmit()}>
                  {m.submit}
                </button>
                <button type="submit" className={buttonVariants({ variant: 'secondary' })} disabled={busy}>
                  {m.saveDraft}
                </button>
              </>
            )}
            {status === 'pending' && (
              <button type="submit" className={buttonVariants({ variant: 'primary' })} disabled={busy}>
                {m.saveChanges}
              </button>
            )}
            {isPublished && (
              <button type="button" className={buttonVariants({ variant: 'primary' })} disabled={busy || !declaration} onClick={() => void onSubmitChanges()}>
                {m.submitChanges}
              </button>
            )}
            {canWithdraw && (
              <button type="button" className={buttonVariants({ variant: 'ghost' })} disabled={busy} onClick={onWithdraw}>
                {m.withdraw}
              </button>
            )}
            {canDelete && (
              <button type="button" className={buttonVariants({ variant: 'ghost', className: 'text-danger' })} disabled={busy} onClick={() => void onDelete()}>
                {m.delete}
              </button>
            )}
          </div>
        </form>
        <div className="lg:sticky lg:top-24">
          <ArticlePreview title={title} summary={summary} body={body} />
        </div>
      </div>
    </div>
  );
}
