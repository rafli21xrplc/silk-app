import { z } from 'zod';
import { DEFAULT_STALE_AFTER_DAYS, parseFeatureFlags, type FeatureFlag } from '@silk/shared';

const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v : undefined));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL wajib'),
  BETTER_AUTH_SECRET: optional,
  BETTER_AUTH_URL: optional,
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  API_ORIGIN: z.string().url().default('http://localhost:4000'),
  REVALIDATE_SECRET: optional,
  CRON_SECRET: optional,
  R2_ACCOUNT_ID: optional,
  R2_ACCESS_KEY_ID: optional,
  R2_SECRET_ACCESS_KEY: optional,
  R2_BUCKET: optional,
  /** Bucket R2 publik khusus media yang sudah disetujui moderator (Fase 2, K8). */
  R2_MEDIA_BUCKET: optional,
  /** Domain publik bucket media, mis. https://media.silk.example (tanpa garis miring di akhir). */
  MEDIA_PUBLIC_BASE_URL: optional.pipe(z.string().url().optional()),
  RESEND_API_KEY: optional,
  EMAIL_FROM: z.string().default('SILK <noreply@example.com>'),
  TURNSTILE_SECRET: optional,
  SANITY_WEBHOOK_SECRET: optional,
  SENTRY_DSN: optional,
  POSTHOG_KEY: optional,
  STALE_AFTER_DAYS: z.coerce.number().int().min(1).max(3650).default(DEFAULT_STALE_AFTER_DAYS),
  /** Duitku (Fase 11). Kunci kosong di dev/uji = simulator lokal; di produksi wajib bila langganan aktif. */
  DUITKU_MERCHANT_CODE: optional,
  DUITKU_API_KEY: optional,
  /** `sandbox` (bawaan) atau `production`. Produksi harus dipilih eksplisit. */
  DUITKU_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  /** Feature flag (dipisah koma), default semua OFF. Lihat packages/shared/src/flags.ts. */
  FEATURE_FLAGS: optional,
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
});

export type Env = z.infer<typeof schema> & { BETTER_AUTH_SECRET: string; flags: ReadonlySet<FeatureFlag> };

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Konfigurasi lingkungan tidak valid: ${msg}`);
  }
  const env = parsed.data;
  const isProd = env.NODE_ENV === 'production';
  if (isProd) {
    const missing = (['BETTER_AUTH_SECRET', 'CRON_SECRET', 'REVALIDATE_SECRET', 'TURNSTILE_SECRET'] as const).filter(
      (k) => !env[k],
    );
    if (missing.length) throw new Error(`Variabel wajib di produksi belum diisi: ${missing.join(', ')}`);
  }
  const flags = parseFeatureFlags(env.FEATURE_FLAGS);
  if (flags.unknown.length) throw new Error(`FEATURE_FLAGS berisi nama tidak dikenal: ${flags.unknown.join(', ')}`);
  // Simulator pembayaran tidak boleh dipakai di produksi: kunci Duitku wajib bila langganan dinyalakan.
  if (isProd && flags.enabled.has('subscriptions_enabled') && (!env.DUITKU_MERCHANT_CODE || !env.DUITKU_API_KEY)) {
    throw new Error('subscriptions_enabled aktif tetapi DUITKU_MERCHANT_CODE/DUITKU_API_KEY belum diisi');
  }
  return {
    ...env,
    flags: flags.enabled,
    // Nilai bawaan hanya untuk dev/test; produksi sudah dicek di atas.
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET ?? 'dev-only-secret-ganti-di-produksi-0123456789abcdef',
  };
}

let cached: Env | undefined;
export function env(): Env {
  cached ??= load();
  return cached;
}

/** Hanya untuk uji: baca ulang env (mis. setelah mengubah FEATURE_FLAGS). */
export function resetEnvCacheForTests(): void {
  // Baca process.env langsung: memanggil env() di sini bisa gagal lebih dulu bila env yang sedang diuji tidak sah.
  if (process.env.NODE_ENV !== 'test') throw new Error('resetEnvCacheForTests hanya untuk NODE_ENV=test');
  cached = undefined;
}

export const isProduction = () => env().NODE_ENV === 'production';
export const isTest = () => env().NODE_ENV === 'test';

/** Flag fitur aktif? Dibaca dari env di server; tanpa state di memori selain cache env. */
export const featureEnabled = (flag: FeatureFlag): boolean => env().flags.has(flag);
