import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { FACILITY_IDS } from '@silk/db/seed';
import { createHmac } from 'node:crypto';
import { createUser, getApp, resetDb, testOutbox } from './helpers';

describe('Job terjadwal (A8) dan webhook', () => {
  beforeAll(async () => {
    await resetDb();
    // Faskes Medika punya tarif usang (diverifikasi 200 hari lalu) dan satu pengelola.
    await createUser({ facilityIds: [FACILITY_IDS.labMedika] });
  });

  it('route job menolak tanpa CRON_SECRET', async () => {
    expect((await request(getApp()).get('/v1/internal/jobs/process-queue')).status).toBe(401);
    expect(
      (await request(getApp()).get('/v1/internal/jobs/process-queue').set('Authorization', 'Bearer salah')).status,
    ).toBe(401);
  });

  it('pengingat tarif usang terkirim sekali per minggu (idempoten)', async () => {
    const auth = { Authorization: 'Bearer test-cron-secret' };
    const first = await request(getApp()).get('/v1/internal/jobs/stale-reminders').set(auth);
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(first.body.data.queued).toBe(1);
    expect(testOutbox.filter((m) => m.kind === 'stale-reminder')).toHaveLength(1);
    const second = await request(getApp()).get('/v1/internal/jobs/stale-reminders').set(auth);
    expect(second.body.data.queued).toBe(0);
    expect(testOutbox.filter((m) => m.kind === 'stale-reminder')).toHaveLength(1);
  });

  it('retensi dan antrean berjalan tanpa galat', async () => {
    const auth = { Authorization: 'Bearer test-cron-secret' };
    expect((await request(getApp()).get('/v1/internal/jobs/retention').set(auth)).status).toBe(200);
    expect((await request(getApp()).get('/v1/internal/jobs/process-queue').set(auth)).status).toBe(200);
  });

  it('webhook Sanity: tanda tangan wajib; artikel melanggar filter terdeteksi', async () => {
    const body = JSON.stringify({ _id: 'a1', _type: 'article', title: 'Biaya MCU termurah di Malang', slug: { current: 'biaya-mcu' }, body: [] });
    const bad = await request(getApp()).post('/v1/webhooks/sanity').set('content-type', 'application/json').send(body);
    expect(bad.status).toBe(401);
    const t = Date.now();
    const sig = createHmac('sha256', 'test-sanity-secret').update(`${t}.${body}`).digest('base64url');
    const ok = await request(getApp())
      .post('/v1/webhooks/sanity')
      .set('content-type', 'application/json')
      .set('sanity-webhook-signature', `t=${t},v1=${sig}`)
      .send(body);
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.data.status).toBe('ditolak');
  });
});
