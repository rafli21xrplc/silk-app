'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Inbox } from 'lucide-react';
import { useState } from 'react';
import { ARTICLE_STATUSES, formatPrice, REVIEW_STATUSES, type AdminArticleListItem, type AdminReview, type PriceType } from '@silk/shared';
import { FormError } from '@/components/app-shell';
import { ConsentSummary } from '@/components/portal/video-consent-fields';
import { Stars } from '@/components/reviews/review-parts';
import { buttonVariants } from '@/components/ui/button';
import { DataPanel } from '@/components/ui/data-panel';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingTable } from '@/components/ui/skeleton';
import { api, errorMessage } from '@/lib/client-api';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import type { MediaConsentView } from '@/lib/portal-types';
import { queryCache } from '@/lib/query-cache';
import { t } from '@/messages/id';
import { AdminShell, StatusFilter, useAdminList } from '../admin-shell';
import { RejectForm } from './reject-form';

const ALL_TABS = ['profil', 'revisi', 'media', 'harga', 'artikel', 'ulasan'] as const;
type Tab = (typeof ALL_TABS)[number];

/**
 * Antrean moderasi: profil baru, revisi profil terbit (K3), media (K8), harga mitra (K4), artikel mitra (F-05),
 * dan ulasan pengalaman (evaluasi USP R8, hanya bila flag reviews_enabled menyala).
 */
export function ModerationView({ reviewsEnabled = false }: { reviewsEnabled?: boolean }) {
  const params = useSearchParams();
  const raw = params.get('tab');
  const TABS = ALL_TABS.filter((k) => k !== 'ulasan' || reviewsEnabled);
  const tab: Tab = (TABS as readonly string[]).includes(raw ?? '') ? (raw as Tab) : 'revisi';
  return (
    <AdminShell>
      {() => (
        <section className="stack">
          <nav aria-label={t.moderation.title} className="flex flex-wrap gap-2">
            {TABS.map((k) => (
              <Link
                key={k}
                href={`/admin/moderasi?tab=${k}`}
                aria-current={k === tab ? 'page' : undefined}
                className={buttonVariants({ variant: k === tab ? 'soft' : 'ghost', size: 'sm' })}
              >
                {t.moderation.tabs[k]}
              </Link>
            ))}
          </nav>
          {tab === 'profil' && <NewProfiles />}
          {tab === 'revisi' && <Revisions />}
          {tab === 'media' && <Media />}
          {tab === 'harga' && <PriceRequests />}
          {tab === 'artikel' && <Articles />}
          {tab === 'ulasan' && <Reviews />}
        </section>
      )}
    </AdminShell>
  );
}

function Empty({ tab }: { tab: Tab }) {
  return (
    <EmptyState icon={Inbox} title={t.admin.empty}>
      {t.moderation.empty[tab]}
    </EmptyState>
  );
}

/* ---------- Profil baru (menunggu_tinjauan → terbit) ---------- */

interface FacilityRow {
  id: string;
  slug: string;
  name: string;
  type: string;
  city: string;
  status: string;
  updatedAt: string;
}

function NewProfiles() {
  const { rows, busy, pagination, error, reload, handle } = useAdminList<FacilityRow>('/admin/facilities?status=menunggu_tinjauan');
  const [working, setWorking] = useState<string | null>(null);

  async function setStatus(id: string, status: 'terbit' | 'draft') {
    setWorking(id);
    try {
      await api('PATCH', `/admin/facilities/${id}`, { status });
      queryCache.invalidate('/admin/overview');
      reload();
    } catch (err) {
      handle(err);
    } finally {
      setWorking(null);
    }
  }

  return (
    <>
      <p className="small muted">{t.moderation.newProfiles}</p>
      {error && <p className="error">{error}</p>}
      {rows === null && !error && <LoadingTable cols={4} />}
      {rows?.length === 0 && <Empty tab="profil" />}
      {rows && rows.length > 0 && (
        <DataPanel pagination={pagination} busy={busy} label={t.moderation.tabs.profil}>
          <table>
            <thead>
              <tr>
                <th scope="col">{t.admin.facilities}</th>
                <th scope="col">{t.common.date}</th>
                <th scope="col">
                  <span className="sr-only">{t.common.action}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.id}>
                  <th scope="row">
                    {f.name}
                    <div className="small muted font-normal">
                      {t.facilityType[f.type] ?? f.type} · {f.city}
                    </div>
                  </th>
                  <td className="whitespace-nowrap">{formatDateTime(f.updatedAt)}</td>
                  <td className="text-right">
                    <span className="inline-flex flex-wrap justify-end gap-2">
                      <button type="button" className="btn-primary" disabled={working === f.id} onClick={() => void setStatus(f.id, 'terbit')}>
                        {t.moderation.publish}
                      </button>
                      <button type="button" className="btn" disabled={working === f.id} onClick={() => void setStatus(f.id, 'draft')}>
                        {t.moderation.backToDraft}
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataPanel>
      )}
    </>
  );
}

