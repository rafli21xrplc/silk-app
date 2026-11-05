import type { RequestHandler } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import type { UserRole } from '@silk/shared';
import { getAuth } from '../auth/auth';
import { AppError } from '../lib/errors';
import { db } from '../lib/db';
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
}

const ADMIN_SESSION_MAX_MS = 8 * 60 * 60 * 1000;

/** Muat sesi Better Auth dari cookie (bila ada). Tidak menolak request tanpa sesi. */
export const loadSession: RequestHandler = async (req, _res, next) => {
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
        role: (u.role as UserRole | null) ?? 'faskes',
        emailVerified: u.emailVerified,
        twoFactorEnabled: Boolean(u.twoFactorEnabled),
        banned: Boolean(u.banned),
      },
      session: {
        id: result.session.id,
        createdAt: new Date(result.session.createdAt),
        expiresAt: new Date(result.session.expiresAt),
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
 * Admin dan moderator wajib MFA (M15, bagian 8). Dengan two-factor aktif, Better Auth hanya
 * membuat sesi setelah TOTP terverifikasi, jadi `twoFactorEnabled` = sesi ber-MFA.
 * Sesi admin berlaku maksimal 8 jam.
 */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.auth) throw new AppError('UNAUTHENTICATED', 'Silakan masuk terlebih dahulu');
  const { user, session } = req.auth;
  if (user.role !== 'admin' && user.role !== 'moderator') throw new AppError('FORBIDDEN', 'Akses ditolak');
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
