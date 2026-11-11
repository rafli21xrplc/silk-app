import { eq } from 'drizzle-orm';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { auditLogs, services } from '@silk/db';
import { FACILITY_IDS, TARIFF_IDS } from '@silk/db/seed';
import { db } from '../src/lib/db';
import { createUser, getApp, resetDb, send, testOutbox, type TestUser } from './helpers';

describe('M15 Panel admin dan M17 filter konten', () => {
  let admin: TestUser;
  let moderator: TestUser;
  let faskes: TestUser;

  beforeAll(async () => {
    await resetDb();
    admin = await createUser({ role: 'admin', mfa: true });
    moderator = await createUser({ role: 'moderator', mfa: true });
    faskes = await createUser({ facilityIds: [FACILITY_IDS.klinikPratama], partner: { type: 'fasilitas' } });
  });

  it('M17: admin menambah aturan tanpa deploy dan langsung berlaku', async () => {
    const before = await send(faskes, 'put', `/v1/portal/facilities/${FACILITY_IDS.klinikPratama}`).send({ description: 'Layanan kilat se-Malang' });
    expect(before.status).toBe(200);
    const created = await send(admin, 'post', '/v1/admin/content-rules').send({ pattern: 'kilat', kind: 'kata', level: 'blokir' });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const after = await send(faskes, 'put', `/v1/portal/facilities/${FACILITY_IDS.klinikPratama}`).send({ description: 'Layanan kilat se-Malang' });
    expect(after.status).toBe(422);
    expect(after.body.error.message).toContain('kilat');
  });

  it('pola regex tidak valid ditolak', async () => {
    const res = await send(admin, 'post', '/v1/admin/content-rules').send({ pattern: '(tidak ditutup', kind: 'regex' });
    expect(res.status).toBe(400);
  });

  it('aturan tingkat tinjau: permintaan harga ditandai perlu ditinjau dan masuk antrean moderator', async () => {
    const [svc] = await db().select().from(services).where(eq(services.slug, 'kolesterol-total'));
    const res = await send(faskes, 'post', `/v1/portal/facilities/${FACILITY_IDS.klinikPratama}/tariffs`).send({
      serviceId: svc!.id,
      priceType: 'tetap',
      priceMin: 45000,
      effectiveFrom: '2026-10-01',
      inclusions: 'Ada promo pelajar',
      sourceTitle: 'Papan tarif klinik',
    });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.data).toMatchObject({ status: 'pending', needsReview: true });
    const queue = await moderator.agent.get('/v1/admin/tariff-requests');
    expect(queue.body.data.map((t: { id: string }) => t.id)).toContain(res.body.data.requestId);
    const overview = await moderator.agent.get('/v1/admin/overview');
    expect(overview.body.data.tariffRequests).toBeGreaterThanOrEqual(1);
  });

  it('admin mengubah status faskes; setiap aksi tercatat di audit log dengan IP', async () => {
    const res = await send(admin, 'patch', `/v1/admin/facilities/${FACILITY_IDS.rsDraft}`).send({ status: 'terbit' });
    expect(res.status).toBe(200);
    expect((await request(getApp()).get('/v1/facilities/rs-contoh-draf')).status).toBe(200);
    const logs = await admin.agent.get('/v1/admin/audit-logs').query({ entity: 'facility', entityId: FACILITY_IDS.rsDraft });
    expect(logs.status).toBe(200);
    expect(logs.body.data[0]).toMatchObject({ action: 'facility.admin_update', actorId: admin.id });
    expect(logs.body.data[0].ip).toBeTruthy();
  });

  it('laporan data publik masuk antrean, menautkan versi tarif, dan pelapor dikabari', async () => {
    const report = await request(getApp())
      .post('/v1/reports')
      .send({ tariffId: TARIFF_IDS.pratamaHb, reason: 'Harga di kasir berbeda dengan yang tertera', contactEmail: 'pelapor@contoh.test' });
    expect(report.status, JSON.stringify(report.body)).toBe(201);
    const queue = await moderator.agent.get('/v1/admin/reports');
    const item = queue.body.data.find((r: { id: string }) => r.id === report.body.data.id);
    expect(item.tariffVersionId).toBeTruthy();
    expect(item.hasContact).toBe(true);
    expect(JSON.stringify(queue.body)).not.toContain('pelapor@contoh.test');
    const handled = await send(moderator, 'patch', `/v1/admin/reports/${item.id}`).send({ status: 'selesai', note: 'Sudah dikonfirmasi ke faskes' });
    expect(handled.status).toBe(200);
    expect(testOutbox.some((m) => m.kind === 'report-status' && m.to === 'pelapor@contoh.test')).toBe(true);
  });

  it('laporan publik dibatasi 5 per menit per IP', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await request(getApp())
        .post('/v1/reports')
        .set('X-Forwarded-For', '203.0.113.77')
        .send({ tariffId: TARIFF_IDS.pratamaHb, reason: 'Uji batas laju laporan publik' });
      statuses.push(r.status);
    }
    expect(statuses.slice(0, 5).every((s) => s === 201)).toBe(true);
    expect(statuses[5]).toBe(429);
  });

  it('audit log menyimpan aksi admin konten', async () => {
    const rows = await db().select().from(auditLogs).where(eq(auditLogs.action, 'content_rule.create'));
    expect(rows).toHaveLength(1);
  });

  it('aturan konten aktif tersedia publik (untuk memeriksa artikel CMS); aturan nonaktif tidak ikut', async () => {
    const created = await send(admin, 'post', '/v1/admin/content-rules').send({ pattern: 'ajaib', kind: 'kata', level: 'blokir' });
    expect(created.status).toBe(201);
    const pub = await request(getApp()).get('/v1/content-rules/active');
    expect(pub.status).toBe(200);
    expect(pub.headers['cache-control']).toContain('s-maxage');
    expect(pub.body.data.map((r: { pattern: string }) => r.pattern)).toContain('ajaib');
    const off = await send(admin, 'patch', `/v1/admin/content-rules/${created.body.data.id}`).send({ active: false });
    expect(off.status).toBe(200);
    const after = await request(getApp()).get('/v1/content-rules/active');
    expect(after.body.data.map((r: { pattern: string }) => r.pattern)).not.toContain('ajaib');
  });

  it('ringkasan antrean admin: angka sesuai; faskes dan anonim ditolak', async () => {
    const res = await admin.agent.get('/v1/admin/overview');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      claims: expect.any(Number),
      tariffs: expect.any(Number),
      reports: expect.any(Number),
      imports: expect.any(Number),
      profiles: expect.any(Number),
      revisions: expect.any(Number),
      media: expect.any(Number),
      tariffRequests: expect.any(Number),
      articles: expect.any(Number),
    });
    const queue = await admin.agent.get('/v1/admin/tariffs').query({ status: 'menunggu_tinjauan', limit: 100 });
    expect(res.body.data.tariffs).toBe(queue.body.data.length);
    expect((await faskes.agent.get('/v1/admin/overview')).status).toBe(403);
    expect((await request(getApp()).get('/v1/admin/overview')).status).toBe(401);
  });
});
