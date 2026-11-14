import { describe, expect, it } from 'vitest';
import { isAccountPath, isAppAreaPath } from './account-paths';

describe('isAccountPath', () => {
  it.each(['/masuk', '/daftar', '/verifikasi-email', '/lupa-sandi', '/atur-ulang-sandi', '/masuk/'])('halaman akun: %s', (p) => {
    expect(isAccountPath(p)).toBe(true);
  });
  it.each(['/', '/portal', '/admin', '/masukan', '/daftar-faskes', '/cari', null])('bukan halaman akun: %s', (p) => {
    expect(isAccountPath(p)).toBe(false);
  });
});

describe('isAppAreaPath', () => {
  it.each(['/admin', '/admin/mitra', '/portal', '/portal/faskes/x', '/akun'])('area aplikasi: %s', (p) => {
    expect(isAppAreaPath(p)).toBe(true);
  });
  it.each(['/', '/admin/mfa', '/administrasi', '/portalku', '/cari', null])('bukan area aplikasi: %s', (p) => {
    expect(isAppAreaPath(p)).toBe(false);
  });
});
