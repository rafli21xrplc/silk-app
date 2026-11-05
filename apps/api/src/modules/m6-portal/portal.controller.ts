import type { Request } from 'express';
import type { z } from 'zod';
import type {
  csvPresignSchema,
  facilityUpdateSchema,
  importRequestSchema,
  tariffCreateSchema,
  tariffUpdateSchema,
} from '@silk/shared';
import { actorFrom } from '../../lib/context';
import type { HandlerResult } from '../../lib/route';
import { importForFacility, presignCsv } from '../m5-imports/imports.service';
import * as service from './portal.service';

type IdParams = { params: { id: string } };

export async function myFacilities(_i: unknown, req: Request): Promise<HandlerResult> {
  return { data: await service.listMyFacilities(actorFrom(req)) };
}

export async function getFacility(i: IdParams, req: Request): Promise<HandlerResult> {
  return { data: await service.getFacility(actorFrom(req), i.params.id) };
}

export async function updateFacility(
  i: IdParams & { body: z.output<typeof facilityUpdateSchema> },
  req: Request,
): Promise<HandlerResult> {
  return { data: await service.updateFacility(actorFrom(req), i.params.id, i.body) };
}

export async function listTariffs(i: IdParams, req: Request): Promise<HandlerResult> {
  return { data: await service.listTariffs(actorFrom(req), i.params.id) };
}

export async function createTariff(
  i: IdParams & { body: z.output<typeof tariffCreateSchema> },
  req: Request,
): Promise<HandlerResult> {
  return { data: await service.createTariff(actorFrom(req), i.params.id, i.body), status: 201 };
}

export async function updateTariff(
  i: IdParams & { body: z.output<typeof tariffUpdateSchema> },
  req: Request,
): Promise<HandlerResult> {
  return { data: await service.updateTariff(actorFrom(req), i.params.id, i.body) };
}

export async function presignImport(i: IdParams & { body: z.output<typeof csvPresignSchema> }): Promise<HandlerResult> {
  return { data: await presignCsv(`imports/facility/${i.params.id}`, i.body), status: 201 };
}

export async function importTariffs(
  i: IdParams & { body: z.output<typeof importRequestSchema> },
  req: Request,
): Promise<HandlerResult> {
  return { data: await importForFacility(actorFrom(req), i.params.id, i.body.objectKey), status: 201 };
}
