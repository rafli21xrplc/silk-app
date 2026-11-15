import { sql, type SQL } from 'drizzle-orm';

/** Escape karakter wildcard LIKE pada input pengguna. */
export function likeEscape(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Filter kota: cocok dengan slug wilayah, nama wilayah, atau teks kota faskes.
 * "Malang" mencakup Kota Malang dan Kabupaten Malang (bagian 4, "Wilayah").
 */
export function cityCondition(city: string, facilityAlias = 'f', regionAlias = 'r'): SQL {
  const pattern = `%${likeEscape(city)}%`;
  const f = sql.raw(facilityAlias);
  const r = sql.raw(regionAlias);
  return sql`(${r}.slug = ${city.toLowerCase()} OR ${r}.name ILIKE ${pattern} OR ${f}.city ILIKE ${pattern})`;
}

/**
 * Pencarian teks bebas di daftar admin: `q` cocok sebagian (tanpa beda huruf besar/kecil) dengan salah satu kolom.
 * `q` kosong = tanpa syarat (undefined, aman dimasukkan ke `and(...)`).
 */
export function searchAny(q: string | undefined, columns: (SQL | SQL.Aliased | { getSQL(): SQL })[]): SQL | undefined {
  const term = q?.trim();
  if (!term) return undefined;
  const pattern = `%${likeEscape(term)}%`;
  return sql`(${sql.join(
    columns.map((c) => sql`${c} ILIKE ${pattern}`),
    sql` OR `,
  )})`;
}
