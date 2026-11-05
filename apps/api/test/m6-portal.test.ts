import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { auditLogs, services } from '@silk/db';
import { FACILITY_IDS, TARIFF_IDS } from '@silk/db/seed';
import { db } from '../src/lib/db';
import { createUser, getApp, resetDb, send, testOutbox, uploadTo, type TestUser } from './helpers';

describe('M6 Papan tarif faskes', () => {
  let faskes: TestUser;
  let unverified: TestUser;

  beforeAll(async () => {
    await resetDb();
    faskes = await createUser({ facilityIds: [FACILITY_IDS.klinikPratama] });
    unverified = await createUser({ facilityIds: [FACILITY_IDS.labBelumKlaim] });
  });

  it('M2-2: mengubah harga membuat versi +1; versi lama tetap dapat dibaca', async () => {
    const res = await send(faskes, 'put', `/v1/portal/tariffs/${TARIFF_IDS.pratamaHb}`).send({
      priceType: 'tetap',
      priceMin: 40000,
      effectiveFrom: '2026-10-01',
      expectedVersionNo: 1,
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data).toMatchObject({ versionNo: 2, status: 'terbit' });
    const history = await request(getApp()).get(`/v1/tariffs/${TARIFF_IDS.pratamaHb}/history`);
    expect(history.body.data.map((v: { versionNo: number; price: { min: number } }) => [v.versionNo, v.price.min])).toEqual([
      [2, 40000],
      [1, 35000],
    ]);
    // Notifikasi email ke pengelola saat tarif berubah
    expect(testOutbox.some((m) => m.kind === 'tariff-changed' && m.to === faskes.email)).toBe(true);
  });

  it('M6-3: perubahan tarif tercatat di audit log dengan nilai sebelum dan sesudah', async () => {
    const [log] = await db()
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityId, TARIFF_IDS.pratamaHb), eq(auditLogs.action, 'tariff.version.create')));
    expect(log).toBeTruthy();
    expect((log!.before as { priceMin: number }).priceMin).toBe(35000);
    expect((log!.after as { priceMin: number }).priceMin).toBe(40000);
    expect(log!.actorId).toBe(faskes.id);
    expect(log!.ip).toBeTruthy();
  });

  it('versi kedaluwarsa = 409 TARIFF_VERSION_CONFLICT', async () => {
    const res = await send(faskes, 'put', `/v1/portal/tariffs/${TARIFF_IDS.pratamaHb}`).send({
      priceType: 'tetap',
      priceMin: 41000,
      effectiveFrom: '2026-10-01',
      expectedVersionNo: 1,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TARIFF_VERSION_CONFLICT');
  });

  it('M2-1: rentang dengan price_max < price_min = 400 VALIDATION_FAILED', async () => {
    const res = await send(faskes, 'put', `/v1/portal/tariffs/${TARIFF_IDS.pratamaHb}`).send({
      priceType: 'rentang',
      priceMin: 50000,
      priceMax: 10000,
      effectiveFrom: '2026-10-01',
      expectedVersionNo: 2,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('M17: deskripsi "klinik terbaik di Malang" ditolak dan menyebut kata yang melanggar', async () => {
    const res = await send(faskes, 'put', `/v1/portal/facilities/${FACILITY_IDS.klinikPratama}`).send({
      description: 'Klinik terbaik di Malang',
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CONTENT_RULE_VIOLATION');
    expect(res.body.error.message).toContain('terbaik');
  });

  it('profil dapat diubah dan tercatat di audit', async () => {
    const res = await send(faskes, 'put', `/v1/portal/facilities/${FACILITY_IDS.klinikPratama}`).send({
      phone: '0341-111222',
      lat: -7.97,
      lng: 112.63,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe('0341-111222');
    expect(res.body.data.lat).toBeCloseTo(-7.97, 4);
  });

  it('tambah tarif: faskes belum terverifikasi → menunggu tinjauan, tidak tampil publik', async () => {
    const [svc] = await db().select().from(services).where(eq(services.slug, 'asam-urat'));
    const res = await send(unverified, 'post', `/v1/portal/facilities/${FACILITY_IDS.labBelumKlaim}/tariffs`).send({
      serviceId: svc!.id,
      priceType: 'tetap',
      priceMin: 30000,
      effectiveFrom: '2026-10-01',
    });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.data.status).toBe('menunggu_tinjauan');
    const pub = await request(getApp()).get('/v1/facilities/laboratorium-contoh-belum-diklaim');
    expect(pub.body.data.tariffs).toHaveLength(0);
  });

  it('tambah paket dengan komponen', async () => {
    const [svc] = await db().select().from(services).where(eq(services.slug, 'mcu-pra-kerja'));
    const res = await send(faskes, 'post', `/v1/portal/facilities/${FACILITY_IDS.klinikPratama}/tariffs`).send({
      serviceId: svc!.id,
      priceType: 'paket',
      priceMin: 250000,
      effectiveFrom: '2026-10-01',
      package: { name: 'MCU Kerja', components: [{ label: 'Pemeriksaan fisik', included: true }, { label: 'Rontgen thorax', included: false }] },
    });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const list = await faskes.agent.get(`/v1/portal/facilities/${FACILITY_IDS.klinikPratama}/tariffs`);
    const pkg = list.body.data.find((t: { id: string }) => t.id === res.body.data.id);
    expect(pkg.components).toHaveLength(2);
  });

  async function uploadCsv(user: TestUser, facilityId: string, csv: string) {
    const presign = await send(user, 'post', `/v1/portal/facilities/${facilityId}/tariffs/import/presign`).send({
      fileName: 'tarif.csv',
      sizeBytes: Buffer.byteLength(csv),
    });
    expect(presign.status, JSON.stringify(presign.body)).toBe(201);
    const put = await uploadTo(presign.body.data, Buffer.from(csv));
    expect(put.status).toBe(200);
    return send(user, 'post', `/v1/portal/facilities/${facilityId}/tariffs/import`).send({ objectKey: presign.body.data.objectKey });
  }

  const header = 'facility_name,city,service_slug,price_type,price_min,price_max,effective_from,source_title,source_url\n';

  it('M6-2: CSV berisi tarif faskes lain ditolak seluruhnya', async () => {
    const csv =
      header +
      'Klinik Pratama Sehat Contoh,Kota Malang,asam-urat,tetap,28000,,2026-10-15,Papan tarif,\n' +
      'Laboratorium Klinik Contoh Medika,Kota Malang,asam-urat,tetap,1000,,2026-10-15,Papan tarif,\n';
    const res = await uploadCsv(faskes, FACILITY_IDS.klinikPratama, csv);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('IMPORT_ROW_INVALID');
    expect(JSON.stringify(res.body.error.details)).toContain('FACILITY_MISMATCH');
    // Baris valid milik sendiri pun tidak terbit
    const pub = await request(getApp()).get('/v1/facilities/klinik-pratama-sehat-contoh');
    expect(pub.body.data.tariffs.find((t: { service: { slug: string } }) => t.service.slug === 'asam-urat')).toBeUndefined();
  });

  it('CSV milik sendiri yang valid langsung terbit (faskes terverifikasi)', async () => {
    const csv = header + 'Klinik Pratama Sehat Contoh,Kota Malang,asam-urat,tetap,28.000,,2026-10-15,Papan tarif,\n';
    const res = await uploadCsv(faskes, FACILITY_IDS.klinikPratama, csv);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.data).toMatchObject({ created: 1, skipped: 0 });
    const pub = await request(getApp()).get('/v1/facilities/klinik-pratama-sehat-contoh');
    const au = pub.body.data.tariffs.find((t: { service: { slug: string } }) => t.service.slug === 'asam-urat');
    expect(au.price.min).toBe(28000);
    expect(au.trust.verification).toBe('diisi_faskes');
  });

  it('kunci objek milik faskes lain tidak bisa dipakai untuk impor', async () => {
    const res = await send(faskes, 'post', `/v1/portal/facilities/${FACILITY_IDS.klinikPratama}/tariffs/import`).send({
      objectKey: `imports/facility/${FACILITY_IDS.labMedika}/x.csv`,
    });
    expect(res.status).toBe(403);
  });
});
