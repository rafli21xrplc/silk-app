import { createHmac } from 'node:crypto';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import type { Express } from 'express';
import { memberships, user } from '@silk/db';
import { seedReference, seedTestData, truncateAll } from '@silk/db/seed/run';
import { createApp } from '../src/app';
import { getAuth } from '../src/auth/auth';
import { db } from '../src/lib/db';
import { testOutbox } from '../src/lib/email';
import type { UserRole } from '@silk/shared';

export const ORIGIN = 'http://localhost:3000';
export const PASSWORD = 'kata-sandi-uji-panjang-123';

let app: Express | undefined;
export function getApp(): Express {
  app ??= createApp();
  return app;
}

/** Kosongkan database lalu isi taksonomi dan data uji fiktif. */
export async function resetDb(now = new Date()): Promise<void> {
  await truncateAll(db());
  await seedReference(db());
  await seedTestData(db(), now);
  testOutbox.length = 0;
}

/* ---------- TOTP (RFC 6238) untuk menguji MFA ---------- */

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = input.replace(/=+$/, '').toUpperCase();
  let bits = '';
  for (const ch of clean) bits += alphabet.indexOf(ch).toString(2).padStart(5, '0');
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function totp(base32Secret: string, now = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 1000 / 30)));
  const h = createHmac('sha1', base32Decode(base32Secret)).update(counter).digest();
  const offset = h[h.length - 1]! & 0x0f;
  const bin = (h.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(bin).padStart(6, '0');
}

/* ---------- Pengguna dan sesi ---------- */

export interface TestUser {
  id: string;
  email: string;
  agent: ReturnType<typeof request.agent>;
  csrf: string;
}

let seq = 0;

/**
 * Buat pengguna lewat Better Auth, tandai email terverifikasi, atur peran, lalu masuk.
 * `mfa: true` mengaktifkan TOTP lewat alur Better Auth sungguhan.
 */
export async function createUser(opts: { role?: UserRole; mfa?: boolean; facilityIds?: string[] } = {}): Promise<TestUser> {
  const email = `uji${++seq}-${Date.now()}@contoh.test`;
  const signUp = await getAuth().api.signUpEmail({ body: { email, password: PASSWORD, name: `Pengguna Uji ${seq}` } });
  const id = signUp.user.id;
  await db().update(user).set({ emailVerified: true, role: opts.role ?? 'faskes' }).where(eq(user.id, id));
  for (const facilityId of opts.facilityIds ?? []) {
    await db().insert(memberships).values({ userId: id, facilityId });
  }

  const agent = request.agent(getApp());
  const login = await agent.post('/v1/auth/sign-in/email').set('Origin', ORIGIN).send({ email, password: PASSWORD });
  if (login.status !== 200) throw new Error(`Login gagal: ${login.status} ${JSON.stringify(login.body)}`);

  if (opts.mfa) {
    const enable = await agent.post('/v1/auth/two-factor/enable').set('Origin', ORIGIN).send({ password: PASSWORD });
    if (enable.status !== 200) throw new Error(`Gagal mengaktifkan 2FA: ${JSON.stringify(enable.body)}`);
    const secret = new URL(String(enable.body.totpURI)).searchParams.get('secret')!;
    const verify = await agent.post('/v1/auth/two-factor/verify-totp').set('Origin', ORIGIN).send({ code: totp(secret) });
    if (verify.status !== 200) throw new Error(`Gagal verifikasi TOTP: ${JSON.stringify(verify.body)}`);
  }

  const csrfRes = await agent.get('/v1/csrf');
  return { id, email, agent, csrf: String(csrfRes.body.data.token) };
}

/** Request non-GET dengan header CSRF dan Origin tepercaya. */
export function send(u: TestUser, method: 'post' | 'put' | 'patch' | 'delete', path: string) {
  return u.agent[method](path).set('Origin', ORIGIN).set('x-csrf-token', u.csrf);
}

/** Unggah berkas ke signed URL penyimpanan lokal (pengganti R2 di uji). */
export async function uploadTo(upload: { uploadUrl: string; headers: Record<string, string> }, body: Buffer) {
  const url = new URL(upload.uploadUrl);
  return request(getApp())
    .put(url.pathname + url.search)
    .set(upload.headers)
    .send(body);
}

export { testOutbox };