/* ---------- Revisi profil ---------- */

interface RevisionRow {
  id: string;
  status: string;
  payload: Record<string, unknown>;
  createdAt: string;
  rejectionReason: string | null;
  facilityName: string;
  facilityType: string;
  submitterEmail: string | null;
}

function Revisions() {
  const [status, setStatus] = useState<string>('pending');
  const { rows, busy, pagination, error } = useAdminList<RevisionRow>(`/admin/profile-revisions?status=${status}`);
  return (
    <>
      <StatusFilter value={status} options={REVIEW_STATUSES} onChange={setStatus} labels={t.priceRequest.status} />
      {error && <p className="error">{error}</p>}
      {rows === null && !error && <LoadingTable cols={4} />}
      {rows?.length === 0 && <Empty tab="revisi" />}
      {rows && rows.length > 0 && (
        <DataPanel pagination={pagination} busy={busy} label={t.moderation.tabs.revisi}>
          <table>
            <thead>
              <tr>
                <th scope="col">{t.admin.facilities}</th>
                <th scope="col">{t.moderation.field}</th>
                <th scope="col">{t.moderation.submitter}</th>
                <th scope="col">{t.common.date}</th>
                <th scope="col">
                  <span className="sr-only">{t.common.action}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row">
                    {r.facilityName}
                    <div className="small muted font-normal">{t.facilityType[r.facilityType] ?? r.facilityType}</div>
                  </th>
                  <td className="small">
                    {Object.keys(r.payload)
                      .map((k) => t.moderation.fields[k] ?? k)
                      .join(', ')}
                  </td>
                  <td className="small">{r.submitterEmail ?? '–'}</td>
                  <td className="whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                  <td className="text-right">
                    <Link href={`/admin/moderasi/revisi/${r.id}`} className={buttonVariants({ size: 'sm' })}>
                      {t.moderation.open}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataPanel>
      )}
    </>
  );
}

/* ---------- Media ---------- */

interface MediaRow {
  id: string;
  kind: 'foto' | 'video';
  fileName: string;
  mime: string;
  sizeBytes: number;
  durationSec: number | null;
  caption: string | null;
  status: string;
  rejectionReason: string | null;
  url: string | null;
  consent: MediaConsentView | null;
  createdAt: string;
  facilityName: string;
}

function Media() {
  const [status, setStatus] = useState<string>('pending');
  const { rows, busy, pagination, error, reload, handle } = useAdminList<MediaRow>(`/admin/media?status=${status}`);
  const [working, setWorking] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function decide(id: string, kind: 'approve' | 'reject', body?: object) {
    setWorking(id);
    setActionError(null);
    try {
      await api('POST', `/admin/media/${id}/${kind}`, body);
      queryCache.invalidate('/admin/overview');
      reload();
    } catch (err) {
      handle(err);
      setActionError(errorMessage(err));
    } finally {
      setWorking(null);
    }
  }

  return (
    <>
      <StatusFilter value={status} options={REVIEW_STATUSES.filter((s) => s !== 'superseded')} onChange={setStatus} labels={t.profile.mediaStatus} />
      {error && <p className="error">{error}</p>}
      <FormError error={actionError} />
      {rows === null && !error && <LoadingTable cols={3} />}
      {rows?.length === 0 && <Empty tab="media" />}
      {rows && rows.length > 0 && (
        <DataPanel pagination={pagination} busy={busy} scroll={false} label={t.moderation.tabs.media}>
          <ul className="plain grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((m) => (
              <li key={m.id} className="grid content-start gap-2 rounded-2xl border border-line bg-white p-3">
                <div className="overflow-hidden rounded-xl bg-surface-2">
                  {m.url && m.kind === 'foto' && <img src={m.url} alt={m.caption ?? m.fileName} className="aspect-[4/3] w-full object-cover" loading="lazy" />}
                  {m.url && m.kind === 'video' && <video controls preload="metadata" src={m.url} className="aspect-video w-full bg-ink" aria-label={m.caption ?? m.fileName} />}
                </div>
                <p className="m-0 font-semibold">{m.facilityName}</p>
                <p className="small muted m-0">
                  {m.kind === 'video' ? t.profile.video : t.profile.photos} · {m.fileName} · {Math.round(m.sizeBytes / 1024)} KB
                  {m.durationSec ? ` · ${t.moderation.duration(Math.round(m.durationSec))}` : ''}
                </p>
                {m.caption && <p className="small m-0">{m.caption}</p>}
                {m.kind === 'video' && <ConsentSummary consent={m.consent} />}
                <p className="small muted m-0">{formatDateTime(m.createdAt)}</p>
                {m.rejectionReason && (
                  <p className="small m-0">
                    <strong>{t.admin.reasonLabel}:</strong> {m.rejectionReason}
                  </p>
                )}
                {m.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      className="btn-primary justify-self-start"
                      disabled={working === m.id || (m.kind === 'video' && !m.consent)}
                      onClick={() => void decide(m.id, 'approve')}
                    >
                      {t.admin.approve}
                    </button>
                    <RejectForm compact busy={working === m.id} onReject={(reason) => void decide(m.id, 'reject', { reason })} />
                  </>
                )}
              </li>
            ))}
          </ul>
        </DataPanel>
      )}
    </>
  );
}

