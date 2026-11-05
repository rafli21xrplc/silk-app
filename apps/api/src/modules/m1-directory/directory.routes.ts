import { Router } from 'express';
import { z } from 'zod';
import {
  facilityDetailSchema,
  facilityListItemSchema,
  facilitySearchQuerySchema,
  practitionerDetailSchema,
  practitionerListItemSchema,
  practitionerSearchQuerySchema,
  practitionerSpecialtySchema,
  slugSchema,
} from '@silk/shared';
import { defineRoute } from '../../lib/route';
import * as c from './directory.controller';

const slugParams = z.object({ slug: slugSchema });

export function directoryRoutes(router: Router): void {
  defineRoute(router, '', {
    method: 'get',
    path: '/facilities',
    summary: 'Cari faskes: q, city, type, service, category, lat/lng/radius, priceMin/priceMax, minRating (ber-flag) (M1, F-03)',
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
    path: '/practitioners',
    summary: 'Cari dokter: q, specialty, city, lat/lng/radius; urut relevansi, nama, atau jarak (Fase 4b, F-03)',
    tags: ['Publik'],
    query: practitionerSearchQuerySchema,
    response: z.array(practitionerListItemSchema),
    handler: (input) => c.searchPractitioners(input),
  });
  defineRoute(router, '', {
    method: 'get',
    path: '/practitioner-specialties',
    summary: 'Spesialisasi dokter yang tampil, untuk filter (Fase 4b)',
    tags: ['Publik'],
    response: z.array(practitionerSpecialtySchema),
    handler: () => c.practitionerSpecialties(),
  });
  defineRoute(router, '', {
    method: 'get',
    path: '/practitioners/:slug',
    summary: 'Detail dokter: profil praktik utama, jadwal, tempat praktik, tarif, artikel (M1, Fase 4b)',
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
