import { sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { TARIFF_IDS } from '@silk/db/seed';
import { db } from '../src/lib/db';
import { resetDb } from './helpers';

/** Drizzle membungkus galat Postgres; pesan dan kode asli ada di `cause`. */
async function pgError(run: () => Promise<unknown>): Promise<{ message: string; code?: string }> {
  try {
    await run();
  } catch (err) {
    const cause = (err as { cause?: { message: string; code?: string } }).cause;
    return cause ?? { message: (err as Error).message };
  }
  throw new Error('query seharusnya ditolak');
}

describe('tariff_versions append-only (A7)', () => {
  beforeAll(() => resetDb());

  it('UPDATE ditolak trigger database (42501)', async () => {
    const e = await pgError(() => db().execute(sql`UPDATE tariff_versions SET price_min = 1 WHERE tariff_id = ${TARIFF_IDS.pratamaHb}`));
    expect(e.message).toMatch(/append-only/);
    expect(e.code).toBe('42501');
  });

  it('DELETE ditolak trigger database (42501)', async () => {
    const e = await pgError(() => db().execute(sql`DELETE FROM tariff_versions WHERE tariff_id = ${TARIFF_IDS.pratamaHb}`));
    expect(e.message).toMatch(/append-only/);
    expect(e.code).toBe('42501');
  });

  it('data tetap utuh setelah percobaan UPDATE/DELETE', async () => {
    const r = await db().execute<{ n: number; min: number }>(
      sql`SELECT count(*)::int AS n, min(price_min)::int AS min FROM tariff_versions WHERE tariff_id = ${TARIFF_IDS.pratamaHb}`,
    );
    expect(r.rows[0]!.n).toBeGreaterThan(0);
    expect(r.rows[0]!.min).not.toBe(1);
  });

  it('constraint harga: rentang terbalik ditolak database (23514)', async () => {
    const e = await pgError(() =>
      db().execute(sql`
        INSERT INTO tariff_versions (tariff_id, version_no, price_type, price_min, price_max, effective_from, verification)
        VALUES (${TARIFF_IDS.pratamaHb}, 99, 'rentang', 500, 100, '2026-01-01', 'diisi_faskes')
      `),
    );
    expect(e.code).toBe('23514');
  });

  it('constraint harga: tipe "tanya" tidak boleh membawa angka', async () => {
    const e = await pgError(() =>
      db().execute(sql`
        INSERT INTO tariff_versions (tariff_id, version_no, price_type, price_min, effective_from, verification)
        VALUES (${TARIFF_IDS.pratamaHb}, 98, 'tanya', 1000, '2026-01-01', 'diisi_faskes')
      `),
    );
    expect(e.code).toBe('23514');
  });

  it('nomor versi unik per tarif', async () => {
    const e = await pgError(() =>
      db().execute(sql`
        INSERT INTO tariff_versions (tariff_id, version_no, price_type, price_min, effective_from, verification)
        VALUES (${TARIFF_IDS.pratamaHb}, 1, 'tetap', 1000, '2027-01-01', 'diisi_faskes')
      `),
    );
    expect(e.code).toBe('23505');
  });
});
