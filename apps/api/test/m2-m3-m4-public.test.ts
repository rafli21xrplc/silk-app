import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { compareResponseSchema, serviceDetailSchema, tariffHistoryItemSchema } from '@silk/shared';
import { FACILITY_IDS, SERVICES, TARIFF_IDS } from '@silk/db/seed';
import { getApp, resetDb } from './helpers';

const api = () => request(getApp());

describe('M2 Katalog layanan dan tarif', () => {
  beforeAll(() => resetDb());

  it('daftar dan cari layanan (termasuk alias)', async () => {
    const all = await api().get('/v1/services').query({ limit: 100 });
    // Taksonomi tumbuh (konsultasi, rawat inap); jumlahnya mengikuti data referensi seed.
    expect(all.body.data.length).toBe(SERVICES.length);
    const byAlias = await api().get('/v1/services').query({ q: 'gdp' });
    expect(byAlias.body.data[0].slug).toBe('gula-darah-puasa');
    // Alias ikut dikirim agar web bisa memetakan kata kunci ke layanan (USP: harga langsung tampil).
    expect(byAlias.body.data[0].aliases).toContain('gdp');
  });

  it('ringkasan harga per kota', async () => {
    const res = await api().get('/v1/services/mcu-dasar');
    const detail = serviceDetailSchema.parse(res.body.data);
    const kota = detail.cities.find((c) => c.city === 'Kota Malang');
    expect(kota).toMatchObject({ facilityCount: 2, minPrice: 295000, maxPrice: 350000 });
  });

  it('M2-3: tarif "tanya" tidak membawa angka', async () => {
    const res = await api().get('/v1/facilities/laboratorium-klinik-contoh-medika');
    const dl = res.body.data.tariffs.find((t: { service: { slug: string } }) => t.service.slug === 'darah-lengkap');
    expect(dl.price).toEqual({ type: 'tanya', min: null, max: null, currency: 'IDR' });
  });

  it('versi yang tampil adalah versi terbaru yang sudah berlaku', async () => {
    const res = await api().get('/v1/facilities/klinik-pratama-sehat-contoh');
    const mcu = res.body.data.tariffs.find((t: { id: string }) => t.id === TARIFF_IDS.pratamaMcu);
    expect(mcu.versionNo).toBe(2);
    expect(mcu.price.min).toBe(350000);
    expect(mcu.package.components).toHaveLength(5);
  });
});

describe('M3 Perbandingan harga', () => {
  beforeAll(() => resetDb());

  it('M3-1: 3 paket, semua komponen tampil, yang tidak ada ditandai tidak termasuk', async () => {
    const res = await api().get('/v1/compare').query({ service: 'mcu-dasar', city: 'Malang' });
    expect(res.status).toBe(200);
    const body = compareResponseSchema.parse(res.body.data);
    expect(body.rows).toHaveLength(3);
    expect(body.columns).toEqual(
      expect.arrayContaining(['Hemoglobin', 'Gula darah puasa', 'Kolesterol total', 'Rontgen thorax', 'EKG', 'Asam urat']),
    );
    for (const row of body.rows) expect(Object.keys(row.components).sort()).toEqual([...body.columns].sort());
    const medika = body.rows.find((r) => r.facility.slug === 'laboratorium-klinik-contoh-medika')!;
    expect(medika.components['Rontgen thorax']).toBe(false);
    expect(medika.components['Asam urat']).toBe(true);
    // Urutan default harga naik; label "termurah" tidak dipakai
    expect(body.rows.map((r) => r.price.min)).toEqual([295000, 350000, 450000]);
    expect(JSON.stringify(res.body)).not.toMatch(/termurah|terbaik/i);
  });

  it('M3-2: tarif usang ditandai dan dapat disaring', async () => {
    const all = await api().get('/v1/compare').query({ service: 'mcu-dasar', city: 'Malang' });
    expect(all.body.data.rows.find((r: { stale: boolean }) => r.stale)).toBeTruthy();
    const fresh = await api().get('/v1/compare').query({ service: 'mcu-dasar', city: 'Malang', hideStale: '1' });
    expect(fresh.body.data.rows).toHaveLength(2);
    expect(fresh.body.data.rows.every((r: { stale: boolean }) => !r.stale)).toBe(true);
  });

  it('M3-3: URL yang sama menghasilkan tampilan yang sama', async () => {
    const q = { service: 'mcu-dasar', facilityIds: `${FACILITY_IDS.klinikKepanjen},${FACILITY_IDS.klinikPratama}`, sort: 'price_desc' };
    const a = await api().get('/v1/compare').query(q);
    const b = await api().get('/v1/compare').query(q);
    expect(a.body).toEqual(b.body);
    expect(a.body.data.rows.map((r: { facility: { slug: string } }) => r.facility.slug)).toEqual([
      'klinik-utama-contoh-kepanjen',
      'klinik-pratama-sehat-contoh',
    ]);
  });

  it('tanpa facilityIds atau city = 400', async () => {
    expect((await api().get('/v1/compare').query({ service: 'mcu-dasar' })).status).toBe(400);
  });
});

describe('M4 Lapisan kepercayaan', () => {
  beforeAll(() => resetDb());
  afterEach(() => vi.useRealTimers());

  it('M4-1: tarif tanpa verified_at tampil sebagai belum diverifikasi', async () => {
    const res = await api().get('/v1/facilities/laboratorium-klinik-contoh-medika');
    const hb = res.body.data.tariffs.find((t: { id: string }) => t.id === TARIFF_IDS.medikaHb);
    expect(hb.trust.verifiedAt).toBeNull();
    expect(hb.trust.stale).toBe(false);
  });

  it('M4-2: jam sistem dimajukan 181 hari → otomatis usang tanpa perubahan data', async () => {
    const before = await api().get('/v1/facilities/klinik-pratama-sehat-contoh');
    const hbBefore = before.body.data.tariffs.find((t: { id: string }) => t.id === TARIFF_IDS.pratamaHb);
    expect(hbBefore.trust.stale).toBe(false);

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(Date.now() + 181 * 86_400_000));
    const after = await api().get('/v1/facilities/klinik-pratama-sehat-contoh');
    const hbAfter = after.body.data.tariffs.find((t: { id: string }) => t.id === TARIFF_IDS.pratamaHb);
    expect(hbAfter.trust.stale).toBe(true);
    expect(hbAfter.trust.verifiedAt).toBe(hbBefore.trust.verifiedAt);
  });

  it('M4-3: riwayat menampilkan semua versi berurutan dengan pembuat dan waktu', async () => {
    const res = await api().get(`/v1/tariffs/${TARIFF_IDS.pratamaMcu}/history`);
    expect(res.status).toBe(200);
    const items = res.body.data.map((i: unknown) => tariffHistoryItemSchema.parse(i));
    expect(items.map((i: { versionNo: number }) => i.versionNo)).toEqual([2, 1]);
    expect(items[0].current).toBe(true);
    expect(items[1].current).toBe(false);
    expect(items[0].createdBy.name).toBeTruthy();
    expect(items[0].createdAt).toBeTruthy();
  });

  it('riwayat tarif dari faskes draft = 404', async () => {
    expect((await api().get(`/v1/tariffs/${TARIFF_IDS.draftHb}/history`)).status).toBe(404);
  });
});
