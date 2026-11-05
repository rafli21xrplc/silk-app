import type { z } from 'zod';
import type { facilitySearchQuerySchema } from '@silk/shared';
import type { HandlerResult } from '../../lib/route';
import * as service from './directory.service';

export async function search(input: { query: z.output<typeof facilitySearchQuerySchema> }): Promise<HandlerResult> {
  const r = await service.searchFacilities(input.query);
  return { data: r.items, meta: { nextCursor: r.nextCursor }, cache: 'public' };
}

export async function detail(input: { params: { slug: string } }): Promise<HandlerResult> {
  return { data: await service.getFacility(input.params.slug), cache: 'public' };
}

export async function practitioner(input: { params: { slug: string } }): Promise<HandlerResult> {
  return { data: await service.getPractitioner(input.params.slug), cache: 'public' };
}

export async function sitemap(): Promise<HandlerResult> {
  return { data: await service.sitemap(), cache: 'public' };
}
