import { sql } from 'drizzle-orm';
import type { Database } from '../src/client';
import { pointSql } from '../src/geo';
import {
  contentRules,
  dataSources,
  facilities,
  facilityPractitioners,
  packageComponents,
  packages,
  practitioners,
  regions,
  serviceCategories,
  services,
  tariffs,
  tariffVersions,
} from '../src/schema/index';
import {
  CATEGORIES,
  CONTENT_RULES,
  FACILITIES,
  PACKAGES,
  PRACTITIONERS,
  REGIONS,
  SERVICES,
  SOURCES,
  TARIFFS,
} from './data';

const DAY_MS = 86_400_000;

/**
 * Taksonomi, wilayah, dan aturan konten. Idempoten.
 * Insert dikelompokkan per tabel: database jarak jauh (Neon) bisa >300 ms per query.
 */
export async function seedReference(db: Database): Promise<void> {
  // Wilayah disisipkan per tingkat agar parent_id sudah diketahui.
  const regionIds = new Map<string, number>();
  let pending = [...REGIONS];
  while (pending.length > 0) {
    const ready = pending.filter((r) => !r.parentCode || regionIds.has(r.parentCode));
    if (ready.length === 0) throw new Error('Wilayah induk tidak ditemukan');
    const rows = await db
      .insert(regions)
      .values(
        ready.map((r) => ({
          code: r.code,
          slug: r.slug,
          name: r.name,
          type: r.type,
          parentId: r.parentCode ? regionIds.get(r.parentCode)! : null,
          source: 'kemendagri',
        })),
      )
      .onConflictDoUpdate({
        target: regions.code,
        set: { name: sql`excluded.name`, slug: sql`excluded.slug`, parentId: sql`excluded.parent_id` },
      })
      .returning({ id: regions.id, code: regions.code });
    for (const row of rows) regionIds.set(row.code, row.id);
    pending = pending.filter((r) => !ready.includes(r));
  }

  await db.insert(serviceCategories).values([...CATEGORIES]).onConflictDoNothing({ target: serviceCategories.slug });
  const cats = await db.select().from(serviceCategories);
  const catId = new Map(cats.map((c) => [c.slug, c.id]));

  await db
    .insert(services)
    .values(
      SERVICES.map((s) => {
        const categoryId = catId.get(s.category);
        if (categoryId === undefined) throw new Error(`Kategori ${s.category} tidak ada`);
        return { categoryId, slug: s.slug, name: s.name, description: s.description, aliases: s.aliases };
      }),
    )
    .onConflictDoUpdate({ target: services.slug, set: { name: sql`excluded.name`, aliases: sql`excluded.aliases` } });

  await db.insert(contentRules).values(CONTENT_RULES.map((r) => ({ ...r }))).onConflictDoNothing();
}

