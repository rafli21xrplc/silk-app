import { z } from 'zod';
import { contentRuleCreateSchema, contentRuleUpdateSchema } from '@silk/shared';
import { actorFrom } from '../../lib/context';
import type { HandlerResult } from '../../lib/route';
import type { Request } from 'express';
import * as service from './content-rules.service';

export const idParams = z.object({ id: z.coerce.number().int().positive() });

export async function listActive(): Promise<HandlerResult> {
  return { data: await service.listActiveRules(), cache: 'public' };
}

export async function list(): Promise<HandlerResult> {
  return { data: await service.listRules() };
}

export async function create(
  input: { body: z.output<typeof contentRuleCreateSchema> },
  req: Request,
): Promise<HandlerResult> {
  return { data: await service.createRule(actorFrom(req), input.body), status: 201 };
}

export async function update(
  input: { body: z.output<typeof contentRuleUpdateSchema>; params: z.output<typeof idParams> },
  req: Request,
): Promise<HandlerResult> {
  return { data: await service.setRuleActive(actorFrom(req), input.params.id, input.body.active) };
}
