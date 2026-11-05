import type { Request } from 'express';
import type { z } from 'zod';
import type {
  documentPresignSchema,
  importRequestSchema,
  rejectReasonSchema,
  reviewQueueQuerySchema,
  tariffActiveSchema,
  tariffCreateSchema,
  tariffUpdateSchema,
} from '@silk/shared';
import { actorFrom } from '../../lib/context';
import type { HandlerResult } from '../../lib/route';
import * as service from './tariff-requests.service';

type IdParams = { params: { id: string } };

/* ---------- Portal ---------- */

export async function createForService(i: IdParams & { body: z.output<typeof tariffCreateSchema> }, req: Request): Promise<HandlerResult> {
  return { data: await service.requestNewTariff(actorFrom(req), i.params.id, i.body), status: 201 };
}

export async function createForTariff(i: IdParams & { body: z.output<typeof tariffUpdateSchema> }, req: Request): Promise<HandlerResult> {
  return { data: await service.requestTariffChange(actorFrom(req), i.params.id, i.body), status: 201 };
}

export async function importCsv(i: IdParams & { body: z.output<typeof importRequestSchema> }, req: Request): Promise<HandlerResult> {
  return { data: await service.requestImport(actorFrom(req), i.params.id, i.body), status: 201 };
}

export async function listForFacility(i: IdParams, req: Request): Promise<HandlerResult> {
  return { data: await service.listForFacility(actorFrom(req), i.params.id) };
}

export async function setActive(i: IdParams & { body: z.output<typeof tariffActiveSchema> }, req: Request): Promise<HandlerResult> {
  return { data: await service.setActive(actorFrom(req), i.params.id, i.body.active) };
}

export async function presignDocument(i: IdParams & { body: z.output<typeof documentPresignSchema> }, req: Request): Promise<HandlerResult> {
  return { data: await service.presignDocument(actorFrom(req), i.params.id, i.body), status: 201 };
}

export async function confirmDocument(i: { params: { id: string; documentId: string } }, req: Request): Promise<HandlerResult> {
  return { data: await service.confirmDocument(actorFrom(req), i.params.id, i.params.documentId) };
}

/* ---------- Admin ---------- */

export async function queue(i: { query: z.output<typeof reviewQueueQuerySchema> }): Promise<HandlerResult> {
  const page = await service.queue(i.query);
  return { data: page.items, meta: { nextCursor: page.nextCursor } };
}

export async function detail(i: IdParams): Promise<HandlerResult> {
  return { data: await service.detail(i.params.id) };
}

export async function approve(i: IdParams, req: Request): Promise<HandlerResult> {
  return { data: await service.approve(actorFrom(req), i.params.id), status: 200 };
}

export async function reject(i: IdParams & { body: z.output<typeof rejectReasonSchema> }, req: Request): Promise<HandlerResult> {
  return { data: await service.reject(actorFrom(req), i.params.id, i.body.reason), status: 200 };
}
