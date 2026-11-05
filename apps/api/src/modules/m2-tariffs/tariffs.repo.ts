import { and, asc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import {
  dataSources,
  facilities,
  packageComponents,
  packages,
  publishedTariffs,
  regions,
  serviceCategories,
  services,
  type DbOrTx,
} from '@silk/db';
import { cityCondition } from '../../lib/sql';

export interface PublishedTariffFilter {
  facilityIds?: string[];
  serviceId?: string;
  city?: string;
}

/** Tarif terbit beserta layanan, paket, dan sumbernya. Hanya membaca view `published_tariffs`. */
export function listPublishedTariffs(db: DbOrTx, f: PublishedTariffFilter) {
  const conds: SQL[] = [];
  if (f.facilityIds) conds.push(inArray(publishedTariffs.facilityId, f.facilityIds));
  if (f.serviceId) conds.push(eq(publishedTariffs.serviceId, f.serviceId));
  if (f.city) conds.push(cityCondition(f.city, 'facilities', 'regions'));
  return db
    .select({
      tariffId: publishedTariffs.tariffId,
      facilityId: publishedTariffs.facilityId,
      facilitySlug: facilities.slug,
      facilityName: facilities.name,
      facilityCity: facilities.city,
      packageId: publishedTariffs.packageId,
      versionId: publishedTariffs.versionId,
      versionNo: publishedTariffs.versionNo,
      priceType: publishedTariffs.priceType,
      priceMin: publishedTariffs.priceMin,
      priceMax: publishedTariffs.priceMax,
      effectiveFrom: publishedTariffs.effectiveFrom,
      effectiveTo: publishedTariffs.effectiveTo,
      verifiedAt: publishedTariffs.verifiedAt,
      verification: publishedTariffs.verification,
      inclusions: publishedTariffs.inclusions,
      exclusions: publishedTariffs.exclusions,
      sourceKind: dataSources.kind,
      sourceTitle: dataSources.title,
      sourceUrl: dataSources.url,
      sourceDocumentDate: dataSources.documentDate,
      serviceSlug: services.slug,
      serviceName: services.name,
      categoryName: serviceCategories.name,
      packageName: packages.name,
      packageNotes: packages.notes,
    })
    .from(publishedTariffs)
    .innerJoin(facilities, eq(facilities.id, publishedTariffs.facilityId))
    .leftJoin(regions, eq(regions.id, facilities.regionId))
    .innerJoin(services, eq(services.id, publishedTariffs.serviceId))
    .innerJoin(serviceCategories, eq(serviceCategories.id, services.categoryId))
    .leftJoin(dataSources, eq(dataSources.id, publishedTariffs.sourceId))
    .leftJoin(packages, eq(packages.id, publishedTariffs.packageId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(serviceCategories.name), asc(services.name), asc(facilities.name));
}

export type PublishedTariffRow = Awaited<ReturnType<typeof listPublishedTariffs>>[number];

type ComponentMap = Map<string, { label: string; included: boolean; sortOrder: number }[]>;

const componentCols = {
  packageId: packageComponents.packageId,
  label: packageComponents.label,
  included: packageComponents.included,
  sortOrder: packageComponents.sortOrder,
};

function groupComponents(rows: { packageId: string; label: string; included: boolean; sortOrder: number }[]): ComponentMap {
  const map: ComponentMap = new Map();
  for (const r of rows) {
    const list = map.get(r.packageId) ?? [];
    list.push({ label: r.label, included: r.included, sortOrder: r.sortOrder });
    map.set(r.packageId, list);
  }
  return map;
}

export async function componentsForPackages(db: DbOrTx, packageIds: string[]): Promise<ComponentMap> {
  if (packageIds.length === 0) return new Map();
  const rows = await db
    .select(componentCols)
    .from(packageComponents)
    .where(inArray(packageComponents.packageId, packageIds))
    .orderBy(asc(packageComponents.packageId), asc(packageComponents.sortOrder));
  return groupComponents(rows);
}

/**
 * Komponen semua paket milik satu faskes / satu layanan. Tidak bergantung pada daftar tarif,
 * jadi bisa dijalankan paralel dengannya (hemat satu round-trip ke database).
 * Paket yang tarifnya tidak terbit ikut terambil tetapi tidak pernah dirujuk.
 */
export async function componentsForFacility(db: DbOrTx, facilityId: string): Promise<ComponentMap> {
  const rows = await db
    .select(componentCols)
    .from(packageComponents)
    .innerJoin(packages, eq(packages.id, packageComponents.packageId))
    .where(eq(packages.facilityId, facilityId))
    .orderBy(asc(packageComponents.packageId), asc(packageComponents.sortOrder));
  return groupComponents(rows);
}

export async function componentsForService(db: DbOrTx, serviceId: string): Promise<ComponentMap> {
  const rows = await db
    .select(componentCols)
    .from(packageComponents)
    .innerJoin(packages, eq(packages.id, packageComponents.packageId))
    .where(eq(packages.serviceId, serviceId))
    .orderBy(asc(packageComponents.packageId), asc(packageComponents.sortOrder));
  return groupComponents(rows);
}

/* ---------- Katalog layanan (M2) ---------- */

export function searchServices(
  db: DbOrTx,
  f: { q?: string; category?: string; limit: number; offset: number },
) {
  const conds: SQL[] = [];
  if (f.category) conds.push(eq(serviceCategories.slug, f.category));
  if (f.q) {
    conds.push(sql`(
      ${services.name} % ${f.q} OR ${f.q} <% ${services.name}
      OR ${services.name} ILIKE ${'%' + f.q.replace(/[\\%_]/g, '\\$&') + '%'}
      OR EXISTS (SELECT 1 FROM unnest(${services.aliases}) a WHERE a % ${f.q} OR ${f.q} <% a)
    )`);
  }
  // Tanpa q tidak ada skor relevansi. Jangan pakai literal `0` di ORDER BY: Postgres membacanya
  // sebagai nomor kolom ("ORDER BY position 0 is not in select list").
  const relevance = f.q
    ? [
        sql`GREATEST(
          similarity(${services.name}, ${f.q}),
          word_similarity(${f.q}, ${services.name}),
          COALESCE((SELECT max(similarity(a, ${f.q})) FROM unnest(${services.aliases}) a), 0)
        ) DESC`,
      ]
    : [];
  return db
    .select({
      id: services.id,
      slug: services.slug,
      name: services.name,
      description: services.description,
      aliases: services.aliases,
      categorySlug: serviceCategories.slug,
      categoryName: serviceCategories.name,
    })
    .from(services)
    .innerJoin(serviceCategories, eq(serviceCategories.id, services.categoryId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(...relevance, asc(serviceCategories.slug), asc(services.name))
    .limit(f.limit + 1)
    .offset(f.offset);
}

export async function findServiceBySlug(db: DbOrTx, slug: string) {
  const [row] = await db
    .select({
      id: services.id,
      slug: services.slug,
      name: services.name,
      description: services.description,
      aliases: services.aliases,
      categorySlug: serviceCategories.slug,
      categoryName: serviceCategories.name,
    })
    .from(services)
    .innerJoin(serviceCategories, eq(serviceCategories.id, services.categoryId))
    .where(eq(services.slug, slug));
  return row ?? null;
}

export async function findServiceById(db: DbOrTx, id: string) {
  const [row] = await db.select().from(services).where(eq(services.id, id));
  return row ?? null;
}

export function listServiceIdsBySlug(db: DbOrTx) {
  return db.select({ id: services.id, slug: services.slug }).from(services);
}

/** Ringkasan harga per kota untuk satu layanan; tarif `tanya` tidak masuk hitungan angka. */
export async function cityPriceSummary(db: DbOrTx, serviceId: string) {
  const result = await db.execute<{
    city: string;
    facility_count: number;
    min_price: number | null;
    max_price: number | null;
    median_price: number | null;
    latest_verified_at: Date | null;
  }>(sql`
    SELECT f.city,
      count(DISTINCT pt.facility_id)::int AS facility_count,
      min(pt.price_min) FILTER (WHERE pt.price_type <> 'tanya')::bigint AS min_price,
      max(coalesce(pt.price_max, pt.price_min)) FILTER (WHERE pt.price_type <> 'tanya')::bigint AS max_price,
      (percentile_cont(0.5) WITHIN GROUP (ORDER BY pt.price_min) FILTER (WHERE pt.price_type <> 'tanya'))::bigint AS median_price,
      max(pt.verified_at) AS latest_verified_at
    FROM published_tariffs pt
    JOIN facilities f ON f.id = pt.facility_id
    WHERE pt.service_id = ${serviceId}
    GROUP BY f.city
    ORDER BY f.city
  `);
  return result.rows;
}
