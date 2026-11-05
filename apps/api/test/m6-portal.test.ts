import { and, eq } from 'drizzle-orm';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { auditLogs, services } from '@silk/db';
import { FACILITY_IDS, TARIFF_IDS } from '@silk/db/seed';
import { db } from '../src/lib/db';
import { attachProof, createUser, getApp, resetDb, send, testOutbox, uploadTo, type TestUser } from './helpers';

/**
 * Sejak Fase 2 (K3, K4): harga dari portal menjadi permintaan yang dimoderasi, dan perubahan profil
 * terbit menjadi revisi. Versi tarif baru hanya ditulis saat moderator menyetujui.
 */
describe('M6 Papan tarif faskes', () => {
  let faskes: TestUser;
  let lab: TestUser;
  let moderator: TestUser;

  beforeAll(async () => {
    await resetDb();
    faskes = await createUser({ facilityIds: [FACILITY_IDS.klinikPratama], partner: { type: 'fasilitas' } });
    lab = await createUser({ facilityIds: [FACILITY_IDS.labBelumKlaim], partner: { type: 'fasilitas', facilityKind: 'laboratorium' } });
    moderator = await createUser({ role: 'moderator', mfa: true });
  });

  async function history(tariffId: string) {
    const res = await request(getApp()).get(`/v1/tariffs/${tariffId}/history`);
    return res.body.data.map((v: { versionNo: number; price: { min: number } }) => [v.versionNo, v.price.min]);
  }

  it('M2-2/K4: mengubah harga membuat permintaan; versi +1 baru ada setelah disetujui', async () => {
    const res = await send(faskes, 'put', `/v1/portal/tariffs/${TARIFF_IDS.pratamaHb}`).send({
      priceType: 'tetap',
      priceMin: 40000,
      effectiveFrom: '2026-10-01',
      expectedVersionNo: 1,
      sourceTitle: 'Papan tarif klinik Oktober 2026',
    });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.data).toMatchObject({ status: 'pending' });
    expect(await history(TARIFF_IDS.pratamaHb)).toEqual([[1, 35000]]);
    // Notifikasi email ke pengelola saat harga diajukan (mitigasi akun diambil alih)
    expect(testOutbox.some((m) => m.kind === 'tariff-request' && m.to === faskes.email)).toBe(true);

    await attachProof(faskes, res.body.data.requestId);
    const approved = await send(moderator, 'post', `/v1/admin/tariff-requests/${res.body.data.requestId}/approve`).send({});
    expect(approved.status, JSON.stringify(approved.body)).toBe(200);
    expect(await history(TARIFF_IDS.pratamaHb)).toEqual([
      [2, 40000],
      [1, 35000],
    ]);
  });

  it('M6-3: permintaan dan persetujuan tercatat di audit log dengan nilai sebelum dan sesudah', async () => {
    const [created] = await db()
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.action, 'tariff.request.create'), eq(auditLogs.actorId, faskes.id)));
    expect((created!.before as { priceMin: number }).priceMin).toBe(35000);
    expect((created!.after as { request: { priceMin: number } }).request.priceMin).toBe(40000);
    expect(created!.ip).toBeTruthy();
    const [approved] = await db()
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.action, 'tariff.request.approve'), eq(auditLogs.actorId, moderator.id)));
    expect((approved!.before as { priceMin: number }).priceMin).toBe(35000);
    expect((approved!.after as { version: { priceMin: number; verification: string } }).version).toMatchObject({
      priceMin: 40000,
      verification: 'diverifikasi_admin',
    });
  });

  it('versi kedaluwarsa = 409 TARIFF_VERSION_CONFLICT', async () => {
    const res = await send(faskes, 'put', `/v1/portal/tariffs/${TARIFF_IDS.pratamaHb}`).send({
      priceType: 'tetap',
      priceMin: 41000,
      effectiveFrom: '2026-10-01',
      expectedVersionNo: 1,
      sourceTitle: 'Papan tarif klinik',
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
      sourceTitle: 'Papan tarif klinik',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('K4: sumber harga wajib', async () => {
    const res = await send(faskes, 'put', `/v1/portal/tariffs/${TARIFF_IDS.pratamaHb}`).send({
      priceType: 'tetap',
      priceMin: 42000,
      effectiveFrom: '2026-10-01',
      expectedVersionNo: 2,
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.error.details)).toContain('sourceTitle');
  });

  it('M17: deskripsi "klinik terbaik di Malang" ditolak dan menyebut kata yang melanggar', async () => {
    const res = await send(faskes, 'put', `/v1/portal/facilities/${FACILITY_IDS.klinikPratama}`).send({
      description: 'Klinik terbaik di Malang',
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CONTENT_RULE_VIOLATION');
    expect(res.body.error.message).toContain('terbaik');
  });

  it('K3: perubahan profil terbit menjadi revisi; publik tetap data lama', async () => {
    const res = await send(faskes, 'put', `/v1/portal/facilities/${FACILITY_IDS.klinikPratama}`).send({
      phone: '0341-111222',
      lat: -7.97,
      lng: 112.63,
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data.revision).toMatchObject({ status: 'pending' });
    expect(res.body.data.phone).not.toBe('0341-111222');
    expect(res.body.data.pendingRevision.payload.phone).toBe('0341-111222');
    const pub = await request(getApp()).get('/v1/facilities/klinik-pratama-sehat-contoh');
    expect(pub.body.data.phone).not.toBe('0341-111222');
    const [log] = await db()
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.action, 'profile.revision.submit'), eq(auditLogs.actorId, faskes.id)));
    expect(log).toBeTruthy();
  });

  it('tambah tarif layanan baru: menjadi permintaan, tidak tampil publik sebelum disetujui', async () => {
    const [svc] = await db().select().from(services).where(eq(services.slug, 'asam-urat'));
    const res = await send(lab, 'post', `/v1/portal/facilities/${FACILITY_IDS.labBelumKlaim}/tariffs`).send({
      serviceId: svc!.id,
      priceType: 'tetap',
      priceMin: 30000,
      effectiveFrom: '2026-10-01',
      sourceTitle: 'Brosur laboratorium',
    });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.data.status).toBe('pending');
    const pub = await request(getApp()).get('/v1/facilities/laboratorium-contoh-belum-diklaim');
    expect(pub.body.data.tariffs).toHaveLength(0);
    const list = await lab.agent.get(`/v1/portal/facilities/${FACILITY_IDS.labBelumKlaim}/tariff-requests`);
    expect(list.body.data.map((r: { id: string }) => r.id)).toContain(res.body.data.requestId);
  });

  it('tambah paket dengan komponen; paket dibuat saat disetujui', async () => {
    const [svc] = await db().select().from(services).where(eq(services.slug, 'mcu-pra-kerja'));
    const res = await send(faskes, 'post', `/v1/portal/facilities/${FACILITY_IDS.klinikPratama}/tariffs`).send({
      serviceId: svc!.id,
      priceType: 'paket',
      priceMin: 250000,
      effectiveFrom: '2026-10-01',
      sourceTitle: 'Brosur MCU',
      package: { name: 'MCU Kerja', components: [{ label: 'Pemeriksaan fisik', included: true }, { label: 'Rontgen thorax', included: false }] },
    });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    await attachProof(faskes, res.body.data.requestId);
    const approved = await send(moderator, 'post', `/v1/admin/tariff-requests/${res.body.data.requestId}/approve`).send({});
    expect(approved.status, JSON.stringify(approved.body)).toBe(200);
    const list = await faskes.agent.get(`/v1/portal/facilities/${FACILITY_IDS.klinikPratama}/tariffs`);
    const pkg = list.body.data.find((t: { packageName: string | null }) => t.packageName === 'MCU Kerja');
    expect(pkg.components).toHaveLength(2);
    expect(pkg.verification).toBe('diverifikasi_admin');
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

  it('K4: CSV milik sendiri menjadi satu permintaan; terbit diverifikasi admin setelah disetujui', async () => {
    const csv = header + 'Klinik Pratama Sehat Contoh,Kota Malang,asam-urat,tetap,28.000,,2026-10-15,Papan tarif,\n';
    const res = await uploadCsv(faskes, FACILITY_IDS.klinikPratama, csv);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.data).toMatchObject({ status: 'pending', rowsValid: 1 });
    const before = await request(getApp()).get('/v1/facilities/klinik-pratama-sehat-contoh');
    expect(before.body.data.tariffs.find((t: { service: { slug: string } }) => t.service.slug === 'asam-urat')).toBeUndefined();

    // Admin tidak bisa menerbitkan batch portal tanpa lewat permintaan
    const direct = await send(moderator, 'post', `/v1/admin/imports/${res.body.data.batchId}/publish`).send({});
    expect(direct.status).toBe(422);
    expect(direct.body.error.code).toBe('IMPORT_NOT_READY');

    await attachProof(faskes, res.body.data.requestId);
    const approved = await send(moderator, 'post', `/v1/admin/tariff-requests/${res.body.data.requestId}/approve`).send({});
    expect(approved.status, JSON.stringify(approved.body)).toBe(200);
    const pub = await request(getApp()).get('/v1/facilities/klinik-pratama-sehat-contoh');
    const au = pub.body.data.tariffs.find((t: { service: { slug: string } }) => t.service.slug === 'asam-urat');
    expect(au.price.min).toBe(28000);
    expect(au.trust.verification).toBe('diverifikasi_admin');
  });

  it('kunci objek milik faskes lain tidak bisa dipakai untuk impor', async () => {
    const res = await send(faskes, 'post', `/v1/portal/facilities/${FACILITY_IDS.klinikPratama}/tariffs/import`).send({
      objectKey: `imports/facility/${FACILITY_IDS.labMedika}/x.csv`,
    });
    expect(res.status).toBe(403);
  });

  it('K11: pengelola yang data mitranya belum diverifikasi tidak bisa mengajukan harga', async () => {
    const pending = await createUser({ facilityIds: [FACILITY_IDS.klinikPratama], partner: { type: 'fasilitas', status: 'pending' } });
    const res = await send(pending, 'put', `/v1/portal/tariffs/${TARIFF_IDS.pratamaHb}`).send({
      priceType: 'tetap',
      priceMin: 45000,
      effectiveFrom: '2026-10-01',
      expectedVersionNo: 2,
      sourceTitle: 'Papan tarif klinik',
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PARTNER_NOT_VERIFIED');
  });
});
