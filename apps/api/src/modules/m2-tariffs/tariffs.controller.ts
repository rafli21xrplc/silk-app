import type { z } from 'zod';
import type { servicesQuerySchema } from '@silk/shared';
import type { HandlerResult } from '../../lib/route';
import * as service from './tariffs.service';

export async function listServices(input: { query: z.output<typeof servicesQuerySchema> }): Promise<HandlerResult> {
  const r = await service.listServices(input.query);
  return { data: r.items, meta: { nextCursor: r.nextCursor }, cache: 'public' };
}

export async function getService(input: { params: { slug: string } }): Promise<HandlerResult> {
  return { data: await service.getService(input.params.slug), cache: 'public' };
}

export async function listCategories(): Promise<HandlerResult> {
  return { data: await service.listCategories(), cache: 'public' };
}
