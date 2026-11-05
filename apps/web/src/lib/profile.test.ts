import { describe, expect, it } from 'vitest';
import { PHOTO_MAX_BYTES, VIDEO_MAX_SECONDS } from '@silk/shared';
import { canCreateProfile, describeProfileField, formatTimeRange, groupByWeekday, mediaFileProblem, parseCoord, tzShort, weekdayName, withProfileDefaults } from './profile';

describe('jadwal', () => {
  it('urutan hari ISO: Senin = 1, Minggu = 7', () => {
    expect(weekdayName(1)).toBe('Senin');
    expect(weekdayName(7)).toBe('Minggu');
  });

  it('format jam memakai titik dan tanda pisah', () => {
    expect(formatTimeRange('07:00', '20:30')).toBe('07.00–20.30');
  });

  it('zona waktu ditampilkan singkat', () => {
    expect(tzShort('Asia/Makassar')).toBe('WITA');
    expect(tzShort('Asia/Jayapura')).toBe('WIT');
  });

  it('dikelompokkan Senin–Minggu dan jam diurutkan, hari kosong tetap ada', () => {
    const groups = groupByWeekday([
      { kind: 'operasional', weekday: 7, start: '08:00', end: '12:00', timezone: 'Asia/Jakarta' },
      { kind: 'operasional', weekday: 1, start: '13:00', end: '17:00', timezone: 'Asia/Jakarta' },
      { kind: 'operasional', weekday: 1, start: '07:00', end: '11:00', timezone: 'Asia/Jakarta' },
    ]);
    expect(groups.map((g) => g.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(groups[0]!.items.map((s) => s.start)).toEqual(['07:00', '13:00']);
    expect(groups[1]!.items).toHaveLength(0);
  });
});

describe('batas media', () => {
  it('foto: tipe dan ukuran', () => {
    expect(mediaFileProblem('foto', { type: 'image/jpeg', size: PHOTO_MAX_BYTES })).toBeNull();
    expect(mediaFileProblem('foto', { type: 'image/jpeg', size: PHOTO_MAX_BYTES + 1 })).toBe('size');
    expect(mediaFileProblem('foto', { type: 'image/gif', size: 10 })).toBe('type');
  });

  it('video: durasi wajib terukur dan maksimal 120 detik', () => {
    expect(mediaFileProblem('video', { type: 'video/mp4', size: 1000 }, VIDEO_MAX_SECONDS)).toBeNull();
    expect(mediaFileProblem('video', { type: 'video/mp4', size: 1000 }, VIDEO_MAX_SECONDS + 1)).toBe('duration');
    expect(mediaFileProblem('video', { type: 'video/mp4', size: 1000 }, Number.NaN)).toBe('duration');
    expect(mediaFileProblem('video', { type: 'video/quicktime', size: 1000 }, 10)).toBe('type');
  });
});

describe('membuat profil', () => {
  const user = { id: 'u', email: 'a@b.c', name: 'A', phone: null, emailVerified: true, twoFactorEnabled: false };
  const verified = { status: 'verified' } as never;
  const one = [{ id: 'f', slug: 'f', name: 'F', city: 'K', type: 'gaya_hidup', status: 'draft', verification: 'diisi_faskes', role: 'pengelola' }];

  it('mitra belum terverifikasi tidak bisa', () => {
    expect(canCreateProfile({ user: { ...user, role: 'apotek' }, partner: { status: 'pending' } as never, memberships: [] })).toBe(false);
  });
  it('non-faskes hanya satu profil', () => {
    expect(canCreateProfile({ user: { ...user, role: 'gaya_hidup' }, partner: verified, memberships: [] })).toBe(true);
    expect(canCreateProfile({ user: { ...user, role: 'gaya_hidup' }, partner: verified, memberships: one })).toBe(false);
  });
  it('faskes boleh lebih dari satu', () => {
    expect(canCreateProfile({ user: { ...user, role: 'faskes' }, partner: verified, memberships: one })).toBe(true);
  });
});

describe('koordinat', () => {
  it('koma desimal diterima, teks kosong = null', () => {
    expect(parseCoord('-7,97')).toBe(-7.97);
    expect(parseCoord('')).toBeNull();
    expect(parseCoord('abc')).toBeNull();
  });
});

describe('describeProfileField', () => {
  it('meringkas lokasi dengan penanda lokasi utama', () => {
    expect(
      describeProfileField('locations', [
        { label: 'Pusat', address: 'Jl. Ijen 1', city: 'Kota Malang', province: 'Jawa Timur', lat: -7.97, lng: 112.63, isPrimary: true },
        { label: null, address: 'Jl. Dinoyo 2', city: 'Kota Malang', province: 'Jawa Timur', lat: -7.94, lng: 112.61, isPrimary: false },
      ]),
    ).toEqual(['★ Pusat — Jl. Ijen 1, Kota Malang, Jawa Timur (-7.97, 112.63)', 'Jl. Dinoyo 2, Kota Malang, Jawa Timur (-7.94, 112.61)']);
  });

  it('mengurutkan jadwal per hari lalu jam, dengan nama tenaga medis', () => {
    const lines = describeProfileField(
      'schedules',
      [
        { kind: 'praktik', weekday: 3, start: '13:00', end: '15:00', timezone: 'Asia/Makassar', practitionerId: 'p1', note: null },
        { kind: 'operasional', weekday: 1, start: '08:00', end: '16:00', timezone: 'Asia/Jakarta', practitionerId: null, note: 'Istirahat 12.00' },
      ],
      (id) => (id === 'p1' ? 'dr. Sari' : undefined),
    );
    expect(lines).toEqual(['Senin 08.00–16.00 WIB (Istirahat 12.00)', 'Rabu 13.00–15.00 WITA (praktik dr. Sari)']);
  });

  it('nilai kosong menjadi daftar kosong; teks biasa satu baris', () => {
    expect(describeProfileField('description', null)).toEqual([]);
    expect(describeProfileField('description', '')).toEqual([]);
    expect(describeProfileField('name', 'Klinik Sehat')).toEqual(['Klinik Sehat']);
  });
});

describe('withProfileDefaults', () => {
  it('mengisi field Fase 2 yang tidak ada di respons cache lama', () => {
    const old: { slug: string; name: string; locations?: unknown[] } = { slug: 'klinik-lama', name: 'Klinik Lama' };
    expect(withProfileDefaults(old)).toEqual({ ...old, locations: [], schedules: [], media: [] });
  });

  it('tidak mengubah data yang sudah lengkap', () => {
    const f = { slug: 'k', locations: [{ isPrimary: true }], schedules: [{ kind: 'praktik' }], media: [{ id: 'm' }] };
    expect(withProfileDefaults(f)).toEqual(f);
  });
});
