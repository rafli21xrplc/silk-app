import { eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { partners } from '@silk/db';
import { facilityListItemSchema, practitionerDetailSchema, practitionerListItemSchema, profileReadinessSchema } from '@silk/shared';
import { db } from '../src/lib/db';
import { resetEnvCacheForTests } from '../src/lib/env';
import { importDemoVideo } from '../src/modules/profiles/media-import.service';
import { CONSENT_DOC, CONSENT_SELF, JPEG_BYTES, PDF_BYTES, createUser, getApp, mp4Bytes, resetDb, send, uploadMediaWithConsent, uploadTo, type TestUser } from './helpers';

/**
 * Rekomendasi evaluasi USP (docs/evaluasi/usp-evaluasi-2026-11-10.md).
 * R3: biaya konsultasi dokter dari tarif kategori `konsultasi` di profil praktik utama.
 * R5: batas video 20–90 detik dan 50 MB. R6: persetujuan tertulis orang yang tampil di video.
 * R7: impor video demo dari tim lewat skrip operator, tetap lewat moderasi.
 * R8: ulasan pengalaman ramping di balik flag reviews_enabled (pra-moderasi, M17, data contoh berlabel).
 */

const api = () => request(getApp());
const CITY = 'Kota Uji USP';
const LOC = { label: 'Praktik', address: 'Jl. USP 1', city: CITY, province: 'Jawa Timur', lat: -8.35, lng: 113.2, isPrimary: true };

async function addTariff(facilityId: string, serviceSlug: string, min: number | null, priceType: 'tetap' | 'tanya' = 'tetap') {
  const t = await db().execute<{ id: string }>(sql`
    INSERT INTO tariffs (facility_id, service_id, status)
    SELECT ${facilityId}, id, 'terbit' FROM services WHERE slug = ${serviceSlug}
    RETURNING id
  `);
  const tariffId = t.rows[0]!.id;
  const v = await db().execute<{ id: string }>(sql`
    INSERT INTO tariff_versions (tariff_id, version_no, price_type, price_min, effective_from, verified_at, verification, source_id)
    VALUES (${tariffId}, 1, ${priceType}::price_type, ${min}, '2026-10-01', now(), 'diisi_faskes',
      (SELECT id FROM data_sources WHERE title = 'Papan tarif uji USP'))
    RETURNING id
  `);
  await db().execute(sql`UPDATE tariffs SET current_version_id = ${v.rows[0]!.id} WHERE id = ${tariffId}`);
  return tariffId;
}

/** Dokter mitra dengan profil praktik terbit. */
async function doctorWithPractice(name: string, moderator: TestUser) {
  const user = await createUser({ partner: { type: 'tenaga_medis' } });
  const created = await send(user, 'post', '/v1/portal/profiles').send({
    name,
    description: 'Praktik dokter untuk uji rekomendasi evaluasi USP, melayani konsultasi keluhan umum.',
    locations: [LOC],
    schedules: [{ kind: 'operasional', weekday: 1, start: '08:00', end: '12:00' }],
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const facilityId = created.body.data.id as string;
  expect((await send(moderator, 'patch', `/v1/admin/facilities/${facilityId}`).send({ status: 'terbit' })).status).toBe(200);
  const [p] = await db().select().from(partners).where(eq(partners.userId, user.id));
  const pr = await db().execute<{ slug: string }>(sql`SELECT slug FROM practitioners WHERE id = ${p!.practitionerId}`);
  return { user, facilityId, slug: pr.rows[0]!.slug };
}

async function detail(slug: string) {
  const res = await api().get(`/v1/practitioners/${slug}`);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return practitionerDetailSchema.parse(res.body.data);
}

async function listItem(slug: string) {
  const res = await api().get('/v1/practitioners').query({ city: CITY, limit: 50 });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  const items = (res.body.data as unknown[]).map((x) => practitionerListItemSchema.parse(x));
  return items.find((i) => i.slug === slug)!;
}

describe('Evaluasi USP R3: biaya konsultasi dokter', () => {
  let moderator: TestUser;
  let withConsult: { facilityId: string; slug: string };
  let askOnly: { facilityId: string; slug: string };
  let noConsult: { facilityId: string; slug: string };

  beforeAll(async () => {
    await resetDb();
    await db().execute(sql`INSERT INTO data_sources (kind, title) VALUES ('faskes', 'Papan tarif uji USP')`);
    moderator = await createUser({ role: 'moderator', mfa: true });

    withConsult = await doctorWithPractice('dr. Uji Konsultasi, Sp.A', moderator);
    await addTariff(withConsult.facilityId, 'hemoglobin', 40_000);
    await addTariff(withConsult.facilityId, 'konsultasi-dokter-umum', null, 'tanya');
    await addTariff(withConsult.facilityId, 'konsultasi-dokter-spesialis', 175_000);

    askOnly = await doctorWithPractice('dr. Uji Tanya Biaya', moderator);
    await addTariff(askOnly.facilityId, 'konsultasi-dokter-umum', null, 'tanya');

    noConsult = await doctorWithPractice('dr. Uji Tanpa Konsultasi', moderator);
    await addTariff(noConsult.facilityId, 'gula-darah-puasa', 25_000);
  });

  it('taksonomi memuat kategori konsultasi dan rawat inap (R3, R9)', async () => {
    const res = await api().get('/v1/service-categories');
    expect(res.status).toBe(200);
    const slugs = (res.body.data as { slug: string }[]).map((c) => c.slug);
    expect(slugs).toEqual(expect.arrayContaining(['konsultasi', 'rawat-inap']));
  });

  it('detail: konsultasi berangka didahulukan atas "tanya", lengkap dengan konteks kepercayaan', async () => {
    const d = await detail(withConsult.slug);
    expect(d.consultation).toMatchObject({
      service: { slug: 'konsultasi-dokter-spesialis', categorySlug: 'konsultasi' },
      price: { type: 'tetap', min: 175_000 },
      trust: { verification: 'diisi_faskes', effectiveFrom: '2026-10-01', source: { title: 'Papan tarif uji USP' } },
    });
    // Tarif konsultasi tetap ada di daftar tarif lengkap; web menyaringnya agar tidak tampil dua kali.
    expect(d.tariffs.map((t) => t.service.slug)).toEqual(expect.arrayContaining(['hemoglobin', 'konsultasi-dokter-spesialis']));
  });

  it('daftar: kartu dokter membawa biaya konsultasi yang sama dengan detail', async () => {
    const item = await listItem(withConsult.slug);
    expect(item.consultation).toMatchObject({
      serviceName: 'Konsultasi dokter spesialis',
      price: { type: 'tetap', min: 175_000 },
      trust: { effectiveFrom: '2026-10-01', source: { title: 'Papan tarif uji USP' } },
    });
  });

  it('hanya "tanya": tetap ditampilkan sebagai tanya, tanpa angka', async () => {
    expect((await detail(askOnly.slug)).consultation?.price).toEqual({ type: 'tanya', min: null, max: null, currency: 'IDR' });
    expect((await listItem(askOnly.slug)).consultation?.price.type).toBe('tanya');
  });

  it('tanpa tarif konsultasi: null di detail dan daftar', async () => {
    expect((await detail(noConsult.slug)).consultation).toBeNull();
    expect((await listItem(noConsult.slug)).consultation).toBeNull();
  });

  it('tarif konsultasi nonaktif tidak tampil (VIEW published_tariffs)', async () => {
    await db().execute(sql`
      UPDATE tariffs SET active = false
      WHERE facility_id = ${withConsult.facilityId} AND service_id = (SELECT id FROM services WHERE slug = 'konsultasi-dokter-spesialis')
    `);
    expect((await detail(withConsult.slug)).consultation?.price.type).toBe('tanya');
    expect((await listItem(withConsult.slug)).consultation?.price.type).toBe('tanya');
  });
});

describe('Evaluasi USP R5 dan R6: batas video dan persetujuan tertulis', () => {
  let moderator: TestUser;
  let doc: { user: TestUser; facilityId: string; slug: string };
  let gaya: TestUser;
  let gayaFacility: string;

  const video = (seconds: number, consent: unknown) => {
    const bytes = mp4Bytes(seconds);
    return { body: { kind: 'video', fileName: 'kenalan.mp4', mime: 'video/mp4', sizeBytes: bytes.length, durationSec: seconds, consent }, bytes };
  };
  const consentRows = (facilityId: string) =>
    db().execute<{ media_id: string | null; method: string; revoked_at: Date | null; revoke_reason: string | null; document_confirmed_at: Date | null }>(
      sql`SELECT media_id, method, revoked_at, revoke_reason, document_confirmed_at FROM media_consents WHERE facility_id = ${facilityId} ORDER BY granted_at`,
    );

  beforeAll(async () => {
    await resetDb();
    moderator = await createUser({ role: 'moderator', mfa: true });
    doc = await doctorWithPractice('dr. Uji Video Persetujuan', moderator);
    gaya = await createUser({ partner: { type: 'gaya_hidup' } });
    const created = await send(gaya, 'post', '/v1/portal/profiles').send({
      name: 'Studio Uji Persetujuan',
      description: 'Studio kebugaran untuk uji persetujuan video pada evaluasi USP SILK.',
      locations: [LOC],
      schedules: [{ kind: 'operasional', weekday: 2, start: '07:00', end: '11:00' }],
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    gayaFacility = created.body.data.id;
  });

  it('R5: video di bawah 20 detik atau di atas 90 detik ditolak saat presign', async () => {
    const url = `/v1/portal/facilities/${doc.facilityId}/media/presign`;
    expect((await send(doc.user, 'post', url).send(video(19, CONSENT_SELF).body)).status).toBe(400);
    expect((await send(doc.user, 'post', url).send(video(91, CONSENT_SELF).body)).status).toBe(400);
  });

  it('R5: MP4 lebih pendek dari 20 detik ditolak saat konfirmasi walau browser melaporkan lebih panjang', async () => {
    const bytes = mp4Bytes(10);
    const res = await uploadMediaWithConsent(doc.user, doc.facilityId, { ...video(30, CONSENT_SELF).body, sizeBytes: bytes.length }, bytes);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('MEDIA_INVALID');
    // Unggahan gagal: media dan persetujuannya dibuang, bukan dicabut.
    expect((await consentRows(doc.facilityId)).rows).toHaveLength(0);
  });

  it('R6: video tanpa persetujuan ditolak 400', async () => {
    const { consent: _c, ...body } = video(40, CONSENT_SELF).body;
    expect((await send(doc.user, 'post', `/v1/portal/facilities/${doc.facilityId}/media/presign`).send(body)).status).toBe(400);
  });

  it('R6: pernyataan di akun hanya untuk tenaga medis; akun lain wajib formulir', async () => {
    const res = await send(gaya, 'post', `/v1/portal/facilities/${gayaFacility}/media/presign`).send(video(40, CONSENT_SELF).body);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CONSENT_METHOD_NOT_ALLOWED');
  });

  it('R6: formulir tidak diunggah atau bukan PDF/JPEG/PNG → konfirmasi 422', async () => {
    const { body, bytes } = video(40, CONSENT_DOC);
    // Tanpa formulir.
    const presign = await send(gaya, 'post', `/v1/portal/facilities/${gayaFacility}/media/presign`).send(body);
    expect(presign.status, JSON.stringify(presign.body)).toBe(201);
    expect(presign.body.data.consentUpload).toBeTruthy();
    await uploadTo(presign.body.data, bytes);
    const confirm = await send(gaya, 'post', `/v1/portal/facilities/${gayaFacility}/media/${presign.body.data.mediaId}/confirm`);
    expect(confirm.status).toBe(422);
    // Formulir berisi JPEG padahal dinyatakan PDF (ukuran sesuai, jadi yang ditolak adalah isinya).
    const fakeBody = { ...body, consent: { ...CONSENT_DOC, document: { ...CONSENT_DOC.document, sizeBytes: JPEG_BYTES.length } } };
    const fake = await uploadMediaWithConsent(gaya, gayaFacility, fakeBody, bytes, JPEG_BYTES);
    expect(fake.status).toBe(422);
    expect((await consentRows(gayaFacility)).rows).toHaveLength(0);
  });

  it('R6: formulir sah → pemilik dan moderator melihat ringkasan persetujuan; video tampil setelah disetujui', async () => {
    const { body, bytes } = video(45, CONSENT_DOC);
    const res = await uploadMediaWithConsent(gaya, gayaFacility, body, bytes);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.consent).toMatchObject({ subjectName: 'Pelatih Uji Tampil', method: 'dokumen', scopes: ['profil_web', 'media_sosial'] });
    expect(res.body.data.consent.document.url).toBeTruthy();

    const queue = await moderator.agent.get('/v1/admin/media');
    const item = (queue.body.data as { id: string; consent: { method: string } | null }[]).find((m) => m.id === res.body.data.id);
    expect(item?.consent?.method).toBe('dokumen');
    expect((await send(moderator, 'post', `/v1/admin/media/${res.body.data.id}/approve`).send({})).status).toBe(200);
    const rows = (await consentRows(gayaFacility)).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.document_confirmed_at).not.toBeNull();
  });

  it('R6: dokter dengan pernyataan di akun → video tampil di profil dan kartu', async () => {
    const { body, bytes } = video(40, CONSENT_SELF);
    const res = await uploadMediaWithConsent(doc.user, doc.facilityId, body, bytes);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.consent).toMatchObject({ method: 'pernyataan_akun', document: null });
    expect((await send(moderator, 'post', `/v1/admin/media/${res.body.data.id}/approve`).send({})).status).toBe(200);
    expect((await detail(doc.slug)).video).toMatchObject({ durationSec: 40 });
    expect((await listItem(doc.slug)).hasVideo).toBe(true);
  });

  it('R6: video lama tanpa persetujuan tidak bisa disetujui dan tidak tampil publik', async () => {
    const legacy = await db().execute<{ id: string }>(sql`
      INSERT INTO profile_media (facility_id, kind, object_key, file_name, mime, size_bytes, duration_sec, status, confirmed_at)
      VALUES (${gayaFacility}, 'video', ${`profiles/${gayaFacility}/lama.mp4`}, 'lama.mp4', 'video/mp4', 1000, 40, 'pending', now())
      RETURNING id
    `);
    const id = legacy.rows[0]!.id;
    const res = await send(moderator, 'post', `/v1/admin/media/${id}/approve`).send({});
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('MEDIA_CONSENT_REQUIRED');

    // Data lama yang sudah terlanjur disetujui tanpa persetujuan: disaring dari publik.
    await db().execute(sql`UPDATE profile_media SET status = 'approved', public_url = 'https://contoh.test/lama.mp4' WHERE id = ${id}`);
    expect((await send(moderator, 'patch', `/v1/admin/facilities/${gayaFacility}`).send({ status: 'terbit' })).status).toBe(200);
    const pub = await api().get(`/v1/facilities/${(await db().execute<{ slug: string }>(sql`SELECT slug FROM facilities WHERE id = ${gayaFacility}`)).rows[0]!.slug}`);
    expect(pub.status, JSON.stringify(pub.body)).toBe(200);
    const urls = (pub.body.data.media as { url: string }[]).map((m) => m.url);
    expect(urls).not.toContain('https://contoh.test/lama.mp4');
    // Video sah (dengan formulir) tetap tampil: penyaringan hanya membuang yang tanpa persetujuan.
    expect(urls.length).toBeGreaterThan(0);
    await db().execute(sql`DELETE FROM profile_media WHERE id = ${id}`);
  });

  it('R6: menghapus video mencabut persetujuan (jejak tetap) dan video hilang dari publik', async () => {
    const before = (await detail(doc.slug)).video;
    expect(before).not.toBeNull();
    const own = await doc.user.agent.get(`/v1/portal/facilities/${doc.facilityId}`);
    const vid = (own.body.data.media as { id: string; kind: string; consent: unknown }[]).find((m) => m.kind === 'video')!;
    expect(vid.consent).toMatchObject({ method: 'pernyataan_akun' });
    expect((await send(doc.user, 'delete', `/v1/portal/facilities/${doc.facilityId}/media/${vid.id}`)).status).toBe(200);

    const rows = (await consentRows(doc.facilityId)).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ media_id: null, revoke_reason: 'Video dihapus oleh pengelola profil' });
    expect(rows[0]!.revoked_at).not.toBeNull();
    const audit = await db().execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM audit_logs WHERE action = 'media.consent.revoke'`);
    expect(audit.rows[0]!.n).toBe(1);

    expect((await detail(doc.slug)).video).toBeNull();
    expect((await listItem(doc.slug)).hasVideo).toBe(false);
  });

  it('R6: setiap pemberian persetujuan tercatat di audit log', async () => {
    const r = await db().execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM audit_logs WHERE action = 'media.consent.grant'`);
    // Dua persetujuan berlaku (formulir studio, pernyataan dokter); unggahan gagal juga sempat tercatat saat presign.
    expect(r.rows[0]!.n).toBeGreaterThanOrEqual(2);
  });
});

