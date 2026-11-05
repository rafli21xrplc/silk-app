import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getApp, ORIGIN, resetDb } from './helpers';

// Rate limit Better Auth biasanya mati di uji; berkas ini menyalakannya sebelum instance auth dibuat.
vi.stubEnv('SILK_TEST_RATE_LIMIT', '1');

describe('Fase 1: brute-force login dan OTP dibatasi', () => {
  beforeAll(async () => {
    await resetDb();
  });
  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('login: percobaan ke-6 dalam 1 menit dari IP yang sama = 429', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await request(getApp())
        .post('/v1/auth/sign-in/email')
        .set('Origin', ORIGIN)
        .set('X-Forwarded-For', '203.0.113.10')
        .send({ email: 'tidak-ada@contoh.test', password: 'salah-salah-salah-1' });
      statuses.push(r.status);
    }
    expect(statuses.slice(0, 5).every((s) => s === 401), JSON.stringify(statuses)).toBe(true);
    expect(statuses[5]).toBe(429);
  });

  it('verifikasi OTP: percobaan ke-6 dalam 1 menit = 429', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await request(getApp())
        .post('/v1/auth/email-otp/verify-email')
        .set('Origin', ORIGIN)
        .set('X-Forwarded-For', '203.0.113.11')
        .send({ email: 'tidak-ada@contoh.test', otp: '000000' });
      statuses.push(r.status);
    }
    expect(statuses[5]).toBe(429);
  });

  it('kirim ulang OTP: percobaan ke-4 dalam 1 menit = 429', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const r = await request(getApp())
        .post('/v1/auth/email-otp/send-verification-otp')
        .set('Origin', ORIGIN)
        .set('X-Forwarded-For', '203.0.113.12')
        .send({ email: 'tidak-ada@contoh.test', type: 'email-verification' });
      statuses.push(r.status);
    }
    expect(statuses[3]).toBe(429);
  });
});
