import { describe, expect, it } from 'vitest';
import { jakartaWeekday, todaySessions } from './schedule-today';

describe('jadwal hari ini (WIB)', () => {
  it('hari mengikuti Asia/Jakarta, bukan UTC', () => {
    // Senin 16 Nov 2026 18:00 UTC = Selasa 01:00 WIB.
    expect(jakartaWeekday(new Date('2026-11-16T18:00:00Z'))).toBe(2);
    expect(jakartaWeekday(new Date('2026-11-16T03:00:00Z'))).toBe(1);
  });

  it('sesi hari ini terurut, tanpa duplikat; kosong bila tidak praktik; null bila tanpa jadwal', () => {
    const now = new Date('2026-11-16T03:00:00Z'); // Senin
    const slots = [
      { weekday: 1, start: '16:00:00', end: '20:00:00' },
      { weekday: 1, start: '08:00', end: '12:00' },
      { weekday: 1, start: '08:00', end: '12:00' },
      { weekday: 3, start: '09:00', end: '13:00' },
    ];
    expect(todaySessions(slots, now)).toEqual(['08.00–12.00', '16.00–20.00']);
    expect(todaySessions([{ weekday: 3, start: '09:00', end: '13:00' }], now)).toEqual([]);
    expect(todaySessions([], now)).toBeNull();
  });
});
