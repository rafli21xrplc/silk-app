import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { facilityDetailSchema, facilityListItemSchema } from '@silk/shared';
import { FACILITY_IDS } from '@silk/db/seed';
import { getApp, resetDb } from './helpers';

const api = () => request(getApp());

describe('M1 Direktori faskes', () => {
  beforeAll(() => resetDb());

  it('M1-1: salah ketik satu huruf ("klinik pratma") tetap menemukan Klinik Pratama', async () => {
    const res = await api().get('/v1/facilities').query({ q: 'klinik pratma' });
    expect(res.status).toBe(200);
    expect(res.body.data[0].slug).toBe('klinik-pratama-sehat-contoh');
    for (const item of res.body.data) facilityListItemSchema.parse(item);
  });

  it('pencarian nama/alias layanan menemukan faskes yang menyediakannya', async () => {
    const res = await api().get('/v1/facilities').query({ q: 'cek hb' });
    const slugs = res.body.data.map((f: { slug: string }) => f.slug);
    expect(slugs).toEqual(expect.arrayContaining(['klinik-pratama-sehat-contoh', 'laboratorium-klinik-contoh-medika']));
  });

  it('M1-2: radius 5 km terurut menurut jarak', async () => {
    const res = await api().get('/v1/facilities').query({ lat: -7.9666, lng: 112.6326, radius: 5000, sort: 'distance' });
    expect(res.status).toBe(200);
    const d = res.body.data.map((f: { distanceM: number }) => f.distanceM);
    expect(d.length).toBeGreaterThanOrEqual(2);
    expect([...d].sort((a, b) => a - b)).toEqual(d);
    expect(d.every((x: number) => x <= 5000)).toBe(true);
    // Kepanjen (~19 km) di luar radius
    expect(res.body.data.map((f: { slug: string }) => f.slug)).not.toContain('klinik-utama-contoh-kepanjen');
  });

  it('M1-3: faskes draft tidak muncul di daftar, detail, maupun sitemap', async () => {
    const list = await api().get('/v1/facilities').query({ limit: 100 });
    expect(list.body.data.map((f: { id: string }) => f.id)).not.toContain(FACILITY_IDS.rsDraft);
    const byName = await api().get('/v1/facilities').query({ q: 'RS Contoh Draf' });
    expect(byName.body.data.map((f: { id: string }) => f.id)).not.toContain(FACILITY_IDS.rsDraft);
    expect((await api().get('/v1/facilities/rs-contoh-draf')).status).toBe(404);
    const sitemap = await api().get('/v1/sitemap');
    expect(JSON.stringify(sitemap.body)).not.toContain('rs-contoh-draf');
    expect(sitemap.body.data.facilities.length).toBe(4);
  });

  it('"Malang" mencakup Kota Malang dan Kabupaten Malang', async () => {
    const res = await api().get('/v1/facilities').query({ city: 'Malang', limit: 100 });
    const cities = new Set(res.body.data.map((f: { city: string }) => f.city));
    expect(cities).toEqual(new Set(['Kota Malang', 'Kabupaten Malang']));
    const kab = await api().get('/v1/facilities').query({ city: 'kabupaten-malang' });
    expect(kab.body.data.every((f: { city: string }) => f.city === 'Kabupaten Malang')).toBe(true);
  });

  it('filter layanan menyertakan harga dan konteks kepercayaan; urut harga naik', async () => {
    const res = await api().get('/v1/facilities').query({ service: 'mcu-dasar', sort: 'price_asc' });
    const prices = res.body.data.map((f: { price: { min: number } }) => f.price.min);
    expect(prices).toEqual([295000, 350000, 450000]);
    expect(res.body.data[0].trust).toMatchObject({ verification: 'diisi_faskes', stale: true });
  });

  it('detail memuat data untuk JSON-LD dan lolos skema kontrak', async () => {
    const res = await api().get('/v1/facilities/klinik-pratama-sehat-contoh');
    expect(res.status).toBe(200);
    const detail = facilityDetailSchema.parse(res.body.data);
    expect(detail.location).not.toBeNull();
    expect(detail.region?.code).toBe('35.73');
    expect(res.headers['cache-control']).toContain('s-maxage');
    expect(res.headers.etag).toBeTruthy();
  });

  it('STR hanya tampil bila sudah diverifikasi', async () => {
    const verified = await api().get('/v1/practitioners/dr-contoh-satu');
    expect(verified.body.data.strNo).toBe('STR-UJI-0001');
    const unverified = await api().get('/v1/practitioners/dr-contoh-dua-spm');
    expect(unverified.body.data.strNo).toBeNull();
  });

  it('paginasi kursor', async () => {
    const first = await api().get('/v1/facilities').query({ limit: 2, sort: 'name' });
    expect(first.body.meta.nextCursor).toBeTruthy();
    const second = await api().get('/v1/facilities').query({ limit: 2, sort: 'name', cursor: first.body.meta.nextCursor });
    const ids = [...first.body.data, ...second.body.data].map((f: { id: string }) => f.id);
    expect(new Set(ids).size).toBe(4);
  });
});
