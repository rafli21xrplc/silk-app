import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { AppError } from '../lib/errors';
import { env } from '../lib/env';

/** Route job hanya boleh dipanggil Vercel Cron dengan `Authorization: Bearer $CRON_SECRET`. */
export const requireCronSecret: RequestHandler = (req, _res, next) => {
  const secret = env().CRON_SECRET;
  const header = req.get('authorization') ?? '';
  const expected = Buffer.from(`Bearer ${secret ?? ''}`);
  const given = Buffer.from(header);
  if (!secret || expected.length !== given.length || !timingSafeEqual(expected, given)) {
    throw new AppError('UNAUTHENTICATED', 'Rahasia cron tidak valid');
  }
  next();
};
