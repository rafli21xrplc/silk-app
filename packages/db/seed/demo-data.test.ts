import { checkContent, PRICE_TYPES, VERIFICATION_LEVELS } from '@silk/shared';
import { describe, expect, it } from 'vitest';
import { CONTENT_RULES, FACILITIES, SERVICES } from './data';
import { buildDemoData, DEMO_SERVICES } from './demo-data';

const demo = buildDemoData();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/;
const rules = CONTENT_RULES.map((r, i) => ({ ...r, id: i + 1 }));

describe('data demo seed', () => {
  it('deterministik: dua kali dibangun hasilnya identik', () => {
    expect(buildDemoData()).toEqual(demo);
  });

  it('cukup banyak untuk mengisi halaman publik', () => {
    expect(demo.facilities.length).toBe(20);
    expect(demo.tariffs.length).toBeGreaterThanOrEqual(150);
  });

  it('ID valid dan unik, tidak bertabrakan dengan data uji', () => {
    const ids = [...demo.facilities.map((f) => f.id), ...demo.packages.map((p) => p.id), ...demo.tariffs.map((t) => t.id)];
    for (const id of ids) expect(id).toMatch(UUID);
    expect(new Set(ids).size).toBe(ids.length);
    const slugs = [...demo.facilities.map((f) => f.slug), ...FACILITIES.map((f) => f.slug)];
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('semua faskes fiktif ("Contoh") dan berada di wilayah Malang', () => {
    for (const f of demo.facilities) {
      expect(f.name).toContain('Contoh');
      expect(f.lat).toBeGreaterThan(-8.4);
      expect(f.lat).toBeLessThan(-7.7);
      expect(f.lng).toBeGreaterThan(112.4);
      expect(f.lng).toBeLessThan(112.9);
    }
  });

  it('setiap tarif merujuk layanan yang ada dan satu tarif per faskes-layanan', () => {
    const known = new Set([...SERVICES, ...DEMO_SERVICES].map((s) => s.slug));
    const pairs = new Set<string>();
    for (const t of demo.tariffs) {
      expect(known.has(t.serviceSlug)).toBe(true);
      const key = `${t.facilityId}:${t.serviceSlug}:${t.packageId ?? ''}`;
      expect(pairs.has(key)).toBe(false);
      pairs.add(key);
    }
  });

  it('harga mematuhi aturan tarif_versions (integer rupiah, urutan min/max, "tanya" tanpa angka)', () => {
    for (const t of demo.tariffs) {
      expect(t.versions.length).toBeGreaterThan(0);
      for (const v of t.versions) {
        expect(PRICE_TYPES).toContain(v.priceType);
        expect(VERIFICATION_LEVELS).toContain(v.verification);
        if (v.priceType === 'tanya') {
          expect(v.priceMin).toBeNull();
          expect(v.priceMax).toBeNull();
        } else {
          expect(Number.isSafeInteger(v.priceMin)).toBe(true);
          expect(v.priceMin).toBeGreaterThan(0);
        }
        if (v.priceMax !== null) expect(v.priceMax).toBeGreaterThanOrEqual(v.priceMin ?? 0);
      }
    }
  });

  it('tanggal berlaku versi naik berurutan dan tercatat sebelum berlaku', () => {
    for (const t of demo.tariffs) {
      const dates = t.versions.map((v) => v.effectiveFrom);
      expect([...dates].sort()).toEqual(dates);
      expect(new Set(dates).size).toBe(dates.length);
      for (const v of t.versions) expect(v.createdAt.slice(0, 10) <= v.effectiveFrom || v.effectiveFrom > '2026-11-01').toBe(true);
    }
  });

  it('variasi data: ada tarif lama (perlu diperbarui), rentang, tanya, dan paket', () => {
    const latest = demo.tariffs.map((t) => t.versions.filter((v) => v.effectiveFrom <= '2026-11-01').at(-1));
    const types = new Set(latest.map((v) => v?.priceType));
    for (const type of ['tetap', 'rentang', 'mulai_dari', 'paket', 'tanya']) expect(types.has(type as never)).toBe(true);
    const old = latest.filter((v) => v?.verifiedAt && v.verifiedAt < '2026-05-05');
    expect(old.length).toBeGreaterThan(0);
  });

  it('semua teks lolos filter konten M17', () => {
    const fields = [
      ...demo.facilities.flatMap((f) => [f.name, f.description, f.address]),
      ...demo.packages.flatMap((p) => [p.name, p.notes, ...p.components.map((c) => c.label)]),
      ...DEMO_SERVICES.flatMap((s) => [s.name, s.description, ...s.aliases]),
    ];
    for (const text of fields) expect(checkContent({ text }, rules).violations).toEqual([]);
  });
});
