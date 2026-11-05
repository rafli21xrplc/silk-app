import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { and, eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { auditLogs, facilityPractitioners, partners, practitioners, services } from '@silk/db';
import { FACILITY_IDS, TARIFF_IDS } from '@silk/db/seed';
import { PHOTO_MAX_BYTES, PHOTO_MAX_COUNT, VIDEO_MAX_BYTES } from '@silk/shared';
import { db } from '../src/lib/db';
import {
  JPEG_BYTES,
  attachProof,
  createUser,
  getApp,
  mp4Bytes,
  resetDb,
  send,
  uploadTo,
  type TestUser,
} from './helpers';

const PRATAMA_SLUG = 'klinik-pratama-sehat-contoh';
const LOC = { label: 'Studio utama', address: 'Jl. Ijen No. 10', city: 'Kota Malang', province: 'Jawa Timur', lat: -7.97, lng: 112.62, isPrimary: true };

async function count(query: ReturnType<typeof sql>): Promise<number> {
  const r = await db().execute<{ n: number }>(query);
  return r.rows[0]!.n;
}
const versionCount = () => count(sql`SELECT count(*)::int AS n FROM tariff_versions`);
const publishedFor = (tariffId: string) => count(sql`SELECT count(*)::int AS n FROM published_tariffs WHERE tariff_id = ${tariffId}`);
const publicDetail = async (slug: string) => (await request(getApp()).get(`/v1/facilities/${slug}`)).body.data;

async function createProfile(u: TestUser, name: string, extra: Record<string, unknown> = {}) {
  return send(u, 'post', '/v1/portal/profiles').send({ name, locations: [LOC], ...extra });
}

async function uploadMedia(u: TestUser, facilityId: string, body: Record<string, unknown>, bytes: Buffer) {
  const presign = await send(u, 'post', `/v1/portal/facilities/${facilityId}/media/presign`).send(body);
  expect(presign.status, JSON.stringify(presign.body)).toBe(201);
  const put = await uploadTo(presign.body.data, bytes);
  expect(put.status).toBe(200);
  return send(u, 'post', `/v1/portal/facilities/${facilityId}/media/${presign.body.data.mediaId}/confirm`);
}

describe('Fase 2: profil layanan, jadwal, media, harga', () => {
  let faskes: TestUser;
  let other: TestUser;
  let gaya: TestUser;
  let medis: TestUser;
  let moderator: TestUser;
  let gayaProfile: { id: string; slug: string };

  beforeAll(async () => {
    await resetDb();
    faskes = await createUser({ facilityIds: [FACILITY_IDS.klinikPratama], partner: { type: 'fasilitas' } });
    other = await createUser({ facilityIds: [FACILITY_IDS.labMedika], partner: { type: 'fasilitas', facilityKind: 'laboratorium' } });
    gaya = await createUser({ partner: { type: 'gaya_hidup' } });
    medis = await createUser({ partner: { type: 'tenaga_medis' } });
    moderator = await createUser({ role: 'moderator', mfa: true });
  });

  describe('membuat profil (K1, K2)', () => {
    it('mitra yang belum terverifikasi tidak bisa membuat profil', async () => {
      const pending = await createUser({ partner: { type: 'apotek', status: 'pending' } });
      const res = await createProfile(pending, 'Apotek Uji Menunggu');
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PARTNER_NOT_VERIFIED');
    });

    it('mitra gaya hidup membuat profil draft bertipe gaya_hidup dengan lokasi utama', async () => {
      const res = await createProfile(gaya, 'Studio Sehat Uji', { description: 'Kelas senam dan konsultasi gizi' });
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      expect(res.body.data).toMatchObject({ type: 'gaya_hidup', status: 'draft', city: 'Kota Malang' });
      expect(res.body.data.locations).toHaveLength(1);
      gayaProfile = { id: res.body.data.id, slug: res.body.data.slug };
      // /me memuat profil ini untuk mitra non-faskes (dipakai portal web)
      const me = await gaya.agent.get('/v1/me');
      expect(me.body.data.memberships).toEqual([expect.objectContaining({ id: gayaProfile.id, type: 'gaya_hidup', status: 'draft' })]);
      // Draft tidak tampil publik
      expect((await request(getApp()).get(`/v1/facilities/${gayaProfile.slug}`)).status).toBe(404);
    });

    it('non-faskes tidak bisa membuat profil kedua', async () => {
      const res = await createProfile(gaya, 'Studio Sehat Kedua');
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PROFILE_LIMIT_REACHED');
    });

    it('mitra faskes boleh membuat profil baru walau sudah mengelola faskes lain', async () => {
      const res = await createProfile(faskes, 'Klinik Cabang Uji Sejahtera');
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      expect(res.body.data.type).toBe('klinik');
    });

    it('tenaga medis: profil praktik_dokter tertaut ke satu praktisi; jadwal praktik merujuk praktisi itu', async () => {
      const res = await createProfile(medis, 'dr. Uji Praktik');
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      expect(res.body.data.type).toBe('praktik_dokter');
      const [link] = await db().select().from(facilityPractitioners).where(eq(facilityPractitioners.facilityId, res.body.data.id));
      const [partner] = await db().select().from(partners).where(eq(partners.userId, medis.id));
      expect(partner!.practitionerId).toBe(link!.practitionerId);
      const [p] = await db().select().from(practitioners).where(eq(practitioners.id, link!.practitionerId));
      expect(p).toMatchObject({ strNo: partner!.strNo, status: 'draft' });

      const ok = await send(medis, 'put', `/v1/portal/facilities/${res.body.data.id}`).send({
        schedules: [{ kind: 'praktik', weekday: 2, start: '16:00', end: '20:00', practitionerId: p!.id }],
      });
      expect(ok.status, JSON.stringify(ok.body)).toBe(200);
      expect(ok.body.data.schedules[0]).toMatchObject({ kind: 'praktik', start: '16:00', end: '20:00', timezone: 'Asia/Jakarta' });
      const bad = await send(medis, 'put', `/v1/portal/facilities/${res.body.data.id}`).send({
        schedules: [{ kind: 'praktik', weekday: 2, start: '16:00', end: '20:00', practitionerId: '00000000-0000-4000-8000-000000000000' }],
      });
      expect(bad.status).toBe(400);

      // Diterbitkan moderator: praktisi ikut terbit dan muncul di halaman publik
      expect((await send(medis, 'post', `/v1/portal/facilities/${res.body.data.id}/submit`)).status).toBe(200);
      expect((await send(moderator, 'patch', `/v1/admin/facilities/${res.body.data.id}`).send({ status: 'terbit' })).status).toBe(200);
      const pub = await publicDetail(res.body.data.slug);
      expect(pub.practitioners.map((x: { name: string }) => x.name)).toContain('dr. Uji Praktik');
      expect(pub.schedules[0].practitioner).toMatchObject({ name: 'dr. Uji Praktik' });
    });
  });

  describe('draft, jadwal, lokasi, dan terbit', () => {
    it('draft diubah langsung; jadwal per hari dan lokasi ganda; lokasi utama tersalin ke kolom faskes', async () => {
      const res = await send(gaya, 'put', `/v1/portal/facilities/${gayaProfile.id}`).send({
        locations: [
          { ...LOC, isPrimary: false },
          { label: 'Cabang Dinoyo', address: 'Jl. MT Haryono 5', city: 'Kota Malang', province: 'Jawa Timur', lat: -7.94, lng: 112.61, isPrimary: true },
        ],
        schedules: [
          { kind: 'operasional', weekday: 1, start: '07:00', end: '20:00' },
          { kind: 'operasional', weekday: 6, start: '08:00', end: '14:00', timezone: 'Asia/Jakarta' },
        ],
      });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(res.body.data.revision).toBeNull();
      expect(res.body.data.address).toBe('Jl. MT Haryono 5');
      expect(res.body.data.locations[0]).toMatchObject({ label: 'Cabang Dinoyo', isPrimary: true });
      expect(res.body.data.schedules).toHaveLength(2);
    });

    it('jadwal dengan jam selesai sebelum jam mulai = 400; tepat satu lokasi utama wajib', async () => {
      const a = await send(gaya, 'put', `/v1/portal/facilities/${gayaProfile.id}`).send({
        schedules: [{ kind: 'operasional', weekday: 1, start: '20:00', end: '07:00' }],
      });
      expect(a.status).toBe(400);
      const b = await send(gaya, 'put', `/v1/portal/facilities/${gayaProfile.id}`).send({ locations: [{ ...LOC, isPrimary: false }] });
      expect(b.status).toBe(400);
    });

    it('ajukan terbit → menunggu tinjauan → moderator menerbitkan', async () => {
      const submit = await send(gaya, 'post', `/v1/portal/facilities/${gayaProfile.id}/submit`);
      expect(submit.status).toBe(200);
      expect(submit.body.data.status).toBe('menunggu_tinjauan');
      expect((await send(gaya, 'post', `/v1/portal/facilities/${gayaProfile.id}/submit`)).status).toBe(409);
      expect((await moderator.agent.get('/v1/admin/overview')).body.data.profiles).toBeGreaterThanOrEqual(1);
      const pub = await send(moderator, 'patch', `/v1/admin/facilities/${gayaProfile.id}`).send({ status: 'terbit' });
      expect(pub.status).toBe(200);
      const detail = await publicDetail(gayaProfile.slug);
      expect(detail.type).toBe('gaya_hidup');
      expect(detail.locations).toHaveLength(2);
      expect(detail.schedules.map((s: { weekday: number }) => s.weekday)).toEqual([1, 6]);
    });
  });

  describe('filter konten M17', () => {
    const blocked = [
      ['deskripsi', { description: 'Studio termurah di Malang' }],
      ['label lokasi', { locations: [{ ...LOC, label: 'Cabang termurah' }] }],
      ['catatan jadwal', { schedules: [{ kind: 'operasional', weekday: 1, start: '07:00', end: '09:00', note: 'paling termurah' }] }],
    ] as const;
    for (const [label, body] of blocked) {
      it(`"termurah" di ${label} = 422`, async () => {
        const res = await send(gaya, 'put', `/v1/portal/facilities/${gayaProfile.id}`).send(body);
        expect(res.status).toBe(422);
        expect(res.body.error.code).toBe('CONTENT_RULE_VIOLATION');
      });
    }

    it('"termurah" di rincian tarif = 422', async () => {
      const [svc] = await db().select().from(services).where(eq(services.slug, 'kelas-senam'));
      const res = await send(gaya, 'post', `/v1/portal/facilities/${gayaProfile.id}/tariffs`).send({
        serviceId: svc!.id,
        priceType: 'tetap',
        priceMin: 50000,
        effectiveFrom: '2026-10-01',
        inclusions: 'Kelas termurah',
        sourceTitle: 'Brosur studio',
      });
      expect(res.status).toBe(422);
    });
  });

  describe('revisi profil terbit (K3)', () => {
    let firstId: string;

    it('perubahan menjadi revisi; publik tetap versi lama', async () => {
      const res = await send(gaya, 'put', `/v1/portal/facilities/${gayaProfile.id}`).send({ name: 'Studio Sehat Uji Baru' });
      expect(res.status).toBe(200);
      expect(res.body.data.revision.status).toBe('pending');
      firstId = res.body.data.revision.id;
      expect((await publicDetail(gayaProfile.slug)).name).toBe('Studio Sehat Uji');
    });

    it('revisi kedua menggantikan yang pertama dan menggabungkan isinya', async () => {
      const res = await send(gaya, 'put', `/v1/portal/facilities/${gayaProfile.id}`).send({ description: 'Deskripsi baru' });
      expect(res.body.data.revision.id).not.toBe(firstId);
      expect(res.body.data.pendingRevision.payload).toMatchObject({ name: 'Studio Sehat Uji Baru', description: 'Deskripsi baru' });
      const st = await db().execute<{ status: string }>(sql`SELECT status FROM profile_revisions WHERE id = ${firstId}`);
      expect(st.rows[0]!.status).toBe('superseded');
      const queue = await moderator.agent.get('/v1/admin/profile-revisions');
      expect(queue.body.data.map((r: { id: string }) => r.id)).toEqual([res.body.data.revision.id]);

      const detail = await moderator.agent.get(`/v1/admin/profile-revisions/${res.body.data.revision.id}`);
      expect(detail.body.data.current.name).toBe('Studio Sehat Uji');
      const approve = await send(moderator, 'post', `/v1/admin/profile-revisions/${res.body.data.revision.id}/approve`).send({});
      expect(approve.status, JSON.stringify(approve.body)).toBe(200);
      const pub = await publicDetail(gayaProfile.slug);
      expect(pub).toMatchObject({ name: 'Studio Sehat Uji Baru', description: 'Deskripsi baru' });
    });

    it('revisi ditolak (alasan wajib) tidak mengubah publik', async () => {
      const res = await send(gaya, 'put', `/v1/portal/facilities/${gayaProfile.id}`).send({ phone: '0341-999888' });
      const id = res.body.data.revision.id;
      expect((await send(moderator, 'post', `/v1/admin/profile-revisions/${id}/reject`).send({})).status).toBe(400);
      expect((await send(moderator, 'post', `/v1/admin/profile-revisions/${id}/reject`).send({ reason: 'Nomor tidak dapat dihubungi' })).status).toBe(200);
      expect((await publicDetail(gayaProfile.slug)).phone).toBeNull();
      const portal = await gaya.agent.get(`/v1/portal/facilities/${gayaProfile.id}`);
      expect(portal.body.data.lastRevision).toMatchObject({ status: 'rejected', rejectionReason: 'Nomor tidak dapat dihubungi' });
    });
  });

  describe('media (K8)', () => {
    it('di atas batas ukuran atau MIME salah ditolak saat presign', async () => {
      const url = `/v1/portal/facilities/${gayaProfile.id}/media/presign`;
      const bigPhoto = await send(gaya, 'post', url).send({ kind: 'foto', fileName: 'a.jpg', mime: 'image/jpeg', sizeBytes: PHOTO_MAX_BYTES + 1 });
      expect(bigPhoto.status).toBe(400);
      const bigVideo = await send(gaya, 'post', url).send({ kind: 'video', fileName: 'a.mp4', mime: 'video/mp4', sizeBytes: VIDEO_MAX_BYTES + 1, durationSec: 30 });
      expect(bigVideo.status).toBe(400);
      const longVideo = await send(gaya, 'post', url).send({ kind: 'video', fileName: 'a.mp4', mime: 'video/mp4', sizeBytes: 1000, durationSec: 121 });
      expect(longVideo.status).toBe(400);
      const gif = await send(gaya, 'post', url).send({ kind: 'foto', fileName: 'a.gif', mime: 'image/gif', sizeBytes: 1000 });
      expect(gif.status).toBe(400);
    });

    it('magic bytes salah = 422 dan berkas dibuang', async () => {
      const res = await uploadMedia(gaya, gayaProfile.id, { kind: 'foto', fileName: 'palsu.png', mime: 'image/png', sizeBytes: JPEG_BYTES.length }, JPEG_BYTES);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('MEDIA_INVALID');
    });

    it('MP4 lebih dari 120 detik ditolak walau browser melaporkan lebih pendek', async () => {
      const bytes = mp4Bytes(130);
      const res = await uploadMedia(gaya, gayaProfile.id, { kind: 'video', fileName: 'panjang.mp4', mime: 'video/mp4', sizeBytes: bytes.length, durationSec: 60 }, bytes);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('MEDIA_INVALID');
    });

    it('media pending dan ditolak tidak publik; yang disetujui publik', async () => {
      const photo = await uploadMedia(gaya, gayaProfile.id, { kind: 'foto', fileName: 'ruang.jpg', mime: 'image/jpeg', sizeBytes: JPEG_BYTES.length, caption: 'Ruang latihan' }, JPEG_BYTES);
      expect(photo.status, JSON.stringify(photo.body)).toBe(200);
      expect(photo.body.data.status).toBe('pending');
      const video = mp4Bytes(30);
      const vid = await uploadMedia(gaya, gayaProfile.id, { kind: 'video', fileName: 'profil.mp4', mime: 'video/mp4', sizeBytes: video.length, durationSec: 30 }, video);
      expect(vid.status, JSON.stringify(vid.body)).toBe(200);
      expect(vid.body.data.durationSec).toBe(30);
      expect((await publicDetail(gayaProfile.slug)).media).toHaveLength(0);

      // Video kedua melebihi batas satu video
      const second = await send(gaya, 'post', `/v1/portal/facilities/${gayaProfile.id}/media/presign`).send({ kind: 'video', fileName: 'b.mp4', mime: 'video/mp4', sizeBytes: 100, durationSec: 5 });
      expect(second.status).toBe(409);
      expect(second.body.error.code).toBe('MEDIA_LIMIT_REACHED');

      const queue = await moderator.agent.get('/v1/admin/media');
      expect(queue.body.data.map((m: { id: string }) => m.id).sort()).toEqual([photo.body.data.id, vid.body.data.id].sort());
      expect((await send(moderator, 'post', `/v1/admin/media/${photo.body.data.id}/approve`).send({})).status).toBe(200);
      expect((await send(moderator, 'post', `/v1/admin/media/${vid.body.data.id}/reject`).send({ reason: 'Video tidak relevan' })).status).toBe(200);
      const media = (await publicDetail(gayaProfile.slug)).media;
      expect(media).toHaveLength(1);
      expect(media[0]).toMatchObject({ kind: 'foto', caption: 'Ruang latihan' });
      const file = await request(getApp()).get(new URL(media[0].url).pathname);
      expect(file.status).toBe(200);
    });

    it('batas 10 foto per profil', async () => {
      const url = `/v1/portal/facilities/${gayaProfile.id}/media/presign`;
      const body = { kind: 'foto', fileName: 'x.jpg', mime: 'image/jpeg', sizeBytes: JPEG_BYTES.length };
      for (let i = 1; i < PHOTO_MAX_COUNT; i++) expect((await send(gaya, 'post', url).send(body)).status).toBe(201);
      const over = await send(gaya, 'post', url).send(body);
      expect(over.status).toBe(409);
    });
  });

  describe('permintaan harga (K4, K5, K10)', () => {
    let tariffId: string;

    it('usulan harga tidak mengubah tarif lama, VIEW, maupun jumlah versi; tanpa dokumen tidak bisa disetujui', async () => {
      const before = await versionCount();
      const publishedBefore = await publishedFor(TARIFF_IDS.pratamaHb);
      const res = await send(faskes, 'put', `/v1/portal/tariffs/${TARIFF_IDS.pratamaHb}`).send({
        priceType: 'tetap',
        priceMin: 99000,
        effectiveFrom: '2026-10-01',
        expectedVersionNo: 1,
        sourceTitle: 'Papan tarif klinik',
      });
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      expect(await versionCount()).toBe(before);
      expect(await publishedFor(TARIFF_IDS.pratamaHb)).toBe(publishedBefore);
      const hb = (await publicDetail(PRATAMA_SLUG)).tariffs.find((t: { id: string }) => t.id === TARIFF_IDS.pratamaHb);
      expect(hb.price.min).toBe(35000);

      const noDoc = await send(moderator, 'post', `/v1/admin/tariff-requests/${res.body.data.requestId}/approve`).send({});
      expect(noDoc.status).toBe(422);
      expect(noDoc.body.error.code).toBe('TARIFF_REQUEST_DOCUMENT_REQUIRED');

      await attachProof(faskes, res.body.data.requestId);
      const reject = await send(moderator, 'post', `/v1/admin/tariff-requests/${res.body.data.requestId}/reject`).send({ reason: 'Bukti tidak sesuai' });
      expect(reject.status).toBe(200);
      expect(await versionCount()).toBe(before);
      const after = (await publicDetail(PRATAMA_SLUG)).tariffs.find((t: { id: string }) => t.id === TARIFF_IDS.pratamaHb);
      expect(after.price.min).toBe(35000);
    });

    it('disetujui menambah tepat satu versi diverifikasi_admin dan tampil publik', async () => {
      const [svc] = await db().select().from(services).where(eq(services.slug, 'kelas-senam'));
      const res = await send(gaya, 'post', `/v1/portal/facilities/${gayaProfile.id}/tariffs`).send({
        serviceId: svc!.id,
        priceType: 'tetap',
        priceMin: 50000,
        effectiveFrom: '2026-10-01',
        sourceTitle: 'Brosur studio',
      });
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      await attachProof(gaya, res.body.data.requestId);
      const detail = await moderator.agent.get(`/v1/admin/tariff-requests/${res.body.data.requestId}`);
      expect(detail.body.data.documents).toHaveLength(1);
      expect(detail.body.data.documents[0].viewUrl).toBeTruthy();
      const before = await versionCount();
      expect((await send(moderator, 'post', `/v1/admin/tariff-requests/${res.body.data.requestId}/approve`).send({})).status).toBe(200);
      expect(await versionCount()).toBe(before + 1);
      const t = (await publicDetail(gayaProfile.slug)).tariffs.find((x: { service: { slug: string } }) => x.service.slug === 'kelas-senam');
      expect(t.trust.verification).toBe('diverifikasi_admin');
      tariffId = t.id;
      expect((await send(moderator, 'post', `/v1/admin/tariff-requests/${res.body.data.requestId}/approve`).send({})).status).toBe(409);
    });

    it('nonaktif menyembunyikan tarif dari publik dan published_tariffs; aktif kembali tampil', async () => {
      const off = await send(gaya, 'patch', `/v1/portal/tariffs/${tariffId}/active`).send({ active: false });
      expect(off.status).toBe(200);
      expect(await publishedFor(tariffId)).toBe(0);
      expect((await publicDetail(gayaProfile.slug)).tariffs).toHaveLength(0);
      await send(gaya, 'patch', `/v1/portal/tariffs/${tariffId}/active`).send({ active: true });
      expect(await publishedFor(tariffId)).toBe(1);
    });
  });

  describe('isolasi antar-mitra', () => {
    it('mitra A tidak bisa membaca atau mengubah profil, media, jadwal, maupun harga mitra B', async () => {
      const B = gayaProfile.id;
      const [svc] = await db().select().from(services).where(eq(services.slug, 'kelas-senam'));
      const reqs = await gaya.agent.get(`/v1/portal/facilities/${B}/tariff-requests`);
      const someRequest = reqs.body.data[0].id as string;
      const media = (await gaya.agent.get(`/v1/portal/facilities/${B}`)).body.data.media[0].id as string;
      const attempts = [
        () => other.agent.get(`/v1/portal/facilities/${B}`),
        () => send(other, 'put', `/v1/portal/facilities/${B}`).send({ name: 'Ambil alih' }),
        () => send(other, 'put', `/v1/portal/facilities/${B}`).send({ schedules: [] }),
        () => send(other, 'post', `/v1/portal/facilities/${B}/submit`),
        () => send(other, 'post', `/v1/portal/facilities/${B}/media/presign`).send({ kind: 'foto', fileName: 'a.jpg', mime: 'image/jpeg', sizeBytes: 10 }),
        () => send(other, 'post', `/v1/portal/facilities/${B}/media/${media}/confirm`),
        () => send(other, 'delete', `/v1/portal/facilities/${B}/media/${media}`),
        () => send(other, 'put', `/v1/portal/facilities/${B}/media/order`).send({ ids: [media] }),
        () => other.agent.get(`/v1/portal/facilities/${B}/tariff-requests`),
        () => send(other, 'post', `/v1/portal/facilities/${B}/tariffs`).send({ serviceId: svc!.id, priceType: 'tetap', priceMin: 1, effectiveFrom: '2026-10-01', sourceTitle: 'Ambil alih' }),
        () => send(other, 'post', `/v1/portal/tariff-requests/${someRequest}/documents/presign`).send({ fileName: 'a.pdf', mime: 'application/pdf', sizeBytes: 10 }),
      ];
      for (const [i, attempt] of attempts.entries()) {
        const res = await attempt();
        expect(res.status, `percobaan ke-${i + 1}: ${JSON.stringify(res.body)}`).toBe(403);
      }
      const tariffs = await gaya.agent.get(`/v1/portal/facilities/${B}/tariffs`);
      const toggle = await send(other, 'patch', `/v1/portal/tariffs/${tariffs.body.data[0].id}/active`).send({ active: false });
      expect(toggle.status).toBe(403);
    });

    it('pasien tidak bisa membuat profil', async () => {
      const pasien = await createUser({ role: 'pasien' });
      expect((await createProfile(pasien, 'Profil Pasien')).status).toBe(403);
    });
  });

  describe('migrasi data dan audit', () => {
    it('setiap faskes dengan koordinat punya tepat satu lokasi utama; data 0006 idempoten', async () => {
      const migration = readFileSync(
        path.resolve(fileURLToPath(import.meta.url), '../../../../packages/db/drizzle/0006_fase2_profile.sql'),
        'utf8',
      );
      const dataPart = migration.slice(migration.indexOf('-- Data:'));
      await db().execute(sql.raw(dataPart));
      await db().execute(sql.raw(dataPart));
      const bad = await count(sql`
        SELECT count(*)::int AS n FROM facilities f
        WHERE f.location IS NOT NULL
          AND (SELECT count(*) FROM profile_locations l WHERE l.facility_id = f.id AND l.is_primary) <> 1`);
      expect(bad).toBe(0);
    });

    it('semua aksi Fase 2 tercatat di audit_logs', async () => {
      const rows = await db().select({ action: auditLogs.action }).from(auditLogs);
      const actions = new Set(rows.map((r) => r.action));
      for (const a of [
        'profile.create',
        'profile.submit',
        'profile.revision.submit',
        'profile.revision.approve',
        'profile.revision.reject',
        'media.upload',
        'media.approve',
        'media.reject',
        'tariff.request.create',
        'tariff.request.approve',
        'tariff.request.reject',
        'tariff.active.toggle',
      ]) {
        expect(actions.has(a), a).toBe(true);
      }
      const [created] = await db().select().from(auditLogs).where(and(eq(auditLogs.action, 'profile.create'), eq(auditLogs.actorId, gaya.id)));
      expect(created!.ip).toBeTruthy();
    });

    it('menghapus media tercatat dan menghilangkannya dari publik', async () => {
      const media = (await gaya.agent.get(`/v1/portal/facilities/${gayaProfile.id}`)).body.data.media;
      const approved = media.find((m: { status: string }) => m.status === 'approved');
      const res = await send(gaya, 'delete', `/v1/portal/facilities/${gayaProfile.id}/media/${approved.id}`);
      expect(res.status).toBe(200);
      expect((await publicDetail(gayaProfile.slug)).media).toHaveLength(0);
      const [log] = await db().select().from(auditLogs).where(and(eq(auditLogs.action, 'media.delete'), eq(auditLogs.entityId, approved.id)));
      expect(log).toBeTruthy();
    });
  });
});
