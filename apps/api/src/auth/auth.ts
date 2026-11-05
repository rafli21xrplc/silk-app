import { hash, verify } from '@node-rs/argon2';
import { schema } from '@silk/db';
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuthMiddleware } from 'better-auth/api';
import { admin, captcha, twoFactor } from 'better-auth/plugins';
import { db } from '../lib/db';
import { sendEmail } from '../lib/email';
import { env, isTest } from '../lib/env';
import { recordAudit } from '../modules/m15-admin/audit.repo';

const DAY = 60 * 60 * 24;

/** Parameter argon2id (rekomendasi OWASP: m=19 MiB, t=2, p=1). Default algoritma paket = argon2id. */
const ARGON2 = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

/** Rute Better Auth yang dicatat ke audit log (prinsip 5). */
const AUDITED_PATHS = new Set([
  '/two-factor/enable',
  '/two-factor/disable',
  '/change-password',
  '/reset-password',
  '/admin/set-role',
  '/admin/ban-user',
  '/admin/unban-user',
  '/admin/remove-user',
  '/admin/revoke-user-sessions',
]);

function buildOptions(): BetterAuthOptions {
  const e = env();
  const plugins: NonNullable<BetterAuthOptions['plugins']> = [
    twoFactor({
      issuer: 'SILK',
      // Rahasia TOTP disimpan terenkripsi oleh Better Auth.
      accountLockout: { enabled: true, maxFailedAttempts: 5, durationSeconds: 15 * 60 },
    }),
    admin({
      defaultRole: 'faskes',
      // Hanya admin yang boleh memakai endpoint admin Better Auth (ubah peran, hapus pengguna).
      // Moderator tidak (M15).
      adminRoles: ['admin'],
    }),
  ];
  if (e.TURNSTILE_SECRET) {
    plugins.push(
      captcha({
        provider: 'cloudflare-turnstile',
        secretKey: e.TURNSTILE_SECRET,
        endpoints: ['/sign-up/email', '/request-password-reset'],
      }),
    );
  }

  return {
    appName: 'SILK',
    baseURL: e.BETTER_AUTH_URL ?? e.API_ORIGIN,
    basePath: '/v1/auth',
    secret: e.BETTER_AUTH_SECRET,
    trustedOrigins: [e.WEB_ORIGIN],
    database: drizzleAdapter(db(), {
      provider: 'pg',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        twoFactor: schema.twoFactor,
        rateLimit: schema.rateLimit,
      },
    }),
    advanced: {
      database: { generateId: 'uuid' },
      cookiePrefix: 'silk',
      useSecureCookies: e.NODE_ENV === 'production',
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'] },
    },
    session: {
      expiresIn: 7 * DAY,
      updateAge: DAY,
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      password: {
        hash: (password) => hash(password, ARGON2),
        verify: ({ hash: hashed, password }) => verify(hashed, password),
      },
      sendResetPassword: async ({ user, url }) => {
        await sendEmail({
          kind: 'reset-password',
          to: user.email,
          subject: 'Atur ulang kata sandi SILK',
          text: `Halo,\n\nBuka tautan berikut untuk mengatur ulang kata sandi Anda (berlaku 1 jam):\n${url}\n\nAbaikan email ini bila Anda tidak memintanya.`,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail({
          kind: 'verify-email',
          to: user.email,
          subject: 'Konfirmasi email SILK',
          text: `Halo,\n\nKonfirmasi alamat email Anda dengan membuka tautan berikut:\n${url}\n\nAbaikan email ini bila Anda tidak mendaftar di SILK.`,
        });
      },
    },
    rateLimit: {
      // Penghitung di Postgres, bukan memori instance (bagian 2, aturan 2).
      enabled: !isTest(),
      storage: 'database',
      window: 60,
      max: 120,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60, max: 5 },
        '/two-factor/verify-totp': { window: 60, max: 5 },
        '/request-password-reset': { window: 60, max: 3 },
      },
    },
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        if (!AUDITED_PATHS.has(ctx.path)) return;
        const actorId = ctx.context.session?.user.id ?? ctx.context.newSession?.user.id ?? null;
        const body = (ctx.body ?? {}) as Record<string, unknown>;
        await recordAudit(db(), {
          actorId,
          action: `auth${ctx.path.replace(/\//g, '.')}`,
          entity: 'user',
          entityId: String(body.userId ?? actorId ?? 'tidak-diketahui'),
          before: null,
          after: 'role' in body ? { role: body.role } : null,
          ip: ctx.request?.headers.get('cf-connecting-ip') ?? ctx.request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
          requestId: ctx.request?.headers.get('x-request-id') ?? null,
        });
      }),
    },
    plugins,
  };
}

function createAuth() {
  return betterAuth(buildOptions());
}

let instance: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  instance ??= createAuth();
  return instance;
}

export type Auth = ReturnType<typeof getAuth>;
export type AuthSession = NonNullable<Awaited<ReturnType<Auth['api']['getSession']>>>;
