import { asc, desc, eq } from 'drizzle-orm';
import { dataSources, publishedTariffs, tariffVersions, user, type DbOrTx } from '@silk/db';

export async function findPublishedTariff(db: DbOrTx, tariffId: string) {
  const [row] = await db.select().from(publishedTariffs).where(eq(publishedTariffs.tariffId, tariffId));
  return row ?? null;
}

/** Semua versi (append-only) beserta sumber dan peran pembuatnya. */
export function listVersions(db: DbOrTx, tariffId: string) {
  return db
    .select({
      id: tariffVersions.id,
      versionNo: tariffVersions.versionNo,
      priceType: tariffVersions.priceType,
      priceMin: tariffVersions.priceMin,
      priceMax: tariffVersions.priceMax,
      effectiveFrom: tariffVersions.effectiveFrom,
      effectiveTo: tariffVersions.effectiveTo,
      verifiedAt: tariffVersions.verifiedAt,
      verification: tariffVersions.verification,
      inclusions: tariffVersions.inclusions,
      exclusions: tariffVersions.exclusions,
      createdAt: tariffVersions.createdAt,
      createdBy: tariffVersions.createdBy,
      creatorRole: user.role,
      sourceKind: dataSources.kind,
      sourceTitle: dataSources.title,
      sourceUrl: dataSources.url,
      sourceDocumentDate: dataSources.documentDate,
    })
    .from(tariffVersions)
    .leftJoin(dataSources, eq(dataSources.id, tariffVersions.sourceId))
    .leftJoin(user, eq(user.id, tariffVersions.createdBy))
    .where(eq(tariffVersions.tariffId, tariffId))
    .orderBy(desc(tariffVersions.versionNo), asc(tariffVersions.createdAt));
}
