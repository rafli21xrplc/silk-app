import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { and, eq, like, sql } from 'drizzle-orm';
import express from 'express';
import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { auditLogs, memberships, partners, user, verification } from '@silk/db';
import { FACILITY_IDS } from '@silk/db/seed';
import { db } from '../src/lib/db';
import { resetEnvCacheForTests } from '../src/lib/env';
import { requireFlag } from '../src/middleware/auth';
import { errorHandler } from '../src/middleware/error';
import { createUser, getApp, ORIGIN, PASSWORD, resetDb, send, testOutbox, type TestUser } from './helpers';

let seq = 0;
const newEmail = () => `fase1-${++seq}-${Date.now()}@contoh.test`;

/** Daftar lewat HTTP seperti web, dengan body tambahan. */
function signUp(body: Record<string, unknown>) {
  return request(getApp())
    .post('/v1/auth/sign-up/email')
    .set('Origin', ORIGIN)
    .send({ name: 'Uji Fase Satu', password: PASSWORD, ...body });
}

function lastOtp(email: string): string {
  const mail = [...testOutbox].reverse().find((m) => m.kind === 'verify-email-otp' && m.to === email);
  const code = mail?.text.match(/\b(\d{6})\b/)?.[1];
  if (!code) throw new Error(`OTP untuk ${email} tidak ada di outbox`);
  return code;
}

function verifyOtp(email: string, otp: string) {
  return request(getApp()).post('/v1/auth/email-otp/verify-email').set('Origin', ORIGIN).send({ email, otp });
}

async function roleOf(email: string) {
  const [row] = await db().select({ role: user.role, emailVerified: user.emailVerified }).from(user).where(eq(user.email, email));
  return row;
}

describe('Fase 1: daftar mandiri dan role', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it.each([
    ['pasien', 'pasien'],
    ['fasilitas', 'faskes'],
    ['tenaga_medis', 'tenaga_medis'],
    ['gaya_hidup', 'gaya_hidup'],
    ['apotek', 'apotek'],
  ])('accountType %s → role %s', async (accountType, role) => {
    const email = newEmail();
    const res = await signUp({ email, accountType });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect((await roleOf(email))?.role).toBe(role);
  });

  it('tanpa accountType = pasien', async () => {
    const email = newEmail();
    expect((await signUp({ email })).status).toBe(200);
    expect((await roleOf(email))?.role).toBe('pasien');
  });

  it('daftar tidak bisa menjadi admin atau moderator', async () => {
    for (const accountType of ['admin', 'moderator']) {
      const email = newEmail();
      expect((await signUp({ email, accountType })).status).toBe(200);
      expect((await roleOf(email))?.role).toBe('pasien');
    }
    const viaRole = newEmail();
    expect((await signUp({ email: viaRole, role: 'admin' })).status).toBe(400);
    expect(await roleOf(viaRole)).toBeUndefined();
  });

  it('daftar menulis audit auth.sign-up', async () => {
    const email = newEmail();
    await signUp({ email, accountType: 'apotek' });
    const [u] = await db().select({ id: user.id }).from(user).where(eq(user.email, email));
    const [log] = await db().select().from(auditLogs).where(and(eq(auditLogs.action, 'auth.sign-up'), eq(auditLogs.entityId, u!.id)));
    expect(log?.after).toEqual({ role: 'apotek' });
  });
});

