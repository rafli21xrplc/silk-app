import { describe, expect, it } from 'vitest';
import { doctorApiQuery, doctorHref, normalizeDoctorSearch } from './doctor-search';

describe('normalizeDoctorSearch (Fase 4b)', () => {
  it('menyimpan filter yang dikenal dan membuang yang lain', () => {
    expect(normalizeDoctorSearch({ q: ' anak ', specialty: 'Anak', city: 'Malang', priceMin: '1000', foo: 'x' })).toEqual({
      q: 'anak',
      specialty: 'Anak',
      city: 'Malang',
    });
  });

  it('radius dan urut jarak hanya bila titik valid', () => {
    expect(normalizeDoctorSearch({ radius: '5000', sort: 'distance' })).toEqual({});
    expect(normalizeDoctorSearch({ lat: '-7.98', lng: '999', radius: '5000' })).toEqual({});
    expect(normalizeDoctorSearch({ lat: '-7.98', lng: '112.63', radius: '5000', sort: 'distance' })).toEqual({
      lat: '-7.98',
      lng: '112.63',
      radius: '5000',
      sort: 'distance',
    });
    expect(normalizeDoctorSearch({ lat: '-7.98', lng: '112.63', radius: '1234' })).toEqual({ lat: '-7.98', lng: '112.63' });
  });

  it('urut relevansi hanya dengan kata kunci; urutan tak dikenal dibuang', () => {
    expect(normalizeDoctorSearch({ sort: 'relevance' })).toEqual({});
    expect(normalizeDoctorSearch({ sort: 'relevance', q: 'jantung' })).toEqual({ sort: 'relevance', q: 'jantung' });
    for (const sort of ['price_asc', 'rating', 'promoted']) expect(normalizeDoctorSearch({ sort })).toEqual({});
  });

  it('query API selalu memakai limit; tautan membuang kursor', () => {
    expect(doctorApiQuery({ q: 'anak' }).toString()).toBe('q=anak&limit=20');
    expect(doctorHref({ q: 'anak', cursor: 'abc' })).toBe('/dokter?q=anak');
    expect(doctorHref({ q: 'anak' }, { specialty: 'Anak' })).toBe('/dokter?q=anak&specialty=Anak');
    expect(doctorHref({}, {})).toBe('/dokter');
  });

  it('filter USP video dan biaya hanya bernilai 1; urut biaya konsultasi tanpa syarat', () => {
    expect(normalizeDoctorSearch({ video: '1', fee: '1', sort: 'fee_asc' })).toEqual({ video: '1', fee: '1', sort: 'fee_asc' });
    expect(normalizeDoctorSearch({ video: 'true', fee: '0' })).toEqual({});
    expect(doctorApiQuery({ fee: '1', sort: 'fee_asc' }).toString()).toBe('fee=1&sort=fee_asc&limit=20');
    expect(doctorHref({ video: '1' }, { video: null })).toBe('/dokter');
  });
});
