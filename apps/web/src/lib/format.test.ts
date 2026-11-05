import { describe, expect, it } from 'vitest';
import { formatDate } from './format';

describe('formatDate', () => {
  it('memakai zona Asia/Jakarta (UTC 17:30 sudah tanggal berikutnya di WIB)', () => {
    expect(formatDate('2026-01-31T17:30:00Z')).toContain('1 Februari 2026');
  });
  it('nilai kosong tampil sebagai tanda pisah', () => {
    expect(formatDate(null)).not.toMatch(/\d/);
  });
});