describe('Evaluasi USP R7: impor video demo dari tim', () => {
  let moderator: TestUser;
  let doc: { facilityId: string; slug: string };

  const input = (slug: string, video: Buffer, consentBytes: Buffer = PDF_BYTES) => ({
    practitionerSlug: slug,
    video: { fileName: 'perkenalan.mp4', bytes: video },
    consent: { fileName: 'persetujuan.pdf', bytes: consentBytes, subjectName: 'dr. Uji Video Demo', socialMedia: true },
    caption: 'Perkenalan singkat dan cara praktik',
  });

  beforeAll(async () => {
    await resetDb();
    moderator = await createUser({ role: 'moderator', mfa: true });
    doc = await doctorWithPractice('dr. Uji Video Demo', moderator);
  });

  it('menolak durasi di luar 20–90 detik, berkas bukan MP4, dan formulir bukan PDF/JPEG/PNG', async () => {
    await expect(importDemoVideo(input(doc.slug, mp4Bytes(15)))).rejects.toMatchObject({ code: 'MEDIA_INVALID' });
    await expect(importDemoVideo(input(doc.slug, mp4Bytes(120)))).rejects.toMatchObject({ code: 'MEDIA_INVALID' });
    await expect(importDemoVideo(input(doc.slug, JPEG_BYTES))).rejects.toMatchObject({ code: 'MEDIA_INVALID' });
    await expect(importDemoVideo(input(doc.slug, mp4Bytes(45), Buffer.from('bukan formulir')))).rejects.toMatchObject({ code: 'DOCUMENT_INVALID' });
    await expect(importDemoVideo(input('dokter-tidak-ada', mp4Bytes(45)))).rejects.toMatchObject({ code: 'PRACTITIONER_NOT_FOUND' });
    const n = await db().execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM profile_media WHERE facility_id = ${doc.facilityId}`);
    expect(n.rows[0]!.n).toBe(0);
  });

  it('video sah masuk antrean moderasi dengan formulir terkonfirmasi, belum tampil publik', async () => {
    const r = await importDemoVideo(input(doc.slug, mp4Bytes(45)));
    expect(r).toMatchObject({ status: 'diimpor', facilityId: doc.facilityId, durationSec: 45 });
    expect((await detail(doc.slug)).video).toBeNull();

    const queue = await moderator.agent.get('/v1/admin/media');
    const row = (queue.body.data as { id: string; consent: { method: string; scopes: string[]; document: unknown } | null }[]).find((m) => m.id === (r as { mediaId: string }).mediaId);
    expect(row?.consent).toMatchObject({ method: 'dokumen', scopes: ['profil_web', 'media_sosial'] });
    expect(row?.consent?.document).not.toBeNull();

    const audit = await db().execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM audit_logs WHERE action = 'media.import_demo' AND entity_id = ${(r as { mediaId: string }).mediaId}`);
    expect(audit.rows[0]!.n).toBe(1);

    expect((await send(moderator, 'post', `/v1/admin/media/${(r as { mediaId: string }).mediaId}/approve`).send({})).status).toBe(200);
    const shown = await detail(doc.slug);
    expect(shown.video).toMatchObject({ durationSec: 45, caption: 'Perkenalan singkat dan cara praktik' });
  });

  it('idempoten: profil yang sudah punya video aktif dilewati', async () => {
    const r = await importDemoVideo(input(doc.slug, mp4Bytes(30)));
    expect(r.status).toBe('dilewati');
    const n = await db().execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM profile_media WHERE facility_id = ${doc.facilityId} AND kind = 'video'`);
    expect(n.rows[0]!.n).toBe(1);
  });
});

describe('Evaluasi USP R8: ulasan pengalaman (Fase 6 ramping, flag reviews_enabled)', () => {
  let moderator: TestUser;
  let pasien: TestUser;
  let pasien2: TestUser;
  let doc: { facilityId: string; slug: string; user: TestUser };
  let facilitySlug: string;
  const review = { rating: 4, aspects: { keramahan_staf: 'baik', waktu_tunggu: 'kurang' }, comment: 'Staf menjelaskan biaya sebelum tindakan.', declaration: true };

  beforeAll(async () => {
    await resetDb();
    moderator = await createUser({ role: 'moderator', mfa: true });
    pasien = await createUser({ role: 'pasien' });
    pasien2 = await createUser({ role: 'pasien' });
    doc = await doctorWithPractice('dr. Uji Ulasan Pengalaman', moderator);
    const f = await db().execute<{ slug: string }>(sql`SELECT slug FROM facilities WHERE id = ${doc.facilityId}`);
    facilitySlug = f.rows[0]!.slug;
  });

  afterEach(() => {
    delete process.env.FEATURE_FLAGS;
    resetEnvCacheForTests();
  });
  const on = () => {
    process.env.FEATURE_FLAGS = 'reviews_enabled';
    resetEnvCacheForTests();
  };

  it('flag OFF: semua rute ulasan 404 (publik, pasien, admin)', async () => {
    expect((await api().get(`/v1/facilities/${facilitySlug}/reviews`)).status).toBe(404);
    expect((await send(pasien, 'put', `/v1/reviews/${facilitySlug}`).send(review)).status).toBe(404);
    expect((await moderator.agent.get('/v1/admin/reviews')).status).toBe(404);
  });

  it('hanya pasien yang boleh menulis; mitra dan anonim ditolak', async () => {
    on();
    expect((await api().put(`/v1/reviews/${facilitySlug}`).send(review)).status).toBe(401);
    expect((await send(doc.user, 'put', `/v1/reviews/${facilitySlug}`).send(review)).status).toBe(403);
  });

  it('validasi: bintang 1–5, aspek dikenal, pernyataan wajib; komentar lewat M17', async () => {
    on();
    expect((await send(pasien, 'put', `/v1/reviews/${facilitySlug}`).send({ ...review, rating: 6 })).status).toBe(400);
    expect((await send(pasien, 'put', `/v1/reviews/${facilitySlug}`).send({ ...review, aspects: { kesembuhan: 'baik' } })).status).toBe(400);
    expect((await send(pasien, 'put', `/v1/reviews/${facilitySlug}`).send({ ...review, declaration: false })).status).toBe(400);
    const blocked = await send(pasien, 'put', `/v1/reviews/${facilitySlug}`).send({ ...review, comment: 'Klinik termurah, pasti sembuh' });
    expect(blocked.status).toBe(422);
    expect(blocked.body.error.code).toBe('CONTENT_RULE_VIOLATION');
  });

  it('pra-moderasi: ulasan baru menunggu dan belum tampil publik', async () => {
    on();
    const res = await send(pasien, 'put', `/v1/reviews/${facilitySlug}`).send(review);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data).toMatchObject({ rating: 4, status: 'pending' });
    const pub = await api().get(`/v1/facilities/${facilitySlug}/reviews`);
    expect(pub.status).toBe(200);
    expect(pub.body.data.summary.count).toBe(0);
    expect(pub.body.data.items).toEqual([]);
  });

  it('disetujui: tampil dengan nama singkat, ringkasan per aspek, dan rating profil', async () => {
    on();
    const queue = await moderator.agent.get('/v1/admin/reviews');
    expect(queue.status).toBe(200);
    const item = (queue.body.data as { id: string; comment: string }[]).find((r) => r.comment === review.comment)!;
    expect((await send(moderator, 'post', `/v1/admin/reviews/${item.id}/approve`).send({})).status).toBe(200);

    const pub = await api().get(`/v1/facilities/${facilitySlug}/reviews`);
    expect(pub.body.data.summary).toMatchObject({ count: 1, average: 4, distribution: [0, 0, 0, 1, 0], sampleCount: 0 });
    expect(pub.body.data.summary.aspects).toContainEqual({ aspect: 'keramahan_staf', good: 1, answered: 1 });
    expect(pub.body.data.items[0]).toMatchObject({ rating: 4, sample: false, authorName: expect.stringMatching(/^Pengguna U\.$/) });

    const rating = await db().execute<{ rating_avg: string; rating_count: number }>(sql`SELECT rating_avg, rating_count FROM facility_ratings WHERE facility_id = ${doc.facilityId}`);
    expect(rating.rows[0]).toMatchObject({ rating_count: 1 });
    expect(Number(rating.rows[0]!.rating_avg)).toBe(4);
  });

  it('satu akun satu ulasan per profil; mengubah ulasan kembali ke antrean dan hilang dari publik', async () => {
    on();
    const res = await send(pasien, 'put', `/v1/reviews/${facilitySlug}`).send({ ...review, rating: 5 });
    expect(res.body.data).toMatchObject({ rating: 5, status: 'pending' });
    const n = await db().execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM reviews WHERE facility_id = ${doc.facilityId}`);
    expect(n.rows[0]!.n).toBe(1);
    expect((await api().get(`/v1/facilities/${facilitySlug}/reviews`)).body.data.summary.count).toBe(0);
    const rating = await db().execute(sql`SELECT 1 FROM facility_ratings WHERE facility_id = ${doc.facilityId}`);
    expect(rating.rows).toHaveLength(0);
    expect((await pasien.agent.get(`/v1/reviews/${facilitySlug}/mine`)).body.data).toMatchObject({ rating: 5, status: 'pending' });
  });

  it('ditolak dengan alasan; pasien melihat alasannya', async () => {
    on();
    const queue = await moderator.agent.get('/v1/admin/reviews');
    const id = (queue.body.data as { id: string }[])[0]!.id;
    expect((await send(moderator, 'post', `/v1/admin/reviews/${id}/reject`).send({})).status).toBe(400);
    expect((await send(moderator, 'post', `/v1/admin/reviews/${id}/reject`).send({ reason: 'Komentar menyebut nama pasien lain.' })).status).toBe(200);
    const mine = await pasien.agent.get(`/v1/reviews/${facilitySlug}/mine`);
    expect(mine.body.data).toMatchObject({ status: 'rejected', rejectionReason: 'Komentar menyebut nama pasien lain.' });
    expect((await send(moderator, 'post', `/v1/admin/reviews/${id}/approve`).send({})).status).toBe(409);
  });

  it('data contoh berlabel dan tidak masuk rating pencarian', async () => {
    on();
    await db().execute(sql`
      INSERT INTO reviews (facility_id, rating, aspects, comment, status, is_sample, declaration_version)
      VALUES (${doc.facilityId}, 5, '{"kenyamanan_tempat":"baik"}', 'Ruang tunggu bersih.', 'approved', true, 'contoh')
    `);
    const pub = await api().get(`/v1/facilities/${facilitySlug}/reviews`);
    expect(pub.body.data.summary).toMatchObject({ count: 1, sampleCount: 1 });
    expect(pub.body.data.items[0]).toMatchObject({ sample: true, authorName: null });
    await send(pasien2, 'put', `/v1/reviews/${facilitySlug}`).send({ rating: 3, declaration: true });
    const queue = await moderator.agent.get('/v1/admin/reviews');
    const id = (queue.body.data as { id: string }[])[0]!.id;
    await send(moderator, 'post', `/v1/admin/reviews/${id}/approve`).send({});
    const rating = await db().execute<{ rating_avg: string; rating_count: number }>(sql`SELECT rating_avg, rating_count FROM facility_ratings WHERE facility_id = ${doc.facilityId}`);
    expect(rating.rows[0]).toMatchObject({ rating_count: 1 });
    expect(Number(rating.rows[0]!.rating_avg)).toBe(3);
  });

  it('pasien bisa menghapus ulasannya; rating profil dihitung ulang', async () => {
    on();
    expect((await send(pasien2, 'delete', `/v1/reviews/${facilitySlug}`)).status).toBe(200);
    expect((await pasien2.agent.get(`/v1/reviews/${facilitySlug}/mine`)).body.data).toBeNull();
    const rating = await db().execute(sql`SELECT 1 FROM facility_ratings WHERE facility_id = ${doc.facilityId}`);
    expect(rating.rows).toHaveLength(0);
    expect((await send(pasien2, 'delete', `/v1/reviews/${facilitySlug}`)).status).toBe(404);
  });

  it('setiap tulis, ubah, hapus, dan keputusan tercatat di audit log', async () => {
    const r = await db().execute<{ action: string }>(sql`SELECT DISTINCT action FROM audit_logs WHERE entity = 'review' ORDER BY action`);
    expect(r.rows.map((x) => x.action)).toEqual(['review.approve', 'review.create', 'review.delete', 'review.reject', 'review.update']);
  });
});

