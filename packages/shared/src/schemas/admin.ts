import { z } from 'zod';
import {
  CONTENT_RULE_KINDS,
  CONTENT_RULE_LEVELS,
  ENTITY_STATUSES,
  REPORT_STATUSES,
} from '../constants';
import { validateRulePattern } from '../content-filter';
import { cursorSchema, dataSourceKindSchema, limitSchema, verificationSchema } from './common';

export const claimRejectSchema = z.object({ reason: z.string().trim().min(5).max(1000) });
export const claimApproveSchema = z.object({ note: z.string().trim().max(1000).optional() });

export const reportUpdateSchema = z.object({
  status: z.enum(REPORT_STATUSES),
  note: z.string().trim().max(1000).optional(),
});

export const adminFacilityUpdateSchema = z
  .object({
    status: z.enum(ENTITY_STATUSES).optional(),
    verification: verificationSchema.optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Tidak ada perubahan' })
  .refine((v) => (v.lat === undefined) === (v.lng === undefined), {
    message: 'lat dan lng harus diisi bersama',
    path: ['lat'],
  });

export const adminFacilityQuerySchema = z.object({
  status: z.enum(ENTITY_STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
  limit: limitSchema,
  cursor: cursorSchema,
});

export const adminImportCreateSchema = z.object({
  objectKey: z.string().min(1).max(300),
  fileName: z.string().trim().max(200).optional(),
  /** Jenis sumber default bila baris CSV tidak menyiratkan lain. */
  sourceKind: dataSourceKindSchema.default('perda'),
});

export const contentRuleCreateSchema = z
  .object({
    pattern: z.string().trim().min(2).max(200),
    kind: z.enum(CONTENT_RULE_KINDS).default('kata'),
    level: z.enum(CONTENT_RULE_LEVELS).default('blokir'),
  })
  .superRefine((v, ctx) => {
    const err = validateRulePattern(v);
    if (err) ctx.addIssue({ code: 'custom', path: ['pattern'], message: `Pola tidak valid: ${err}` });
  });

export const contentRuleUpdateSchema = z.object({ active: z.boolean() });

export const auditQuerySchema = z.object({
  entity: z.string().max(60).optional(),
  entityId: z.string().max(100).optional(),
  actorId: z.string().max(100).optional(),
  action: z.string().max(100).optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  limit: limitSchema,
  cursor: cursorSchema,
});
export type AuditQuery = z.infer<typeof auditQuerySchema>;

export const queueQuerySchema = z.object({
  status: z.string().max(40).optional(),
  limit: limitSchema,
  cursor: cursorSchema,
});
