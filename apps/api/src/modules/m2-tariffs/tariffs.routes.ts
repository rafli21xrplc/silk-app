import { Router } from 'express';
import { z } from 'zod';
import { serviceDetailSchema, serviceListItemSchema, servicesQuerySchema, slugSchema } from '@silk/shared';
import { defineRoute } from '../../lib/route';
import * as c from './tariffs.controller';

export function tariffsRoutes(router: Router): void {
  defineRoute(router, '', {
    method: 'get',
    path: '/services',
    summary: 'Daftar dan cari layanan standar (M2)',
    tags: ['Publik'],
    query: servicesQuerySchema,
    response: z.array(serviceListItemSchema),
    handler: (input) => c.listServices(input),
  });
  defineRoute(router, '', {
    method: 'get',
    path: '/services/:slug',
    summary: 'Detail layanan dan ringkasan harga per kota (M2)',
    tags: ['Publik'],
    params: z.object({ slug: slugSchema }),
    response: serviceDetailSchema,
    handler: (input) => c.getService(input),
  });
}