describe('USP lanjutan: filter video dan biaya serta urutan biaya konsultasi di pencarian dokter', () => {
  let a: { user: TestUser; facilityId: string; slug: string };
  let b: { facilityId: string; slug: string };
  let c: { facilityId: string; slug: string };
  let d: { facilityId: string; slug: string };

  const slugs = async (query: Record<string, string>) => {
    const res = await api()
      .get('/v1/practitioners')
      .query({ city: CITY, limit: 50, ...query });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    return (res.body.data as { slug: string }[]).map((x) => x.slug);
  };

  beforeAll(async () => {
    await resetDb();
    await db().execute(sql`INSERT INTO data_sources (kind, title) VALUES ('faskes', 'Papan tarif uji USP')`);
    const moderator = await createUser({ role: 'moderator', mfa: true });
    a = await doctorWithPractice('dr. Uji Biaya Video', moderator);
    await addTariff(a.facilityId, 'konsultasi-dokter-spesialis', 175_000);
    const bytes = mp4Bytes(40);
    const vid = await uploadMediaWithConsent(
      a.user,
      a.facilityId,
      { kind: 'video', fileName: 'kenalan.mp4', mime: 'video/mp4', sizeBytes: bytes.length, durationSec: 40, consent: CONSENT_SELF },
      bytes,
    );
    expect(vid.status, JSON.stringify(vid.body)).toBe(200);
    expect((await send(moderator, 'post', `/v1/admin/media/${vid.body.data.id}/approve`).send({})).status).toBe(200);

    b = await doctorWithPractice('dr. Uji Biaya Saja', moderator);
    await addTariff(b.facilityId, 'konsultasi-dokter-umum', 100_000);
    c = await doctorWithPractice('dr. Uji Biaya Tanya', moderator);
    await addTariff(c.facilityId, 'konsultasi-dokter-umum', null, 'tanya');
    d = await doctorWithPractice('dr. Uji Biaya Tanpa', moderator);
  });

  it('fee=1: hanya dokter dengan biaya konsultasi berangka ("tanya" dan tanpa tarif tidak ikut)', async () => {
    expect((await slugs({ fee: '1' })).sort()).toEqual([a.slug, b.slug].sort());
  });

  it('video=1: hanya dokter dengan video perkenalan yang boleh tampil publik', async () => {
    expect(await slugs({ video: '1' })).toEqual([a.slug]);
    expect(await slugs({ video: '1', fee: '1' })).toEqual([a.slug]);
  });

  it('sort=fee_asc: biaya naik, yang tanpa biaya berangka di akhir menurut nama', async () => {
    expect(await slugs({ sort: 'fee_asc' })).toEqual([b.slug, a.slug, d.slug, c.slug]);
  });

  it('kartu /cari tanpa filter layanan membawa ringkasan: biaya konsultasi, jumlah dokter, video (evaluasi UI/UX A2)', async () => {
    const res = await api().get('/v1/facilities').query({ city: CITY, limit: 50 });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const items = (res.body.data as unknown[]).map((x) => facilityListItemSchema.parse(x));
    const byId = new Map(items.map((i) => [i.id, i]));
    expect(byId.get(a.facilityId)).toMatchObject({ publishedTariffCount: 1, consultationFeeMin: 175_000, practitionerCount: 1, hasVideo: true, price: null });
    expect(byId.get(b.facilityId)).toMatchObject({ consultationFeeMin: 100_000, practitionerCount: 1, hasVideo: false });
    // "Tanya" bukan angka: tidak dijadikan biaya konsultasi.
    expect(byId.get(c.facilityId)).toMatchObject({ publishedTariffCount: 1, consultationFeeMin: null });
    expect(byId.get(d.facilityId)).toMatchObject({ publishedTariffCount: 0, consultationFeeMin: null, hasVideo: false });
  });

  it('video yang persetujuannya dicabut tidak lagi lolos filter video', async () => {
    await db().execute(sql`UPDATE media_consents SET revoked_at = now(), revoke_reason = 'uji' WHERE facility_id = ${a.facilityId}`);
    expect(await slugs({ video: '1' })).toEqual([]);
  });

  it('ringkasan kartu /cari ikut aturan persetujuan: video yang dicabut tidak lagi dihitung', async () => {
    const res = await api().get('/v1/facilities').query({ city: CITY, limit: 50 });
    const item = (res.body.data as { id: string; hasVideo: boolean }[]).find((i) => i.id === a.facilityId)!;
    expect(item.hasVideo).toBe(false);
  });

  it('nilai filter tidak sah ditolak 400', async () => {
    const res = await api().get('/v1/practitioners').query({ video: 'mungkin' });
    expect(res.status).toBe(400);
  });
});

