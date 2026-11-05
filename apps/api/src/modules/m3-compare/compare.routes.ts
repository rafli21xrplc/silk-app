import { Router } from 'express';
import { compareQuerySchema, compareResponseSchema } from '@silk/shared';
import { defineRoute } from '../../lib/route';
import * as service from './compare.service';

export function compareRoutes(router: Router): void {
  defineRoute(router, '', {
    method: 'get',
    path: '/compare',
    summary: 'Bandingkan tarif: service + facilityIds atau service + city (M3)',
    tags: ['Publik'],
    query: compareQuerySchema,
    response: compareResponseSchema,
    // Controller tipis: validasi sudah di defineRoute.
    handler: async (input) => ({ data: await service.compare(input.query), meta: { nextCursor: null }, cache: 'public' }),
  });
}
