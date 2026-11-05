import { asc, eq } from 'drizzle-orm';
import { dataReports, facilities, services, tariffs, type DbOrTx } from '@silk/db';

export async function insertReport(
  db: DbOrTx,
  v: { tariffId: string; tariffVersionId: string; reason: string; contactEmail: string | null },
) {
  const [row] = await db.insert(dataReports).values(v).returning();
  return row!;
}

export function reportQueue(db: DbOrTx, f: { status: string; limit: number; offset: number }) {
  return db
    .select({
      id: dataReports.id,
      status: dataReports.status,
      reason: dataReports.reason,
      note: dataReports.note,
      createdAt: dataReports.createdAt,
      handledAt: dataReports.handledAt,
      tariffId: dataReports.tariffId,
      tariffVersionId: dataReports.tariffVersionId,
      hasContact: dataReports.contactEmail,
      facilityName: facilities.name,
      facilitySlug: facilities.slug,
      serviceName: services.name,
    })
    .from(dataReports)
    .innerJoin(tariffs, eq(tariffs.id, dataReports.tariffId))
    .innerJoin(facilities, eq(facilities.id, tariffs.facilityId))
    .innerJoin(services, eq(services.id, tariffs.serviceId))
    .where(eq(dataReports.status, f.status))
    .orderBy(asc(dataReports.createdAt))
    .limit(f.limit + 1)
    .offset(f.offset);
}

export async function findReport(db: DbOrTx, id: string) {
  const [row] = await db.select().from(dataReports).where(eq(dataReports.id, id));
  return row ?? null;
}

export async function updateReport(db: DbOrTx, id: string, v: { status: string; note: string | null; handledBy: string | null }) {
  const [row] = await db
    .update(dataReports)
    .set({ ...v, handledAt: new Date() })
    .where(eq(dataReports.id, id))
    .returning();
  return row!;
}
