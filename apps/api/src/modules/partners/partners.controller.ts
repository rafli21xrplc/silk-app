import type { Request } from 'express';
import type { z } from 'zod';
import type { partnerQueueQuerySchema, PartnerUpsertInput } from '@silk/shared';
import { actorFrom } from '../../lib/context';
import type { HandlerResult } from '../../lib/route';
import * as service from './partners.service';

export async function mine(_i: unknown, req: Request): Promise<HandlerResult> {
  return { data: await service.myPartner(actorFrom(req)) };
}

export async function upsertMine(i: { body: PartnerUpsertInput }, req: Request): Promise<HandlerResult> {
  return { data: await service.upsertMyPartner(actorFrom(req), i.body) };
}

export async function queue(i: { query: z.output<typeof partnerQueueQuerySchema> }): Promise<HandlerResult> {
  const page = await service.partnerQueue(i.query);
  return { data: page.items, meta: { nextCursor: page.nextCursor } };
}

export async function approve(i: { params: { id: string } }, req: Request): Promise<HandlerResult> {
  return { data: await service.approvePartner(actorFrom(req), i.params.id) };
}

export async function reject(i: { params: { id: string }; body: { reason: string } }, req: Request): Promise<HandlerResult> {
  return { data: await service.rejectPartner(actorFrom(req), i.params.id, i.body.reason) };
}
