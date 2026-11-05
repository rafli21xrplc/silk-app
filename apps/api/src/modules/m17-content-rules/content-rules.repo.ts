import { asc, eq } from 'drizzle-orm';
import { contentRules, type DbOrTx } from '@silk/db';
import type { ContentRule, ContentRuleKind, ContentRuleLevel } from '@silk/shared';

export async function listActiveRules(db: DbOrTx): Promise<ContentRule[]> {
  const rows = await db
    .select({ id: contentRules.id, pattern: contentRules.pattern, kind: contentRules.kind, level: contentRules.level })
    .from(contentRules)
    .where(eq(contentRules.active, true));
  return rows.map((r) => ({ ...r, kind: r.kind as ContentRuleKind, level: r.level as ContentRuleLevel }));
}

export function listAllRules(db: DbOrTx) {
  return db.select().from(contentRules).orderBy(asc(contentRules.id));
}

export async function findRule(db: DbOrTx, id: number) {
  const [row] = await db.select().from(contentRules).where(eq(contentRules.id, id));
  return row ?? null;
}

export async function insertRule(
  db: DbOrTx,
  v: { pattern: string; kind: ContentRuleKind; level: ContentRuleLevel; createdBy: string | null },
) {
  const [row] = await db.insert(contentRules).values(v).onConflictDoNothing().returning();
  return row ?? null;
}

export async function setRuleActive(db: DbOrTx, id: number, active: boolean) {
  const [row] = await db.update(contentRules).set({ active }).where(eq(contentRules.id, id)).returning();
  return row ?? null;
}
