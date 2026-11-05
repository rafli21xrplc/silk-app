import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Muat .env root lalu arahkan ke database uji. TEST_DATABASE_URL diutamakan bila ada. */
export function loadTestEnv(): void {
  config({ path: path.resolve(fileURLToPath(import.meta.url), '../../../../.env'), quiet: true });
  if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.DATABASE_URL_UNPOOLED = process.env.TEST_DATABASE_URL;
  }
  process.env.NODE_ENV = 'test';
  process.env.CRON_SECRET = 'test-cron-secret';
  process.env.SANITY_WEBHOOK_SECRET = 'test-sanity-secret';
  process.env.WEB_ORIGIN = 'http://localhost:3000';
  process.env.API_ORIGIN = 'http://localhost:4000';
  process.env.BETTER_AUTH_URL = 'http://localhost:4000';
  process.env.STALE_AFTER_DAYS = '180';
  // Uji tidak boleh memakai layanan eksternal.
  for (const k of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'RESEND_API_KEY', 'TURNSTILE_SECRET', 'REVALIDATE_SECRET']) {
    delete process.env[k];
  }
}
