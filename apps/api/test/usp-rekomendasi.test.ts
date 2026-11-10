import { eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { partners } from '@silk/db';
import { practitionerDetailSchema, practitionerListItemSchema } from '@silk/shared';
import { db } from '../src/lib/db';
import { createUser, getApp, resetDb, send, type TestUser } from './helpers';

/**
 * Rekomendasi evaluasi USP (docs/evaluasi/usp-evaluasi-2026-11-10.md).
 * R3: biaya konsultasi dokter dari tarif kategori `konsultasi` di profil praktik utama.
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
