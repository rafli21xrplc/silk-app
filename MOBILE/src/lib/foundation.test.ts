import { describe, expect, it } from 'vitest';
import { priceRangeShort, priceRangeText } from './format';
import { activeWeekdays, groupHours, jakartaClock, nextSession } from './schedule';
import { rangePositions, relativeWidth, spreadMarks } from './range';
import { commonVerification, trustFlags } from './trust';

describe('format rentang', () => {
  it('tanda pisah sama di semua tempat (C4)', () => {
    expect(priceRangeText(15000, 45000)).toBe('Rp15.000–Rp45.000');
  });
  it('ringkas untuk daftar ringkasan', () => {
    expect(priceRangeShort(15000, 45000)).toBe('Rp15–45 rb');
    expect(priceRangeShort(37500, 120000)).toBe('Rp37,5–120 rb');
    expect(priceRangeShort(85000, 85000)).toBe('Rp85 rb');
    expect(priceRangeShort(250000, 1_200_000)).toBe('Rp250 rb–1,2 jt');
    expect(priceRangeShort(1_500_000, 3_250_000)).toBe('Rp1,5–3,3 jt');
    expect(priceRangeShort(500, 900)).toBe('Rp500–Rp900');
    expect(priceRangeShort(null, null)).toBeNull();
  });
});

describe('jadwal', () => {
  it('jam Jakarta (UTC+7), Senin = 1', () => {
    // Senin 13 Okt 2026 02:30 UTC = Senin 09.30 WIB; Minggu 18:00 UTC = Senin 01.00 WIB.
    expect(jakartaClock(new Date('2026-10-12T02:30:00Z'))).toEqual({ weekday: 1, minutes: 570 });
    expect(jakartaClock(new Date('2026-10-11T18:00:00Z'))).toEqual({ weekday: 1, minutes: 60 });
  });

  const slots = [
    { weekday: 2, start: '16:00', end: '20:00' },
    { weekday: 5, start: '16:00', end: '20:00' },
    { weekday: 2, start: '08:00', end: '10:00', note: 'Poli' },
  ];
  it('sesi berikutnya: hari ini, sedang berlangsung, lusa, pekan depan', () => {
    expect(nextSession(slots, { weekday: 2, minutes: 7 * 60 })).toMatchObject({ weekday: 2, start: '08:00', inDays: 0, ongoing: false, note: 'Poli' });
    expect(nextSession(slots, { weekday: 2, minutes: 17 * 60 })).toMatchObject({ weekday: 2, start: '16:00', inDays: 0, ongoing: true });
    expect(nextSession(slots, { weekday: 3, minutes: 0 })).toMatchObject({ weekday: 5, inDays: 2 });
    expect(nextSession(slots, { weekday: 5, minutes: 21 * 60 })).toMatchObject({ weekday: 2, inDays: 4 });
    expect(nextSession([{ weekday: 5, start: '16:00', end: '20:00' }], { weekday: 5, minutes: 21 * 60 })).toMatchObject({ weekday: 5, inDays: 7 });
    expect(nextSession([], { weekday: 1, minutes: 0 })).toBeNull();
  });
  it('hari aktif untuk strip pekan', () => {
    expect([...activeWeekdays(slots)].sort()).toEqual([2, 5]);
  });
});

describe('penanda kepercayaan', () => {
  const t = (verification: string, stale = false) => ({ verification, stale });
  it('tingkat terbanyak disebut sekali', () => {
    expect(commonVerification([t('a'), t('b'), t('a')])).toBe('a');
    expect(commonVerification([])).toBeNull();
  });
  it('baris hanya menandai yang berbeda dan tarif lama', () => {
    expect(trustFlags(t('a'), 'a')).toEqual([]);
    expect(trustFlags(t('b', true), 'a')).toEqual(['stale', 'verification']);
  });
});

describe('batang rentang', () => {
  it('posisi dalam persen, dibatasi ke rentang', () => {
    expect(rangePositions([15000, 30000, 45000, 60000], 15000, 45000)).toEqual([0, 50, 100, 100]);
    expect(rangePositions([20000], 20000, 20000)).toEqual([50]);
  });
  it('lebar relatif', () => {
    expect(relativeWidth(15000, 45000)).toBe(33);
    expect(relativeWidth(100, 45000)).toBe(4);
    expect(relativeWidth(1, 0)).toBe(0);
  });
  it('sebaran ringkas: ruas dan nilai tengah per wilayah pada skala bersama', () => {
    const r = spreadMarks([
      { minPrice: 79000, maxPrice: 105000, medianPrice: 93000 },
      { minPrice: 75000, maxPrice: 120000, medianPrice: 94000 },
      { minPrice: null, maxPrice: null, medianPrice: null },
    ]);
    expect(r.segments).toEqual([
      { left: 8.9, width: 57.8 },
      { left: 0, width: 100 },
    ]);
    expect(r.medians).toEqual([40, 42.2]);
  });
  it('sebaran ringkas: satu harga di tengah, tanpa harga kosong', () => {
    expect(spreadMarks([{ minPrice: 90000, maxPrice: null, medianPrice: 90000 }])).toEqual({ segments: [{ left: 50, width: 0 }], medians: [50] });
    expect(spreadMarks([])).toEqual({ segments: [], medians: [] });
  });
});

describe('jam buka', () => {
  const names = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  it('hari berurutan dengan jam sama digabung', () => {
    expect(groupHours(Array(7).fill('24 jam'), names, 'Setiap hari')).toEqual([{ days: 'Setiap hari', value: '24 jam' }]);
    expect(groupHours(['08–20', '08–20', '08–20', '08–20', '08–20', '08–12', null], names, 'Setiap hari')).toEqual([
      { days: 'Senin–Jumat', value: '08–20' },
      { days: 'Sabtu', value: '08–12' },
      { days: 'Minggu', value: null },
    ]);
  });
});
