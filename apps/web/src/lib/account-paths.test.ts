import { describe, expect, it } from 'vitest';
import { isAccountPath } from './account-paths';

describe('isAccountPath', () => {
  it.each(['/masuk', '/daftar', '/verifikasi-email', '/lupa-sandi', '/atur-ulang-sandi', '/masuk/'])('halaman akun: %s', (p) => {
    expect(isAccountPath(p)).toBe(true);
  });
  it.each(['/', '/portal', '/admin', '/masukan', '/daftar-faskes', '/cari', null])('bukan halaman akun: %s', (p) => {
    expect(isAccountPath(p)).toBe(false);
  });
});
