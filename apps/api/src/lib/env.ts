import { z } from 'zod';
import { DEFAULT_STALE_AFTER_DAYS } from '@silk/shared';

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
  RESEND_API_KEY: optional,
  EMAIL_FROM: z.string().default('SILK <noreply@example.com>'),
  TURNSTILE_SECRET: optional,
  SANITY_WEBHOOK_SECRET: optional,
  SENTRY_DSN: optional,
  POSTHOG_KEY: optional,
  STALE_AFTER_DAYS: z.coerce.number().int().min(1).max(3650).default(DEFAULT_STALE_AFTER_DAYS),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
});

export type Env = z.infer<typeof schema> & { BETTER_AUTH_SECRET: string };

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
  return {
    ...env,
    // Nilai bawaan hanya untuk dev/test; produksi sudah dicek di atas.
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET ?? 'dev-only-secret-ganti-di-produksi-0123456789abcdef',
  };
}

let cached: Env | undefined;
export function env(): Env {
  cached ??= load();
  return cached;
}

export const isProduction = () => env().NODE_ENV === 'production';
export const isTest = () => env().NODE_ENV === 'test';
