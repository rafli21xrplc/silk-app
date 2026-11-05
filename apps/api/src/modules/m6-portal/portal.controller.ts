import type { Request } from 'express';
import type { z } from 'zod';
import type { csvPresignSchema } from '@silk/shared';
import { actorFrom } from '../../lib/context';
import type { HandlerResult } from '../../lib/route';
import { presignCsv } from '../m5-imports/imports.service';
import * as service from './portal.service';

type IdParams = { params: { id: string } };

export async function myFacilities(_i: unknown, req: Request): Promise<HandlerResult> {
  return { data: await service.listMyFacilities(actorFrom(req)) };
}

export async function listTariffs(i: IdParams, req: Request): Promise<HandlerResult> {
  return { data: await service.listTariffs(actorFrom(req), i.params.id) };
}

export async function presignImport(i: IdParams & { body: z.output<typeof csvPresignSchema> }): Promise<HandlerResult> {
  return { data: await presignCsv(`imports/facility/${i.params.id}`, i.body), status: 201 };
}