describe('USP lanjutan: kesiapan profil di portal (GET /portal/facilities/:id/readiness)', () => {
  let moderator: TestUser;
  let doc: { user: TestUser; facilityId: string; slug: string };
  const readiness = async (user: TestUser, facilityId: string) => {
    const res = await user.agent.get(`/v1/portal/facilities/${facilityId}/readiness`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    return profileReadinessSchema.parse(res.body.data);
  };
  const state = (r: { checks: { item: string; state: string; done: boolean }[] }, item: string) => r.checks.find((c) => c.item === item);

  beforeAll(async () => {
    await resetDb();
    await db().execute(sql`INSERT INTO data_sources (kind, title) VALUES ('faskes', 'Papan tarif uji USP')`);
    moderator = await createUser({ role: 'moderator', mfa: true });
    doc = await doctorWithPractice('dr. Uji Kesiapan', moderator);
  });

  it('praktik dokter baru: biaya dan video belum, info kunjungan dari formulir pembuatan sudah', async () => {
    const r = await readiness(doc.user, doc.facilityId);
    expect(r.published).toBe(true);
    expect(state(r, 'biaya_konsultasi')).toMatchObject({ done: false, state: 'tidak_ada' });
    expect(state(r, 'video')).toMatchObject({ done: false, state: 'tidak_ada' });
    expect(state(r, 'jadwal')?.done).toBe(true);
    expect(state(r, 'lokasi')?.done).toBe(true);
    expect(r.pillars).toMatchObject({ biaya: false, kenal: false });
  });

  it('biaya "tanya" belum cukup; biaya berangka memenuhi pilar biaya (sama dengan halaman publik)', async () => {
    await addTariff(doc.facilityId, 'konsultasi-dokter-umum', null, 'tanya');
    expect(state(await readiness(doc.user, doc.facilityId), 'biaya_konsultasi')?.state).toBe('tanya');
    await addTariff(doc.facilityId, 'konsultasi-dokter-spesialis', 150_000);
    const r = await readiness(doc.user, doc.facilityId);
    expect(state(r, 'biaya_konsultasi')).toMatchObject({ done: true, state: 'angka' });
    expect(r.pillars.biaya).toBe(true);
  });

  it('video: menunggu moderasi → publik setelah disetujui → tanpa_persetujuan bila persetujuan dicabut', async () => {
    const bytes = mp4Bytes(30);
    const vid = await uploadMediaWithConsent(
      doc.user,
      doc.facilityId,
      { kind: 'video', fileName: 'kenalan.mp4', mime: 'video/mp4', sizeBytes: bytes.length, durationSec: 30, consent: CONSENT_SELF },
      bytes,
    );
    expect(vid.status, JSON.stringify(vid.body)).toBe(200);
    expect(state(await readiness(doc.user, doc.facilityId), 'video')?.state).toBe('menunggu');
    expect((await send(moderator, 'post', `/v1/admin/media/${vid.body.data.id}/approve`).send({})).status).toBe(200);
    expect(state(await readiness(doc.user, doc.facilityId), 'video')).toMatchObject({ done: true, state: 'publik' });
    await db().execute(sql`UPDATE media_consents SET revoked_at = now(), revoke_reason = 'uji' WHERE facility_id = ${doc.facilityId}`);
    expect(state(await readiness(doc.user, doc.facilityId), 'video')).toMatchObject({ done: false, state: 'tanpa_persetujuan' });
  });

  it('hanya anggota profil yang boleh melihat kesiapan', async () => {
    const other = await createUser({ partner: { type: 'tenaga_medis' } });
    expect((await other.agent.get(`/v1/portal/facilities/${doc.facilityId}/readiness`)).status).toBe(403);
    expect((await api().get(`/v1/portal/facilities/${doc.facilityId}/readiness`)).status).toBe(401);
  });
});
