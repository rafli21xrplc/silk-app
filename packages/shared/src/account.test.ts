import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_TYPES,
  isPartnerRole,
  isStaffRole,
  partnerTypeForRole,
  PARTNER_ROLES,
  roleForAccountType,
  USER_ROLES,
} from './constants';
import { FEATURE_FLAGS, parseFeatureFlags } from './flags';
import { can, PERMISSIONS, type Actor, type Permission } from './permissions';
import { accountTypeSchema, normalizePhone, partnerUpsertSchema, phoneSchema, profileUpdateSchema } from './schemas/account';

describe('jenis akun dan role (F-01)', () => {
  it('daftar mandiri tidak pernah menghasilkan role staf', () => {
    for (const type of ACCOUNT_TYPES) expect(isStaffRole(roleForAccountType(type))).toBe(false);
    for (const evil of ['admin', 'moderator', 'ADMIN', '', null, undefined, 42, { role: 'admin' }]) {
      expect(roleForAccountType(evil)).toBe('pasien');
    }
  });

  it('skema accountType menolak role staf', () => {
    expect(accountTypeSchema.safeParse('admin').success).toBe(false);
    expect(accountTypeSchema.safeParse('moderator').success).toBe(false);
    expect(accountTypeSchema.parse('fasilitas')).toBe('fasilitas');
  });

  it('setiap jenis mitra punya role mitra dan sebaliknya', () => {
    expect(roleForAccountType('fasilitas')).toBe('faskes');
    for (const role of PARTNER_ROLES) {
      expect(isPartnerRole(role)).toBe(true);
      expect(roleForAccountType(partnerTypeForRole(role))).toBe(role);
    }
    expect(isPartnerRole('pasien')).toBe(false);
    expect(isPartnerRole('admin')).toBe(false);
  });
});

/** Tabel bagian 5 rencana Fase 1, ditulis ulang sebagai data agar setiap sel teruji. */
const MATRIX: Record<Permission, Actor[]> = {
  'public.read': ['anonim', 'pasien', 'faskes', 'tenaga_medis', 'gaya_hidup', 'apotek', 'moderator', 'admin'],
  'report.create': ['anonim', 'pasien', 'faskes', 'tenaga_medis', 'gaya_hidup', 'apotek', 'moderator', 'admin'],
  'account.self': ['pasien', 'faskes', 'tenaga_medis', 'gaya_hidup', 'apotek', 'moderator', 'admin'],
  'partner.self': ['faskes', 'tenaga_medis', 'gaya_hidup', 'apotek'],
  'portal.facility': ['faskes', 'tenaga_medis', 'gaya_hidup', 'apotek'],
  'portal.articles': ['faskes', 'tenaga_medis', 'gaya_hidup'],
  'portal.claims': ['faskes'],
  'admin.access': ['moderator', 'admin'],
  'admin.partners': ['moderator', 'admin'],
  'admin.users': ['admin'],
  'auth.token': ['pasien', 'faskes', 'tenaga_medis', 'gaya_hidup', 'apotek'],
};

describe('matriks role × permission', () => {
  const actors: Actor[] = ['anonim', ...USER_ROLES];
  it('mencakup semua permission', () => {
    expect(Object.keys(PERMISSIONS).sort()).toEqual(Object.keys(MATRIX).sort());
  });
  for (const permission of Object.keys(MATRIX) as Permission[]) {
    for (const actor of actors) {
      const allowed = MATRIX[permission].includes(actor);
      it(`${actor} ${allowed ? 'boleh' : 'ditolak'} ${permission}`, () => {
        expect(can(actor, permission)).toBe(allowed);
      });
    }
  }
  it('tanpa aktor dianggap anonim', () => {
    expect(can(null, 'public.read')).toBe(true);
    expect(can(undefined, 'account.self')).toBe(false);
  });
});

describe('data mitra per jenis', () => {
  const base = { businessName: 'Praktik Sehat', licenseNo: 'IZN-123' };
  it('atribut wajib per jenis', () => {
    expect(partnerUpsertSchema.safeParse({ partnerType: 'tenaga_medis', ...base, specialty: 'Penyakit dalam' }).success).toBe(false);
    expect(partnerUpsertSchema.safeParse({ partnerType: 'tenaga_medis', ...base, specialty: 'Penyakit dalam', strNo: 'STR12345' }).success).toBe(true);
    expect(partnerUpsertSchema.safeParse({ partnerType: 'apotek', ...base }).success).toBe(false);
    expect(partnerUpsertSchema.safeParse({ partnerType: 'apotek', ...base, siaNo: 'SIA-1' }).success).toBe(true);
    expect(partnerUpsertSchema.safeParse({ partnerType: 'fasilitas', ...base, facilityKind: 'klinik' }).success).toBe(true);
    expect(partnerUpsertSchema.safeParse({ partnerType: 'fasilitas', ...base, facilityKind: 'hotel' }).success).toBe(false);
    expect(partnerUpsertSchema.safeParse({ partnerType: 'gaya_hidup', ...base, field: 'Gizi' }).success).toBe(true);
  });
  it('nama usaha dan nomor izin wajib', () => {
    expect(partnerUpsertSchema.safeParse({ partnerType: 'gaya_hidup', businessName: 'X', licenseNo: '', field: 'Gizi' }).success).toBe(false);
  });
});

describe('nomor HP', () => {
  it('format Indonesia', () => {
    for (const ok of ['081234567890', '+6281234567890', '6281234567890']) expect(phoneSchema.safeParse(ok).success).toBe(true);
    for (const bad of ['12345', '0212345678', '+1 555 0100', '08abc']) expect(phoneSchema.safeParse(bad).success).toBe(false);
  });
  it('dinormalisasi ke +62', () => {
    for (const p of ['081234567890', '6281234567890', '+6281234567890']) expect(normalizePhone(p)).toBe('+6281234567890');
    expect(profileUpdateSchema.parse({ name: 'Uji', phone: '0812345678' }).phone).toBe('+62812345678');
    expect(profileUpdateSchema.parse({ name: 'Uji', phone: '' }).phone).toBeNull();
    expect(profileUpdateSchema.parse({ name: 'Uji', phone: null }).phone).toBeNull();
  });
});

describe('feature flag', () => {
  it('default semua OFF', () => {
    expect(parseFeatureFlags(undefined).enabled.size).toBe(0);
    expect(parseFeatureFlags('').enabled.size).toBe(0);
  });
  it('mengaktifkan nama yang dikenal dan melaporkan salah ketik', () => {
    const r = parseFeatureFlags(' reviews_enabled, AI_CHAT_ENABLED ,reviews_enable');
    expect([...r.enabled].sort()).toEqual(['ai_chat_enabled', 'reviews_enabled']);
    expect(r.unknown).toEqual(['reviews_enable']);
  });
  it('daftar flag sesuai prompt enablement', () => {
    expect(FEATURE_FLAGS).toHaveLength(6);
  });
});
