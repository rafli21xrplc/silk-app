import { decodeProtectedHeader, importJWK, jwtVerify, type JWK } from 'jose';
import type { UserRole } from '@silk/shared';
import { USER_ROLES } from '@silk/shared';
import { db } from '../lib/db';
import { env } from '../lib/env';
import { AppError } from '../lib/errors';
import type { SessionInfo, SessionUser } from '../middleware/auth';
import { JWT_AUDIENCE } from './auth';
import { findLiveSession, findPublicKey } from './jwt.repo';

const invalid = () => new AppError('UNAUTHENTICATED', 'Token tidak valid atau kedaluwarsa');

/**
 * Verifikasi JWT dari `GET /v1/auth/token` (EdDSA, kunci publik di tabel jwks, `kid` = jwks.id).
 * Token juga ditolak bila sesi asalnya sudah dicabut/kedaluwarsa, jadi keluar = semua JWT ikut mati.
 * Tanpa cache kunci di memori (API berjalan sebagai fungsi tanpa state).
 */
export async function verifyBearer(token: string): Promise<{ user: SessionUser; session: SessionInfo }> {
  let kid: string | undefined;
  try {
    const header = decodeProtectedHeader(token);
    if (header.alg !== 'EdDSA') throw invalid();
    kid = header.kid;
  } catch {
    throw invalid();
  }
  if (!kid || !/^[0-9a-f-]{36}$/i.test(kid)) throw invalid();

  const key = await findPublicKey(db(), kid);
  if (!key) throw invalid();

  let sub: string;
  let sid: string;
  try {
    const publicKey = await importJWK(JSON.parse(key.publicKey) as JWK, 'EdDSA');
    const { payload } = await jwtVerify(token, publicKey, {
      algorithms: ['EdDSA'],
      issuer: env().API_ORIGIN,
      audience: JWT_AUDIENCE,
    });
    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') throw invalid();
    sub = payload.sub;
    sid = payload.sid;
  } catch {
    throw invalid();
  }

  const now = new Date();
  const row = await findLiveSession(db(), sid, sub, now);
  if (!row) throw invalid();

  // Role dibaca dari DB, bukan dari klaim token: perubahan role berlaku segera.
  const role = (USER_ROLES as readonly string[]).includes(row.role) ? (row.role as UserRole) : 'pasien';
  return {
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      role,
      emailVerified: row.emailVerified,
      twoFactorEnabled: Boolean(row.twoFactorEnabled),
      banned: Boolean(row.banned) && (!row.banExpires || row.banExpires > now),
    },
    session: { id: row.sessionId, createdAt: row.createdAt, expiresAt: row.expiresAt, via: 'jwt' },
  };
}
