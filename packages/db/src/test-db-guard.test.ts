import { describe, expect, it } from 'vitest';
import { assertSafeTestDatabase, UnsafeTestDatabaseError } from './test-db-guard';

const neon = (db: string, host = 'ep-cool-1234.ap-southeast-1.aws.neon.tech') =>
  `postgresql://user:rahasia@${host}/${db}?sslmode=require`;

describe('assertSafeTestDatabase', () => {
  it('menolak bila TEST_DATABASE_URL kosong (tanpa fallback ke DATABASE_URL)', () => {
    expect(() => assertSafeTestDatabase(undefined, neon('neondb'))).toThrow(UnsafeTestDatabaseError);
    expect(() => assertSafeTestDatabase('  ', neon('neondb'))).toThrow(/wajib diisi/);
  });

  it('mengizinkan Postgres lokal dengan nama apa pun', () => {
    expect(assertSafeTestDatabase('postgres://u:p@localhost:5432/silk')).toEqual({ host: 'localhost', database: 'silk' });
    expect(() => assertSafeTestDatabase('postgres://u:p@127.0.0.1/silk_dev')).not.toThrow();
  });

  it('host non-lokal hanya boleh database berawalan test_', () => {
    expect(() => assertSafeTestDatabase(neon('neondb'))).toThrow(/harus diawali "test_"/);
    expect(() => assertSafeTestDatabase(neon('silk_test'))).toThrow(UnsafeTestDatabaseError);
    expect(assertSafeTestDatabase(neon('test_silk')).database).toBe('test_silk');
  });

  it('menolak database yang sama dengan DATABASE_URL, termasuk lewat host pooler', () => {
    const pooled = neon('test_silk', 'ep-cool-1234-pooler.ap-southeast-1.aws.neon.tech');
    expect(() => assertSafeTestDatabase(neon('test_silk'), pooled)).toThrow(/sama dengan DATABASE_URL/);
    expect(() => assertSafeTestDatabase(neon('test_silk'), neon('neondb'))).not.toThrow();
  });

  it('menolak URL yang bukan Postgres atau tidak valid', () => {
    expect(() => assertSafeTestDatabase('mysql://u:p@localhost/x')).toThrow(/postgres/);
    expect(() => assertSafeTestDatabase('bukan url')).toThrow(/tidak valid/);
  });

  it('pesan galat tidak membocorkan kata sandi', () => {
    try {
      assertSafeTestDatabase(neon('neondb'));
    } catch (err) {
      expect(String(err)).not.toContain('rahasia');
    }
  });
});
