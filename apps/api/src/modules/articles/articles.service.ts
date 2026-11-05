import { randomInt } from 'node:crypto';
import {
  ARTICLE_MAX_PENDING,
  articlePlainText,
  articleReadingMinutes,
  articleSubmitContentSchema,
  checkContent,
  parseArticleBody,
  type AdminArticleDetail,
  type AdminArticleListItem,
  type ArticleDraftInput,
  type ArticleStatus,
  type PortalArticle,
  type PublicArticle,
  type PublicArticleSummary,
} from '@silk/shared';
import type { DbOrTx } from '@silk/db';
import { db } from '../../lib/db';
import type { ActorContext } from '../../lib/context';
import { AppError, notFound } from '../../lib/errors';
import { decodeOffsetCursor, pageOf } from '../../lib/pagination';
import { revalidate, tags } from '../../lib/revalidate';
import { recordAudit } from '../m15-admin/audit.repo';
import { assertContentAllowed, checkFields } from '../m17-content-rules/content-rules.service';
import { listActiveRules } from '../m17-content-rules/content-rules.repo';
import { assertVerifiedPartner } from '../profiles/profiles.guard';
import { slugify } from '../profiles/profiles.service';
import * as repo from './articles.repo';
import type { ArticleRow, AuthorRow, PublicRow } from './articles.repo';

/* ---------- Bantuan ---------- */

const SUFFIX_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
/** Akhiran acak agar slug artikel mitra tidak bertabrakan dengan slug editorial Sanity (A1). */
const slugFor = (title: string) =>
  `${slugify(title).slice(0, 70).replace(/-$/, '') || 'artikel'}-${Array.from({ length: 4 }, () => SUFFIX_ALPHABET[randomInt(SUFFIX_ALPHABET.length)]).join('')}`;

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** Kolom yang diperiksa M17: teks polos isi, bukan sintaks Markdown. */
const contentFields = (a: { title: string; summary: string; body: string }) => ({
  title: a.title,
  summary: a.summary,
  body: articlePlainText(a.body),
});

const hasPublished = (a: ArticleRow) => a.publishedBody !== null;

