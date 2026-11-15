import {
  profileReadiness,
  profileTypeForPartner,
  revisionPayloadSchema,
  type FacilityUpdateInput,
  type LocationInput,
  type ProfileCreateInput,
  type ReviewStatus,
  type RevisionPayload,
} from '@silk/shared';
import type { DbOrTx } from '@silk/db';
import { db } from '../../lib/db';
import type { ActorContext } from '../../lib/context';
import { AppError, notFound } from '../../lib/errors';
import { decodeOffsetCursor, pageOf } from '../../lib/pagination';
import { revalidate, tags } from '../../lib/revalidate';
import { revalidatePractitionersOfFacilities } from '../m1-directory/practitioner-cache';
import { recordAudit } from '../m15-admin/audit.repo';
import { assertContentAllowed } from '../m17-content-rules/content-rules.service';
import { addMembership, findFacility } from '../m6-portal/portal.repo';
import { mediaForOwner } from './media.service';
import { assertMember, assertVerifiedPartner } from './profiles.guard';
import * as repo from './profiles.repo';

export function slugify(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/\p{M}+/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80)
      .replace(/-$/, '') || 'profil'
  );
}

/* ---------- Teks publik dan validasi silang ---------- */

/** Semua teks publik di payload profil, untuk filter konten M17. */
function contentFieldsOf(p: RevisionPayload | ProfileCreateInput): Record<string, string | null | undefined> {
  const fields: Record<string, string | null | undefined> = { name: p.name, description: p.description };
  p.locations?.forEach((l, i) => {
    fields[`locations.${i}.label`] = l.label;
    fields[`locations.${i}.address`] = l.address;
  });
  p.schedules?.forEach((s, i) => {
    fields[`schedules.${i}.note`] = s.note;
  });
  if ('hours' in p && p.hours) for (const [day, text] of Object.entries(p.hours)) fields[`hours.${day}`] = text;
  return fields;
}

/** Jadwal praktik hanya boleh merujuk tenaga medis yang terhubung dengan profil ini. */
async function checkPractitioners(database: DbOrTx, facilityId: string, p: Pick<RevisionPayload, 'schedules'>) {
  const ids = [...new Set((p.schedules ?? []).flatMap((s) => (s.practitionerId ? [s.practitionerId] : [])))];
  if (ids.length === 0) return;
  const linked = new Set(await repo.linkedPractitionerIds(database, facilityId));
  const bad = ids.filter((id) => !linked.has(id));
  if (bad.length) {
    throw new AppError('VALIDATION_FAILED', 'Tenaga medis pada jadwal tidak terhubung dengan profil ini', [
      { path: 'schedules', message: 'Pilih tenaga medis yang terdaftar di profil ini' },
    ]);
  }
}

/** Lebur field lama address/lat/lng ke lokasi utama agar hanya ada satu bentuk payload. */
async function normalize(database: DbOrTx, facilityId: string, input: FacilityUpdateInput): Promise<RevisionPayload> {
  const { address, lat, lng, ...rest } = input;
  if (address === undefined && lat === undefined) return rest;
  const current: LocationInput[] = (await repo.listLocations(database, facilityId)).map((l) => ({
    label: l.label,
    address: l.address,
    city: l.city,
    province: l.province,
    lat: l.lat,
    lng: l.lng,
    isPrimary: l.isPrimary,
  }));
  let primary = current.find((l) => l.isPrimary);
  if (!primary) {
    const f = await findFacility(database, facilityId);
    if (!f) throw notFound('FACILITY_NOT_FOUND', 'Profil');
    const pLat = lat ?? f.lat;
    const pLng = lng ?? f.lng;
    if (pLat === null || pLng === null) {
      throw new AppError('VALIDATION_FAILED', 'Titik lokasi wajib diisi', [{ path: 'lat', message: 'Pilih titik di peta' }]);
    }
    primary = { label: null, address: f.address, city: f.city, province: f.province, lat: Number(pLat), lng: Number(pLng), isPrimary: true };
    current.unshift(primary);
  }
  if (address !== undefined) primary.address = address;
  if (lat !== undefined && lng !== undefined) {
    primary.lat = lat;
    primary.lng = lng;
  }
  return { ...rest, locations: current };
}

