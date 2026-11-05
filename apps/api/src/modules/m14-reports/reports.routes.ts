import { Router } from 'express';
import { z } from 'zod';
import { reportCreateSchema } from '@silk/shared';
import { defineRoute } from '../../lib/route';
import { pgRateLimit } from '../../middleware/rate-limit';
import * as service from './reports.service';

export function reportsRoutes(router: Router): void {
  defineRoute(router, '', {
    method: 'post',
    path: '/reports',
    summary: 'Laporkan data tarif salah (Turnstile wajib) (M14)',
    tags: ['Publik'],
    body: reportCreateSchema,
    response: z.object({ id: z.string(), status: z.string() }),
    middleware: [pgRateLimit({ name: 'report', limit: 5, windowSec: 60, key: (req) => req.ip ?? null })],
    handler: async (input, req) => ({ data: await service.createReport(input.body, req.ip ?? null), status: 201 }),
  });
}
