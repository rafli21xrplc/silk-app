import { checkContent, type ContentCheckResult, type ContentRuleKind, type ContentRuleLevel } from '@silk/shared';
import type { DbOrTx } from '@silk/db';
import { db } from '../../lib/db';
import type { ActorContext } from '../../lib/context';
import { AppError, notFound } from '../../lib/errors';
import { recordAudit } from '../m15-admin/audit.repo';
import * as repo from './content-rules.repo';

/** Periksa teks yang akan tampil publik terhadap aturan aktif (M17). Aturan dibaca dari DB tiap kali. */
export async function checkFields(
  fields: Record<string, string | null | undefined>,
  database: DbOrTx = db(),
): Promise<ContentCheckResult> {
  const rules = await repo.listActiveRules(database);
  return checkContent(fields, rules);
}

/**
 * Tolak dengan `CONTENT_RULE_VIOLATION` bila ada aturan `blokir` yang cocok, sambil menyebut kata
 * yang melanggar. Mengembalikan `needsReview` bila hanya aturan `tinjau` yang cocok.
 */
export async function assertContentAllowed(
  fields: Record<string, string | null | undefined>,
  database: DbOrTx = db(),
): Promise<{ needsReview: boolean }> {
  const result = await checkFields(fields, database);
  if (result.blocked) {
    const words = [...new Set(result.violations.filter((v) => v.level === 'blokir').map((v) => v.match))];
    throw new AppError(
      'CONTENT_RULE_VIOLATION',
      `Teks mengandung kata yang tidak diizinkan: ${words.map((w) => `"${w}"`).join(', ')}`,
      result.violations.map((v) => ({ path: v.field, message: `Kata "${v.match}" tidak diizinkan`, match: v.match, level: v.level })),
    );
  }
  return { needsReview: result.needsReview };
}

/** Aturan aktif (dipakai web untuk memeriksa artikel Sanity sebelum render). */
export function listActiveRules() {
  return repo.listActiveRules(db());
}

export function listRules() {
  return repo.listAllRules(db());
}

export async function createRule(
  ctx: ActorContext,
  input: { pattern: string; kind: ContentRuleKind; level: ContentRuleLevel },
) {
  return db().transaction(async (tx) => {
    const row = await repo.insertRule(tx, { ...input, createdBy: ctx.actorId });
    if (!row) throw new AppError('CONFLICT', 'Aturan dengan pola yang sama sudah ada');
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: 'content_rule.create',
      entity: 'content_rule',
      entityId: String(row.id),
      before: null,
      after: row,
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    return row;
  });
}

export async function setRuleActive(ctx: ActorContext, id: number, active: boolean) {
  return db().transaction(async (tx) => {
    const before = await repo.findRule(tx, id);
    if (!before) throw notFound('NOT_FOUND', 'Aturan');
    const after = await repo.setRuleActive(tx, id, active);
    await recordAudit(tx, {
      actorId: ctx.actorId,
      action: 'content_rule.update',
      entity: 'content_rule',
      entityId: String(id),
      before,
      after,
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    return after;
  });
}
