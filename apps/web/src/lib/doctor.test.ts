import { describe, expect, it } from 'vitest';
import { AVATAR_TONES, avatarTone, doctorInitials, withDoctorDefaults } from './doctor';

describe('doctorInitials', () => {
  it('membuang gelar depan dan belakang', () => {
    expect(doctorInitials('dr. Rahma Putri, Sp.A')).toBe('RP');
    expect(doctorInitials('Prof. dr. Budi')).toBe('B');
    expect(doctorInitials('drg. Sari Ayu')).toBe('SA');
    expect(doctorInitials('Bidan Wati')).toBe('BW');
  });

  it('melewati penanda data contoh agar avatar demo tidak semuanya berawalan "C"', () => {
    expect(doctorInitials('dr. Contoh Rahma Putri, Sp.A')).toBe('RP');
    expect(doctorInitials('drg. Contoh Satu')).toBe('S');
    expect(doctorInitials('Klinik Contoh Sawojajar')).toBe('KS');
  });

  it('nama yang hanya berisi gelar tetap menghasilkan inisial', () => {
    expect(doctorInitials('dr.')).toBe('D');
    expect(doctorInitials('dr. (Ahmad) Yani')).toBe('AY');
  });
});

describe('avatarTone', () => {
  it('stabil untuk nama yang sama dan memakai palet tema', () => {
    expect(avatarTone('dr. Rahma')).toBe(avatarTone('dr. Rahma'));
    expect(AVATAR_TONES).toContain(avatarTone('dr. Rahma'));
  });

  it('nama demo berawalan sama ("dr. Contoh …") tetap tersebar ke beberapa warna', () => {
    const demo = ['dr. Contoh Arif Nugroho, Sp.PD', 'dr. Contoh Bima Pratama', 'dr. Contoh Dua, Sp.PK', 'dr. Contoh Rahma Putri, Sp.A', 'dr. Contoh Sari Wulandari, Sp.OG', 'dr. Contoh Satu', 'drg. Contoh Dewi Lestari'];
    expect(new Set(demo.map(avatarTone)).size).toBeGreaterThanOrEqual(4);
  });

  it('nama berbeda tersebar ke beberapa warna', () => {
    const names = ['dr. Andi', 'dr. Budi', 'dr. Citra', 'dr. Dewi', 'dr. Eka', 'dr. Fajar', 'dr. Gita', 'dr. Hadi'];
    expect(new Set(names.map(avatarTone)).size).toBeGreaterThanOrEqual(3);
  });
});

describe('withDoctorDefaults', () => {
  it('mengisi field Fase 4b pada respons cache lama', () => {
    const old: { slug: string; strVerifiedAt: string | null; practices?: unknown[] } = { slug: 'dr-a', strVerifiedAt: '2026-01-01T00:00:00.000Z' };
    const p = withDoctorDefaults(old);
    expect(p.practices).toEqual([]);
    expect(p.tariffs).toEqual([]);
    expect(p.articles).toEqual([]);
    expect(p.verification).toEqual({ str: true, partner: false });
    expect(p.photo).toBeNull();
    expect(p.contact).toBeNull();
    // Evaluasi USP R3: respons sebelum biaya konsultasi ditambahkan.
    expect(p.consultation).toBeNull();
  });

  it('tidak mengubah respons baru', () => {
    const fresh = { slug: 'dr-b', strVerifiedAt: null, verification: { str: false, partner: true }, practices: [1], tariffs: [], consultation: null, articles: [], photo: null, about: 'x', contact: null, video: null };
    expect(withDoctorDefaults(fresh)).toEqual(fresh);
  });
});