/* ---------- Ulasan (evaluasi USP R8) ---------- */

function Reviews() {
  const [status, setStatus] = useState<string>('pending');
  const { rows, busy, pagination, error, reload, handle } = useAdminList<AdminReview>(`/admin/reviews?status=${status}`);
  const [working, setWorking] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function decide(id: string, kind: 'approve' | 'reject', body?: object) {
    setWorking(id);
    setActionError(null);
    try {
      await api('POST', `/admin/reviews/${id}/${kind}`, body);
      reload();
    } catch (err) {
      handle(err);
      setActionError(errorMessage(err));
    } finally {
      setWorking(null);
    }
  }

  return (
    <>
      <StatusFilter value={status} options={REVIEW_STATUSES.filter((s) => s !== 'superseded')} onChange={setStatus} labels={t.reviews.form.status} />
      {error && <p className="error">{error}</p>}
      <FormError error={actionError} />
      {rows === null && !error && <LoadingTable cols={3} />}
      {rows?.length === 0 && <Empty tab="ulasan" />}
      {rows && rows.length > 0 && (
        <DataPanel pagination={pagination} busy={busy} scroll={false} label={t.moderation.tabs.ulasan}>
          <ul className="plain grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((r) => (
              <li key={r.id} className="grid content-start gap-2 rounded-2xl border border-line bg-white p-3">
                <p className="m-0 flex flex-wrap items-center gap-2">
                  <Stars value={r.rating} />
                  {r.sample && <span className="badge">{t.reviews.sample}</span>}
                </p>
                <p className="small m-0">
                  <strong>{t.reviews.moderation.facility}:</strong>{' '}
                  <Link href={`/faskes/${r.facilitySlug}`} target="_blank">
                    {r.facilityName}
                  </Link>
                </p>
                <p className="small m-0">
                  <strong>{t.reviews.moderation.author}:</strong> {r.authorName ?? t.reviews.sample}
                </p>
                {Object.keys(r.aspects).length > 0 && (
                  <ul className="plain flex flex-wrap gap-1.5">
                    {Object.entries(r.aspects).map(([aspect, value]) => (
                      <li key={aspect} className={cn('badge', value === 'kurang' && 'badge-stale')}>
                        {t.reviews.aspects[aspect]}: {t.reviews.aspectValue[value]}
                      </li>
                    ))}
                  </ul>
                )}
                {r.comment && <p className="m-0 whitespace-pre-line">{r.comment}</p>}
                <p className="small muted m-0">{formatDateTime(r.updatedAt)}</p>
                {r.rejectionReason && (
                  <p className="small m-0">
                    <strong>{t.admin.reasonLabel}:</strong> {r.rejectionReason}
                  </p>
                )}
                {r.status === 'pending' && (
                  <>
                    <button type="button" className="btn-primary justify-self-start" disabled={working === r.id} onClick={() => void decide(r.id, 'approve')}>
                      {t.admin.approve}
                    </button>
                    <RejectForm compact busy={working === r.id} onReject={(reason) => void decide(r.id, 'reject', { reason })} />
                  </>
                )}
              </li>
            ))}
          </ul>
        </DataPanel>
      )}
    </>
  );
}

