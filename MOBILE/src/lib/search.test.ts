import { describe, expect, it } from 'vitest';
import { activeFacilityFilters, parseDoctorParams, parseFacilityParams, resolveServiceQuery, toQueryString } from './search';

describe('parseFacilityParams', () => {
  it('nilai tidak sah dibuang, bukan galat', () => {
    expect(parseFacilityParams({ type: 'kapal', service: 'Bukan Slug!', lat: '999', q: '' })).toEqual({
      q: undefined,
      city: undefined,
      type: undefined,
      service: undefined,
      category: undefined,
      sort: undefined,
      lat: undefined,
      lng: undefined,
      teks: undefined,
      cursor: undefined,
    });
  });

  it('urut harga tanpa layanan dan urut jarak tanpa lokasi dinormalkan (API menolaknya)', () => {
    expect(parseFacilityParams({ sort: 'price_asc' }).sort).toBeUndefined();
    expect(parseFacilityParams({ sort: 'price_desc', service: 'hemoglobin' }).sort).toBe('price_desc');
    expect(parseFacilityParams({ sort: 'distance' }).sort).toBeUndefined();
    expect(parseFacilityParams({ sort: 'distance', lat: '-7.98', lng: '112.63' }).sort).toBe('distance');
  });

  it('lat dan lng harus berpasangan', () => {
    const p = parseFacilityParams({ lat: '-7.98' });
    expect([p.lat, p.lng]).toEqual([undefined, undefined]);
  });

  it('menerima URLSearchParams dan array dari Next', () => {
    expect(parseFacilityParams(new URLSearchParams('city=Kota+Malang&type=klinik')).city).toBe('Kota Malang');
    expect(parseFacilityParams({ type: ['laboratorium', 'klinik'] }).type).toBe('laboratorium');
  });

  it('menghitung filter aktif untuk lencana', () => {
    expect(activeFacilityFilters(parseFacilityParams({ city: 'Kota Malang', service: 'hemoglobin', q: 'x' }))).toBe(2);
  });
});

describe('parseDoctorParams', () => {
  it('hanya flag "1" dan urutan netral yang dikenal', () => {
    expect(parseDoctorParams({ fee: '1', video: 'ya', sort: 'payment' })).toMatchObject({ fee: '1', video: undefined, sort: undefined });
    expect(parseDoctorParams({ sort: 'fee_asc' }).sort).toBe('fee_asc');
  });
});

describe('toQueryString', () => {
  it('membuang nilai kosong dan mengurutkan kunci (kunci cache stabil)', () => {
    expect(toQueryString({ z: '1', a: undefined, b: '', c: 0, m: 'x y' })).toBe('c=0&m=x+y&z=1');
  });
});

describe('resolveServiceQuery', () => {
  const services = [
    { slug: 'hemoglobin', name: 'Hemoglobin', aliases: ['hb'] },
    { slug: 'rawat-inap-kelas-3', name: 'Kamar rawat inap kelas 3 (per malam)', aliases: ['rawat inap', 'kamar kelas 3'] },
    { slug: 'rawat-inap-kelas-2', name: 'Kamar rawat inap kelas 2 (per malam)', aliases: ['rawat inap'] },
  ];
  it('nama, alias, slug, atau nama tanpa keterangan kurung → satu layanan', () => {
    expect(resolveServiceQuery('HB', services)?.slug).toBe('hemoglobin');
    expect(resolveServiceQuery(' hemoglobin ', services)?.slug).toBe('hemoglobin');
    expect(resolveServiceQuery('Kamar rawat inap kelas 3', services)?.slug).toBe('rawat-inap-kelas-3');
  });
  it('ambigu atau terlalu pendek → null (tetap pencarian teks)', () => {
    expect(resolveServiceQuery('rawat inap', services)).toBeNull();
    expect(resolveServiceQuery('h', services)).toBeNull();
    expect(resolveServiceQuery('klinik', services)).toBeNull();
  });
});