async function applyPayload(database: DbOrTx, facilityId: string, p: RevisionPayload) {
  const { locations, schedules, ...fields } = p;
  await repo.updateProfileFields(database, facilityId, fields);
  if (locations) await repo.replaceLocations(database, facilityId, locations);
  if (schedules) await repo.replaceSchedules(database, facilityId, schedules);
}

async function snapshot(database: DbOrTx, facilityId: string) {
  // Berurutan: di dalam transaksi semua query memakai satu koneksi.
  const facility = await findFacility(database, facilityId);
  const locations = await repo.listLocations(database, facilityId);
  const schedules = await repo.listSchedules(database, facilityId);
  return facility ? { ...facility, locations, schedules } : null;
}

/* ---------- Portal ---------- */

/** Mitra terverifikasi membuat profil draft (K2). Non-faskes maksimal satu profil. */
export async function createProfile(ctx: ActorContext, input: ProfileCreateInput) {
  const partner = await assertVerifiedPartner(ctx);
  await assertContentAllowed(contentFieldsOf(input));
  const type = profileTypeForPartner(partner);
  const primary = input.locations.find((l) => l.isPrimary)!;

  const created = await db().transaction(async (tx) => {
    // Kunci baris mitra: dua permintaan bersamaan tidak bisa sama-sama lolos batas satu profil.
    await repo.lockPartner(tx, partner.id);
    if (partner.partnerType !== 'fasilitas' && (await repo.membershipCount(tx, ctx.actorId!)) > 0) {
      throw new AppError('PROFILE_LIMIT_REACHED', 'Akun mitra ini sudah memiliki profil layanan');
    }
    const slug = await repo.uniqueFacilitySlug(tx, slugify(`${input.name} ${primary.city}`));
    const facility = await repo.insertFacility(tx, {
      slug,
      name: input.name,
      type,
      description: input.description ?? null,
      phone: input.phone ?? null,
      website: input.website ?? null,
      address: primary.address,
      city: primary.city,
      province: primary.province,
    });
    await repo.replaceLocations(tx, facility.id, input.locations);
    await addMembership(tx, ctx.actorId!, facility.id);
    if (partner.partnerType === 'tenaga_medis') {
      const practitionerId =
        partner.practitionerId ??
        (
          await repo.insertPractitioner(tx, {
            slug: await repo.uniquePractitionerSlug(tx, slugify(input.name)),
            name: input.name,
            specialty: partner.specialty,
            strNo: partner.strNo,
          })
        ).id;
      await repo.linkPractitioner(tx, facility.id, practitionerId);
      if (!partner.practitionerId) await repo.setPartnerPractitioner(tx, partner.id, practitionerId);
    }
    // Jadwal sesudah praktisi ditautkan, supaya jadwal praktik bisa merujuk ke praktisi itu.
    if (input.schedules?.length) {
      await checkPractitioners(tx, facility.id, input);
      await repo.replaceSchedules(tx, facility.id, input.schedules);
    }
    const after = await snapshot(tx, facility.id);
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: 'profile.create',
      entity: 'facility',
      entityId: facility.id,
      before: null,
      after,
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    return facility;
  });
  return getProfile(ctx, created.id);
}

/** Profil lengkap untuk pengelolanya: termasuk media yang belum dimoderasi dan revisi menunggu. */
export async function getProfile(ctx: ActorContext, facilityId: string) {
  await assertMember(ctx, facilityId);
  const s = await snapshot(db(), facilityId);
  if (!s) throw notFound('FACILITY_NOT_FOUND', 'Profil');
  const [media, pending, lastDecided, practitionerRows] = await Promise.all([
    mediaForOwner(facilityId),
    repo.pendingRevision(db(), facilityId),
    repo.lastDecidedRevision(db(), facilityId),
    repo.practitionersOfFacility(db(), facilityId),
  ]);
  return {
    ...s,
    updatedAt: s.updatedAt.toISOString(),
    media,
    practitioners: practitionerRows,
    pendingRevision: pending ? revisionView(pending) : null,
    lastRevision: lastDecided ? revisionView(lastDecided) : null,
  };
}

