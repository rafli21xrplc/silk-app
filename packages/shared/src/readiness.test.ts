import { describe, expect, it } from 'vitest';
import { profileReadiness, type ReadinessFacts } from './readiness';

const empty: ReadinessFacts = {
  type: 'praktik_dokter',
  status: 'draft',
  photo: 'tidak_ada',
  video: 'tidak_ada',
  consultation: 'tidak_ada',
  pricedTariffs: 0,
  practitioners: 0,
  hasSchedule: false,
  hasLocation: false,
  hasContact: false,
  hasDescription: false,
};
const full: ReadinessFacts = {
  ...empty,
  status: 'terbit',
  photo: 'publik',
  video: 'publik',
  consultation: 'angka',
  pricedTariffs: 1,
  hasSchedule: true,
  hasLocation: true,
  hasContact: true,
  hasDescription: true,
};
const item = (f: ReadinessFacts, key: string) => profileReadiness(f).checks.find((c) => c.item === key);

describe('profileReadiness (USP: tahu biayanya, kenal dokternya, sebelum datang)', () => {
  it('praktik dokter lengkap: semua pilar terpenuhi', () => {
    const r = profileReadiness(full);
    expect(r.published).toBe(true);
    expect(r.pillars).toEqual({ biaya: true, kenal: true, kunjungan: true });
    expect(r.done).toBe(r.total);
    expect(r.checks.map((c) => c.item)).toEqual(['biaya_konsultasi', 'foto', 'video', 'jadwal', 'lokasi', 'kontak', 'deskripsi']);
  });

  it('praktik dokter: biaya konsultasi "tanya" belum memenuhi pilar biaya', () => {
    const r = profileReadiness({ ...full, consultation: 'tanya' });
    expect(r.pillars.biaya).toBe(false);
    expect(item({ ...full, consultation: 'tanya' }, 'biaya_konsultasi')).toMatchObject({ done: false, state: 'tanya' });
  });

  it('praktik dokter: video wajib untuk pilar kenal; video tanpa persetujuan aktif tidak dihitung', () => {
    for (const video of ['tidak_ada', 'menunggu', 'tanpa_persetujuan'] as const) {
      const f = { ...full, video };
      expect(profileReadiness(f).pillars.kenal).toBe(false);
      expect(item(f, 'video')).toMatchObject({ done: false, state: video, optional: false });
    }
  });

  it('deskripsi hanya disarankan: tidak menggagalkan pilar kunjungan', () => {
    expect(profileReadiness({ ...full, hasDescription: false }).pillars.kunjungan).toBe(true);
    expect(profileReadiness({ ...full, hasContact: false }).pillars.kunjungan).toBe(false);
  });

  it('faskes: pilar biaya butuh minimal 3 tarif berangka; video dan dokter terdaftar hanya disarankan', () => {
    const klinik: ReadinessFacts = { ...full, type: 'klinik', consultation: 'tidak_ada', video: 'tidak_ada', pricedTariffs: 2 };
    const r = profileReadiness(klinik);
    expect(r.checks.map((c) => c.item)).toEqual(['tarif', 'foto', 'video', 'dokter_terdaftar', 'jadwal', 'lokasi', 'kontak', 'deskripsi']);
    expect(r.pillars).toEqual({ biaya: false, kenal: true, kunjungan: true });
    expect(profileReadiness({ ...klinik, pricedTariffs: 3 }).pillars.biaya).toBe(true);
    expect(item(klinik, 'video')?.optional).toBe(true);
  });

  it('tempat tanpa dokter (mis. gaya hidup) tidak diminta dokter terdaftar', () => {
    expect(item({ ...full, type: 'gaya_hidup' }, 'dokter_terdaftar')).toBeUndefined();
  });

  it('profil kosong belum terbit: tidak ada pilar terpenuhi', () => {
    const r = profileReadiness(empty);
    expect(r.published).toBe(false);
    expect(r.done).toBe(0);
    expect(r.pillars).toEqual({ biaya: false, kenal: false, kunjungan: false });
  });
});
