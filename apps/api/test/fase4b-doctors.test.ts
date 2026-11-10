import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { partners } from '@silk/db';
import { FACILITY_IDS } from '@silk/db/seed';
import { practitionerDetailSchema, practitionerListItemSchema } from '@silk/shared';
import { db } from '../src/lib/db';
import { CONSENT_SELF, JPEG_BYTES, createUser, getApp, mp4Bytes, resetDb, send, uploadTo, type TestUser } from './helpers';

/** `revalidate` asli tidak melakukan apa pun saat uji; di sini panggilannya direkam. */
const revalidateCalls = vi.hoisted(() => [] as string[][]);
vi.mock('../src/lib/revalidate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/revalidate')>();
  return {
    ...actual,
    revalidate: vi.fn(async (tagList: string[]) => {
      revalidateCalls.push(tagList);
    }),
  };
});

const api = () => request(getApp());
const revalidatedTags = () => revalidateCalls.flat();

/* ---------- Data uji: kota sendiri agar tidak tercampur data seed ---------- */

const CITY = 'Kota Uji Dokter';
const BRANCH_CITY = 'Kota Cabang Dokter';
const C = { lat: -8.3, lng: 113.1 };
const east = (m: number) => C.lng + m / 110_000;

const MAIN_LOC = { label: 'Praktik utama', address: 'Jl. Dokter Uji 1', city: CITY, province: 'Jawa Timur', lat: C.lat, lng: east(500), isPrimary: true };
const BRANCH_LOC = { label: 'Cabang', address: 'Jl. Cabang Uji 2', city: BRANCH_CITY, province: 'Jawa Timur', lat: C.lat, lng: east(4000), isPrimary: false };

const BODY = [
  '## Kapan anak perlu diperiksa',
  'Demam pada anak sering membuat orang tua cemas. Catat suhu, lama demam, dan gejala lain sebelum datang ke tempat praktik.',
  'Minum yang cukup dan istirahat tetap penting. Bawa catatan obat yang sudah diberikan agar tenaga medis bisa menilai dengan tepat.',
  '',
  '- Catat suhu tubuh',
  '- Bawa buku kesehatan anak',
].join('\n');

async function uploadMedia(u: TestUser, facilityId: string, body: Record<string, unknown>, bytes: Buffer): Promise<string> {
  const presign = await send(u, 'post', `/v1/portal/facilities/${facilityId}/media/presign`).send(body);
  expect(presign.status, JSON.stringify(presign.body)).toBe(201);
  expect((await uploadTo(presign.body.data, bytes)).status).toBe(200);
  const confirm = await send(u, 'post', `/v1/portal/facilities/${facilityId}/media/${presign.body.data.mediaId}/confirm`);
  expect(confirm.status, JSON.stringify(confirm.body)).toBe(200);
  return confirm.body.data.id as string;
}

async function addTariff(facilityId: string, serviceSlug: string, min: number, active = true) {
  const t = await db().execute<{ id: string }>(sql`
    INSERT INTO tariffs (facility_id, service_id, status, active)
    SELECT ${facilityId}, id, 'terbit', ${active} FROM services WHERE slug = ${serviceSlug}
    RETURNING id
  `);
  const tariffId = t.rows[0]!.id;
  const v = await db().execute<{ id: string }>(sql`
    INSERT INTO tariff_versions (tariff_id, version_no, price_type, price_min, effective_from, verified_at, verification, source_id)
    VALUES (${tariffId}, 1, 'tetap', ${min}, '2026-01-01', now(), 'diverifikasi_admin',
      (SELECT id FROM data_sources WHERE title = 'Sumber uji Fase 4b'))
    RETURNING id
  `);
  await db().execute(sql`UPDATE tariffs SET current_version_id = ${v.rows[0]!.id} WHERE id = ${tariffId}`);
}

async function insertFacility(slug: string, name: string, type: string, status: string, extra: { description?: string; lng?: number } = {}) {
  const r = await db().execute<{ id: string }>(sql`
    INSERT INTO facilities (slug, name, type, description, address, city, province, location, verification, status)
    VALUES (${slug}, ${name}, ${type}::facility_type, ${extra.description ?? null}, ${`Jl. ${name}`}, ${CITY}, 'Jawa Timur',
      ST_SetSRID(ST_MakePoint(${extra.lng ?? east(9000)}, ${C.lat}), 4326)::geography, 'diisi_faskes', ${status}::entity_status)
    RETURNING id
  `);
  return r.rows[0]!.id;
}