/** Kesiapan profil terhadap USP "tahu biayanya, kenal dokternya, sebelum datang" (hanya untuk anggota profil). */
export async function getReadiness(ctx: ActorContext, facilityId: string) {
  await assertMember(ctx, facilityId);
  const facts = await repo.readinessFacts(db(), facilityId);
  if (!facts) throw notFound('FACILITY_NOT_FOUND', 'Profil');
  return profileReadiness(facts);
}

function revisionView(r: Awaited<ReturnType<typeof repo.pendingRevision>> & object) {
  return {
    id: r.id,
    status: r.status,
    payload: r.payload as RevisionPayload,
    rejectionReason: r.rejectionReason,
    createdAt: r.createdAt.toISOString(),
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
  };
}

/**
 * Ubah profil (K3). Draft dan menunggu tinjauan diterapkan langsung karena belum tampil publik.
 * Profil terbit menjadi revisi: publik tetap melihat data lama sampai moderator menyetujui.
 */
export async function updateProfile(ctx: ActorContext, facilityId: string, input: FacilityUpdateInput) {
  await assertMember(ctx, facilityId);
  await assertVerifiedPartner(ctx);
  const payload = await normalize(db(), facilityId, input);
  const { needsReview } = await assertContentAllowed(contentFieldsOf(payload));
  await checkPractitioners(db(), facilityId, payload);

  const revision = await db().transaction(async (tx) => {
    const f = await repo.lockFacility(tx, facilityId);
    if (!f) throw notFound('FACILITY_NOT_FOUND', 'Profil');
    if (f.status === 'ditarik') throw new AppError('PROFILE_NOT_EDITABLE', 'Profil ini ditarik admin dan tidak dapat diubah');

    if (f.status === 'terbit') {
      const previous = await repo.pendingRevision(tx, facilityId);
      // Usulan baru digabung dengan usulan yang masih menunggu; yang lama menjadi superseded.
      const merged = revisionPayloadSchema.parse({ ...((previous?.payload as object | undefined) ?? {}), ...payload });
      if (previous) await repo.supersedeRevision(tx, previous.id);
      const rev = await repo.insertRevision(tx, { facilityId, payload: merged, submittedBy: ctx.actorId });
      await recordAudit(tx, {
        actorId: ctx.actorId,
        action: 'profile.revision.submit',
        entity: 'profile_revision',
        entityId: rev.id,
        before: previous ? { id: previous.id, payload: previous.payload } : null,
        after: { id: rev.id, facilityId, payload: merged },
        ip: ctx.ip,
        requestId: ctx.requestId,
      });
      return { id: rev.id, status: rev.status };
    }

    const before = await snapshot(tx, facilityId);
    await applyPayload(tx, facilityId, payload);
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: 'facility.update',
      entity: 'facility',
      entityId: facilityId,
      before,
      after: await snapshot(tx, facilityId),
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    return null;
  });
  const profile = await getProfile(ctx, facilityId);
  return { ...profile, needsReview, revision };
}

/** Draft → menunggu tinjauan (K2). Moderator menerbitkan lewat PATCH /admin/facilities/:id. */
export async function submitProfile(ctx: ActorContext, facilityId: string) {
  await assertMember(ctx, facilityId);
  await assertVerifiedPartner(ctx);
  await db().transaction(async (tx) => {
    const f = await repo.lockFacility(tx, facilityId);
    if (!f) throw notFound('FACILITY_NOT_FOUND', 'Profil');
    if (f.status !== 'draft') throw new AppError('CONFLICT', 'Hanya profil draft yang dapat diajukan');
    await repo.updateProfileFields(tx, facilityId, { status: 'menunggu_tinjauan' });
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: 'profile.submit',
      entity: 'facility',
      entityId: facilityId,
      before: { status: f.status },
      after: { status: 'menunggu_tinjauan' },
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
  });
  return getProfile(ctx, facilityId);
}

/* ---------- Admin: moderasi revisi ---------- */

export async function revisionQueue(q: { status: ReviewStatus; q?: string; limit: number; cursor?: string }) {
  const offset = decodeOffsetCursor(q.cursor);
  const rows = await repo.revisionQueue(db(), { status: q.status, q: q.q, limit: q.limit, offset });
  return pageOf(rows, q.limit, offset);
}

