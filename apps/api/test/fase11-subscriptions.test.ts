import { sql } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { FACILITY_IDS } from '@silk/db/seed';
import { callbackSignature, signatureEquals, SIMULATOR_API_KEY, SIMULATOR_MERCHANT_CODE } from '../src/lib/duitku';
import { db } from '../src/lib/db';
import { resetEnvCacheForTests } from '../src/lib/env';
import { createUser, getApp, resetDb, send, type TestUser } from './helpers';

/**
 * Fase 11: langganan mitra dengan pembayaran Duitku (mode simulator: tanpa kunci, tanpa jaringan).
 * Kriteria: nominal dari server, callback wajib tanda tangan dan nominal cocok, idempoten, status dari callback
 * bukan URL kembali, flag OFF = 404, dan urutan hasil pencarian tidak berubah karena langganan (aturan mutlak 1).
 */
const api = () => request(getApp());
const CALLBACK = '/v1/payments/duitku/callback';

function signedCallback(merchantOrderId: string, amount: number | string, resultCode = '00', reference = 'SIMREF') {
  const a = String(amount);
  return {
    merchantCode: SIMULATOR_MERCHANT_CODE,
    amount: a,
    merchantOrderId,
    resultCode,
    reference,
    paymentCode: 'VC',
    signature: callbackSignature(SIMULATOR_MERCHANT_CODE, a, merchantOrderId, SIMULATOR_API_KEY),
  };
}
const postCallback = (body: Record<string, string>) => api().post(CALLBACK).type('form').send(body);

