import type { Request } from 'express';
import type { z } from 'zod';
import type { claimCreateSchema, claimRejectSchema, documentPresignSchema, queueQuerySchema } from '@silk/shared';
import { actorFrom } from '../../lib/context';
import type { HandlerResult } from '../../lib/route';
import * as service from './claims.service';

export async function mine(_i: unknown, req: Request): Promise<HandlerResult> {
  return { data: await service.myClaims(actorFrom(req)) };
}

export async function create(i: { body: z.output<typeof claimCreateSchema> }, req: Request): Promise<HandlerResult> {
  return { data: await service.createClaim(actorFrom(req), i.body), status: 201 };
}

export async function presign(
  i: { params: { id: string }; body: z.output<typeof documentPresignSchema> },
  req: Request,
): Promise<HandlerResult> {
  return { data: await service.presignDocument(actorFrom(req), i.params.id, i.body), status: 201 };
}

export async function confirm(i: { params: { id: string; documentId: string } }, req: Request): Promise<HandlerResult> {
  return { data: await service.confirmDocument(actorFrom(req), i.params.id, i.params.documentId), status: 200 };
}

export async function queue(i: { query: z.output<typeof queueQuerySchema> }): Promise<HandlerResult> {
  const page = await service.claimQueue(i.query);
  return { data: page.items, meta: { nextCursor: page.nextCursor } };
}

export async function detail(i: { params: { id: string } }): Promise<HandlerResult> {
  return { data: await service.claimDetail(i.params.id) };
}

export async function approve(i: { params: { id: string }; body: { note?: string } }, req: Request): Promise<HandlerResult> {
  return { data: await service.approveClaim(actorFrom(req), i.params.id, i.body.note), status: 200 };
}

export async function reject(
  i: { params: { id: string }; body: z.output<typeof claimRejectSchema> },
  req: Request,
): Promise<HandlerResult> {
  return { data: await service.rejectClaim(actorFrom(req), i.params.id, i.body.reason), status: 200 };
}
