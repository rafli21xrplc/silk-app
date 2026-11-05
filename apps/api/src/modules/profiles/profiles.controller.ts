import type { Request } from 'express';
import type { z } from 'zod';
import type {
  facilityUpdateSchema,
  mediaOrderSchema,
  mediaPresignSchema,
  profileCreateSchema,
  rejectReasonSchema,
  reviewQueueQuerySchema,
} from '@silk/shared';
import { actorFrom } from '../../lib/context';
import type { HandlerResult } from '../../lib/route';
import * as media from './media.service';
import * as service from './profiles.service';

type IdParams = { params: { id: string } };
type MediaParams = { params: { id: string; mediaId: string } };
type QueueQuery = { query: z.output<typeof reviewQueueQuerySchema> };
type Reject = { body: z.output<typeof rejectReasonSchema> };

/* ---------- Portal ---------- */

export async function create(i: { body: z.output<typeof profileCreateSchema> }, req: Request): Promise<HandlerResult> {
  return { data: await service.createProfile(actorFrom(req), i.body), status: 201 };
}

export async function get(i: IdParams, req: Request): Promise<HandlerResult> {
  return { data: await service.getProfile(actorFrom(req), i.params.id) };
}

export async function update(i: IdParams & { body: z.output<typeof facilityUpdateSchema> }, req: Request): Promise<HandlerResult> {
  return { data: await service.updateProfile(actorFrom(req), i.params.id, i.body) };
}

export async function submit(i: IdParams, req: Request): Promise<HandlerResult> {
  return { data: await service.submitProfile(actorFrom(req), i.params.id), status: 200 };
}

export async function presignMedia(i: IdParams & { body: z.output<typeof mediaPresignSchema> }, req: Request): Promise<HandlerResult> {
  return { data: await media.presignMedia(actorFrom(req), i.params.id, i.body), status: 201 };
}

export async function confirmMedia(i: MediaParams, req: Request): Promise<HandlerResult> {
  return { data: await media.confirmMedia(actorFrom(req), i.params.id, i.params.mediaId) };
}

export async function deleteMedia(i: MediaParams, req: Request): Promise<HandlerResult> {
  return { data: await media.deleteMedia(actorFrom(req), i.params.id, i.params.mediaId) };
}

export async function reorderMedia(i: IdParams & { body: z.output<typeof mediaOrderSchema> }, req: Request): Promise<HandlerResult> {
  return { data: await media.reorderMedia(actorFrom(req), i.params.id, i.body.ids) };
}

/* ---------- Admin ---------- */

export async function revisionQueue(i: QueueQuery): Promise<HandlerResult> {
  const page = await service.revisionQueue(i.query);
  return { data: page.items, meta: { nextCursor: page.nextCursor } };
}

export async function revisionDetail(i: IdParams): Promise<HandlerResult> {
  return { data: await service.revisionDetail(i.params.id) };
}

export async function approveRevision(i: IdParams, req: Request): Promise<HandlerResult> {
  return { data: await service.approveRevision(actorFrom(req), i.params.id), status: 200 };
}

export async function rejectRevision(i: IdParams & Reject, req: Request): Promise<HandlerResult> {
  return { data: await service.rejectRevision(actorFrom(req), i.params.id, i.body.reason), status: 200 };
}

export async function mediaQueue(i: QueueQuery): Promise<HandlerResult> {
  const page = await media.mediaQueue(i.query);
  return { data: page.items, meta: { nextCursor: page.nextCursor } };
}

export async function approveMedia(i: IdParams, req: Request): Promise<HandlerResult> {
  return { data: await media.approveMedia(actorFrom(req), i.params.id), status: 200 };
}

export async function rejectMedia(i: IdParams & Reject, req: Request): Promise<HandlerResult> {
  return { data: await media.rejectMedia(actorFrom(req), i.params.id, i.body.reason), status: 200 };
}