/* ---------- Harga ---------- */

interface PriceRequestRow {
  id: string;
  kind: 'tunggal' | 'impor';
  status: string;
  serviceName: string | null;
  package: { name: string } | null;
  importRows: number | null;
  priceType: PriceType | null;
  priceMin: number | null;
  priceMax: number | null;
  documentCount: number;
  createdAt: string;
  facilityName: string;
  submitterEmail: string | null;
}

function PriceRequests() {
  const [status, setStatus] = useState<string>('pending');
  const { rows, busy, pagination, error } = useAdminList<PriceRequestRow>(`/admin/tariff-requests?status=${status}`);
  return (
    <>
      <StatusFilter value={status} options={REVIEW_STATUSES} onChange={setStatus} labels={t.priceRequest.status} />
      {error && <p className="error">{error}</p>}
      {rows === null && !error && <LoadingTable cols={5} />}
      {rows?.length === 0 && <Empty tab="harga" />}
      {rows && rows.length > 0 && (
        <DataPanel pagination={pagination} busy={busy} label={t.moderation.tabs.harga}>
          <table>
            <thead>
              <tr>
                <th scope="col">{t.admin.facilities}</th>
                <th scope="col">{t.moderation.newPrice}</th>
                <th scope="col">{t.admin.documents}</th>
                <th scope="col">{t.common.date}</th>
                <th scope="col">
                  <span className="sr-only">{t.common.action}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row">
                    {r.facilityName}
                    <div className="small muted font-normal">{r.submitterEmail ?? ''}</div>
                  </th>
                  <td>
                    {r.kind === 'impor' ? (
                      <>
                        {t.priceRequest.kind.impor}
                        {r.importRows !== null && <div className="small muted">{t.priceRequest.rows(r.importRows)}</div>}
                      </>
                    ) : (
                      <>
                        {r.package?.name ? `${r.package.name} (${r.serviceName})` : r.serviceName}
                        {r.priceType && <div className="small">{formatPrice({ type: r.priceType, min: r.priceMin, max: r.priceMax })}</div>}
                      </>
                    )}
                  </td>
                  <td className={cn('tabular-nums', r.documentCount === 0 && 'text-danger')}>{r.documentCount}</td>
                  <td className="whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                  <td className="text-right">
                    <Link href={`/admin/moderasi/harga/${r.id}`} className={buttonVariants({ size: 'sm' })}>
                      {t.moderation.open}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataPanel>
      )}
    </>
  );
}

/* ---------- Artikel mitra (Fase 4, F-05) ---------- */

function Articles() {
  const [status, setStatus] = useState<string>('pending');
  const { rows, busy, pagination, error } = useAdminList<AdminArticleListItem>(`/admin/articles?status=${status}`);
  return (
    <>
      <StatusFilter value={status} options={ARTICLE_STATUSES} onChange={setStatus} labels={t.articleEditor.status} />
      {error && <p className="error">{error}</p>}
      {rows === null && !error && <LoadingTable cols={4} />}
      {rows?.length === 0 && <Empty tab="artikel" />}
      {rows && rows.length > 0 && (
        <DataPanel pagination={pagination} busy={busy} label={t.moderation.tabs.artikel}>
          <table>
            <thead>
              <tr>
                <th scope="col">{t.articleEditor.fieldTitle}</th>
                <th scope="col">{t.moderation.articleAuthor}</th>
                <th scope="col">{t.common.date}</th>
                <th scope="col">
                  <span className="sr-only">{t.common.action}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <th scope="row">
                    {a.title}
                    <div className="small muted font-normal">
                      {a.revision ? t.moderation.articleRevision : t.moderation.articleNew}
                      {a.needsReview && <span className="badge badge-stale ml-2">{t.moderation.articleFlagged}</span>}
                    </div>
                  </th>
                  <td className="small">
                    {a.author.name}
                    <div className="muted">{t.partner.types[a.author.partnerType] ?? a.author.partnerType}</div>
                  </td>
                  <td className="whitespace-nowrap">{formatDateTime(a.submittedAt ?? a.updatedAt)}</td>
                  <td className="text-right">
                    <Link href={`/admin/moderasi/artikel/${a.id}`} className={buttonVariants({ size: 'sm' })}>
                      {t.moderation.open}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataPanel>
      )}
    </>
  );
}
