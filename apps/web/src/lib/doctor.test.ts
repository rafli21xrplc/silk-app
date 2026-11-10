import { describe, expect, it } from 'vitest';
import { doctorInitials, withDoctorDefaults } from './doctor';

describe('doctorInitials', () => {
  it('membuang gelar depan dan belakang', () => {
    expect(doctorInitials('dr. Contoh Rahma Putri, Sp.A')).toBe('CR');
    expect(doctorInitials('Prof. dr. Budi')).toBe('B');
    expect(doctorInitials('drg. Sari Ayu')).toBe('SA');
    expect(doctorInitials('Bidan Wati')).toBe('BW');
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