/** Data uji fiktif: faskes, tenaga medis, paket, tarif beserta versi. Idempoten. */
export async function seedTestData(db: Database, now: Date = new Date()): Promise<void> {
  await db
    .insert(dataSources)
    .values(SOURCES.map((s) => ({ ...s, url: s.url ?? null })))
    .onConflictDoNothing({ target: dataSources.id });

  const regionRows = await db.select().from(regions);
  const regionBySlug = new Map(regionRows.map((r) => [r.slug, r]));

  await db
    .insert(facilities)
    .values(
      FACILITIES.map((f) => {
        const region = regionBySlug.get(f.regionSlug);
        if (!region) throw new Error(`Wilayah ${f.regionSlug} tidak ada`);
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
          hours: { senin: '07.00–20.00', selasa: '07.00–20.00', rabu: '07.00–20.00', kamis: '07.00–20.00', jumat: '07.00–20.00', sabtu: '07.00–14.00' },
          verification: f.verification,
          status: f.status,
        };
      }),
    )
    .onConflictDoNothing({ target: facilities.id });
  await seedPrimaryLocations(db);

  await db
    .insert(practitioners)
    .values(
      PRACTITIONERS.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        specialty: p.specialty,
        strNo: p.strNo,
        strVerifiedAt: p.strVerified ? new Date(now.getTime() - 60 * DAY_MS) : null,
        status: 'terbit' as const,
      })),
    )
    .onConflictDoNothing({ target: practitioners.id });
  const links = PRACTITIONERS.flatMap((p) => p.facilityIds.map((facilityId) => ({ facilityId, practitionerId: p.id })));
  if (links.length) await db.insert(facilityPractitioners).values(links).onConflictDoNothing();

  const serviceRows = await db.select({ id: services.id, slug: services.slug }).from(services);
  const serviceId = (slug: string) => {
    const s = serviceRows.find((r) => r.slug === slug);
    if (!s) throw new Error(`Layanan ${slug} tidak ada`);
    return s.id;
  };

  const insertedPkgs = await db
    .insert(packages)
    .values(PACKAGES.map((p) => ({ id: p.id, facilityId: p.facilityId, serviceId: serviceId(p.serviceSlug), name: p.name, notes: p.notes })))
    .onConflictDoNothing({ target: packages.id })
    .returning({ id: packages.id });
  const newPkgIds = new Set(insertedPkgs.map((r) => r.id));
  const comps = PACKAGES.filter((p) => newPkgIds.has(p.id)).flatMap((p) =>
    p.components.map(([label, included], i) => ({ packageId: p.id, label, included, sortOrder: i })),
  );
  if (comps.length) await db.insert(packageComponents).values(comps);

  const existing = new Set((await db.select({ id: tariffs.id }).from(tariffs)).map((r) => r.id));
  const todo = TARIFFS.filter((t) => !existing.has(t.id));
  if (todo.length === 0) return;
  await db.transaction(async (tx) => {
    await tx.insert(tariffs).values(
      todo.map((t) => ({ id: t.id, facilityId: t.facilityId, serviceId: serviceId(t.serviceSlug), packageId: t.packageId, status: t.status })),
    );
    await tx.insert(tariffVersions).values(
      todo.flatMap((t) =>
        t.versions.map((v, i) => ({
          tariffId: t.id,
          versionNo: i + 1,
          priceType: v.priceType,
          priceMin: v.priceMin,
          priceMax: v.priceMax,
          effectiveFrom: v.effectiveFrom,
          verifiedAt: v.verifiedDaysAgo === null ? null : new Date(now.getTime() - v.verifiedDaysAgo * DAY_MS),
          verification: v.verification,
          sourceId: SOURCES[v.sourceIndex]?.id ?? null,
          createdAt: new Date(now.getTime() - (t.versions.length - i) * 30 * DAY_MS),
        })),
      ),
    );
    await setMissingCurrentVersions(tx);
  });
}

/** Versi terakhir tiap tarif (nomor versi tertinggi) menjadi versi saat ini bagi tarif yang belum punya. */
export async function setMissingCurrentVersions(db: Pick<Database, 'execute'>): Promise<void> {
  await db.execute(sql`
    UPDATE tariffs t SET current_version_id = v.id
    FROM (SELECT DISTINCT ON (tariff_id) tariff_id, id FROM tariff_versions ORDER BY tariff_id, version_no DESC) v
    WHERE v.tariff_id = t.id AND t.current_version_id IS NULL
  `);
}

/** Kosongkan semua tabel aplikasi (hanya untuk uji). TRUNCATE tidak memicu trigger append-only. */
/**
 * Lokasi utama (Fase 2) untuk faskes yang belum punya, disalin dari kolom faskes. Sama dengan
 * langkah data migrasi 0006; dipakai seed karena seed menyisipkan faskes setelah migrasi.
 */
export async function seedPrimaryLocations(db: Database): Promise<void> {
  await db.execute(sql`
    INSERT INTO profile_locations (facility_id, address, city, province, region_id, location, is_primary)
    SELECT f.id, f.address, f.city, f.province, f.region_id, f.location, true
    FROM facilities f
    WHERE f.location IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM profile_locations l WHERE l.facility_id = f.id)
  `);
}

export async function truncateAll(db: Database): Promise<void> {
  await db.execute(sql`
    TRUNCATE TABLE
      audit_logs, facility_ratings, partner_articles, profile_media, profile_revisions, schedules, profile_locations, tariff_change_requests,
      partners, jwks, data_reports, import_rows, import_batches, documents, facility_claims,
      memberships, tariff_versions, tariffs, package_components, packages, data_sources,
      facility_practitioners, practitioners, facilities, services, service_categories,
      regions, content_rules, jobs, rate_limit_counters, rate_limit,
      two_factor, verification, account, session, "user"
    RESTART IDENTITY CASCADE
  `);
}
