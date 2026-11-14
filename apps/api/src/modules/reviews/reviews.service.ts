import {
  REVIEW_DECLARATION_VERSION,
  shortAuthorName,
  summarizeReviews,
  type ReviewAspects,
  type ReviewInput,
  type ReviewStatus,
} from '@silk/shared';
import { db } from '../../lib/db';
import type { ActorContext } from '../../lib/context';
import { AppError, notFound } from '../../lib/errors';
import { decodeOffsetCursor, pageOf } from '../../lib/pagination';
import { revalidate, tags } from '../../lib/revalidate';
import { recordAudit } from '../m15-admin/audit.repo';
import { findPublishedFacilityBySlug } from '../m1-directory/directory.repo';
import { revalidatePractitionersOfFacilities } from '../m1-directory/practitioner-cache';
import { assertContentAllowed } from '../m17-content-rules/content-rules.service';
import * as repo from './reviews.repo';

/**
 * Ulasan pengalaman (Fase 6 ramping, evaluasi USP R8). Semua rute di balik flag `reviews_enabled`.
 * Pra-moderasi: hanya ulasan disetujui yang tampil; komentar lewat M17. Rating tidak pernah urutan bawaan.
 */

const asAspects = (v: unknown): ReviewAspects => (v && typeof v === 'object' ? (v as ReviewAspects) : {});

async function publishedFacility(slug: string) {
  const f = await findPublishedFacilityBySlug(db(), slug);
  if (!f) throw notFound('FACILITY_NOT_FOUND', 'Faskes');
  return f;
}

async function revalidateFacility(facilityId: string) {
  const f = await repo.facilityOf(db(), facilityId);
  if (f?.status !== 'terbit') return;
  await revalidate([tags.facility(f.slug)]);
  // Ringkasan ulasan profil praktik juga tampil di halaman dokter.
  await revalidatePractitionersOfFacilities([facilityId]);
}

function myView(r: repo.ReviewRow) {
  return {
    id: r.id,
    rating: r.rating,
    aspects: asAspects(r.aspects),
    comment: r.comment,
    status: r.status,
    rejectionReason: r.rejectionReason,
    updatedAt: r.updatedAt.toISOString(),
  };
}

/* ---------- Publik ---------- */

export async function publicReviews(slug: string, q: { limit: number; cursor?: string }) {
  const f = await publishedFacility(slug);
  const offset = decodeOffsetCursor(q.cursor);
  const [all, rows] = await Promise.all([repo.approvedForSummary(db(), f.id), repo.approvedPage(db(), f.id, { limit: q.limit, offset })]);
  const page = pageOf(rows, q.limit, offset);
  return {
    summary: summarizeReviews(all.map((r) => ({ rating: r.rating, aspects: asAspects(r.aspects), sample: r.sample }))),
    items: page.items.map((r) => ({
      id: r.id,
      rating: r.rating,
      aspects: asAspects(r.aspects),
      comment: r.comment,
      sample: r.sample,
      authorName: r.sample ? null : shortAuthorName(r.authorName),
      createdAt: r.createdAt.toISOString(),
    })),
    nextCursor: page.nextCursor,
  };
}

/* ---------- Pasien ---------- */

export async function mine(ctx: ActorContext, slug: string) {
  const f = await publishedFacility(slug);
  const row = await repo.findMine(db(), ctx.actorId!, f.id);
  return row ? myView(row) : null;
}

export async function upsertMine(ctx: ActorContext, slug: string, input: ReviewInput) {
  const f = await publishedFacility(slug);
  await assertContentAllowed({ comment: input.comment });
  const { before, row } = await db().transaction(async (tx) => {
    const before = await repo.findMine(tx, ctx.actorId!, f.id);
    const row = await repo.upsertMine(tx, {
      authorId: ctx.actorId!,
      facilityId: f.id,
      rating: input.rating,
      aspects: input.aspects,
      comment: input.comment,
      declarationVersion: REVIEW_DECLARATION_VERSION,
    });
    if (before?.status === 'approved') await repo.refreshRating(tx, f.id);
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: before ? 'review.update' : 'review.create',
      entity: 'review',
      entityId: row.id,
      before: before ? { rating: before.rating, aspects: before.aspects, comment: before.comment, status: before.status } : null,
      after: { facilityId: f.id, rating: row.rating, aspects: row.aspects, comment: row.comment, status: row.status, declarationVersion: REVIEW_DECLARATION_VERSION },
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    return { before, row };
  });
  // Ulasan yang sudah tampil kembali ke antrean: halaman publik harus berhenti menampilkannya.
  if (before?.status === 'approved') await revalidateFacility(f.id);
  return myView(row);
}

export async function deleteMine(ctx: ActorContext, slug: string) {
  const f = await publishedFacility(slug);
  const removed = await db().transaction(async (tx) => {
    const row = await repo.findMine(tx, ctx.actorId!, f.id);
    if (!row) throw notFound('NOT_FOUND', 'Ulasan');
    await repo.deleteReview(tx, row.id);
    if (row.status === 'approved') await repo.refreshRating(tx, f.id);
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: 'review.delete',
      entity: 'review',
      entityId: row.id,
      before: { facilityId: f.id, rating: row.rating, status: row.status },
      after: null,
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    return row;
  });
  if (removed.status === 'approved') await revalidateFacility(f.id);
  return { id: removed.id, deleted: true };
}

/* ---------- Moderator ---------- */

export async function queue(q: { status: ReviewStatus; q?: string; limit: number; cursor?: string }) {
  const offset = decodeOffsetCursor(q.cursor);
  const rows = await repo.queue(db(), { status: q.status, q: q.q, limit: q.limit, offset });
  const page = pageOf(rows, q.limit, offset);
  return {
    items: page.items.map((r) => ({
      ...r,
      aspects: asAspects(r.aspects),
      // Moderator melihat nama lengkap penulis; publik hanya nama singkat.
      authorName: r.authorName ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    nextCursor: page.nextCursor,
  };
}

async function decideReview(ctx: ActorContext, id: string, status: 'approved' | 'rejected', reason: string | null) {
  const row = await db().transaction(async (tx) => {
    const locked = await repo.lockReview(tx, id);
    if (!locked) throw notFound('NOT_FOUND', 'Ulasan');
    if (locked.status !== 'pending') throw new AppError('CONFLICT', 'Ulasan sudah diputuskan');
    const decided = await repo.decide(tx, id, { status, reviewedBy: ctx.actorId, rejectionReason: reason });
    await repo.refreshRating(tx, decided.facilityId);
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: status === 'approved' ? 'review.approve' : 'review.reject',
      entity: 'review',
      entityId: id,
      before: { status: 'pending' },
      after: { status, ...(reason ? { rejectionReason: reason } : {}) },
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    return decided;
  });
  if (status === 'approved') await revalidateFacility(row.facilityId);
  return myView(row);
}

export const approve = (ctx: ActorContext, id: string) => decideReview(ctx, id, 'approved', null);
export const reject = (ctx: ActorContext, id: string, reason: string) => decideReview(ctx, id, 'rejected', reason);