describe('Fase 1: verifikasi email lewat OTP', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('OTP benar memverifikasi email, lalu bisa masuk', async () => {
    const email = newEmail();
    await signUp({ email, accountType: 'pasien' });
    // Belum terverifikasi: masuk ditolak.
    const before = await request(getApp()).post('/v1/auth/sign-in/email').set('Origin', ORIGIN).send({ email, password: PASSWORD });
    expect(before.status).toBe(403);

    const res = await verifyOtp(email, lastOtp(email));
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect((await roleOf(email))?.emailVerified).toBe(true);

    const after = await request(getApp()).post('/v1/auth/sign-in/email').set('Origin', ORIGIN).send({ email, password: PASSWORD });
    expect(after.status).toBe(200);
    const logs = await db().select().from(auditLogs).where(eq(auditLogs.action, 'auth.email-verified'));
    expect(logs.length).toBeGreaterThan(0);
  });

  it('OTP disimpan dalam bentuk hash, bukan kode polos', async () => {
    const email = newEmail();
    await signUp({ email });
    const [row] = await db().select().from(verification).where(like(verification.identifier, `%${email}`));
    expect(row).toBeDefined();
    expect(row!.value).not.toContain(lastOtp(email));
  });

  it('OTP kedaluwarsa ditolak', async () => {
    const email = newEmail();
    await signUp({ email });
    const otp = lastOtp(email);
    await db()
      .update(verification)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(like(verification.identifier, `%${email}`));
    expect((await verifyOtp(email, otp)).status).toBe(400);
    expect((await roleOf(email))?.emailVerified).toBe(false);
  });

  it('setelah 3 kali salah, kode benar pun ditolak', async () => {
    const email = newEmail();
    await signUp({ email });
    const otp = lastOtp(email);
    const wrong = otp === '000000' ? '111111' : '000000';
    for (let i = 0; i < 3; i++) expect((await verifyOtp(email, wrong)).status).toBe(400);
    const res = await verifyOtp(email, otp);
    expect(res.status).toBe(403);
    expect((await roleOf(email))?.emailVerified).toBe(false);
  });

  it('kirim ulang membuat kode baru dan kode lama tidak berlaku', async () => {
    const email = newEmail();
    await signUp({ email });
    const first = lastOtp(email);
    const resend = await request(getApp())
      .post('/v1/auth/email-otp/send-verification-otp')
      .set('Origin', ORIGIN)
      .send({ email, type: 'email-verification' });
    expect(resend.status).toBe(200);
    const second = lastOtp(email);
    if (first !== second) expect((await verifyOtp(email, first)).status).toBe(400);
    expect((await verifyOtp(email, second)).status).toBe(200);
  });

  it('masuk tanpa sandi lewat OTP dimatikan', async () => {
    const res = await request(getApp()).post('/v1/auth/sign-in/email-otp').set('Origin', ORIGIN).send({ email: newEmail(), otp: '123456' });
    expect(res.status).toBe(404);
  });

  it('login gagal diaudit tanpa email polos', async () => {
    const email = newEmail();
    await request(getApp()).post('/v1/auth/sign-in/email').set('Origin', ORIGIN).send({ email, password: 'salah-salah-salah-1' });
    const logs = await db().select().from(auditLogs).where(eq(auditLogs.action, 'auth.sign-in.failed'));
    expect(logs.length).toBeGreaterThan(0);
    expect(JSON.stringify(logs)).not.toContain(email);
  });
});

