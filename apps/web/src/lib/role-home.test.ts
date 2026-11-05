import { describe, expect, it } from 'vitest';
import { homePathFor, roleAllowed } from './role-home';

describe('halaman awal per role', () => {
  it.each([
    ['pasien', false, '/akun'],
    ['faskes', false, '/portal'],
    ['tenaga_medis', false, '/portal/mitra'],
    ['gaya_hidup', false, '/portal/mitra'],
    ['apotek', false, '/portal/mitra'],
    ['moderator', true, '/admin'],
    ['admin', false, '/admin/mfa'],
  ] as const)('%s → %s', (role, twoFactorEnabled, path) => {
    expect(homePathFor({ role, twoFactorEnabled })).toBe(path);
  });
});

describe('area halaman', () => {
  it('pasien hanya area akun', () => {
    expect(roleAllowed('signed-in', 'pasien')).toBe(true);
    expect(roleAllowed('partner', 'pasien')).toBe(false);
    expect(roleAllowed('staff', 'pasien')).toBe(false);
  });
  it('faskes adalah mitra, mitra lain bukan faskes', () => {
    expect(roleAllowed('partner', 'faskes')).toBe(true);
    expect(roleAllowed('faskes', 'apotek')).toBe(false);
    expect(roleAllowed('partner', 'apotek')).toBe(true);
  });
  it('staf bukan mitra', () => {
    expect(roleAllowed('partner', 'admin')).toBe(false);
    expect(roleAllowed('staff', 'moderator')).toBe(true);
  });
});
