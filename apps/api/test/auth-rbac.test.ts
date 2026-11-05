import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { FACILITY_IDS, TARIFF_IDS } from '@silk/db/seed';
import { createUser, getApp, ORIGIN, resetDb, send, type TestUser } from './helpers';

describe('Auth, RBAC, dan otorisasi lintas faskes (T3, M16)', () => {
  let faskesA: TestUser;
  let adminNoMfa: TestUser;
  let admin: TestUser;
  let moderator: TestUser;

  beforeAll(async () => {
    await resetDb();
    faskesA = await createUser({ role: 'faskes', facilityIds: [FACILITY_IDS.klinikPratama] });
    adminNoMfa = await createUser({ role: 'admin' });
    admin = await createUser({ role: 'admin', mfa: true });
    moderator = await createUser({ role: 'moderator', mfa: true });
  });

  it('portal tanpa login = 401', async () => {
    const res = await request(getApp()).get('/v1/portal/facilities');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('GET /v1/me mengembalikan profil dan keanggotaan', async () => {
    const res = await faskesA.agent.get('/v1/me');
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('faskes');
    expect(res.body.data.memberships.map((m: { id: string }) => m.id)).toEqual([FACILITY_IDS.klinikPratama]);
  });

  it('M6-1: pengelola faskes A yang memanggil SEMUA endpoint faskes B menerima 403', async () => {
    const B = FACILITY_IDS.labMedika;
    const calls = [
      () => faskesA.agent.get(`/v1/portal/facilities/${B}`),
      () => send(faskesA, 'put', `/v1/portal/facilities/${B}`).send({ name: 'Ambil alih' }),
      () => faskesA.agent.get(`/v1/portal/facilities/${B}/tariffs`),
      () => send(faskesA, 'post', `/v1/portal/facilities/${B}/tariffs`).send({
        serviceId: '00000000-0000-4000-8000-000000000000',
        priceType: 'tetap',
        priceMin: 1000,
        effectiveFrom: '2026-01-01',
      }),
      () => send(faskesA, 'put', `/v1/portal/tariffs/${TARIFF_IDS.medikaHb}`).send({
        priceType: 'tetap',
        priceMin: 1,
        effectiveFrom: '2026-01-01',
        expectedVersionNo: 1,
      }),
      () => send(faskesA, 'post', `/v1/portal/facilities/${B}/tariffs/import/presign`).send({ fileName: 'a.csv', sizeBytes: 10 }),
      () => send(faskesA, 'post', `/v1/portal/facilities/${B}/tariffs/import`).send({ objectKey: `imports/facility/${B}/x.csv` }),
    ];
    // Bangun request satu per satu (supertest membuat server sementara per request).
    for (const call of calls) {
      const res = await call();
      expect(res.status, JSON.stringify(res.body)).toBe(403);
    }
  });

  it('pengguna faskes tidak dapat membuka admin', async () => {
    expect((await faskesA.agent.get('/v1/admin/claims')).status).toBe(403);
  });

  it('M15: admin tanpa MFA ditolak dengan MFA_REQUIRED', async () => {
    const res = await adminNoMfa.agent.get('/v1/admin/claims');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('MFA_REQUIRED');
  });

  it('admin dengan MFA dapat membuka antrean', async () => {
    const res = await admin.agent.get('/v1/admin/claims');
    expect(res.status).toBe(200);
  });

  it('M15: moderator tidak dapat mengubah peran pengguna', async () => {
    const res = await moderator.agent
      .post('/v1/auth/admin/set-role')
      .set('Origin', ORIGIN)
      .send({ userId: faskesA.id, role: 'admin' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    const me = await faskesA.agent.get('/v1/me');
    expect(me.body.data.user.role).toBe('faskes');
  });

  it('CSRF: request portal non-GET tanpa token ditolak', async () => {
    const res = await faskesA.agent
      .put(`/v1/portal/facilities/${FACILITY_IDS.klinikPratama}`)
      .set('Origin', ORIGIN)
      .send({ phone: '0341-999' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });

  it('CSRF: Origin asing ditolak walau token benar', async () => {
    const res = await faskesA.agent
      .put(`/v1/portal/facilities/${FACILITY_IDS.klinikPratama}`)
      .set('Origin', 'https://jahat.example')
      .set('x-csrf-token', faskesA.csrf)
      .send({ phone: '0341-999' });
    expect(res.status).toBe(403);
  });

  it('kata sandi kurang dari 12 karakter ditolak', async () => {
    const res = await request(getApp())
      .post('/v1/auth/sign-up/email')
      .set('Origin', ORIGIN)
      .send({ email: 'pendek@contoh.test', password: 'pendek123', name: 'Uji' });
    expect(res.status).toBe(400);
  });
});