describe('Fase 1: matriks role × endpoint', () => {
  let pasien: TestUser;
  let faskes: TestUser;
  let medis: TestUser;
  let gaya: TestUser;
  let apotek: TestUser;
  let moderator: TestUser;
  let admin: TestUser;

  beforeAll(async () => {
    await resetDb();
    pasien = await createUser({ role: 'pasien' });
    faskes = await createUser({ role: 'faskes', facilityIds: [FACILITY_IDS.klinikPratama] });
    medis = await createUser({ role: 'tenaga_medis' });
    gaya = await createUser({ role: 'gaya_hidup' });
    apotek = await createUser({ role: 'apotek' });
    moderator = await createUser({ role: 'moderator', mfa: true });
    admin = await createUser({ role: 'admin', mfa: true });
  });

  it('anonim: publik 200, area masuk 401', async () => {
    const anon = request(getApp());
    expect((await anon.get('/v1/facilities')).status).toBe(200);
    for (const p of ['/v1/me', '/v1/partners/me', '/v1/portal/facilities', '/v1/admin/partners']) {
      expect((await request(getApp()).get(p)).status, p).toBe(401);
    }
  });

  it('/v1/me untuk semua role yang masuk, termasuk phone dan partner', async () => {
    for (const u of [pasien, faskes, medis, gaya, apotek, moderator, admin]) {
      const res = await u.agent.get('/v1/me');
      expect(res.status).toBe(200);
      expect(res.body.data.user).toHaveProperty('phone');
      expect(res.body.data).toHaveProperty('partner');
    }
  });

  it('/v1/partners/me hanya untuk mitra', async () => {
    for (const u of [faskes, medis, gaya, apotek]) expect((await u.agent.get('/v1/partners/me')).status).toBe(200);
    for (const u of [pasien, moderator, admin]) expect((await u.agent.get('/v1/partners/me')).status).toBe(403);
  });

  it('portal faskes hanya untuk role faskes', async () => {
    expect((await faskes.agent.get('/v1/portal/facilities')).status).toBe(200);
    for (const u of [pasien, medis, gaya, apotek]) expect((await u.agent.get('/v1/portal/facilities')).status).toBe(403);
  });

  it('admin hanya untuk staf ber-MFA', async () => {
    for (const u of [pasien, faskes, medis, gaya, apotek]) expect((await u.agent.get('/v1/admin/partners')).status).toBe(403);
    for (const u of [moderator, admin]) expect((await u.agent.get('/v1/admin/partners')).status).toBe(200);
  });

  it('ubah role (admin Better Auth) hanya admin, bukan moderator', async () => {
    const res = await moderator.agent.post('/v1/auth/admin/set-role').set('Origin', ORIGIN).send({ userId: pasien.id, role: 'admin' });
    expect(res.status).toBe(403);
    expect((await pasien.agent.get('/v1/me')).body.data.user.role).toBe('pasien');
  });

  it('PATCH /v1/me mengubah nama dan HP (dinormalisasi), dengan audit', async () => {
    const res = await send(pasien, 'patch', '/v1/me').send({ name: 'Pasien Uji', phone: '081234567890' });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data).toEqual({ name: 'Pasien Uji', phone: '+6281234567890' });
    const [log] = await db().select().from(auditLogs).where(and(eq(auditLogs.action, 'account.profile.update'), eq(auditLogs.entityId, pasien.id)));
    expect(log).toBeDefined();
    expect((await send(pasien, 'patch', '/v1/me').send({ name: 'Pasien Uji', phone: '12345' })).status).toBe(400);
  });

  it('PATCH /v1/me tanpa CSRF ditolak', async () => {
    const res = await pasien.agent.patch('/v1/me').set('Origin', ORIGIN).send({ name: 'Tanpa Token', phone: null });
    expect(res.status).toBe(403);
  });
});

