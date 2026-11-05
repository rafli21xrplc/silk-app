import { inArray } from 'drizzle-orm';
import type { Database } from '../src/client';
import { pointSql } from '../src/geo';
import { dataSources, facilities, packageComponents, packages, regions, serviceCategories, services, tariffs, tariffVersions } from '../src/schema/index';
import { SOURCES } from './data';
import { buildDemoData, DEMO_CATEGORIES, DEMO_SERVICES } from './demo-data';
import { setMissingCurrentVersions } from './run';

export interface DemoSeedResult {
  facilities: number;
  tariffs: number;
  versions: number;
}

/**
 * Isi data demo fiktif (faskes + tarif publik). Idempoten: baris dengan ID yang sudah ada dilewati.
 * Perlu seedReference lebih dulu (wilayah dan kategori dasar).
 */
export async function seedDemoData(db: Database, now: Date = new Date()): Promise<DemoSeedResult> {
  const demo = buildDemoData();
  const cap = (iso: string) => new Date(Math.min(new Date(iso).getTime(), now.getTime()));

  await db.insert(serviceCategories).values([...DEMO_CATEGORIES]).onConflictDoNothing({ target: serviceCategories.slug });
  const categoryRows = await db.select({ id: serviceCategories.id, slug: serviceCategories.slug }).from(serviceCategories);
  const categoryId = new Map(categoryRows.map((c) => [c.slug, c.id]));
  await db
    .insert(services)
    .values(
      DEMO_SERVICES.map((s) => {
        const id = categoryId.get(s.category);
        if (id === undefined) throw new Error(`Kategori ${s.category} tidak ada; jalankan seed dasar dulu`);
        return { categoryId: id, slug: s.slug, name: s.name, description: s.description, aliases: s.aliases };
      }),
    )
    .onConflictDoNothing({ target: services.slug });

  await db
    .insert(dataSources)
    .values(SOURCES.map((s) => ({ ...s, url: s.url ?? null })))
    .onConflictDoNothing({ target: dataSources.id });

  const regionRows = await db.select().from(regions);
  const regionBySlug = new Map(regionRows.map((r) => [r.slug, r]));
  const insertedFacilities = await db
    .insert(facilities)
    .values(
      demo.facilities.map((f) => {
        const region = regionBySlug.get(f.regionSlug);
        if (!region) throw new Error(`Wilayah ${f.regionSlug} tidak ada; jalankan seed dasar dulu`);
        return {
          id: f.id,
          slug: f.slug,
          name: f.name,
          type: f.type,
          description: f.description,
          address: f.address,
          city: region.name,
          province: 'Jawa Timur',
          regionId: region.id,
          location: pointSql(f.lat, f.lng),
          phone: f.phone,
          hours: f.hours,
          verification: f.verification,
          status: f.status,
        };
      }),
    )
    .onConflictDoNothing({ target: facilities.id })
    .returning({ id: facilities.id });

  const serviceRows = await db.select({ id: services.id, slug: services.slug }).from(services);
  const serviceIdBySlug = new Map(serviceRows.map((s) => [s.slug, s.id]));
  const serviceId = (slug: string) => {
    const id = serviceIdBySlug.get(slug);
    if (!id) throw new Error(`Layanan ${slug} tidak ada`);
    return id;
  };

  const insertedPkgs = await db
    .insert(packages)
    .values(demo.packages.map((p) => ({ id: p.id, facilityId: p.facilityId, serviceId: serviceId(p.serviceSlug), name: p.name, notes: p.notes })))
    .onConflictDoNothing({ target: packages.id })
    .returning({ id: packages.id });
  const newPkgIds = new Set(insertedPkgs.map((r) => r.id));
  const comps = demo.packages
    .filter((p) => newPkgIds.has(p.id))
    .flatMap((p) => p.components.map((c, i) => ({ packageId: p.id, label: c.label, included: c.included, sortOrder: i })));
  if (comps.length) await db.insert(packageComponents).values(comps);

  const ids = demo.tariffs.map((t) => t.id);
  const existing = new Set((await db.select({ id: tariffs.id }).from(tariffs).where(inArray(tariffs.id, ids))).map((r) => r.id));
  const todo = demo.tariffs.filter((t) => !existing.has(t.id));
  const versions = todo.flatMap((t) =>
    t.versions.map((v, i) => ({
      tariffId: t.id,
      versionNo: i + 1,
      priceType: v.priceType,
      priceMin: v.priceMin,
      priceMax: v.priceMax,
      effectiveFrom: v.effectiveFrom,
      verifiedAt: v.verifiedAt === null ? null : cap(v.verifiedAt),
      verification: v.verification,
      sourceId: SOURCES[v.sourceIndex].id,
      createdAt: cap(v.createdAt),
    })),
  );
  if (todo.length) {
    // tariff_versions append-only: hanya INSERT. Tarif + versinya masuk dalam satu transaksi.
    await db.transaction(async (tx) => {
      await tx.insert(tariffs).values(
        todo.map((t) => ({ id: t.id, facilityId: t.facilityId, serviceId: serviceId(t.serviceSlug), packageId: t.packageId, status: t.status })),
      );
      await tx.insert(tariffVersions).values(versions);
      await setMissingCurrentVersions(tx);
    });
  }

  return { facilities: insertedFacilities.length, tariffs: todo.length, versions: versions.length };
}