/** Data publik saat ini berdampingan dengan usulan, untuk perbandingan oleh moderator. */
export async function revisionDetail(id: string) {
  const rev = await repo.findRevision(db(), id);
  if (!rev) throw notFound('REVISION_NOT_FOUND', 'Revisi');
  const current = await snapshot(db(), rev.facilityId);
  return { ...revisionView(rev), facilityId: rev.facilityId, current };
}

export async function approveRevision(ctx: ActorContext, id: string) {
  const result = await db().transaction(async (tx) => {
    const locked = await repo.lockRevision(tx, id);
    if (!locked) throw notFound('REVISION_NOT_FOUND', 'Revisi');
    if (locked.status !== 'pending') throw new AppError('CONFLICT', 'Revisi sudah diputuskan');
    const rev = (await repo.findRevision(tx, id))!;
    const parsed = revisionPayloadSchema.safeParse(rev.payload);
    if (!parsed.success) throw new AppError('VALIDATION_FAILED', 'Isi revisi tidak valid; tolak revisi ini');
    // Aturan M17 bisa berubah sejak revisi diajukan: periksa ulang saat disetujui.
    await assertContentAllowed(contentFieldsOf(parsed.data), tx);
    await checkPractitioners(tx, rev.facilityId, parsed.data);
    const f = await repo.lockFacility(tx, rev.facilityId);
    if (!f) throw notFound('FACILITY_NOT_FOUND', 'Profil');
    if (f.status === 'ditarik') throw new AppError('PROFILE_NOT_EDITABLE', 'Profil sudah ditarik');
    const before = await snapshot(tx, rev.facilityId);
    await applyPayload(tx, rev.facilityId, parsed.data);
    const after = await snapshot(tx, rev.facilityId);
    const decided = await repo.decideRevision(tx, id, { status: 'approved', reviewedBy: ctx.actorId });
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: 'profile.revision.approve',
      entity: 'profile_revision',
      entityId: id,
      before,
      after: { revision: { id, status: decided.status }, profile: after },
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    return { decided, slug: f.slug, facilityId: rev.facilityId };
  });
  await revalidate([tags.facility(result.slug), tags.facilities, tags.sitemap]);
  await revalidatePractitionersOfFacilities([result.facilityId]);
  return revisionView(result.decided);
}

export async function rejectRevision(ctx: ActorContext, id: string, reason: string) {
  const decided = await db().transaction(async (tx) => {
    const locked = await repo.lockRevision(tx, id);
    if (!locked) throw notFound('REVISION_NOT_FOUND', 'Revisi');
    if (locked.status !== 'pending') throw new AppError('CONFLICT', 'Revisi sudah diputuskan');
    const row = await repo.decideRevision(tx, id, { status: 'rejected', reviewedBy: ctx.actorId, rejectionReason: reason });
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: 'profile.revision.reject',
      entity: 'profile_revision',
      entityId: id,
      before: { status: 'pending' },
      after: { status: 'rejected', rejectionReason: reason },
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    return row;
  });
  return revisionView(decided);
}

/* ---------- Admin: status profil ikut ke praktisi ---------- */

/** Dipanggil setelah admin mengubah status atau koordinat profil (PATCH /admin/facilities/:id). */
export async function afterAdminFacilityUpdate(
  tx: DbOrTx,
  facilityId: string,
  change: { status?: 'draft' | 'menunggu_tinjauan' | 'terbit' | 'ditarik'; lat?: number },
) {
  if (change.status) await repo.syncPartnerPractitioners(tx, facilityId, change.status);
  if (change.lat !== undefined) await repo.syncPrimaryPointFromFacility(tx, facilityId);
}

/* ---------- Publik ---------- */

export async function publicProfileExtras(facilityId: string) {
  const [locations, schedules] = await Promise.all([
    repo.listLocations(db(), facilityId),
    repo.publicSchedules(db(), facilityId),
  ]);
  return {
    locations: locations.map(({ id: _id, ...l }) => l),
    schedules,
  };
}