describe('Fase 1: verifikasi mitra', () => {
  let medis: TestUser;
  let apotek: TestUser;
  let moderator: TestUser;

  beforeAll(async () => {
    await resetDb();
    medis = await createUser({ role: 'tenaga_medis' });
    apotek = await createUser({ role: 'apotek' });
    moderator = await createUser({ role: 'moderator', mfa: true });
  });

  const medisBody = { partnerType: 'tenaga_medis', businessName: 'Praktik dr. Uji', licenseNo: 'SIP-123', specialty: 'Penyakit dalam', strNo: 'STR-12345' };

  it('jenis mitra harus sesuai role akun', async () => {
    const res = await send(apotek, 'put', '/v1/partners/me').send(medisBody);
    expect(res.status).toBe(403);
  });

  it('atribut wajib per jenis divalidasi', async () => {
    const res = await send(medis, 'put', '/v1/partners/me').send({ ...medisBody, strNo: undefined });
    expect(res.status).toBe(400);
  });

  it('kirim → pending, setujui → verified, semua diaudit', async () => {
    const submit = await send(medis, 'put', '/v1/partners/me').send(medisBody);
    expect(submit.status, JSON.stringify(submit.body)).toBe(200);
    expect(submit.body.data.status).toBe('pending');
    const id = submit.body.data.id as string;

    const queue = await moderator.agent.get('/v1/admin/partners?status=pending&type=tenaga_medis');
    expect(queue.body.data.map((r: { id: string }) => r.id)).toContain(id);

    const approve = await send(moderator, 'post', `/v1/admin/partners/${id}/approve`).send();
    expect(approve.status).toBe(200);
    expect(approve.body.data.status).toBe('verified');
    expect(approve.body.data.verifiedAt).toBeTruthy();
    expect((await send(moderator, 'post', `/v1/admin/partners/${id}/approve`).send()).status).toBe(409);

    const actions = (await db().select({ action: auditLogs.action }).from(auditLogs).where(eq(auditLogs.entityId, id))).map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(['partner.submitted', 'partner.verified']));
    expect(testOutbox.some((m) => m.kind === 'partner-verified' && m.to === medis.email)).toBe(true);
  });

  it('mengubah data mitra terverifikasi mengembalikan status ke pending', async () => {
    const res = await send(medis, 'put', '/v1/partners/me').send({ ...medisBody, licenseNo: 'SIP-999' });
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.verifiedAt).toBeNull();
    const [log] = await db().select().from(auditLogs).where(and(eq(auditLogs.action, 'partner.updated'), eq(auditLogs.entityId, res.body.data.id)));
    expect(log?.before).toMatchObject({ status: 'verified' });
  });

  it('tolak wajib alasan; alasan tampil ke mitra dan dikirim lewat email', async () => {
    const submit = await send(apotek, 'put', '/v1/partners/me').send({ partnerType: 'apotek', businessName: 'Apotek Uji', licenseNo: 'NIB-1', siaNo: 'SIA-1' });
    const id = submit.body.data.id as string;
    expect((await send(moderator, 'post', `/v1/admin/partners/${id}/reject`).send({ reason: '' })).status).toBe(400);
    const reject = await send(moderator, 'post', `/v1/admin/partners/${id}/reject`).send({ reason: 'Nomor SIA tidak terbaca' });
    expect(reject.status).toBe(200);
    const mine = await apotek.agent.get('/v1/partners/me');
    expect(mine.body.data).toMatchObject({ status: 'rejected', rejectionReason: 'Nomor SIA tidak terbaca' });
    expect(testOutbox.some((m) => m.kind === 'partner-rejected' && m.text.includes('Nomor SIA tidak terbaca'))).toBe(true);
  });

  it('mitra pending/ditolak tidak muncul di endpoint publik', async () => {
    const pub = await request(getApp()).get('/v1/facilities?q=Apotek%20Uji');
    expect(JSON.stringify(pub.body)).not.toContain('Apotek Uji');
  });
});

