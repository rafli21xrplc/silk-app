import { checkContent } from '@silk/shared';
import { describe, expect, it } from 'vitest';
import { RULES, texts } from './copy-test-utils';
import { t } from './id';

describe('teks halaman akun (M17)', () => {
  const all = [...texts(t.auth, 'auth'), ...texts(t.authPanel, 'authPanel')];

  it('punya teks untuk diperiksa', () => {
    expect(all.length).toBeGreaterThan(20);
  });

  it.each(all)('%s lolos filter konten', (_path, text) => {
    const result = checkContent({ text }, RULES);
    expect(result.violations).toEqual([]);
  });

  it('penanda langkah verifikasi memakai angka yang diberikan', () => {
    expect(t.auth.step(2, 2)).toBe('Langkah 2 dari 2');
  });
});
