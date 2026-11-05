import type { Request, RequestHandler } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../lib/db';
import { AppError } from '../lib/errors';

/**
 * Rate limit berbasis Postgres (jendela tetap). Dipakai untuk rute sensitif seperti laporan publik;
 * lapis utama untuk lalu lintas umum adalah WAF (bagian 8).
 */
export function pgRateLimit(opts: { name: string; limit: number; windowSec: number; key: (req: Request) => string | null }): RequestHandler {
  return async (req, res, next) => {
    const id = opts.key(req);
    if (!id) return next();
    const key = `${opts.name}:${id}`;
    const result = await db().execute<{ count: number }>(sql`
      INSERT INTO rate_limit_counters (key, window_start, count)
      VALUES (${key}, to_timestamp(floor(extract(epoch from now()) / ${opts.windowSec}) * ${opts.windowSec}), 1)
      ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limit_counters.count + 1
      RETURNING count
    `);
    const count = Number(result.rows[0]?.count ?? 0);
    res.set('RateLimit-Limit', String(opts.limit));
    res.set('RateLimit-Remaining', String(Math.max(0, opts.limit - count)));
    if (count > opts.limit) {
      res.set('Retry-After', String(opts.windowSec));
      throw new AppError('RATE_LIMITED', 'Terlalu banyak permintaan; coba lagi nanti');
    }
    next();
  };
}
