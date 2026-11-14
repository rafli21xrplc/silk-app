import { eq } from 'drizzle-orm';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { partners } from '@silk/db';
import { TARIFF_IDS } from '@silk/db/seed';
import { db } from '../src/lib/db';
import { createUser, getApp, resetDb, type TestUser } from './helpers';

/** Pencarian `q` di daftar admin (aditif): cocok sebagian, tanpa beda huruf, aman dari wildcard. */
describe('Admin: pencarian daftar dengan q', () => {
  let admin: TestUser;
  let apotek: TestUser;

  beforeAll(async () => {
    await resetDb();
    admin = await createUser({ role: 'admin', mfa: true });
    apotek = await createUser({ partner: { type: 'apotek', status: 'pending' } });
    await createUser({ partner: { type: 'fasilitas', status: 'pending' } });
    await db().update(partners).set({ businessName: 'Apotek Sehat Sentosa' }).where(eq(partners.userId, apotek.id));
  });

  const ids = (body: { data: { id: string }[] }) => body.data.map((r) => r.id);

  it('mitra: cocok nama usaha sebagian tanpa beda huruf besar/kecil', async () => {
    const all = await admin.agent.get('/v1/admin/partners').query({ status: 'pending' });
    expect(all.status).toBe(200);
    expect(all.body.data.length).toBeGreaterThanOrEqual(2);
    const hit = await admin.agent.get('/v1/admin/partners').query({ status: 'pending', q: 'sehat SENT' });
    expect(hit.status).toBe(200);
    expect(hit.body.data).toHaveLength(1);
    expect(hit.body.data[0].businessName).toBe('Apotek Sehat Sentosa');
  });

  it('mitra: cocok email pemohon', async () => {
    const hit = await admin.agent.get('/v1/admin/partners').query({ status: 'pending', q: apotek.email.slice(0, 8) });
    expect(hit.body.data.map((r: { userEmail: string }) => r.userEmail)).toContain(apotek.email);
  });

  it('wildcard % dan _ diperlakukan sebagai huruf biasa', async () => {
    const res = await admin.agent.get('/v1/admin/partners').query({ status: 'pending', q: '%' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('q kosong atau spasi = tanpa saring', async () => {
    const all = await admin.agent.get('/v1/admin/partners').query({ status: 'pending' });
    const blank = await admin.agent.get('/v1/admin/partners').query({ status: 'pending', q: '   ' });
    expect(ids(blank.body)).toEqual(ids(all.body));
  });

  it('q lebih dari 100 karakter ditolak', async () => {
    const res = await admin.agent.get('/v1/admin/partners').query({ status: 'pending', q: 'a'.repeat(101) });
    expect(res.status).toBe(400);
  });

  it('laporan data: cocok nama faskes atau layanan', async () => {
    const report = await request(getApp()).post('/v1/reports').send({ tariffId: TARIFF_IDS.pratamaHb, reason: 'Harga di kasir berbeda dengan yang tertera' });
    expect(report.status).toBe(201);
    const hit = await admin.agent.get('/v1/admin/reports').query({ q: 'hemoglobin' });
    expect(ids(hit.body)).toContain(report.body.data.id);
    const miss = await admin.agent.get('/v1/admin/reports').query({ q: 'tidak-ada-yang-cocok' });
    expect(miss.body.data).toEqual([]);
  });

  it('antrean lain menerima q tanpa galat', async () => {
    for (const path of ['claims', 'tariffs', 'imports', 'tariff-requests', 'profile-revisions', 'media', 'articles']) {
      const res = await admin.agent.get(`/v1/admin/${path}`).query({ q: 'contoh' });
      expect(res.status, `${path}: ${JSON.stringify(res.body)}`).toBe(200);
    }
  });
});