async function count(table: 'subscriptions' | 'payment_events', where = sql`true`) {
  const r = await db().execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM ${sql.raw(table)} WHERE ${where}`);
  return r.rows[0]!.n;
}

describe('Fase 11: langganan mitra + pembayaran Duitku', () => {
  let mitra: TestUser;
  let mitraLain: TestUser;
  let belumVerif: TestUser;

  beforeAll(async () => {
    await resetDb();
    mitra = await createUser({ partner: { type: 'fasilitas' }, facilityIds: [FACILITY_IDS.klinikPratama] });
    mitraLain = await createUser({ partner: { type: 'tenaga_medis' } });
    belumVerif = await createUser({ partner: { type: 'gaya_hidup', status: 'pending' } });
  });

  const on = () => {
    process.env.FEATURE_FLAGS = 'subscriptions_enabled';
    resetEnvCacheForTests();
  };
  afterEach(() => {
    delete process.env.FEATURE_FLAGS;
    resetEnvCacheForTests();
  });

  it('flag OFF: rute langganan, callback, dan simulator 404', async () => {
    expect((await mitra.agent.get('/v1/partners/me/subscription')).status).toBe(404);
    expect((await send(mitra, 'post', '/v1/partners/me/subscription/orders').send({ plan: 'bulanan' })).status).toBe(404);
    expect((await postCallback(signedCallback('SILK-X', 99000))).status).toBe(404);
    expect((await api().get('/v1/dev/duitku/pay').query({ order: 'x', reference: 'y' })).status).toBe(404);
  });

  it('mitra belum terverifikasi tidak bisa berlangganan; pasien tidak punya akses', async () => {
    on();
    const r = await send(belumVerif, 'post', '/v1/partners/me/subscription/orders').send({ plan: 'bulanan' });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('PARTNER_NOT_VERIFIED');
    const pasien = await createUser({ role: 'pasien' });
    expect((await pasien.agent.get('/v1/partners/me/subscription')).status).toBe(403);
  });

  it('ringkasan awal: belum aktif, daftar paket dari server, mode simulator', async () => {
    on();
    const r = await mitra.agent.get('/v1/partners/me/subscription');
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ activeUntil: null, periods: [], orders: [], providerMode: 'simulator' });
    expect(r.body.data.plans).toEqual([
      { id: 'bulanan', months: 1, price: 99000 },
      { id: 'tahunan', months: 12, price: 990000 },
    ]);
  });

  it('nominal dari server (nilai dari klien diabaikan); klik ganda memakai tagihan yang sama; CSRF wajib', async () => {
    on();
    expect((await mitra.agent.post('/v1/partners/me/subscription/orders').set('Origin', 'http://localhost:3000').send({ plan: 'bulanan' })).status).toBe(403);
    const a = await send(mitra, 'post', '/v1/partners/me/subscription/orders').send({ plan: 'bulanan', amount: 1 });
    expect(a.status, JSON.stringify(a.body)).toBe(201);
    expect(a.body.data).toMatchObject({ plan: 'bulanan', months: 1, amount: 99000, status: 'pending' });
    expect(a.body.data.merchantOrderId).toMatch(/^SILK-\d{8}-[0-9A-F]{16}$/);
    expect(a.body.data.paymentUrl).toContain('/v1/dev/duitku/pay?order=');
    const b = await send(mitra, 'post', '/v1/partners/me/subscription/orders').send({ plan: 'bulanan' });
    expect(b.body.data.id).toBe(a.body.data.id);
    expect((await send(mitra, 'post', '/v1/partners/me/subscription/orders').send({ plan: 'seumur-hidup' })).status).toBe(400);
  });

  it('callback: tanda tangan salah dan nominal tidak cocok ditolak, tetap tercatat, pesanan tetap pending', async () => {
    on();
    const order = (await send(mitra, 'post', '/v1/partners/me/subscription/orders').send({ plan: 'bulanan' })).body.data;
    const forged = { ...signedCallback(order.merchantOrderId, order.amount), signature: 'a'.repeat(64) };
    expect((await postCallback(forged)).status).toBe(400);
    // Tanda tangan sah untuk nominal lain (mis. kunci bocor + nominal dimanipulasi) tetap ditolak.
    expect((await postCallback(signedCallback(order.merchantOrderId, 1000))).status).toBe(400);
    expect((await postCallback({ merchantOrderId: order.merchantOrderId })).status).toBe(400);
    expect(await count('payment_events', sql`merchant_order_id = ${order.merchantOrderId} AND outcome IN ('rejected_signature','rejected_amount','malformed')`)).toBe(3);
    const after = await mitra.agent.get(`/v1/partners/me/subscription/orders/${order.id}`);
    expect(after.body.data.status).toBe('pending');
  });

  it('URL kembali tidak mengubah status; callback sah → lunas + masa aktif; callback ulang idempoten', async () => {
    on();
    const order = (await send(mitra, 'post', '/v1/partners/me/subscription/orders').send({ plan: 'bulanan' })).body.data;
    // Portal hanya membaca status; resultCode=00 di URL kembali tidak berarti lunas.
    expect((await mitra.agent.get(`/v1/partners/me/subscription/orders/${order.id}`).query({ resultCode: '00' })).body.data.status).toBe('pending');

    const ok = await postCallback(signedCallback(order.merchantOrderId, `${order.amount}.00`));
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.data.outcome).toBe('paid');
    const again = await postCallback(signedCallback(order.merchantOrderId, order.amount));
    expect(again.status).toBe(200);
    expect(again.body.data.outcome).toBe('duplicate');
    expect(await count('subscriptions', sql`payment_order_id = ${order.id}`)).toBe(1);

    const o = await mitra.agent.get(`/v1/partners/me/subscription/orders/${order.id}`);
    expect(o.body.data).toMatchObject({ status: 'paid', paymentUrl: null });
    expect(o.body.data.paidAt).toBeTruthy();
    const s = (await mitra.agent.get('/v1/partners/me/subscription')).body.data;
    const days = (new Date(s.activeUntil).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(27);
    expect(days).toBeLessThan(32);

    const audit = await db().execute<{ action: string }>(sql`SELECT action FROM audit_logs WHERE entity_id IN (${order.id}, (SELECT partner_id::text FROM payment_orders WHERE id = ${order.id}))`);
    expect(audit.rows.map((r) => r.action)).toEqual(expect.arrayContaining(['payment.created', 'payment.paid', 'subscription.activated']));
    // Callback gagal setelah lunas tidak memundurkan status.
    expect((await postCallback(signedCallback(order.merchantOrderId, order.amount, '01'))).body.data.outcome).toBe('duplicate');
  });

  it('perpanjangan dimulai dari akhir masa sebelumnya; callback gagal menutup pesanan', async () => {
    on();
    const before = (await mitra.agent.get('/v1/partners/me/subscription')).body.data.activeUntil as string;
    const tahunan = (await send(mitra, 'post', '/v1/partners/me/subscription/orders').send({ plan: 'tahunan' })).body.data;
    expect(tahunan.amount).toBe(990000);
    expect((await postCallback(signedCallback(tahunan.merchantOrderId, tahunan.amount))).body.data.outcome).toBe('paid');
    const s = (await mitra.agent.get('/v1/partners/me/subscription')).body.data;
    expect(s.periods[0]).toMatchObject({ plan: 'tahunan', startsAt: new Date(before).toISOString() });
    expect(new Date(s.activeUntil).getTime()).toBeGreaterThan(new Date(before).getTime() + 360 * 86_400_000);

    const gagal = (await send(mitra, 'post', '/v1/partners/me/subscription/orders').send({ plan: 'bulanan' })).body.data;
    expect((await postCallback(signedCallback(gagal.merchantOrderId, gagal.amount, '01'))).body.data.outcome).toBe('failed');
    expect((await mitra.agent.get(`/v1/partners/me/subscription/orders/${gagal.id}`)).body.data.status).toBe('failed');
  });

  it('pesanan milik mitra lain tidak bisa dibaca', async () => {
    on();
    const order = (await send(mitra, 'post', '/v1/partners/me/subscription/orders').send({ plan: 'bulanan' })).body.data;
    expect((await mitraLain.agent.get(`/v1/partners/me/subscription/orders/${order.id}`)).status).toBe(404);
  });

  it('simulator: halaman bayar → callback bertanda tangan → kembali ke portal; status lunas', async () => {
    on();
    const order = (await send(mitraLain, 'post', '/v1/partners/me/subscription/orders').send({ plan: 'bulanan' })).body.data;
    const url = new URL(order.paymentUrl);
    const page = await api().get(url.pathname + url.search);
    expect(page.status).toBe(200);
    expect(page.text).toContain('Simulator, bukan Duitku');
    expect(page.text).toContain('Rp99.000');
    expect(page.headers['content-security-policy']).toContain('form-action');
    const pay = await api()
      .post('/v1/dev/duitku/pay')
      .type('form')
      .send({ order: url.searchParams.get('order')!, reference: url.searchParams.get('reference')!, result: 'success' });
    expect(pay.status).toBe(303);
    expect(pay.headers.location).toMatch(new RegExp(`^http://localhost:3000/portal/langganan/${order.id}\\?`));
    expect((await mitraLain.agent.get(`/v1/partners/me/subscription/orders/${order.id}`)).body.data.status).toBe('paid');
    // Referensi salah tidak membuka halaman.
    expect((await api().get('/v1/dev/duitku/pay').query({ order: order.merchantOrderId, reference: 'SALAH' })).status).toBe(404);
  });

  it('job process-queue mengedaluwarsakan pesanan simulator yang lewat batas', async () => {
    on();
    const order = (await send(belumVerif, 'post', '/v1/partners/me/subscription/orders').send({ plan: 'bulanan' })).body;
    expect(order.error.code).toBe('PARTNER_NOT_VERIFIED');
    const p = (await send(mitraLain, 'post', '/v1/partners/me/subscription/orders').send({ plan: 'tahunan' })).body.data;
    await db().execute(sql`UPDATE payment_orders SET created_at = now() - interval '3 hours', expires_at = now() - interval '2 hours' WHERE id = ${p.id}`);
    const run = await api().get('/v1/internal/jobs/process-queue').set('Authorization', 'Bearer test-cron-secret');
    expect(run.status).toBe(200);
    expect(run.body.data.payments.expired).toBeGreaterThanOrEqual(1);
    expect((await mitraLain.agent.get(`/v1/partners/me/subscription/orders/${p.id}`)).body.data.status).toBe('expired');
    // Dana yang ternyata masuk setelah kedaluwarsa tetap diterima (uang pengguna tidak hilang).
    expect((await postCallback(signedCallback(p.merchantOrderId, p.amount))).body.data.outcome).toBe('paid');
  });

  it('aturan mutlak 1: urutan hasil pencarian identik untuk mitra berlangganan dan tidak', async () => {
    const queries = [{}, { service: 'hemoglobin', sort: 'price_asc' }, { q: 'klinik' }];
    const snapshot = async () =>
      Promise.all(queries.map(async (q) => ((await api().get('/v1/facilities').query({ limit: 100, ...q })).body.data as { slug: string }[]).map((f) => f.slug)));
    await db().execute(sql`DELETE FROM subscriptions`);
    const without = await snapshot();
    on();
    const order = (await send(mitra, 'post', '/v1/partners/me/subscription/orders').send({ plan: 'tahunan' })).body.data;
    expect((await postCallback(signedCallback(order.merchantOrderId, order.amount))).body.data.outcome).toBe('paid');
    expect(await count('subscriptions')).toBeGreaterThan(0);
    expect(await snapshot()).toEqual(without);
  });

  it('tanda tangan: perbandingan tidak peka huruf besar/kecil dan panjang berbeda ditolak', () => {
    const sig = callbackSignature('D1', '100', 'X', 'k');
    expect(signatureEquals(sig.toUpperCase(), sig)).toBe(true);
    expect(signatureEquals(sig.slice(1), sig)).toBe(false);
  });
});
