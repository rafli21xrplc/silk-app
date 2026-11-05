import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  facilities,
  memberships,
  packageComponents,
  packages,
  services,
  tariffs,
  tariffVersions,
  user,
  type DbOrTx,
} from '@silk/db';

export async function isMember(db: DbOrTx, userId: string, facilityId: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(facilityId)) return false;
  const rows = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.facilityId, facilityId)))
    .limit(1);
  return rows.length > 0;
}

export function myFacilities(db: DbOrTx, userId: string) {
  return db
    .select({
      id: facilities.id,
      slug: facilities.slug,
      name: facilities.name,
      city: facilities.city,
      type: facilities.type,
      status: facilities.status,
      verification: facilities.verification,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(facilities, eq(facilities.id, memberships.facilityId))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(facilities.name));
}

export async function findFacility(db: DbOrTx, id: string) {
  const [row] = await db
    .select({
      id: facilities.id,
      slug: facilities.slug,
      name: facilities.name,
      type: facilities.type,
      description: facilities.description,
      address: facilities.address,
      city: facilities.city,
      province: facilities.province,
      phone: facilities.phone,
      website: facilities.website,
      hours: facilities.hours,
      verification: facilities.verification,
      status: facilities.status,
      lat: sql<number | null>`ST_Y(${facilities.location}::geometry)`,
      lng: sql<number | null>`ST_X(${facilities.location}::geometry)`,
      updatedAt: facilities.updatedAt,
    })
    .from(facilities)
    .where(eq(facilities.id, id));
  return row ?? null;
}

export async function facilityTariffs(db: DbOrTx, facilityId: string) {
  const rows = await db
    .select({
      id: tariffs.id,
      status: tariffs.status,
      active: tariffs.active,
      /** Permintaan harga yang masih menunggu moderator untuk tarif ini (K4). */
      pendingRequestId: sql<string | null>`(SELECT r.id FROM tariff_change_requests r
        WHERE r.tariff_id = ${tariffs.id} AND r.status = 'pending' ORDER BY r.created_at DESC LIMIT 1)`,
      serviceId: services.id,
      serviceSlug: services.slug,
      serviceName: services.name,
      packageId: tariffs.packageId,
      packageName: packages.name,
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
      updatedAt: tariffVersions.createdAt,
    })
    .from(tariffs)
    .innerJoin(services, eq(services.id, tariffs.serviceId))
    .leftJoin(packages, eq(packages.id, tariffs.packageId))
    .leftJoin(tariffVersions, eq(tariffVersions.id, tariffs.currentVersionId))
    .where(eq(tariffs.facilityId, facilityId))
    .orderBy(asc(services.name), desc(tariffVersions.createdAt));
  const pkgIds = rows.flatMap((r) => (r.packageId ? [r.packageId] : []));
  const comps = pkgIds.length
    ? await db
        .select({ packageId: packageComponents.packageId, label: packageComponents.label, included: packageComponents.included })
        .from(packageComponents)
        .where(inArray(packageComponents.packageId, pkgIds))
        .orderBy(asc(packageComponents.sortOrder))
    : [];
  return rows.map((r) => ({
    ...r,
    components: r.packageId ? comps.filter((c) => c.packageId === r.packageId).map(({ label, included }) => ({ label, included })) : [],
  }));
}

export async function memberEmails(db: DbOrTx, facilityId: string): Promise<string[]> {
  const rows = await db
    .select({ email: user.email })
    .from(memberships)
    .innerJoin(user, eq(user.id, memberships.userId))
    .where(eq(memberships.facilityId, facilityId));
  return rows.map((r) => r.email);
}

export async function addMembership(db: DbOrTx, userId: string, facilityId: string) {
  await db.insert(memberships).values({ userId, facilityId }).onConflictDoNothing();
}
