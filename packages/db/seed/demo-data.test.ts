import { checkContent, PRICE_TYPES, VERIFICATION_LEVELS } from '@silk/shared';
import { describe, expect, it } from 'vitest';
import { CONTENT_RULES, FACILITIES, PRACTITIONERS, SERVICES } from './data';
import { buildDemoData, DEMO_SERVICES } from './demo-data';

const demo = buildDemoData();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/;
const rules = CONTENT_RULES.map((r, i) => ({ ...r, id: i + 1 }));

describe('data demo seed', () => {
  it('deterministik: dua kali dibangun hasilnya identik', () => {
    expect(buildDemoData()).toEqual(demo);
  });

  it('tarif 20 faskes awal tetap di ruang ID `de`; faskes tambahan memakai `df`; tambahan USP memakai `d1`', () => {
    const base = new Set(demo.facilities.slice(0, 20).map((f) => f.id));
    const usp = new Set(['konsultasi', 'rawat-inap']);
    const category = new Map(SERVICES.map((s) => [s.slug, s.category as string]));
    for (const t of demo.tariffs) {
      const expected = usp.has(category.get(t.serviceSlug) ?? '') ? 'd1' : base.has(t.facilityId) ? 'de' : 'df';
      expect(t.id.startsWith(expected), `${t.serviceSlug} ${t.id}`).toBe(true);
    }
    // Profil praktik dokter tambahan memakai ID `f1`, terpisah dari FACILITY_ROWS.
    expect(demo.facilities.slice(21).every((f) => f.id.startsWith('f1'))).toBe(true);
  });

  it('data demo lama tidak bergeser oleh tambahan USP', () => {
    // Tarif `de`/`df` dibangun sebelum tambahan USP dengan PRNG sendiri; cuplikan ini harus stabil.
    const old = demo.tariffs.filter((t) => !t.id.startsWith('d1'));
    expect(old.length).toBeGreaterThanOrEqual(150);
    expect(demo.facilities.slice(0, 21).map((f) => f.id.slice(0, 2))).toEqual(Array(21).fill('fd'));
  });

  it('cukup banyak untuk mengisi halaman publik', () => {
    expect(demo.facilities.length).toBe(24);
    expect(demo.tariffs.length).toBeGreaterThanOrEqual(150);
  });

  it('evaluasi USP: setiap dokter demo dengan profil praktik punya biaya konsultasi, RS punya rawat inap', () => {
    const consultationOf = (facilityId: string) =>
      demo.tariffs.filter((t) => t.facilityId === facilityId && t.serviceSlug.startsWith('konsultasi-')).map((t) => t.serviceSlug);
    const practices = demo.facilities.filter((f) => f.type === 'praktik_dokter' && f.slug.startsWith('praktik-dr'));
    expect(practices.length).toBeGreaterThanOrEqual(4);
    for (const f of practices) expect(consultationOf(f.id).length, f.slug).toBe(1);
    const drg = demo.facilities.find((f) => f.slug === 'praktik-drg-contoh-dewi-lestari')!;
    expect(consultationOf(drg.id)).toEqual(['konsultasi-dokter-gigi']);
    for (const rs of demo.facilities.filter((f) => f.type === 'rumah_sakit')) {
      const slugs = demo.tariffs.filter((t) => t.facilityId === rs.id).map((t) => t.serviceSlug);
      expect(slugs).toEqual(expect.arrayContaining(['rawat-inap-kelas-3', 'rawat-inap-kelas-2', 'rawat-inap-kelas-1', 'rawat-inap-vip']));
    }
    // Dokter demo dengan profil praktik sendiri: 3 sampai 5 (target demo day).
    const withOwnPractice = demo.practitioners.filter((p) => p.practices.some((x) => practices.some((f) => f.slug === x.facilitySlug)));
    expect(withOwnPractice.length).toBeGreaterThanOrEqual(3);
    expect(withOwnPractice.length).toBeLessThanOrEqual(5);
  });

  it('ID valid dan unik, tidak bertabrakan dengan data uji', () => {
    const ids = [...demo.facilities.map((f) => f.id), ...demo.packages.map((p) => p.id), ...demo.tariffs.map((t) => t.id)];
    for (const id of ids) expect(id).toMatch(UUID);
    expect(new Set(ids).size).toBe(ids.length);
    const slugs = [...demo.facilities.map((f) => f.slug), ...FACILITIES.map((f) => f.slug)];
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('dokter demo fiktif: tempat praktik dan cabang ada di data demo, jadwal valid, M17 lolos', () => {
    const slugs = new Set(demo.facilities.map((f) => f.slug));
    expect(demo.practitioners.length).toBeGreaterThanOrEqual(2);
    for (const p of demo.practitioners) {
      expect(p.id).toMatch(UUID);
      expect(p.name).toContain('Contoh');
      for (const x of p.practices) {
        expect(slugs.has(x.facilitySlug)).toBe(true);
        for (const s of x.schedules) {
          expect(s.weekday).toBeGreaterThanOrEqual(1);
          expect(s.weekday).toBeLessThanOrEqual(7);
          expect(s.start < s.end).toBe(true);
        }
      }
    }
    for (const b of demo.branches) expect(slugs.has(b.facilitySlug)).toBe(true);
    // ID dan slug tidak boleh bertabrakan dengan praktisi data uji (seed ulang memakai onConflictDoNothing).
    const testIds = new Set<string>(PRACTITIONERS.map((p) => p.id));
    const testSlugs = new Set<string>(PRACTITIONERS.map((p) => p.slug));
    for (const p of demo.practitioners) {
      expect(testIds.has(p.id)).toBe(false);
      expect(testSlugs.has(p.slug)).toBe(false);
    }
    // Profil praktik dokter demo punya deskripsi khusus yang lolos filter konten.
    const praktik = demo.facilities.find((f) => f.slug === 'praktik-dr-contoh-rahma-putri-sp-a')!;
    expect(praktik.description).toContain('spesialis anak');
    expect(checkContent({ text: praktik.description }, rules).violations).toEqual([]);
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
      ...SERVICES.flatMap((s) => [s.name, s.description, ...s.aliases]),
    ];
    for (const text of fields) expect(checkContent({ text }, rules).violations).toEqual([]);
  });
});
