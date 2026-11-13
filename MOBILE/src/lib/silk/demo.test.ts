import { describe, expect, it } from 'vitest';
import raw from '../../demo/snapshot.json';
import { parseFacilityParams } from '../search';
import { demoCompare, demoSearchFacilities, demoSearchPractitioners, distanceMeters } from './demo';
import { snapshotSchema } from './snapshot';

const snap = snapshotSchema.parse(raw);
const search = (q: Record<string, string>, limit?: number) => demoSearchFacilities(snap, parseFacilityParams(q), limit);

describe('data cadangan (snapshot.json)', () => {
  it('lolos skema respons API dan konsisten', () => {
    expect(snap.facilities.length).toBeGreaterThan(10);
    expect(snap.practitioners.length).toBeGreaterThan(3);
    for (const f of snap.facilities) expect(snap.facilityDetails[f.slug], f.slug).toBeDefined();
    for (const d of snap.practitioners) expect(snap.practitionerDetails[d.slug], d.slug).toBeDefined();
    for (const s of snap.services) expect(snap.serviceDetails[s.slug], s.slug).toBeDefined();
  });
});

describe('demoSearchFacilities', () => {
  it('filter wilayah dan jenis', () => {
    const r = search({ city: 'Kota Malang', type: 'klinik' }, 100);
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items.every((f) => f.city === 'Kota Malang' && f.type === 'klinik')).toBe(true);
  });

  it('filter layanan: hanya faskes yang punya tarifnya, dengan harga dan konteks kepercayaan', () => {
    const r = search({ service: 'hemoglobin' }, 100);
    expect(r.items.length).toBe(snap.serviceDetails.hemoglobin!.cities.reduce((n, c) => n + c.facilityCount, 0));
    expect(r.items.every((f) => f.price !== null && f.trust !== null)).toBe(true);
  });

  it('urut harga naik: angka naik, "tanya" di akhir', () => {
    const items = search({ service: 'hemoglobin', sort: 'price_asc' }, 100).items;
    const keys = items.map((f) => (f.priceAvailable ? f.price!.min : null));
    const numbers = keys.filter((k): k is number => k !== null);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    expect(keys.slice(numbers.length).every((k) => k === null)).toBe(true);
  });

  it('kata kunci mencocokkan nama faskes dan nama layanan', () => {
    expect(search({ q: 'sawojajar' }).items.map((f) => f.slug)).toContain('klinik-contoh-sawojajar');
    expect(search({ q: 'zzz-tidak-ada' }).items).toEqual([]);
  });

  it('halaman: kursor offset tanpa duplikat', () => {
    const p1 = search({}, 10);
    expect(p1.nextCursor).toBe('10');
    const p2 = search({ cursor: p1.nextCursor! }, 10);
    const ids = [...p1.items, ...p2.items].map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('dekat saya: jarak terisi dan urut naik', () => {
    const items = search({ lat: '-7.9666', lng: '112.6326', sort: 'distance' }, 100).items;
    const d = items.map((f) => f.distanceM).filter((x): x is number => x !== null);
    expect(d.length).toBeGreaterThan(0);
    expect(d).toEqual([...d].sort((a, b) => a - b));
  });
});

describe('demoSearchPractitioners', () => {
  it('fee=1: hanya biaya konsultasi berangka; urut biaya naik', () => {
    const fee = demoSearchPractitioners(snap, { fee: '1' }).items;
    expect(fee.every((d) => d.consultation && d.consultation.price.type !== 'tanya')).toBe(true);
    const sorted = demoSearchPractitioners(snap, { sort: 'fee_asc' }).items.map((d) => d.consultation?.price.min ?? null);
    const nums = sorted.filter((x): x is number => x !== null);
    expect(nums).toEqual([...nums].sort((a, b) => a - b));
  });

  it('spesialisasi dan kata kunci', () => {
    const anak = demoSearchPractitioners(snap, { specialty: 'Anak' }).items;
    expect(anak.every((d) => d.specialty === 'Anak')).toBe(true);
    expect(demoSearchPractitioners(snap, { q: 'rahma' }).items.length).toBe(1);
  });
});

describe('demoCompare', () => {
  it('per wilayah, urut harga naik', () => {
    const c = demoCompare(snap, 'hemoglobin', 'Kota Malang', false)!;
    expect(c.rows.length).toBeGreaterThan(0);
    expect(c.rows.every((r) => r.facility.city === 'Kota Malang')).toBe(true);
    const mins = c.rows.filter((r) => r.price.type !== 'tanya').map((r) => r.price.min!);
    expect(mins).toEqual([...mins].sort((a, b) => a - b));
  });
  it('sembunyikan tarif lama', () => {
    expect(demoCompare(snap, 'hemoglobin', undefined, true)!.rows.every((r) => !r.stale)).toBe(true);
  });
  it('layanan tidak dikenal → null', () => {
    expect(demoCompare(snap, 'tidak-ada', undefined, false)).toBeNull();
  });
});

describe('distanceMeters', () => {
  it('Malang ↔ Kepanjen ± 20 km', () => {
    const d = distanceMeters({ lat: -7.9666, lng: 112.6326 }, { lat: -8.1302, lng: 112.5718 });
    expect(d).toBeGreaterThan(17_000);
    expect(d).toBeLessThan(21_000);
  });
});
