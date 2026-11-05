import { and, desc, eq, gte, lt, lte, type SQL } from 'drizzle-orm';
import { auditLogs, type DbOrTx } from '@silk/db';

export interface AuditEntry {
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string;
  before: unknown;
  after: unknown;
  ip: string | null;
  requestId: string | null;
}

/** Tulis satu entri audit. Dipanggil di dalam transaksi yang sama dengan perubahan datanya. */
export async function recordAudit(db: DbOrTx, entry: AuditEntry): Promise<void> {
  await db.insert(auditLogs).values({
    actorId: entry.actorId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    before: entry.before ?? null,
    after: entry.after ?? null,
    ip: entry.ip,
    requestId: entry.requestId,
  });
}

export interface AuditFilter {
  entity?: string;
  entityId?: string;
  actorId?: string;
  action?: string;
  from?: string;
  to?: string;
  beforeId: number | null;
  limit: number;
}

export function searchAudit(db: DbOrTx, f: AuditFilter) {
  const conds: SQL[] = [];
  if (f.entity) conds.push(eq(auditLogs.entity, f.entity));
  if (f.entityId) conds.push(eq(auditLogs.entityId, f.entityId));
  if (f.actorId) conds.push(eq(auditLogs.actorId, f.actorId));
  if (f.action) conds.push(eq(auditLogs.action, f.action));
  if (f.from) conds.push(gte(auditLogs.at, new Date(f.from)));
  if (f.to) conds.push(lte(auditLogs.at, new Date(f.to)));
  if (f.beforeId !== null) conds.push(lt(auditLogs.id, f.beforeId));
  return db
    .select()
    .from(auditLogs)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(auditLogs.id))
    .limit(f.limit + 1);
}

/** Banyak entri audit dalam satu INSERT (mis. penerbitan impor). */
export async function recordAudits(db: DbOrTx, entries: AuditEntry[]): Promise<void> {
  for (let i = 0; i < entries.length; i += 500) {
    await db.insert(auditLogs).values(
      entries.slice(i, i + 500).map((e) => ({
        actorId: e.actorId,
        action: e.action,
        entity: e.entity,
        entityId: e.entityId,
        before: e.before ?? null,
        after: e.after ?? null,
        ip: e.ip,
        requestId: e.requestId,
      })),
    );
  }
}