async function insertPractitioner(slug: string, name: string, status: string, specialty: string | null = null) {
  const r = await db().execute<{ id: string }>(sql`
    INSERT INTO practitioners (slug, name, specialty, status) VALUES (${slug}, ${name}, ${specialty}, ${status}::entity_status) RETURNING id
  `);
  return r.rows[0]!.id;
}

const link = (facilityId: string, practitionerId: string) =>
  db().execute(sql`INSERT INTO facility_practitioners (facility_id, practitioner_id) VALUES (${facilityId}, ${practitionerId})`);

async function detail(slug: string) {
  const res = await api().get(`/v1/practitioners/${slug}`);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return practitionerDetailSchema.parse(res.body.data);
}

async function list(query: Record<string, string | number> = {}) {
  const res = await api().get('/v1/practitioners').query({ limit: 100, ...query });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return {
    items: (res.body.data as unknown[]).map((x) => practitionerListItemSchema.parse(x)),
    nextCursor: res.body.meta.nextCursor as string | null,
  };
}
const slugs = (items: { slug: string }[]) => items.map((i) => i.slug);

describe('Fase 4b: profil dan pencarian dokter', () => {
  let medis: TestUser;
  let moderator: TestUser;
  let own: { id: string; slug: string };
  let doctor: { id: string; slug: string };
  let fallbackSlug: string;
  let photoId: string;
  let pendingPhotoId: string;
  let articleSlug: string;

  beforeAll(async () => {
    await resetDb();
    await db().execute(sql`INSERT INTO data_sources (kind, title) VALUES ('faskes', 'Sumber uji Fase 4b')`);
    medis = await createUser({ partner: { type: 'tenaga_medis' } });
    moderator = await createUser({ role: 'moderator', mfa: true });

    // Profil praktik sendiri, dibuat lewat portal lalu diterbitkan moderator.
    const created = await send(medis, 'post', '/v1/portal/profiles').send({
      name: 'dr. Uji Lengkap',
      description: 'Praktik dokter umum untuk keluarga, termasuk pemeriksaan anak dan konsultasi kesehatan rutin.',
      phone: '0341-555123',
      website: 'https://contoh.test/dr-uji',
      locations: [MAIN_LOC, BRANCH_LOC],
      schedules: [{ kind: 'operasional', weekday: 1, start: '08:00', end: '12:00' }],
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    own = { id: created.body.data.id, slug: created.body.data.slug };
    const [p] = await db().select().from(partners).where(eq(partners.userId, medis.id));
    const pr = await db().execute<{ id: string; slug: string }>(sql`SELECT id, slug FROM practitioners WHERE id = ${p!.practitionerId}`);
    doctor = pr.rows[0]!;
    expect((await send(moderator, 'patch', `/v1/admin/facilities/${own.id}`).send({ status: 'terbit' })).status).toBe(200);

    // Jadwal praktik dokter ini di profilnya sendiri.
    await db().execute(sql`
      INSERT INTO schedules (facility_id, kind, weekday, start_time, end_time, timezone, practitioner_id)
      VALUES (${own.id}, 'praktik', 3, '16:00', '20:00', 'Asia/Jakarta', ${doctor.id})
    `);

    // Foto dan video disetujui; foto kedua masih menunggu.
    photoId = await uploadMedia(medis, own.id, { kind: 'foto', fileName: 'wajah.jpg', mime: 'image/jpeg', sizeBytes: JPEG_BYTES.length, caption: 'dr. Uji' }, JPEG_BYTES);
    const video = mp4Bytes(40);
    const videoId = await uploadMedia(medis, own.id, { kind: 'video', fileName: 'kenalan.mp4', mime: 'video/mp4', sizeBytes: video.length, durationSec: 40, consent: CONSENT_SELF }, video);
    for (const id of [photoId, videoId]) expect((await send(moderator, 'post', `/v1/admin/media/${id}/approve`).send({})).status).toBe(200);
    pendingPhotoId = await uploadMedia(medis, own.id, { kind: 'foto', fileName: 'baru.jpg', mime: 'image/jpeg', sizeBytes: JPEG_BYTES.length, caption: 'Belum ditinjau' }, JPEG_BYTES);

    // Tarif profil sendiri: satu aktif, satu nonaktif (tidak tampil lewat VIEW published_tariffs).
    await addTariff(own.id, 'hemoglobin', 40_000);
    await addTariff(own.id, 'kolesterol-total', 90_000, false);

    // Juga praktik di klinik seed: hanya jadwal dokter ini yang ikut, bukan jadwal umum atau dokter lain.
    await link(FACILITY_IDS.klinikPratama, doctor.id);
    const otherDoctor = await db().execute<{ id: string }>(sql`SELECT practitioner_id AS id FROM facility_practitioners WHERE facility_id = ${FACILITY_IDS.klinikPratama} AND practitioner_id <> ${doctor.id} LIMIT 1`);
    await db().execute(sql`
      INSERT INTO schedules (facility_id, kind, weekday, start_time, end_time, timezone, practitioner_id) VALUES
        (${FACILITY_IDS.klinikPratama}, 'praktik', 5, '09:00', '11:00', 'Asia/Jakarta', ${doctor.id}),
        (${FACILITY_IDS.klinikPratama}, 'operasional', 5, '07:00', '21:00', 'Asia/Jakarta', NULL),
        (${FACILITY_IDS.klinikPratama}, 'praktik', 6, '09:00', '11:00', 'Asia/Jakarta', ${otherDoctor.rows[0]?.id ?? null})
    `);

    // Artikel: satu terbit, satu masih menunggu.
    const draft = { title: 'Demam pada anak dan kapan perlu diperiksa', summary: 'Langkah sederhana mencatat gejala demam pada anak sebelum datang ke tempat praktik.', body: BODY };
    const a = await send(medis, 'post', '/v1/portal/articles').send(draft);
    expect(a.status, JSON.stringify(a.body)).toBe(201);
    articleSlug = a.body.data.slug;
    expect((await send(medis, 'post', `/v1/portal/articles/${a.body.data.id}/submit`).send({ declaration: true })).status).toBe(200);
    expect((await send(moderator, 'post', `/v1/admin/articles/${a.body.data.id}/approve`)).status).toBe(200);
    const b = await send(medis, 'post', '/v1/portal/articles').send({ ...draft, title: 'Artikel kedua yang masih menunggu tinjauan' });
    expect((await send(medis, 'post', `/v1/portal/articles/${b.body.data.id}/submit`).send({ declaration: true })).status).toBe(200);

    // Dokter dari data faskes (bukan mitra) dengan profil `praktik_dokter` sebagai cadangan.
    const praktik = await insertFacility('praktik-dr-cadangan-uji', 'Praktik dr. Cadangan Uji', 'praktik_dokter', 'terbit', {
      description: 'Praktik mandiri dokter spesialis anak.',
    });
    const fallback = await insertPractitioner('dr-cadangan-uji', 'dr. Cadangan Uji, Sp.A', 'terbit', 'Anak');
    await link(praktik, fallback);
    fallbackSlug = 'dr-cadangan-uji';

    // Tidak tampil: praktisi draft, dan praktisi terbit yang satu-satunya faskesnya masih draft.
    await link(FACILITY_IDS.klinikPratama, await insertPractitioner('dr-draft-uji', 'dr. Draft Uji', 'draft', 'Anak'));
    await link(FACILITY_IDS.rsDraft, await insertPractitioner('dr-faskes-draft-uji', 'dr. Faskes Draft Uji', 'terbit', 'Anak'));
  });

  beforeEach(() => {
    revalidateCalls.length = 0;
  });

  describe('detail dokter', () => {
    it('dokter mitra: foto, tentang, kontak, video, tempat praktik, jadwal, tarif, dan artikel', async () => {
      const d = await detail(doctor.slug);
      expect(d.verification).toEqual({ str: false, partner: true });
      expect(d.photo).toMatchObject({ caption: 'dr. Uji' });
      expect(d.about).toContain('Praktik dokter umum untuk keluarga');
      expect(d.contact).toEqual({ phone: '0341-555123', website: 'https://contoh.test/dr-uji' });
      expect(d.video).toMatchObject({ mime: 'video/mp4', durationSec: 40 });
      expect(d.rating).toBeNull();

      expect(d.practices.map((p) => [p.facility.slug, p.isPrimary])).toEqual([
        [own.slug, true],
        ['klinik-pratama-sehat-contoh', false],
      ]);
      const [primary, clinic] = d.practices;
      expect(primary!.locations.map((l) => l.city)).toEqual([CITY, BRANCH_CITY]);
      expect(primary!.schedules.map((s) => [s.kind, s.weekday])).toEqual([
        ['operasional', 1],
        ['praktik', 3],
      ]);
      // Di klinik lain hanya jadwal yang memuat dokter ini.
      expect(clinic!.schedules.map((s) => [s.kind, s.weekday, s.start])).toEqual([['praktik', 5, '09:00']]);

      expect(d.tariffs.map((t) => t.service.slug)).toEqual(['hemoglobin']);
      expect(d.articles.map((a) => a.slug)).toEqual([articleSlug]);
      expect(d.articles[0]!.author.profilePath).toBe(`/dokter/${doctor.slug}`);
    });

    it('tidak bocor: media menunggu, revisi menunggu, dan artikel menunggu tidak tampil', async () => {
      const before = await detail(doctor.slug);
      const rev = await send(medis, 'put', `/v1/portal/facilities/${own.id}`).send({ description: 'Deskripsi baru yang belum disetujui moderator untuk praktik ini.' });
      expect(rev.status, JSON.stringify(rev.body)).toBe(200);
      expect(rev.body.data.revision.status).toBe('pending');
      const after = await detail(doctor.slug);
      expect(after.about).toBe(before.about);
      expect(after.photo).toEqual(before.photo);
      expect(after.articles).toHaveLength(1);
    });

    it('dokter non-mitra memakai profil praktik_dokter sebagai cadangan; lencana mitra false', async () => {
      const d = await detail(fallbackSlug);
      expect(d.verification).toEqual({ str: false, partner: false });
      expect(d.about).toBe('Praktik mandiri dokter spesialis anak.');
      expect(d.practices).toHaveLength(1);
      expect(d.practices[0]!.isPrimary).toBe(true);
      // Data lama tanpa baris lokasi: alamat dan titik kolom faskes dipakai.
      expect(d.practices[0]!.locations).toHaveLength(1);
    });

    it('dokter tanpa profil utama: bagian profil kosong, tempat praktik tetap tampil', async () => {
      const d = await detail('dr-contoh-satu');
      expect(d).toMatchObject({ photo: null, about: null, contact: null, video: null, tariffs: [] });
      expect(d.practices.length).toBeGreaterThan(0);
      expect(d.practices.every((p) => !p.isPrimary)).toBe(true);
    });

    it('praktisi draft dan praktisi tanpa faskes terbit: 404 di detail, tidak ada di daftar, spesialisasi, dan sitemap', async () => {
      for (const slug of ['dr-draft-uji', 'dr-faskes-draft-uji']) {
        const res = await api().get(`/v1/practitioners/${slug}`);
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('PRACTITIONER_NOT_FOUND');
      }
      const all = slugs((await list()).items);
      expect(all).not.toContain('dr-draft-uji');
      expect(all).not.toContain('dr-faskes-draft-uji');
      const specialties = (await api().get('/v1/practitioner-specialties')).body.data as { name: string; count: number }[];
      // Hanya dr. Cadangan Uji yang tampil dengan spesialisasi Anak.
      expect(specialties.find((s) => s.name.toLowerCase() === 'anak')).toEqual({ name: 'Anak', count: 1 });
      const sitemap = (await api().get('/v1/sitemap')).body.data.practitioners as { path: string }[];
      expect(sitemap.map((x) => x.path)).toContain('/dokter');
      expect(sitemap.map((x) => x.path)).not.toContain('/dokter/dr-draft-uji');
      expect(sitemap.map((x) => x.path)).not.toContain('/dokter/dr-faskes-draft-uji');
    });
  });

  describe('daftar dan pencarian', () => {
    it('kartu dokter mitra: foto, kota, tempat praktik (utama dulu), video, jadwal', async () => {
      const item = (await list({ q: 'Uji Lengkap' })).items.find((i) => i.slug === doctor.slug)!;
      expect(item).toMatchObject({
        verification: { str: false, partner: true },
        hasVideo: true,
        hasSchedule: true,
        practiceCount: 2,
        distanceM: null,
      });
      expect(item.photoUrl).toBeTruthy();
      expect(item.practices[0]!.slug).toBe(own.slug);
      expect(item.cities).toEqual(expect.arrayContaining([CITY, BRANCH_CITY]));
    });

    it('q mencocokkan nama sebagian dan spesialisasi', async () => {
      expect(slugs((await list({ q: 'Cadangan' })).items)).toEqual([fallbackSlug]);
      expect(slugs((await list({ q: 'anak' })).items)).toContain(fallbackSlug);
      expect((await list({ q: 'zzzz tidak ada' })).items).toEqual([]);
    });

    it('specialty tanpa membedakan huruf besar/kecil', async () => {
      expect(slugs((await list({ specialty: 'ANAK' })).items)).toEqual([fallbackSlug]);
    });

    it('city mencakup kota lokasi cabang tempat praktik', async () => {
      expect(slugs((await list({ city: BRANCH_CITY })).items)).toEqual([doctor.slug]);
      expect(slugs((await list({ city: CITY })).items).sort()).toEqual([doctor.slug, fallbackSlug].sort());
    });

    it('radius dan urut jarak memakai tempat praktik terdekat', async () => {
      const near = await list({ lat: C.lat, lng: C.lng, radius: 2000, sort: 'distance' });
      expect(slugs(near.items)).toEqual([doctor.slug]);
      expect(near.items[0]!.distanceM).toBeGreaterThan(400);
      expect(near.items[0]!.distanceM).toBeLessThan(700);
      const all = await list({ lat: C.lat, lng: C.lng, sort: 'distance' });
      const d = all.items.map((i) => i.distanceM ?? Infinity);
      expect(d).toEqual([...d].sort((a, b) => a - b));
      expect(slugs(all.items).slice(0, 2)).toEqual([doctor.slug, fallbackSlug]);
    });

    it('urutan bawaan = nama; kursor konsisten tanpa duplikat', async () => {
      const all = (await list()).items;
      expect(slugs(all)).toEqual([fallbackSlug, 'dr-contoh-dua-spm', 'dr-contoh-satu', doctor.slug]);
      const seen: string[] = [];
      let cursor: string | null = null;
      do {
        const page = await list({ limit: 1, ...(cursor ? { cursor } : {}) });
        seen.push(...slugs(page.items));
        cursor = page.nextCursor;
      } while (cursor);
      expect(seen).toEqual(slugs(all));
    });

    it('parameter tidak sah ditolak 400, termasuk urutan selain relevansi/nama/jarak', async () => {
      for (const query of [{ radius: 1000 }, { sort: 'distance' }, { lat: -8 }, { sort: 'relevance' }, { sort: 'rating' }, { sort: 'price_asc' }, { sort: 'promoted' }]) {
        const res = await api().get('/v1/practitioners').query(query);
        expect(res.status, JSON.stringify(query)).toBe(400);
      }
    });

    it('urutan tidak memakai data pembayaran atau langganan (uji statis repo)', () => {
      const source = readFileSync(fileURLToPath(new URL('../src/modules/m1-directory/directory.repo.ts', import.meta.url)), 'utf8');
      const block = source.slice(source.indexOf('export async function searchPractitioners'), source.indexOf('export async function practitionerSpecialties'));
      expect(block.length).toBeGreaterThan(100);
      expect(block).not.toMatch(/\b(subscriptions?|payments?|plans?|orders?|langganan|pembayaran)\b/i);
    });
  });

  describe('revalidate halaman dokter', () => {
    it('media disetujui, revisi disetujui, dan perubahan status faskes memanggil tag dokter', async () => {
      expect((await send(moderator, 'post', `/v1/admin/media/${pendingPhotoId}/approve`).send({})).status).toBe(200);
      expect(revalidatedTags()).toContain(`practitioner:${doctor.slug}`);

      revalidateCalls.length = 0;
      const pending = await db().execute<{ id: string }>(sql`SELECT id FROM profile_revisions WHERE facility_id = ${own.id} AND status = 'pending'`);
      expect((await send(moderator, 'post', `/v1/admin/profile-revisions/${pending.rows[0]!.id}/approve`)).status).toBe(200);
      expect(revalidatedTags()).toContain(`practitioner:${doctor.slug}`);
      expect((await detail(doctor.slug)).about).toContain('Deskripsi baru');

      revalidateCalls.length = 0;
      expect((await send(moderator, 'patch', `/v1/admin/facilities/${FACILITY_IDS.klinikPratama}`).send({ verification: 'diisi_faskes' })).status).toBe(200);
      expect(revalidatedTags()).toEqual(expect.arrayContaining([`practitioner:${doctor.slug}`, 'practitioners']));
    });

    it('artikel disetujui memanggil tag dokter penulisnya', async () => {
      const a = await send(medis, 'post', '/v1/portal/articles').send({
        title: 'Menjaga cairan tubuh anak saat demam',
        summary: 'Panduan sederhana agar anak tetap cukup minum selama demam dan kapan perlu datang ke tempat praktik.',
        body: BODY,
      });
      expect((await send(medis, 'post', `/v1/portal/articles/${a.body.data.id}/submit`).send({ declaration: true })).status).toBe(200);
      revalidateCalls.length = 0;
      expect((await send(moderator, 'post', `/v1/admin/articles/${a.body.data.id}/approve`)).status).toBe(200);
      expect(revalidatedTags()).toContain(`practitioner:${doctor.slug}`);
    });
  });

  it('mitra dicabut: lencana mitra false (dokter tetap tampil selama profil terbit)', async () => {
    await db().update(partners).set({ status: 'rejected' }).where(eq(partners.userId, medis.id));
    const d = await detail(doctor.slug);
    expect(d.verification.partner).toBe(false);
    // Artikel mitra yang tidak terverifikasi tidak tampil (aturan Fase 4).
    expect(d.articles).toEqual([]);
  });
});