function portalView(a: ArticleRow, partnerVerified: boolean): PortalArticle {
  return {
    id: a.id,
    slug: a.slug,
    status: a.status,
    title: a.title,
    summary: a.summary,
    body: a.body,
    published: hasPublished(a) ? { title: a.publishedTitle!, summary: a.publishedSummary!, body: a.publishedBody! } : null,
    firstPublishedAt: iso(a.firstPublishedAt),
    publishedUpdatedAt: iso(a.publishedUpdatedAt),
    submittedAt: iso(a.submittedAt),
    reviewedAt: iso(a.reviewedAt),
    rejectionReason: a.rejectionReason,
    withdrawnReason: a.withdrawnReason,
    needsReview: a.needsReview,
    live: hasPublished(a) && a.withdrawnAt === null && partnerVerified,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

const authorView = (r: AuthorRow) => ({ name: r.author_name, partnerType: r.partner_type, profilePath: r.profile_path });

const articleTags = (slug: string) => [tags.articles, tags.article(slug), tags.sitemap];

/** Pastikan isi lengkap sebelum masuk antrean; pesan per kolom untuk formulir. */
function assertSubmittable(a: { title: string; summary: string; body: string }) {
  const parsed = articleSubmitContentSchema.safeParse(a);
  if (!parsed.success) {
    throw new AppError(
      'VALIDATION_FAILED',
      'Artikel belum lengkap untuk diajukan',
      parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
}

async function assertPendingRoom(tx: DbOrTx, partnerId: string, articleId: string) {
  if ((await repo.countPending(tx, partnerId, articleId)) >= ARTICLE_MAX_PENDING) {
    throw new AppError('ARTICLE_PENDING_LIMIT', `Maksimal ${ARTICLE_MAX_PENDING} artikel menunggu tinjauan sekaligus`);
  }
}

/** Kunci baris dan pastikan milik mitra ini; artikel mitra lain dibalas 404 agar tidak bisa ditebak. */
async function lockOwned(tx: DbOrTx, id: string, partnerId: string): Promise<ArticleRow> {
  const a = await repo.lockArticle(tx, id);
  if (!a || a.partnerId !== partnerId) throw notFound('ARTICLE_NOT_FOUND', 'Artikel');
  return a;
}

const notEditable = (msg: string) => new AppError('ARTICLE_NOT_EDITABLE', msg);

function audit(tx: DbOrTx, ctx: ActorContext, action: string, a: ArticleRow, before: unknown, after: unknown) {
  return recordAudit(tx, { actorId: ctx.actorId, action, entity: 'partner_article', entityId: a.id, before, after, ip: ctx.ip, requestId: ctx.requestId });
}

/** Ringkasan untuk audit: tanpa isi lengkap agar log tidak membengkak. */
const auditState = (a: ArticleRow) => ({ status: a.status, title: a.title, bodyLength: a.body.length, slug: a.slug });

/* ---------- Portal mitra ---------- */

export async function listMine(ctx: ActorContext): Promise<PortalArticle[]> {
  const partner = await assertVerifiedPartner(ctx);
  return (await repo.listByPartner(db(), partner.id)).map((a) => portalView(a, true));
}

export async function getMine(ctx: ActorContext, id: string): Promise<PortalArticle> {
  const partner = await assertVerifiedPartner(ctx);
  const a = await repo.findArticle(db(), id);
  if (!a || a.partnerId !== partner.id) throw notFound('ARTICLE_NOT_FOUND', 'Artikel');
  return portalView(a, true);
}

export async function create(ctx: ActorContext, input: ArticleDraftInput): Promise<PortalArticle> {
  const partner = await assertVerifiedPartner(ctx);
  const row = await db().transaction(async (tx) => {
    const a = await repo.insertArticle(tx, {
      partnerId: partner.id,
      authorUserId: ctx.actorId,
      slug: slugFor(input.title),
      title: input.title,
      summary: input.summary,
      body: input.body,
    });
    await audit(tx, ctx, 'article.create', a, null, auditState(a));
    return a;
  });
  return portalView(row, true);
}

/**
 * Ubah salinan kerja. Draf, ditolak, dan ditarik → draf. Menunggu tetap menunggu (diperiksa ulang).
 * Artikel terbit → menunggu (prompt fase 4); versi terbit tetap tampil sampai perubahan disetujui.
 */
export async function update(ctx: ActorContext, id: string, input: ArticleDraftInput): Promise<PortalArticle> {
  const partner = await assertVerifiedPartner(ctx);
  const row = await db().transaction(async (tx) => {
    const a = await lockOwned(tx, id, partner.id);
    const content = { title: input.title, summary: input.summary, body: input.body };
    let status: ArticleStatus = 'draft';
    let review: Partial<ArticleRow> = {};
    if (a.status === 'pending' || a.status === 'published') {
      if (a.status === 'published' && input.declaration !== true) {
        throw new AppError('VALIDATION_FAILED', 'Centang pernyataan untuk mengajukan perubahan artikel terbit', [
          { path: 'declaration', message: 'Wajib dicentang' },
        ]);
      }
      assertSubmittable(content);
      const { needsReview } = await assertContentAllowed(contentFields(content), tx);
      if (a.status === 'published') await assertPendingRoom(tx, partner.id, a.id);
      status = 'pending';
      review = {
        needsReview,
        submittedAt: a.status === 'published' ? new Date() : a.submittedAt,
        ...(a.status === 'published' ? { declarationAt: new Date(), rejectionReason: null } : {}),
      };
    }
    const next = await repo.updateArticle(tx, a.id, { ...content, status, ...review });
    await audit(tx, ctx, 'article.update', next, auditState(a), auditState(next));
    return next;
  });
  return portalView(row, true);
}

export async function submit(ctx: ActorContext, id: string): Promise<PortalArticle> {
  const partner = await assertVerifiedPartner(ctx);
  const row = await db().transaction(async (tx) => {
    const a = await lockOwned(tx, id, partner.id);
    if (a.status !== 'draft' && a.status !== 'rejected' && a.status !== 'withdrawn') {
      throw notEditable(a.status === 'pending' ? 'Artikel sudah menunggu tinjauan' : 'Artikel terbit diajukan ulang dengan mengubah isinya');
    }
    assertSubmittable(a);
    const { needsReview } = await assertContentAllowed(contentFields(a), tx);
    await assertPendingRoom(tx, partner.id, a.id);
    const now = new Date();
    const next = await repo.updateArticle(tx, a.id, {
      status: 'pending',
      submittedAt: now,
      declarationAt: now,
      needsReview,
      rejectionReason: null,
      withdrawnReason: null,
    });
    await audit(tx, ctx, 'article.submit', next, auditState(a), { ...auditState(next), needsReview });
    return next;
  });
  return portalView(row, true);
}

export async function withdrawMine(ctx: ActorContext, id: string, reason: string | undefined): Promise<PortalArticle> {
  const partner = await assertVerifiedPartner(ctx);
  const row = await withdraw(ctx, id, reason ?? null, partner.id);
  return portalView(row, true);
}

export async function deleteMine(ctx: ActorContext, id: string): Promise<{ deleted: true }> {
  const partner = await assertVerifiedPartner(ctx);
  await db().transaction(async (tx) => {
    const a = await lockOwned(tx, id, partner.id);
    if (a.firstPublishedAt) throw notEditable('Artikel yang pernah terbit tidak bisa dihapus; tarik artikel ini');
    await repo.deleteArticle(tx, a.id);
    await audit(tx, ctx, 'article.delete', a, auditState(a), null);
  });
  return { deleted: true };
}

/** Tarik oleh mitra (partnerId terisi) atau moderator (partnerId null, alasan wajib di skema). */
async function withdraw(ctx: ActorContext, id: string, reason: string | null, partnerId: string | null): Promise<ArticleRow> {
  const next = await db().transaction(async (tx) => {
    const a = partnerId ? await lockOwned(tx, id, partnerId) : await repo.lockArticle(tx, id);
    if (!a) throw notFound('ARTICLE_NOT_FOUND', 'Artikel');
    // Bisa ditarik bila sedang menunggu, atau versi terbitnya masih tampil (termasuk saat revisinya ditolak).
    if (a.status !== 'pending' && !(hasPublished(a) && a.withdrawnAt === null)) {
      throw notEditable('Hanya artikel yang tampil atau menunggu tinjauan yang bisa ditarik');
    }
    const row = await repo.updateArticle(tx, a.id, {
      status: 'withdrawn',
      withdrawnReason: reason,
      withdrawnAt: new Date(),
      ...(partnerId ? {} : { reviewedBy: ctx.actorId, reviewedAt: new Date() }),
    });
    await audit(tx, ctx, partnerId ? 'article.withdraw' : 'article.staff_withdraw', row, auditState(a), { ...auditState(row), reason });
    return row;
  });
  if (hasPublished(next)) await revalidate(articleTags(next.slug));
  return next;
}

/* ---------- Moderasi ---------- */

export async function queue(q: { status: ArticleStatus; limit: number; cursor?: string }) {
  const offset = decodeOffsetCursor(q.cursor);
  const rows = await repo.queue(db(), { status: q.status, limit: q.limit, offset });
  const page = pageOf(rows, q.limit, offset);
  const items: AdminArticleListItem[] = page.items.map((r) => ({
    id: r.id,
    slug: r.slug,
    status: r.status,
    title: r.title,
    needsReview: r.needs_review,
    revision: r.revision,
    submittedAt: r.submitted_at ? new Date(r.submitted_at).toISOString() : null,
    updatedAt: new Date(r.updated_at).toISOString(),
    author: authorView(r),
  }));
  return { items, nextCursor: page.nextCursor };
}

export async function detail(id: string): Promise<AdminArticleDetail> {
  const a = await repo.findArticle(db(), id);
  const author = a ? await repo.authorOf(db(), id) : null;
  if (!a || !author) throw notFound('ARTICLE_NOT_FOUND', 'Artikel');
  const check = await checkFields(contentFields(a));
  return {
    ...portalView(a, author.partner_status === 'verified'),
    author: authorView(author),
    violations: check.violations.map((v) => ({ field: v.field ?? '', match: v.match, level: v.level })),
  };
}

export async function approve(ctx: ActorContext, id: string): Promise<AdminArticleDetail> {
  const row = await db().transaction(async (tx) => {
    const a = await repo.lockArticle(tx, id);
    if (!a) throw notFound('ARTICLE_NOT_FOUND', 'Artikel');
    if (a.status !== 'pending') throw notEditable('Hanya artikel yang menunggu tinjauan yang bisa disetujui');
    if (!(await repo.partnerIsVerified(tx, a.partnerId))) throw new AppError('PARTNER_NOT_VERIFIED', 'Mitra penulis tidak lagi terverifikasi');
    assertSubmittable(a);
    // Aturan M17 bisa berubah sejak diajukan.
    await assertContentAllowed(contentFields(a), tx);
    const now = new Date();
    const next = await repo.updateArticle(tx, a.id, {
      status: 'published',
      publishedTitle: a.title,
      publishedSummary: a.summary,
      publishedBody: a.body,
      firstPublishedAt: a.firstPublishedAt ?? now,
      publishedUpdatedAt: now,
      reviewedAt: now,
      reviewedBy: ctx.actorId,
      rejectionReason: null,
      withdrawnReason: null,
      withdrawnAt: null,
      needsReview: false,
    });
    await audit(tx, ctx, 'article.approve', next, auditState(a), auditState(next));
    return next;
  });
  await revalidate(articleTags(row.slug));
  return detail(row.id);
}

export async function reject(ctx: ActorContext, id: string, reason: string): Promise<AdminArticleDetail> {
  const row = await db().transaction(async (tx) => {
    const a = await repo.lockArticle(tx, id);
    if (!a) throw notFound('ARTICLE_NOT_FOUND', 'Artikel');
    if (a.status !== 'pending') throw notEditable('Hanya artikel yang menunggu tinjauan yang bisa ditolak');
    const next = await repo.updateArticle(tx, a.id, { status: 'rejected', rejectionReason: reason, reviewedAt: new Date(), reviewedBy: ctx.actorId });
    await audit(tx, ctx, 'article.reject', next, auditState(a), { ...auditState(next), reason });
    return next;
  });
  // Tolak tidak mengubah apa yang tampil publik: tanpa revalidate.
  return detail(row.id);
}

export async function staffWithdraw(ctx: ActorContext, id: string, reason: string): Promise<AdminArticleDetail> {
  const row = await withdraw(ctx, id, reason, null);
  return detail(row.id);
}

/** Dipanggil saat status mitra berubah: artikelnya ikut tampil/tersembunyi. */
export async function revalidatePartnerArticles(partnerId: string, database: DbOrTx = db()): Promise<void> {
  const slugs = await repo.liveSlugsOfPartner(database, partnerId);
  if (slugs.length) await revalidate([tags.articles, tags.sitemap, ...slugs.map(tags.article)]);
}

/* ---------- Publik ---------- */

function publicSummary(r: PublicRow): PublicArticleSummary {
  return {
    slug: r.slug,
    title: r.published_title,
    description: r.published_summary,
    publishedAt: r.first_published_at,
    updatedAt: r.published_updated_at,
    readingMinutes: articleReadingMinutes(r.published_body),
    author: authorView(r),
  };
}

/** Aturan M17 dibaca sekali per permintaan; artikel yang kini melanggar `blokir` disembunyikan. */
async function notBlocked(rows: PublicRow[]): Promise<PublicRow[]> {
  if (rows.length === 0) return rows;
  const rules = await listActiveRules(db());
  return rows.filter(
    (r) => !checkContent(contentFields({ title: r.published_title, summary: r.published_summary, body: r.published_body }), rules).blocked,
  );
}

export async function publicList(q: { limit: number; cursor?: string }) {
  const offset = decodeOffsetCursor(q.cursor);
  const page = pageOf(await repo.publicList(db(), { limit: q.limit, offset }), q.limit, offset);
  return { items: (await notBlocked(page.items)).map(publicSummary), nextCursor: page.nextCursor };
}

export async function publicGet(slug: string): Promise<PublicArticle> {
  const row = await repo.publicBySlug(db(), slug);
  const [visible] = row ? await notBlocked([row]) : [];
  if (!visible) throw notFound('ARTICLE_NOT_FOUND', 'Artikel');
  return { ...publicSummary(visible), body: parseArticleBody(visible.published_body) };
}
