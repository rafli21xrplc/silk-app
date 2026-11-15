import { describe, expect, it } from 'vitest';
import { activeUntilOf, addMonths, SUBSCRIPTION_PRICES, subscriptionPrice, trialEndOf } from './subscription';

const d = (s: string) => new Date(s);

describe('langganan mitra: harga, masa gratis, masa aktif', () => {
  it('harga per jenis mitra per 12 bulan (mengikuti SILK versi lama)', () => {
    expect(subscriptionPrice('tenaga_medis')).toBe(300_000);
    expect(subscriptionPrice('fasilitas')).toBe(1_500_000);
    expect(Object.values(SUBSCRIPTION_PRICES).every((p) => Number.isInteger(p) && p > 0)).toBe(true);
  });

  it('addMonths memakai bulan kalender dan menjepit akhir bulan', () => {
    expect(addMonths(d('2026-01-15T03:00:00Z'), 6).toISOString()).toBe('2026-07-15T03:00:00.000Z');
    expect(addMonths(d('2026-08-31T00:00:00Z'), 6).toISOString()).toBe('2027-02-28T00:00:00.000Z');
    expect(addMonths(d('2027-08-31T00:00:00Z'), 6).toISOString()).toBe('2028-02-29T00:00:00.000Z');
  });

  it('masa gratis 6 bulan sejak verifikasi; belum diverifikasi = tanpa masa gratis', () => {
    expect(trialEndOf(d('2026-11-14T00:00:00Z'))?.toISOString()).toBe('2027-05-14T00:00:00.000Z');
    expect(trialEndOf(null)).toBeNull();
  });

  it('masa aktif: masa gratis lalu periode berbayar yang menyambung', () => {
    const now = d('2026-12-01T00:00:00Z');
    const trial = d('2027-05-14T00:00:00Z');
    expect(activeUntilOf(now, trial, [])).toEqual(trial);
    expect(activeUntilOf(now, trial, [{ startsAt: trial, endsAt: d('2028-05-14T00:00:00Z') }])).toEqual(d('2028-05-14T00:00:00Z'));
  });

  it('masa aktif: celah memutus rangkaian; masa lampau tidak dihitung', () => {
    const now = d('2026-12-01T00:00:00Z');
    expect(activeUntilOf(now, d('2026-06-01T00:00:00Z'), [])).toBeNull();
    const periods = [
      { startsAt: d('2026-11-01T00:00:00Z'), endsAt: d('2027-01-01T00:00:00Z') },
      { startsAt: d('2027-02-01T00:00:00Z'), endsAt: d('2028-02-01T00:00:00Z') },
    ];
    expect(activeUntilOf(now, null, periods)).toEqual(d('2027-01-01T00:00:00Z'));
    expect(activeUntilOf(d('2027-01-15T00:00:00Z'), null, periods)).toBeNull();
  });
});
