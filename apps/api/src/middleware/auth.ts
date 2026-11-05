import type { RequestHandler } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { can, USER_ROLES, type FeatureFlag, type Permission, type UserRole } from '@silk/shared';
import { getAuth } from '../auth/auth';
import { verifyBearer } from '../auth/jwt';
import { AppError } from '../lib/errors';
import { db } from '../lib/db';
import { featureEnabled } from '../lib/env';
import { isMember } from '../modules/m6-portal/portal.repo';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  banned: boolean;
}

export interface SessionInfo {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  /** Asal sesi: cookie Better Auth (web) atau JWT bearer (klien lain). */
  via: 'cookie' | 'jwt';
}

const ADMIN_SESSION_MAX_MS = 8 * 60 * 60 * 1000;

const asRole = (raw: string | null | undefined): UserRole =>
  raw && (USER_ROLES as readonly string[]).includes(raw) ? (raw as UserRole) : 'pasien';

/**
 * Muat sesi dari `Authorization: Bearer <JWT>` atau cookie Better Auth. Tidak menolak request tanpa
 * sesi, tetapi bearer yang tidak valid langsung 401 (bukan diam-diam dianggap anonim).
 */
export const loadSession: RequestHandler = async (req, _res, next) => {
  const authorization = req.get('authorization');
  if (authorization) {
    const match = /^Bearer\s+(\S+)$/i.exec(authorization);
    if (!match?.[1]) throw new AppError('UNAUTHENTICATED', 'Format header Authorization tidak valid');
    req.auth = await verifyBearer(match[1]);
    return next();
  }
  const result = await getAuth().api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (result) {
    const u = result.user as typeof result.user & {
      role?: string | null;
      twoFactorEnabled?: boolean | null;
      banned?: boolean | null;
    };
    req.auth = {
      user: {
        id: u.id,
        email: u.email,
        name: u.name,
        role: asRole(u.role),
        emailVerified: u.emailVerified,
        twoFactorEnabled: Boolean(u.twoFactorEnabled),
        banned: Boolean(u.banned),
      },
      session: {
        id: result.session.id,
        createdAt: new Date(result.session.createdAt),
        expiresAt: new Date(result.session.expiresAt),
        via: 'cookie',
      },
    };
  }
  next();
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.auth) throw new AppError('UNAUTHENTICATED', 'Silakan masuk terlebih dahulu');
  if (req.auth.user.banned) throw new AppError('FORBIDDEN', 'Akun dinonaktifkan');
  next();
};

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED', 'Silakan masuk terlebih dahulu');
    if (!roles.includes(req.auth.user.role)) throw new AppError('FORBIDDEN', 'Akses ditolak');
    next();
  };
}

/**
 * Tegakkan matriks role × permission dari `@silk/shared` (satu sumber dengan menu web).
 * Tanpa sesi → 401; role tidak berhak → 403.
 */
export function requirePermission(permission: Permission): RequestHandler {
  return (req, _res, next) => {
    if (can('anonim', permission)) return next();
    if (!req.auth) throw new AppError('UNAUTHENTICATED', 'Silakan masuk terlebih dahulu');
    if (req.auth.user.banned) throw new AppError('FORBIDDEN', 'Akun dinonaktifkan');
    if (!can(req.auth.user.role, permission)) throw new AppError('FORBIDDEN', 'Akses ditolak');
    next();
  };
}

/** Fitur di balik flag: saat OFF endpoint berperilaku seolah tidak ada (404). */
export function requireFlag(flag: FeatureFlag): RequestHandler {
  return (_req, _res, next) => {
    if (!featureEnabled(flag)) throw new AppError('NOT_FOUND', 'Tidak ditemukan');
    next();
  };
}

/**
 * Admin dan moderator wajib MFA (M15, bagian 8). Dengan two-factor aktif, Better Auth hanya
 * membuat sesi setelah TOTP terverifikasi, jadi `twoFactorEnabled` = sesi ber-MFA.
 * Sesi admin berlaku maksimal 8 jam.
 */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.auth) throw new AppError('UNAUTHENTICATED', 'Silakan masuk terlebih dahulu');
  const { user, session } = req.auth;
  // Staf hanya lewat sesi cookie yang dibuat setelah TOTP; JWT tidak pernah cukup untuk admin.
  if (session.via !== 'cookie') throw new AppError('FORBIDDEN', 'Akses admin hanya lewat sesi web');
  if (user.banned) throw new AppError('FORBIDDEN', 'Akun dinonaktifkan');
  if (!can(user.role, 'admin.access')) throw new AppError('FORBIDDEN', 'Akses ditolak');
  if (!user.twoFactorEnabled) throw new AppError('MFA_REQUIRED', 'Aktifkan autentikasi dua langkah terlebih dahulu');
  if (Date.now() - session.createdAt.getTime() > ADMIN_SESSION_MAX_MS) {
    throw new AppError('SESSION_EXPIRED', 'Sesi admin berakhir setelah 8 jam; silakan masuk lagi');
  }
  next();
};

/** Hanya peran `admin` (bukan moderator), misalnya untuk mengubah peran pengguna. */
export const requireFullAdmin: RequestHandler = (req, res, next) => {
  requireAdmin(req, res, () => {
    if (req.auth?.user.role !== 'admin') throw new AppError('FORBIDDEN', 'Hanya admin');
    next();
  });
};

/** Pengguna harus terdaftar sebagai pengelola faskes di `memberships` (M6). */
export function requireFacilityAccess(param = 'id'): RequestHandler {
  return async (req, _res, next) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED', 'Silakan masuk terlebih dahulu');
    const raw = req.params[param];
    const facilityId = typeof raw === 'string' ? raw : undefined;
    if (!facilityId || !(await isMember(db(), req.auth.user.id, facilityId))) {
      throw new AppError('FORBIDDEN', 'Anda tidak mengelola faskes ini');
    }
    next();
  };
}
