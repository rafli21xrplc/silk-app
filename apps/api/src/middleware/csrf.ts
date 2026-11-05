import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { AppError } from '../lib/errors';
import { env } from '../lib/env';

export const CSRF_COOKIE = 'silk_csrf';
export const CSRF_HEADER = 'x-csrf-token';

/** Terbitkan token CSRF (pola double-submit): cookie HttpOnly + token di body untuk dikirim lewat header. */
export const issueCsrf: RequestHandler = (req, res) => {
  const existing = req.cookies?.[CSRF_COOKIE] as string | undefined;
  const token = existing && /^[A-Za-z0-9_-]{43}$/.test(existing) ? existing : randomBytes(32).toString('base64url');
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env().NODE_ENV === 'production',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.set('Cache-Control', 'no-store');
  res.json({ data: { token } });
};

/** Untuk metode selain GET/HEAD/OPTIONS (sesi cookie). Pasang setelah `loadSession`: header harus sama dengan cookie, dan Origin (bila ada) tepercaya. */
export const verifyCsrf: RequestHandler = (req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  // Bearer JWT tidak dikirim otomatis oleh browser, jadi tidak rentan CSRF.
  if (req.auth?.session.via === 'jwt') return next();
  const origin = req.get('origin');
  if (origin && origin !== env().WEB_ORIGIN && origin !== env().API_ORIGIN) {
    throw new AppError('CSRF_INVALID', 'Origin tidak diizinkan');
  }
  const cookie = req.cookies?.[CSRF_COOKIE] as string | undefined;
  const header = req.get(CSRF_HEADER);
  if (!cookie || !header) throw new AppError('CSRF_INVALID', 'Token CSRF wajib');
  const a = Buffer.from(cookie);
  const b = Buffer.from(header);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new AppError('CSRF_INVALID', 'Token CSRF tidak cocok');
  next();
};
