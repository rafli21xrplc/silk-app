import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertSafeTestDatabase } from '@silk/db/test-guard';

/**
 * Muat .env root lalu arahkan ke database uji. Uji ini MENGOSONGKAN database, jadi guard menolak jalan
 * bila TEST_DATABASE_URL kosong, bukan lokal/test_*, atau sama dengan DATABASE_URL (lihat @silk/db/test-guard).
 */
export function loadTestEnv(): void {
  config({ path: path.resolve(fileURLToPath(import.meta.url), '../../../../.env'), quiet: true });
  const testUrl = process.env.TEST_DATABASE_URL;
  // globalSetup menimpa DATABASE_URL dan worker mewarisi env-nya; simpan URL dev asli agar guard di worker
  // tetap membandingkan dengan database dev, bukan dengan URL uji yang sudah ditimpa.
  process.env.SILK_DEV_DATABASE_URL ??= process.env.DATABASE_URL ?? '';
  assertSafeTestDatabase(testUrl, process.env.SILK_DEV_DATABASE_URL || undefined);
  process.env.DATABASE_URL = testUrl;
  process.env.DATABASE_URL_UNPOOLED = testUrl;
  process.env.NODE_ENV = 'test';
  process.env.CRON_SECRET = 'test-cron-secret';
  process.env.SANITY_WEBHOOK_SECRET = 'test-sanity-secret';
  process.env.WEB_ORIGIN = 'http://localhost:3000';
  process.env.API_ORIGIN = 'http://localhost:4000';
  process.env.BETTER_AUTH_URL = 'http://localhost:4000';
  process.env.STALE_AFTER_DAYS = '180';
  // Uji tidak boleh memakai layanan eksternal.
  for (const k of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_MEDIA_BUCKET', 'MEDIA_PUBLIC_BASE_URL', 'RESEND_API_KEY', 'TURNSTILE_SECRET', 'REVALIDATE_SECRET']) {
    delete process.env[k];
  }
}
