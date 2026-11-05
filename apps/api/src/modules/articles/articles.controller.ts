import type { Request } from 'express';
import type { z } from 'zod';
import type {
  articleDraftInputSchema,
  articleQueueQuerySchema,
  articleStaffWithdrawSchema,
  articleWithdrawSchema,
  rejectReasonSchema,
} from '@silk/shared';
import { actorFrom } from '../../lib/context';
import type { HandlerResult } from '../../lib/route';
import * as service from './articles.service';

type IdParams = { params: { id: string } };
type Draft = { body: z.output<typeof articleDraftInputSchema> };

/* ---------- Portal ---------- */

export async function listMine(_i: unknown, req: Request): Promise<HandlerResult> {
  return { data: await service.listMine(actorFrom(req)) };
}

export async function getMine(i: IdParams, req: Request): Promise<HandlerResult> {
  return { data: await service.getMine(actorFrom(req), i.params.id) };
}

export async function create(i: Draft, req: Request): Promise<HandlerResult> {
  return { data: await service.create(actorFrom(req), i.body), status: 201 };
}

export async function update(i: IdParams & Draft, req: Request): Promise<HandlerResult> {
  return { data: await service.update(actorFrom(req), i.params.id, i.body) };
}

export async function submit(i: IdParams, req: Request): Promise<HandlerResult> {
  return { data: await service.submit(actorFrom(req), i.params.id) };
}

export async function withdrawMine(i: IdParams & { body: z.output<typeof articleWithdrawSchema> }, req: Request): Promise<HandlerResult> {
  return { data: await service.withdrawMine(actorFrom(req), i.params.id, i.body.reason) };
}

export async function deleteMine(i: IdParams, req: Request): Promise<HandlerResult> {
  return { data: await service.deleteMine(actorFrom(req), i.params.id) };
}

/* ---------- Admin ---------- */

export async function queue(i: { query: z.output<typeof articleQueueQuerySchema> }): Promise<HandlerResult> {
  const page = await service.queue(i.query);
  return { data: page.items, meta: { nextCursor: page.nextCursor } };
}

export async function detail(i: IdParams): Promise<HandlerResult> {
  return { data: await service.detail(i.params.id) };
}

export async function approve(i: IdParams, req: Request): Promise<HandlerResult> {
  return { data: await service.approve(actorFrom(req), i.params.id) };
}

export async function reject(i: IdParams & { body: z.output<typeof rejectReasonSchema> }, req: Request): Promise<HandlerResult> {
  return { data: await service.reject(actorFrom(req), i.params.id, i.body.reason) };
}

export async function staffWithdraw(i: IdParams & { body: z.output<typeof articleStaffWithdrawSchema> }, req: Request): Promise<HandlerResult> {
  return { data: await service.staffWithdraw(actorFrom(req), i.params.id, i.body.reason) };
}

/* ---------- Publik ---------- */

export async function publicList(i: { query: { limit: number; cursor?: string } }): Promise<HandlerResult> {
  const page = await service.publicList(i.query);
  return { data: page.items, meta: { nextCursor: page.nextCursor } };
}

export async function publicGet(i: { params: { slug: string } }): Promise<HandlerResult> {
  return { data: await service.publicGet(i.params.slug) };
}
