import { Router } from 'express';
import { z } from 'zod';
import {
  facilityDetailSchema,
  facilityListItemSchema,
  facilitySearchQuerySchema,
  practitionerDetailSchema,
  slugSchema,
} from '@silk/shared';
import { defineRoute } from '../../lib/route';
import * as c from './directory.controller';

const slugParams = z.object({ slug: slugSchema });

export function directoryRoutes(router: Router): void {
  defineRoute(router, '', {
    method: 'get',
    path: '/facilities',
    summary: 'Cari faskes: q, city, type, service, lat, lng, radius (M1)',
    tags: ['Publik'],
    query: facilitySearchQuerySchema,
    response: z.array(facilityListItemSchema),
    handler: (input) => c.search(input),
  });
  defineRoute(router, '', {
    method: 'get',
    path: '/facilities/:slug',
    summary: 'Detail faskes beserta tarif terbit (M1, M2)',
    tags: ['Publik'],
    params: slugParams,
    response: facilityDetailSchema,
    handler: (input) => c.detail(input),
  });
  defineRoute(router, '', {
    method: 'get',
    path: '/practitioners/:slug',
    summary: 'Detail tenaga medis (M1)',
    tags: ['Publik'],
    params: slugParams,
    response: practitionerDetailSchema,
    handler: (input) => c.practitioner(input),
  });
  defineRoute(router, '', {
    method: 'get',
    path: '/sitemap',
    summary: 'Daftar URL untuk sitemap; hanya entitas terbit (M12)',
    tags: ['Publik'],
    handler: () => c.sitemap(),
  });
}
