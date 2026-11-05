import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  facilities,
  packageComponents,
  packages,
  tariffs,
  tariffVersions,
  type DbOrTx,
} from '@silk/db';
import type { EntityStatus, PriceType, VerificationLevel } from '@silk/shared';

/** Kunci baris tarif selama transaksi agar nomor versi tidak bentrok. */
export async function lockTariff(db: DbOrTx, tariffId: string) {
  const result = await db.execute<{
    id: string;
    facility_id: string;
    service_id: string;
    package_id: string | null;
    status: EntityStatus;
    current_version_id: string | null;
  }>(sql`SELECT id, facility_id, service_id, package_id, status, current_version_id FROM tariffs WHERE id = ${tariffId} FOR UPDATE`);
  return result.rows[0] ?? null;
}

export async function findTariffWithFacility(db: DbOrTx, tariffId: string) {
  const [row] = await db
    .select({
      id: tariffs.id,
      facilityId: tariffs.facilityId,
      serviceId: tariffs.serviceId,
      packageId: tariffs.packageId,
      status: tariffs.status,
      facilityVerification: facilities.verification,
      facilitySlug: facilities.slug,
      facilityName: facilities.name,
    })
    .from(tariffs)
    .innerJoin(facilities, eq(facilities.id, tariffs.facilityId))
    .where(eq(tariffs.id, tariffId));
  return row ?? null;
}

export async function latestVersion(db: DbOrTx, tariffId: string) {
  const [row] = await db
    .select()
    .from(tariffVersions)
    .where(eq(tariffVersions.tariffId, tariffId))
    .orderBy(desc(tariffVersions.versionNo))
    .limit(1);
  return row ?? null;
}

export async function versionExistsForDate(db: DbOrTx, tariffId: string, effectiveFrom: string): Promise<boolean> {
  const rows = await db
    .select({ id: tariffVersions.id })
    .from(tariffVersions)
    .where(and(eq(tariffVersions.tariffId, tariffId), eq(tariffVersions.effectiveFrom, effectiveFrom)))
    .limit(1);
  return rows.length > 0;
}

export interface NewVersion {
  tariffId: string;
  versionNo: number;
  priceType: PriceType;
  priceMin: number | null;
  priceMax: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  verifiedAt: Date | null;
  verification: VerificationLevel;
  sourceId: string | null;
  inclusions: string | null;
  exclusions: string | null;
  createdBy: string | null;
}

/** Satu-satunya penulisan ke tariff_versions: INSERT. Tidak ada UPDATE/DELETE (A7). */
export async function insertVersion(db: DbOrTx, v: NewVersion) {
  const [row] = await db.insert(tariffVersions).values(v).returning();
  return row!;
}

export async function setCurrentVersion(db: DbOrTx, tariffId: string, versionId: string, status?: EntityStatus) {
  await db
    .update(tariffs)
    .set({ currentVersionId: versionId, ...(status ? { status } : {}) })
    .where(eq(tariffs.id, tariffId));
}

export async function setTariffStatus(db: DbOrTx, tariffId: string, status: EntityStatus) {
  const [row] = await db.update(tariffs).set({ status }).where(eq(tariffs.id, tariffId)).returning();
  return row ?? null;
}

export async function findTariffByKey(db: DbOrTx, facilityId: string, serviceId: string, packageId: string | null) {
  const [row] = await db
    .select()
    .from(tariffs)
    .where(
      and(
        eq(tariffs.facilityId, facilityId),
        eq(tariffs.serviceId, serviceId),
        packageId ? eq(tariffs.packageId, packageId) : isNull(tariffs.packageId),
      ),
    );
  return row ?? null;
}

export async function insertTariff(
  db: DbOrTx,
  v: { facilityId: string; serviceId: string; packageId: string | null; status: EntityStatus },
) {
  const [row] = await db.insert(tariffs).values(v).returning();
  return row!;
}

export async function insertPackage(
  db: DbOrTx,
  v: { facilityId: string; serviceId: string; name: string; notes: string | null; components: { label: string; included: boolean }[] },
) {
  const [pkg] = await db
    .insert(packages)
    .values({ facilityId: v.facilityId, serviceId: v.serviceId, name: v.name, notes: v.notes })
    .returning();
  await db
    .insert(packageComponents)
    .values(v.components.map((c, i) => ({ packageId: pkg!.id, label: c.label, included: c.included, sortOrder: i })));
  return pkg!;
}

