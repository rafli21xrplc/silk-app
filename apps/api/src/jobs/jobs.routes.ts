import { Router } from 'express';
import { z } from 'zod';
import { requireCronSecret } from '../middleware/cron';
import { defineRoute } from '../lib/route';
import { AppError } from '../lib/errors';
import { retention, runQueue, staleReminders } from './handlers';

export const CRON_JOBS = {
  'process-queue': () => runQueue(),
  'stale-reminders': () => staleReminders(),
  retention: () => retention(),
} as const;

export type CronJobName = keyof typeof CRON_JOBS;

export async function runCronJob(name: string) {
  const fn = CRON_JOBS[name as CronJobName];
  if (!fn) throw new AppError('NOT_FOUND', `Job "${name}" tidak dikenal`);
  return fn();
}

/** GET /v1/internal/jobs/:type — dipanggil Vercel Cron dengan CRON_SECRET (A8). */
export function jobsRoutes(router: Router): void {
  defineRoute(router, '/internal', {
    method: 'get',
    path: '/jobs/:type',
    summary: 'Jalankan job terjadwal (Vercel Cron)',
    tags: ['Internal'],
    security: 'cron',
    params: z.object({ type: z.enum(['process-queue', 'stale-reminders', 'retention']) }),
    middleware: [requireCronSecret],
    handler: async (input) => ({ data: await runCronJob(input.params.type) }),
  });
}
