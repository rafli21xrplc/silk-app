import { Router } from 'express';
import { z } from 'zod';
import { tariffHistoryItemSchema, uuidSchema } from '@silk/shared';
import { defineRoute } from '../../lib/route';
import * as service from './trust.service';

export function trustRoutes(router: Router): void {
  defineRoute(router, '', {
    method: 'get',
    path: '/tariffs/:id/history',
    summary: 'Riwayat versi tarif (M4)',
    tags: ['Publik'],
    params: z.object({ id: uuidSchema }),
    response: z.array(tariffHistoryItemSchema),
    handler: async (input) => ({ data: await service.history(input.params.id), cache: 'public' }),
  });
}
