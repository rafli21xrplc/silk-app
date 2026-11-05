import type { Request } from 'express';
import type { z } from 'zod';
import type {
  adminFacilityQuerySchema,
  adminFacilityUpdateSchema,
  adminImportCreateSchema,
  auditQuerySchema,
  csvPresignSchema,
  queueQuerySchema,
  reportUpdateSchema,
} from '@silk/shared';
import { actorFrom } from '../../lib/context';
import type { HandlerResult } from '../../lib/route';
import { runCronJob } from '../../jobs/jobs.routes';
import { jobStats } from '../../jobs/jobs.repo';
import { db } from '../../lib/db';
import * as imports from '../m5-imports/imports.service';
import * as reports from '../m14-reports/reports.service';
import { recordAudit } from './audit.repo';
import * as service from './admin.service';

export async function facilities(i: { query: z.output<typeof adminFacilityQuerySchema> }): Promise<HandlerResult> {
  const page = await service.listFacilities(i.query);
  return { data: page.items, meta: { nextCursor: page.nextCursor } };
}

export async function updateFacility(
  i: { params: { id: string }; body: z.output<typeof adminFacilityUpdateSchema> },
  req: Request,
): Promise<HandlerResult> {
  return { data: await service.updateFacility(actorFrom(req), i.params.id, i.body) };
}

export async function tariffQueue(i: { query: z.output<typeof queueQuerySchema> }): Promise<HandlerResult> {
  const page = await service.tariffQueue(i.query);
  return { data: page.items, meta: { nextCursor: page.nextCursor } };
}

export async function publishTariff(i: { params: { id: string } }, req: Request): Promise<HandlerResult> {
  return { data: await service.setTariffStatus(actorFrom(req), i.params.id, 'terbit'), status: 200 };
}

export async function withdrawTariff(i: { params: { id: string } }, req: Request): Promise<HandlerResult> {
  return { data: await service.setTariffStatus(actorFrom(req), i.params.id, 'ditarik'), status: 200 };
}

export async function auditLogs(i: { query: z.output<typeof auditQuerySchema> }): Promise<HandlerResult> {
  const page = await service.auditLogs(i.query);
  return { data: page.items, meta: { nextCursor: page.nextCursor } };
}

export async function presignImport(i: { body: z.output<typeof csvPresignSchema> }): Promise<HandlerResult> {
  return { data: await imports.presignCsv('imports/admin', i.body), status: 201 };
}

export async function createImport(i: { body: z.output<typeof adminImportCreateSchema> }, req: Request): Promise<HandlerResult> {
  return { data: await imports.createAdminBatch(actorFrom(req), i.body), status: 201 };
}

export async function listImports(i: { query: z.output<typeof queueQuerySchema> }): Promise<HandlerResult> {
  const page = await imports.listAdminBatches(i.query);
  return { data: page.items, meta: { nextCursor: page.nextCursor } };
}

export async function getImport(i: { params: { id: string }; query: { cursor?: string } }): Promise<HandlerResult> {
  const r = await imports.getBatch(i.params.id, i.query.cursor);
  return { data: { batch: r.batch, problemRows: r.problemRows }, meta: { nextCursor: r.nextCursor } };
}

export async function resolveImportRow(
  i: { params: { id: string; rowId: number }; body: { facilityId: string } },
  req: Request,
): Promise<HandlerResult> {
  return { data: await imports.resolveRow(actorFrom(req), i.params.id, i.params.rowId, i.body.facilityId) };
}

export async function publishImport(i: { params: { id: string } }, req: Request): Promise<HandlerResult> {
  return { data: await imports.publishBatch(actorFrom(req), i.params.id), status: 200 };
}

export async function reportQueue(i: { query: z.output<typeof queueQuerySchema> }): Promise<HandlerResult> {
  const page = await reports.queue(i.query);
  return { data: page.items, meta: { nextCursor: page.nextCursor } };
}

export async function updateReport(
  i: { params: { id: string }; body: z.output<typeof reportUpdateSchema> },
  req: Request,
): Promise<HandlerResult> {
  return { data: await reports.handle(actorFrom(req), i.params.id, i.body) };
}

/** Jalankan job manual (staging tidak punya Cron otomatis; bagian 2 aturan 7). */
export async function runJob(i: { params: { type: string } }, req: Request): Promise<HandlerResult> {
  const ctx = actorFrom(req);
  const result = await runCronJob(i.params.type);
  await recordAudit(db(), {
    actorId: ctx.actorId,
    action: 'job.run_manual',
    entity: 'job',
    entityId: i.params.type,
    before: null,
    after: result,
    ip: ctx.ip,
    requestId: ctx.requestId,
  });
  return { data: result, status: 200 };
}

export async function jobs(): Promise<HandlerResult> {
  return { data: await jobStats(db()) };
}

export async function overview(): Promise<HandlerResult> {
  return { data: await service.overview() };
}
