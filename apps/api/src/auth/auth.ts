import { createHash } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import { schema } from '@silk/db';
import { roleForAccountType } from '@silk/shared';
import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createAuthMiddleware, isAPIError } from 'better-auth/api';
import { admin, captcha, emailOTP, jwt, twoFactor } from 'better-auth/plugins';
import { db } from '../lib/db';
import { sendEmail } from '../lib/email';
import { env, isTest } from '../lib/env';
import { recordAudit } from '../modules/m15-admin/audit.repo';

const DAY = 60 * 60 * 24;

/** Audiens JWT API (Fase 1). Diverifikasi juga di `auth/jwt.ts`. */
export const JWT_AUDIENCE = 'silk-api';

/** Header IP klien yang sama dengan `advanced.ipAddress`. */
function clientIp(headers: Headers | undefined): string | null {
  return headers?.get('cf-connecting-ip') ?? headers?.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
}

/** Hash email untuk audit login gagal: bisa dicocokkan tanpa menyimpan alamatnya. */
function emailHash(email: unknown): string | null {
  if (typeof email !== 'string' || !email) return null;
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

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
      // Role mitra ditetapkan server dari jenis akun saat daftar (databaseHooks di bawah).
      defaultRole: 'pasien',
      // Hanya admin yang boleh memakai endpoint admin Better Auth (ubah peran, hapus pengguna).
      // Moderator tidak (M15).
      adminRoles: ['admin'],
    }),
    emailOTP({
      // Verifikasi email lewat OTP 6 digit (F-01). Disimpan ter-hash; 3 kali salah = minta kode baru.
      otpLength: 6,
      expiresIn: 10 * 60,
      allowedAttempts: 3,
      storeOTP: 'hashed',
      overrideDefaultEmailVerification: true,
      sendVerificationOnSignUp: true,
      // OTP hanya untuk verifikasi email, bukan cara daftar atau masuk.
      disableSignUp: true,
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type !== 'email-verification') return;
        await sendEmail({
          kind: 'verify-email-otp',
          to: email,
          subject: 'Kode verifikasi SILK',
          text: `Halo,\n\nKode verifikasi email SILK Anda: ${otp}\n\nKode berlaku 10 menit. Jangan bagikan kode ini kepada siapa pun.\nAbaikan email ini bila Anda tidak mendaftar di SILK.`,
        });
      },
    }),
    jwt({
      // Token singkat untuk klien non-browser. Diverifikasi di Express dengan kunci publik tabel jwks.
      jwks: {
        keyPairConfig: { alg: 'EdDSA', crv: 'Ed25519' },
        rotationInterval: 30 * DAY,
        gracePeriod: DAY,
      },
      jwt: {
        issuer: e.API_ORIGIN,
        audience: JWT_AUDIENCE,
        expirationTime: '15m',
        definePayload: ({ user, session }) => ({ role: user.role ?? 'pasien', sid: session.id }),
      },
      // Token hanya lewat GET /v1/auth/token, tidak ditempel ke setiap respons get-session.
      disableSettingJwtHeader: true,
    }),
  ];
  if (e.TURNSTILE_SECRET) {
    plugins.push(
      captcha({
        provider: 'cloudflare-turnstile',
        secretKey: e.TURNSTILE_SECRET,
        endpoints: ['/sign-up/email', '/sign-in/email', '/request-password-reset', '/email-otp/send-verification-otp'],
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
        jwks: schema.jwks,
      },
    }),
    // Endpoint email-otp yang tidak dipakai SILK: masuk/reset/ganti email tetap lewat alur sandi.
    disabledPaths: [
      '/sign-in/email-otp',
      '/email-otp/check-verification-otp',
      '/email-otp/request-password-reset',
      '/email-otp/reset-password',
      '/forget-password/email-otp',
      '/email-otp/request-email-change',
      '/email-otp/change-email',
    ],
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
      // Pengiriman memakai OTP (plugin emailOTP menimpa sendVerificationEmail).
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: false,
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user, ctx) => {
            // Daftar mandiri: role dari jenis akun, tidak pernah staf. Body `role` ditolak plugin admin.
            if (ctx?.path !== '/sign-up/email') return;
            const body = (ctx.body ?? {}) as Record<string, unknown>;
            return { data: { ...user, role: roleForAccountType(body.accountType) } };
          },
          after: async (user, ctx) => {
            const created = user as typeof user & { role?: string | null };
            await recordAudit(db(), {
              actorId: ctx?.path === '/sign-up/email' ? user.id : (ctx?.context.session?.user.id ?? null),
              action: ctx?.path === '/sign-up/email' ? 'auth.sign-up' : 'auth.user-created',
              entity: 'user',
              entityId: user.id,
              before: null,
              after: { role: created.role ?? null },
              ip: clientIp(ctx?.request?.headers),
              requestId: ctx?.request?.headers.get('x-request-id') ?? null,
            });
          },
        },
      },
    },
    rateLimit: {
      // Penghitung di Postgres, bukan memori instance (bagian 2, aturan 2).
      // Mati di uji agar pembuatan pengguna tidak terbentur batas; uji brute-force menyalakannya per berkas.
      enabled: !isTest() || process.env.SILK_TEST_RATE_LIMIT === '1',
      storage: 'database',
      window: 60,
      max: 120,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60, max: 5 },
        '/two-factor/verify-totp': { window: 60, max: 5 },
        '/request-password-reset': { window: 60, max: 3 },
        '/email-otp/send-verification-otp': { window: 60, max: 3 },
        '/email-otp/verify-email': { window: 60, max: 5 },
        '/token': { window: 60, max: 30 },
      },
    },
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        const failed = isAPIError(ctx.context.returned);
        const ip = clientIp(ctx.request?.headers);
        const requestId = ctx.request?.headers.get('x-request-id') ?? null;
        const body = (ctx.body ?? {}) as Record<string, unknown>;

        if (ctx.path === '/sign-in/email' && failed) {
          // Login gagal: tanpa aktor dan tanpa alamat email polos.
          await recordAudit(db(), {
            actorId: null,
            action: 'auth.sign-in.failed',
            entity: 'user',
            entityId: 'tidak-diketahui',
            before: null,
            after: { emailSha256: emailHash(body.email) },
            ip,
            requestId,
          });
          return;
        }
        // Aksi yang gagal tidak mengubah data, jadi tidak diaudit sebagai perubahan.
        if (failed) return;

        if (ctx.path === '/email-otp/verify-email') {
          const returned = ctx.context.returned as { user?: { id?: string } } | undefined;
          const userId = returned?.user?.id ?? ctx.context.newSession?.user.id ?? null;
          await recordAudit(db(), {
            actorId: userId,
            action: 'auth.email-verified',
            entity: 'user',
            entityId: userId ?? `email:${emailHash(body.email) ?? 'tidak-diketahui'}`,
            before: null,
            after: null,
            ip,
            requestId,
          });
          return;
        }

        if (!AUDITED_PATHS.has(ctx.path)) return;
        const actorId = ctx.context.session?.user.id ?? ctx.context.newSession?.user.id ?? null;
        await recordAudit(db(), {
          actorId,
          action: `auth${ctx.path.replace(/\//g, '.')}`,
          entity: 'user',
          entityId: String(body.userId ?? actorId ?? 'tidak-diketahui'),
          before: null,
          after: 'role' in body ? { role: body.role } : null,
          ip,
          requestId,
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
