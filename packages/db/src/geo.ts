import { sql, type SQL } from 'drizzle-orm';

/** Nilai untuk kolom geography(Point, 4326). Urutan PostGIS adalah (lng, lat). */
export function pointSql(lat: number, lng: number): SQL {
  return sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;
}