describe('Fase 1: JWT untuk klien non-browser', () => {
  let pasien: TestUser;
  let admin: TestUser;

  beforeAll(async () => {
    await resetDb();
    pasien = await createUser({ role: 'pasien' });
    admin = await createUser({ role: 'admin', mfa: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function tokenOf(u: TestUser): Promise<string> {
    const res = await u.agent.get('/v1/auth/token');
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    return String(res.body.token);
  }

  it('token valid membuka /v1/me tanpa cookie; klaim role dan sid ada', async () => {
    const token = await tokenOf(pasien);
    const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as Record<string, unknown>;
    expect(payload).toMatchObject({ sub: pasien.id, role: 'pasien', aud: 'silk-api' });
    expect(typeof payload.sid).toBe('string');
    const res = await request(getApp()).get('/v1/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(pasien.id);
  });

  it('JWT tidak perlu CSRF untuk PATCH', async () => {
    const token = await tokenOf(pasien);
    const res = await request(getApp()).patch('/v1/me').set('Authorization', `Bearer ${token}`).send({ name: 'Lewat JWT', phone: null });
    expect(res.status).toBe(200);
  });

  it('token rusak atau bertanda tangan salah = 401', async () => {
    const token = await tokenOf(pasien);
    const tampered = `${token.slice(0, -4)}AAAA`;
    expect((await request(getApp()).get('/v1/me').set('Authorization', `Bearer ${tampered}`)).status).toBe(401);
    expect((await request(getApp()).get('/v1/me').set('Authorization', 'Bearer bukan.jwt.valid')).status).toBe(401);
    expect((await request(getApp()).get('/v1/me').set('Authorization', 'Basic abc')).status).toBe(401);
  });

  it('token kedaluwarsa (lebih dari 15 menit) = 401', async () => {
    const token = await tokenOf(pasien);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 16 * 60 * 1000);
    expect((await request(getApp()).get('/v1/me').set('Authorization', `Bearer ${token}`)).status).toBe(401);
  });

  it('staf tidak bisa menerbitkan JWT', async () => {
    expect((await admin.agent.get('/v1/auth/token')).status).toBe(403);
  });

  it('JWT tidak pernah cukup untuk admin, walau role diubah jadi admin', async () => {
    const other = await createUser({ role: 'pasien' });
    const token = await tokenOf(other);
    await db().update(user).set({ role: 'admin', twoFactorEnabled: true }).where(eq(user.id, other.id));
    const res = await request(getApp()).get('/v1/admin/claims').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('akun diblokir = JWT ditolak', async () => {
    const other = await createUser({ role: 'pasien' });
    const token = await tokenOf(other);
    await db().update(user).set({ banned: true }).where(eq(user.id, other.id));
    expect((await request(getApp()).get('/v1/me').set('Authorization', `Bearer ${token}`)).status).toBe(403);
  });

  it('keluar mencabut sesi, JWT dari sesi itu ikut tidak berlaku', async () => {
    const other = await createUser({ role: 'pasien' });
    const token = await tokenOf(other);
    expect((await request(getApp()).get('/v1/me').set('Authorization', `Bearer ${token}`)).status).toBe(200);
    await other.agent.post('/v1/auth/sign-out').set('Origin', ORIGIN).send({});
    expect((await request(getApp()).get('/v1/me').set('Authorization', `Bearer ${token}`)).status).toBe(401);
  });

  it('JWKS publik tersedia tanpa kunci privat', async () => {
    const res = await request(getApp()).get('/v1/auth/jwks');
    expect(res.status).toBe(200);
    expect(res.body.keys.length).toBeGreaterThan(0);
    expect(JSON.stringify(res.body)).not.toMatch(/"d"\s*:/);
  });
});

describe('Fase 1: migrasi data faskes lama', () => {
  beforeAll(async () => {
    await resetDb();
  });

  it('pengelola faskes dengan keanggotaan menjadi mitra fasilitas terverifikasi, idempoten', async () => {
    const lama = await createUser({ role: 'faskes', facilityIds: [FACILITY_IDS.klinikPratama] });
    const tanpaFaskes = await createUser({ role: 'faskes' });
    const migration = readFileSync(
      path.resolve(fileURLToPath(import.meta.url), '../../../../packages/db/drizzle/0005_fase1_partners_jwt.sql'),
      'utf8',
    );
    const dataPart = migration.slice(migration.indexOf('-- Data:'));
    await db().execute(sql.raw(dataPart));
    await db().execute(sql.raw(dataPart));

    const rows = await db().select().from(partners).where(eq(partners.userId, lama.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ partnerType: 'fasilitas', status: 'verified' });
    expect(rows[0]!.verifiedAt).toBeInstanceOf(Date);
    expect(await db().select().from(partners).where(eq(partners.userId, tanpaFaskes.id))).toHaveLength(0);
    const [m] = await db().select().from(memberships).where(eq(memberships.userId, lama.id));
    expect(m).toBeDefined();
  });
});

describe('Fase 1: feature flag', () => {
  afterEach(() => {
    delete process.env.FEATURE_FLAGS;
    resetEnvCacheForTests();
  });

  function flagged() {
    const app = express();
    app.get('/x', requireFlag('reviews_enabled'), (_req, res) => {
      res.json({ data: 'ok' });
    });
    app.use(errorHandler);
    return app;
  }

  it('default OFF: endpoint 404', async () => {
    resetEnvCacheForTests();
    expect((await request(flagged()).get('/x')).status).toBe(404);
  });

  it('ON lewat FEATURE_FLAGS', async () => {
    process.env.FEATURE_FLAGS = 'reviews_enabled';
    resetEnvCacheForTests();
    expect((await request(flagged()).get('/x')).status).toBe(200);
  });

  it('nama flag salah ketik membuat konfigurasi gagal', () => {
    process.env.FEATURE_FLAGS = 'reviews_enable';
    resetEnvCacheForTests();
    expect(() => requireFlag('reviews_enabled')({} as never, {} as never, () => undefined)).toThrow(/FEATURE_FLAGS/);
  });
});