/** Cari atau buat sumber data (kind, title, url) — unik lewat indeks ekspresi. */
export async function upsertDataSource(db: DbOrTx, kind: string, title: string, url: string | null): Promise<string> {
  const result = await db.execute<{ id: string }>(sql`
    INSERT INTO data_sources (kind, title, url) VALUES (${kind}, ${title}, ${url})
    ON CONFLICT (kind, title, coalesce(url, '')) DO UPDATE SET title = EXCLUDED.title
    RETURNING id
  `);
  return result.rows[0]!.id;
}

/* ---------- Varian massal untuk penerbitan impor (sedikit round-trip ke database) ---------- */

type TariffRow = typeof tariffs.$inferSelect;
type VersionRow = typeof tariffVersions.$inferSelect;

/** Kunci tarif tanpa paket untuk pasangan (faskes, layanan) yang diberikan. */
export async function lockTariffsByKeys(db: DbOrTx, keys: { facilityId: string; serviceId: string }[]): Promise<TariffRow[]> {
  if (keys.length === 0) return [];
  const json = JSON.stringify(keys.map((k) => ({ f: k.facilityId, s: k.serviceId })));
  const result = await db.execute<{ id: string }>(sql`
    SELECT t.id FROM tariffs t
    JOIN jsonb_to_recordset(${json}::jsonb) AS k(f uuid, s uuid) ON t.facility_id = k.f AND t.service_id = k.s
    WHERE t.package_id IS NULL
    ORDER BY t.id
    FOR UPDATE OF t
  `);
  const ids = result.rows.map((r) => r.id);
  return ids.length ? db.select().from(tariffs).where(inArray(tariffs.id, ids)) : [];
}

export async function insertTariffs(
  db: DbOrTx,
  rows: { facilityId: string; serviceId: string; packageId: string | null; status: EntityStatus }[],
): Promise<TariffRow[]> {
  return rows.length ? db.insert(tariffs).values(rows).returning() : [];
}

/** Versi terakhir (nomor tertinggi) per tarif. */
export async function latestVersions(db: DbOrTx, tariffIds: string[]): Promise<VersionRow[]> {
  if (tariffIds.length === 0) return [];
  return db
    .selectDistinctOn([tariffVersions.tariffId])
    .from(tariffVersions)
    .where(inArray(tariffVersions.tariffId, tariffIds))
    .orderBy(tariffVersions.tariffId, desc(tariffVersions.versionNo));
}

/** Pasangan (tarif, tanggal berlaku) yang sudah punya versi — untuk melewati baris ganda. */
export async function existingVersionDates(db: DbOrTx, tariffIds: string[]): Promise<Set<string>> {
  if (tariffIds.length === 0) return new Set();
  const rows = await db
    .select({ tariffId: tariffVersions.tariffId, effectiveFrom: tariffVersions.effectiveFrom })
    .from(tariffVersions)
    .where(inArray(tariffVersions.tariffId, tariffIds));
  return new Set(rows.map((r) => `${r.tariffId}|${r.effectiveFrom}`));
}

export async function insertVersions(db: DbOrTx, rows: NewVersion[]): Promise<VersionRow[]> {
  return rows.length ? db.insert(tariffVersions).values(rows).returning() : [];
}

export async function setCurrentVersions(db: DbOrTx, rows: { tariffId: string; versionId: string; status: EntityStatus }[]) {
  if (rows.length === 0) return;
  const json = JSON.stringify(rows.map((r) => ({ t: r.tariffId, v: r.versionId, s: r.status })));
  await db.execute(sql`
    UPDATE tariffs t SET current_version_id = u.v, status = u.s::entity_status
    FROM jsonb_to_recordset(${json}::jsonb) AS u(t uuid, v uuid, s text)
    WHERE t.id = u.t
  `);
}

/** Cari atau buat banyak sumber data sekaligus. Kunci hasil: `${kind}|${title}|${url ?? ''}`. */
export async function upsertDataSources(db: DbOrTx, rows: { kind: string; title: string; url: string | null }[]): Promise<Map<string, string>> {
  const unique = [...new Map(rows.map((r) => [`${r.kind}|${r.title}|${r.url ?? ''}`, r])).values()];
  const out = new Map<string, string>();
  if (unique.length === 0) return out;
  const json = JSON.stringify(unique);
  const result = await db.execute<{ id: string; kind: string; title: string; url: string | null }>(sql`
    INSERT INTO data_sources (kind, title, url)
    SELECT kind, title, url FROM jsonb_to_recordset(${json}::jsonb) AS r(kind text, title text, url text)
    ON CONFLICT (kind, title, coalesce(url, '')) DO UPDATE SET title = EXCLUDED.title
    RETURNING id, kind, title, url
  `);
  for (const r of result.rows) out.set(`${r.kind}|${r.title}|${r.url ?? ''}`, r.id);
  return out;
}
