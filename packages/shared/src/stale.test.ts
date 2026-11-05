import { afterEach, describe, expect, it, vi } from 'vitest';
import { isStale } from './stale';

describe('isStale (M4)', () => {
  afterEach(() => vi.useRealTimers());

  it('tanpa verified_at tidak dianggap usang (tampil "belum diverifikasi")', () => {
    expect(isStale(null)).toBe(false);
  });

  it('menjadi usang otomatis saat jam dimajukan 181 hari, tanpa perubahan data', () => {
    const verifiedAt = new Date('2026-01-01T00:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    expect(isStale(verifiedAt)).toBe(false);
    vi.setSystemTime(new Date(verifiedAt.getTime() + 181 * 86400000));
    expect(isStale(verifiedAt)).toBe(true);
  });

  it('batas hari dapat dikonfigurasi', () => {
    const now = new Date('2026-06-01T00:00:00Z');
    expect(isStale('2026-05-01T00:00:00Z', now, 30)).toBe(true);
    expect(isStale('2026-05-01T00:00:00Z', now, 60)).toBe(false);
  });
});
