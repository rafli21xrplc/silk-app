import { describe, expect, it } from 'vitest';
import { formatDate, formatDuration } from './format';

describe('formatDate', () => {
  it('memakai zona Asia/Jakarta (UTC 17:30 sudah tanggal berikutnya di WIB)', () => {
    expect(formatDate('2026-01-31T17:30:00Z')).toContain('1 Februari 2026');
  });
  it('nilai kosong tampil sebagai tanda pisah', () => {
    expect(formatDate(null)).not.toMatch(/\d/);
  });
});

describe('formatDuration', () => {
  it('menit:detik dua digit', () => {
    expect(formatDuration(45)).toBe('0:45');
    expect(formatDuration(90)).toBe('1:30');
    expect(formatDuration(59.6)).toBe('1:00');
    expect(formatDuration(-3)).toBe('0:00');
  });
});
