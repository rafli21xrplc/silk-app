'use client';

import Link from 'next/link';
import { Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { REVIEW_ASPECTS, REVIEW_COMMENT_MAX, type MyReview } from '@silk/shared';
import { FormError } from '@/components/app-shell';
import { buttonVariants } from '@/components/ui/button';
import { api, ClientApiError, errorMessage } from '@/lib/client-api';
import { cn } from '@/lib/cn';
import { useQuery } from '@/lib/query-cache';
import { emptyReviewDraft, reviewBodyFromDraft, toggleAspect, type ReviewDraft } from '@/lib/reviews';
import type { Me } from '@/lib/types';
import { ME_STALE_MS } from '@/lib/use-me';
import { t } from '@/messages/id';

const f = t.reviews.form;

/**
 * Tulis, ubah, atau hapus ulasan sendiri (hanya akun pasien; API menegakkan aturan yang sama).
 * Setiap kiriman masuk antrean moderasi; halaman publik baru berubah setelah disetujui.
 */
export function ReviewForm({ facilitySlug }: { facilitySlug: string }) {
  const { data: me, error: meError } = useQuery<Me>('/me', { staleMs: ME_STALE_MS });
  const isPatient = me?.user.role === 'pasien';
  const [mine, setMine] = useState<MyReview | null | undefined>(undefined);
  const [draft, setDraft] = useState<ReviewDraft>(emptyReviewDraft());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isPatient) return;
    let live = true;
    api<MyReview | null>('GET', `/reviews/${encodeURIComponent(facilitySlug)}/mine`)
      .then(({ data }) => {
        if (!live) return;
        setMine(data);
        if (data) setDraft({ rating: data.rating, aspects: data.aspects, comment: data.comment ?? '', declaration: false });
      })
      .catch((err: unknown) => live && setError(errorMessage(err)));
    return () => {
      live = false;
    };
  }, [isPatient, facilitySlug]);

  const signedOut = meError instanceof ClientApiError && (meError.status === 401 || meError.status === 403);
  if (signedOut) {
    const back = typeof window === 'undefined' ? '' : `?kembali=${encodeURIComponent(`${window.location.pathname}#ulasan`)}`;
    return (
      <Link href={`/masuk${back}`} className="btn justify-self-start">
        {f.signIn}
      </Link>
    );
  }
  if (!me) return null;
  if (!isPatient) return <p className="small muted m-0">{f.onlyPatients}</p>;
  if (mine === undefined) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const r = reviewBodyFromDraft(draft);
    if ('problem' in r) {
      setError(f[r.problem]);
      return;
    }
    setBusy(true);
    try {
      const { data } = await api<MyReview>('PUT', `/reviews/${encodeURIComponent(facilitySlug)}`, r.body);
      setMine(data);
      setDraft((d) => ({ ...d, declaration: false }));
      setNotice(f.sent);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(f.confirmDelete)) return;
    setBusy(true);
    setError(null);
    try {
      await api('DELETE', `/reviews/${encodeURIComponent(facilitySlug)}`);
      setMine(null);
      setDraft(emptyReviewDraft());
      setNotice(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-4 rounded-2xl border border-line bg-white p-4 sm:p-5" aria-labelledby="ulasan-form">
      <h3 id="ulasan-form" className="m-0 text-base">
        {mine ? f.editTitle : f.title}
      </h3>
      {mine && (
        <p className="small m-0">
          <span className="badge">{f.status[mine.status] ?? mine.status}</span>{' '}
          {mine.status === 'rejected' && mine.rejectionReason ? f.rejected(mine.rejectionReason) : f.editNote}
        </p>
      )}
      <FormError error={error} />
      {notice && <p className="small m-0 rounded-xl bg-primary-50 px-3 py-2">{notice}</p>}

      <fieldset className="grid gap-1.5">
        <legend className="text-sm font-semibold">{f.rating}</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer" title={t.reviews.starsLabel(n)}>
              <input type="radio" name="rating" value={n} className="sr-only" checked={draft.rating === n} onChange={() => setDraft({ ...draft, rating: n })} />
              <Star className={cn('size-7', n <= draft.rating ? 'text-amber-500' : 'text-line-strong')} fill={n <= draft.rating ? 'currentColor' : 'none'} aria-hidden="true" />
              <span className="sr-only">{t.reviews.starsLabel(n)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">{f.aspectsLabel}</legend>
        {REVIEW_ASPECTS.map((aspect) => (
          <div key={aspect} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>{t.reviews.aspects[aspect]}</span>
            <span className="flex gap-1.5">
              {(['baik', 'kurang'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={draft.aspects[aspect] === v}
                  className={buttonVariants({ size: 'sm', variant: draft.aspects[aspect] === v ? (v === 'baik' ? 'primary' : 'soft') : 'secondary' })}
                  onClick={() => setDraft(toggleAspect(draft, aspect, v))}
                >
                  {t.reviews.aspectValue[v]}
                </button>
              ))}
            </span>
          </div>
        ))}
      </fieldset>

      <label>
        {f.comment}
        <textarea rows={3} maxLength={REVIEW_COMMENT_MAX} value={draft.comment} onChange={(e) => setDraft({ ...draft, comment: e.target.value })} />
        <span className="small muted">{f.commentHelp}</span>
      </label>

      <label className="flex items-start gap-2 font-normal">
        <input type="checkbox" className="mt-1" checked={draft.declaration} onChange={(e) => setDraft({ ...draft, declaration: e.target.checked })} />
        <span>{f.declaration}</span>
      </label>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={busy}>
          {mine ? f.update : f.submit}
        </button>
        {mine && (
          <button type="button" className="btn-link" disabled={busy} onClick={() => void remove()}>
            {f.delete}
          </button>
        )}
      </div>
    </form>
  );
}
