import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { facilityListItemSchema, RATING_MIN_COUNT } from '@silk/shared';
import { db } from '../src/lib/db';
import { resetEnvCacheForTests } from '../src/lib/env';
import { buildSearchQuery, type FacilitySearchParams } from '../src/modules/m1-directory/directory.repo';
import { createUser, getApp, resetDb } from './helpers';

const api = () => request(getApp());
type Item = { id: string; slug: string; name: string; distanceM: number | null; price: { min: number | null } | null; [k: string]: unknown };

/* ---------- Data uji Fase 3: kota sendiri agar tidak tercampur data seed ---------- */

const CITY = 'Kota Uji Tiga';
const C = { lat: -8.1, lng: 112.8 };
/** Geser ke timur/barat sejauh `m` meter (≈ 110,2 km per derajat bujur di lintang -8,1). */
const east = (m: number) => C.lng + m / 110_200;
const south = (m: number) => C.lat - m / 110_600;

const F = {} as Record<'alfa' | 'bravo' | 'charlie' | 'delta' | 'echo' | 'kembar1' | 'kembar2', string>;

async function insertFacility(slug: string, name: string, type: string, lat: number, lng: number, city = CITY): Promise<string> {
  const r = await db().execute<{ id: string }>(sql`
    INSERT INTO facilities (slug, name, type, address, city, province, location, verification, status)
    VALUES (${slug}, ${name}, ${type}::facility_type, ${`Jl. Uji ${name}`}, ${city}, 'Jawa Timur',
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, 'diisi_faskes', 'terbit')
    RETURNING id
  `);
  const id = r.rows[0]!.id;
  await db().execute(sql`
    INSERT INTO profile_locations (facility_id, address, city, province, location, is_primary)
    SELECT id, address, city, province, location, true FROM facilities WHERE id = ${id}
  `);
  return id;
}

async function addTariff(facilityId: string, serviceSlug: string, priceType: string, min: number | null, max: number | null = null) {
  const t = await db().execute<{ id: string }>(sql`
    INSERT INTO tariffs (facility_id, service_id, status)
    SELECT ${facilityId}, id, 'terbit' FROM services WHERE slug = ${serviceSlug}
    RETURNING id
  `);
  const tariffId = t.rows[0]!.id;
  const v = await db().execute<{ id: string }>(sql`
    INSERT INTO tariff_versions (tariff_id, version_no, price_type, price_min, price_max, effective_from, verified_at, verification, source_id)
    VALUES (${tariffId}, 1, ${priceType}::price_type, ${min}, ${max}, '2026-01-01', now(), 'diverifikasi_admin',
      (SELECT id FROM data_sources WHERE title = 'Sumber uji Fase 3'))
    RETURNING id
  `);
  await db().execute(sql`UPDATE tariffs SET current_version_id = ${v.rows[0]!.id} WHERE id = ${tariffId}`);
}

async function seedFase3() {
  await db().execute(sql`INSERT INTO data_sources (kind, title) VALUES ('faskes', 'Sumber uji Fase 3')`);
  F.alfa = await insertFacility('faskes-tiga-alfa', 'Faskes Tiga Alfa', 'klinik', C.lat, east(500));
  F.bravo = await insertFacility('faskes-tiga-bravo', 'Faskes Tiga Bravo', 'klinik', C.lat, east(1500));
  F.charlie = await insertFacility('faskes-tiga-charlie', 'Faskes Tiga Charlie', 'laboratorium', C.lat, east(3000));
  F.delta = await insertFacility('faskes-tiga-delta', 'Faskes Tiga Delta', 'klinik', C.lat, east(2000));
  // Echo: lokasi utama jauh (kota lain), cabang 800 m di barat titik pusat, di Kota Uji Tiga.
  F.echo = await insertFacility('faskes-tiga-echo', 'Faskes Tiga Echo', 'gaya_hidup', -7.9, 112.8, 'Kota Jauh Uji');
  await db().execute(sql`
    INSERT INTO profile_locations (facility_id, label, address, city, province, location, is_primary)
    VALUES (${F.echo}, 'Cabang Barat', 'Jl. Cabang Barat 1', ${CITY}, 'Jawa Timur',
      ST_SetSRID(ST_MakePoint(${C.lng - 800 / 110_200}, ${C.lat}), 4326)::geography, false)
  `);
  // Dua profil bernama sama: urutan bawaan dengan q + titik dipecah oleh jarak.
  F.kembar1 = await insertFacility('apotek-kembar-uji-1', 'Apotek Kembar Uji', 'apotek', south(1200), C.lng);
  F.kembar2 = await insertFacility('apotek-kembar-uji-2', 'Apotek Kembar Uji', 'apotek', south(2500), C.lng);

  await addTariff(F.alfa, 'hemoglobin', 'tetap', 50_000);
  await addTariff(F.alfa, 'kolesterol-total', 'rentang', 80_000, 120_000);
  await addTariff(F.bravo, 'hemoglobin', 'tetap', 30_000);
  await addTariff(F.charlie, 'hemoglobin', 'tanya', null);
  await addTariff(F.echo, 'konsultasi-gizi', 'mulai_dari', 100_000);
}

interface SearchBody {
  data: Item[];
  meta: { nextCursor: string | null; unpricedCount?: number };
}

async function search(query: Record<string, string | number>): Promise<{ body: SearchBody }> {
  const res = await api().get('/v1/facilities').query({ limit: 100, ...query });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return { body: res.body as SearchBody };
}
const names = (items: Item[]) => items.map((i) => i.slug);

function setFlags(value: string | undefined) {
  if (value === undefined) delete process.env.FEATURE_FLAGS;
  else process.env.FEATURE_FLAGS = value;
  resetEnvCacheForTests();
}

describe('Fase 3: pencarian dan filter (F-03)', () => {
  beforeAll(async () => {
    await resetDb();
    await seedFase3();
  });
  afterEach(() => setFlags(undefined));

  describe('kategori dan tarif yang belum tersedia', () => {
    it('kategori baru: gaya-hidup-sehat menemukan profil gaya hidup', async () => {
      const res = await search({ category: 'gaya-hidup-sehat', city: CITY });
      expect(names(res.body.data)).toEqual(['faskes-tiga-echo']);
    });

    it('kategori laboratorium: faskes dengan tarif terbit (termasuk "tanya"); tanpa tarif tidak masuk', async () => {
      const res = await search({ category: 'laboratorium', city: CITY });
      expect(names(res.body.data)).toEqual(['faskes-tiga-alfa', 'faskes-tiga-bravo', 'faskes-tiga-charlie']);
    });

    it('kategori tidak dikenal = hasil kosong', async () => {
      const res = await search({ category: 'tidak-ada' });
      expect(res.body.data).toEqual([]);
    });

    it('urutan bawaan mencampur faskes dengan dan tanpa tarif; tanpa tarif ditandai 0 tarif', async () => {
      const res = await search({ city: CITY });
      const order = names(res.body.data);
      // Dua apotek bernama sama (urutan di antara keduanya ditentukan id), lalu urut nama.
      expect(new Set(order.slice(0, 2))).toEqual(new Set(['apotek-kembar-uji-1', 'apotek-kembar-uji-2']));
      expect(order.slice(2)).toEqual(['faskes-tiga-alfa', 'faskes-tiga-bravo', 'faskes-tiga-charlie', 'faskes-tiga-delta', 'faskes-tiga-echo']);
      const delta = res.body.data.find((i) => i.slug === 'faskes-tiga-delta')!;
      expect(delta.publishedTariffCount).toBe(0);
      expect(delta.priceAvailable).toBe(false);
      for (const item of res.body.data) facilityListItemSchema.parse(item);
      // Urut nama: Delta berada di antara Charlie dan Echo, tidak didorong ke atas atau bawah.
      expect(order.indexOf('faskes-tiga-delta')).toBe(order.indexOf('faskes-tiga-charlie') + 1);
      expect(order.indexOf('faskes-tiga-echo')).toBe(order.indexOf('faskes-tiga-delta') + 1);
    });

    it('urut harga: yang berharga diurutkan; "tanya" dikelompokkan sesudahnya dengan priceAvailable=false', async () => {
      const asc = await search({ service: 'hemoglobin', city: CITY, sort: 'price_asc' });
      expect(names(asc.body.data)).toEqual(['faskes-tiga-bravo', 'faskes-tiga-alfa', 'faskes-tiga-charlie']);
      expect(asc.body.data.map((i) => i.priceAvailable)).toEqual([true, true, false]);
      expect(asc.body.data[2]!.price).toMatchObject({ type: 'tanya', min: null });
      const desc = await search({ service: 'hemoglobin', city: CITY, sort: 'price_desc' });
      expect(names(desc.body.data)).toEqual(['faskes-tiga-alfa', 'faskes-tiga-bravo', 'faskes-tiga-charlie']);
    });
  });

  describe('filter biaya', () => {
    it('layanan + rentang: hanya yang beririsan; unpricedCount menghitung yang hanya "tanya"', async () => {
      const res = await search({ service: 'hemoglobin', city: CITY, priceMin: 40_000, priceMax: 60_000 });
      expect(names(res.body.data)).toEqual(['faskes-tiga-alfa']);
      expect(res.body.data[0]!.price).toMatchObject({ min: 50_000 });
      expect(res.body.meta.unpricedCount).toBe(1);
    });

    it('kategori + biaya minimal: tarif rentang yang beririsan ikut cocok', async () => {
      const res = await search({ category: 'laboratorium', city: CITY, priceMin: 100_000 });
      expect(names(res.body.data)).toEqual(['faskes-tiga-alfa']);
      expect(res.body.meta.unpricedCount).toBe(1);
    });

    it('"mulai dari" cocok dengan biaya minimal berapa pun di atasnya', async () => {
      const res = await search({ category: 'gaya-hidup-sehat', priceMin: 5_000_000 });
      expect(names(res.body.data)).toEqual(['faskes-tiga-echo']);
    });

    it('tanpa filter biaya, unpricedCount tidak dikirim', async () => {
      const res = await search({ service: 'hemoglobin', city: CITY });
      expect(res.body.meta).not.toHaveProperty('unpricedCount');
    });

    it('biaya tanpa layanan/kategori dan min > maks = 400', async () => {
      expect((await api().get('/v1/facilities').query({ priceMin: 1000 })).status).toBe(400);
      expect((await api().get('/v1/facilities').query({ service: 'hemoglobin', priceMin: 9, priceMax: 1 })).status).toBe(400);
    });
  });

  describe('lokasi: radius, kota, dan cabang (K6)', () => {
    it('radius memakai lokasi profil terdekat; cabang di dalam radius ikut dengan nearestLocation', async () => {
      const res = await search({ lat: C.lat, lng: C.lng, radius: 1000, sort: 'distance' });
      expect(names(res.body.data)).toEqual(['faskes-tiga-alfa', 'faskes-tiga-echo']);
      const [alfa, echo] = res.body.data;
      expect(alfa!.distanceM).toBeGreaterThan(450);
      expect(alfa!.distanceM).toBeLessThan(550);
      expect(alfa!.nearestLocation).toBeNull();
      expect(echo!.distanceM).toBeGreaterThan(750);
      expect(echo!.distanceM).toBeLessThan(850);
      expect(echo!.nearestLocation).toEqual({ label: 'Cabang Barat', address: 'Jl. Cabang Barat 1', city: CITY });
    });

    it('kota cocok dengan kota cabang', async () => {
      const res = await search({ city: CITY, type: 'gaya_hidup' });
      expect(names(res.body.data)).toEqual(['faskes-tiga-echo']);
    });

    it('urutan bawaan dengan q dan titik: relevansi lalu jarak', async () => {
      const near = await search({ q: 'Apotek Kembar Uji', lat: C.lat, lng: C.lng });
      expect(names(near.body.data).slice(0, 2)).toEqual(['apotek-kembar-uji-1', 'apotek-kembar-uji-2']);
      // Dari titik di selatan kedua apotek, urutannya terbalik.
      const far = await search({ q: 'Apotek Kembar Uji', lat: south(4000), lng: C.lng });
      expect(names(far.body.data).slice(0, 2)).toEqual(['apotek-kembar-uji-2', 'apotek-kembar-uji-1']);
    });

    it('kombinasi layanan + radius + urut jarak', async () => {
      const res = await search({ service: 'hemoglobin', lat: C.lat, lng: C.lng, radius: 2000, sort: 'distance' });
      expect(names(res.body.data)).toEqual(['faskes-tiga-alfa', 'faskes-tiga-bravo']);
    });
  });

  describe('rating (flag reviews_enabled)', () => {
    beforeAll(async () => {
      await db().execute(sql`
        INSERT INTO facility_ratings (facility_id, rating_avg, rating_count) VALUES
          (${F.alfa}, 4.5, 10), (${F.bravo}, 3.9, 5), (${F.charlie}, 5.0, ${RATING_MIN_COUNT - 1})
      `);
    });

    it('flag OFF: minRating dan sort=rating = 404; item tidak membawa rating', async () => {
      setFlags(undefined);
      expect((await api().get('/v1/facilities').query({ minRating: 4 })).status).toBe(404);
      expect((await api().get('/v1/facilities').query({ sort: 'rating' })).status).toBe(404);
      const res = await search({ city: CITY });
      expect(res.body.data.every((i) => i.rating === null)).toBe(true);
    });

    it('flag ON: minRating hanya untuk yang jumlah ulasannya cukup', async () => {
      setFlags('reviews_enabled');
      const res = await search({ city: CITY, minRating: 4 });
      expect(names(res.body.data)).toEqual(['faskes-tiga-alfa']);
      expect(res.body.data[0]!.rating).toEqual({ avg: 4.5, count: 10 });
    });

    it('flag ON: sort=rating mengurutkan yang punya rating; sisanya dengan urutan bawaan sesudahnya', async () => {
      setFlags('reviews_enabled');
      const res = await search({ city: CITY, type: 'klinik', sort: 'rating' });
      expect(names(res.body.data)).toEqual(['faskes-tiga-alfa', 'faskes-tiga-bravo', 'faskes-tiga-delta']);
    });

    it('rating tidak mengubah urutan bawaan', async () => {
      setFlags(undefined);
      const off = names((await search({ city: CITY })).body.data);
      setFlags('reviews_enabled');
      const on = names((await search({ city: CITY })).body.data);
      expect(on).toEqual(off);
    });
  });

  describe('regresi urutan: atribut komersial tidak memengaruhi urutan', () => {
    const queries: Record<string, string | number>[] = [
      { city: CITY },
      { city: CITY, sort: 'name' },
      { q: 'Faskes Tiga' },
      { q: 'Faskes Tiga', lat: C.lat, lng: C.lng },
      { lat: C.lat, lng: C.lng, radius: 5000 },
      { lat: C.lat, lng: C.lng, radius: 5000, sort: 'distance' },
      { service: 'hemoglobin', city: CITY, sort: 'price_asc' },
      { service: 'hemoglobin', city: CITY, sort: 'price_desc' },
      { category: 'laboratorium', city: CITY },
    ];

    it('urutan identik setelah mitra, keanggotaan, media, permintaan harga, klaim, dan rating berubah', async () => {
      const before = await Promise.all(queries.map(async (q) => names((await search(q)).body.data)));

      // Bravo dan Delta "dikelola mitra aktif" dengan media, permintaan harga menunggu, dan klaim.
      const owner = await createUser({ partner: { type: 'fasilitas' }, facilityIds: [F.bravo, F.delta] });
      for (const fid of [F.bravo, F.delta]) {
        await db().execute(sql`
          INSERT INTO profile_media (facility_id, kind, object_key, file_name, mime, size_bytes, status, public_url, confirmed_at)
          VALUES (${fid}, 'foto', ${`profiles/${fid}/a.jpg`}, 'a.jpg', 'image/jpeg', 1000, 'approved', 'https://media.contoh.test/a.jpg', now())
        `);
        await db().execute(sql`
          INSERT INTO tariff_change_requests (facility_id, kind, service_id, price_type, price_min, effective_from, source_title, submitted_by)
          SELECT ${fid}, 'tunggal', id, 'tetap', 1, '2026-01-01', 'Sumber uji', ${owner.id} FROM services WHERE slug = 'hemoglobin'
        `);
        await db().execute(sql`INSERT INTO facility_claims (facility_id, user_id) VALUES (${fid}, ${owner.id})`);
      }
      await db().execute(sql`
        INSERT INTO facility_ratings (facility_id, rating_avg, rating_count) VALUES (${F.delta}, 5.0, 100)
        ON CONFLICT (facility_id) DO UPDATE SET rating_avg = 5.0, rating_count = 100
      `);

      for (const flags of [undefined, 'reviews_enabled']) {
        setFlags(flags);
        const after = await Promise.all(queries.map(async (q) => names((await search(q)).body.data)));
        expect(after).toEqual(before);
      }
    });

    it('menambah tarif ke faskes tanpa tarif tidak memindahkan posisinya di urutan bawaan', async () => {
      const q: Record<string, string | number>[] = [{ city: CITY }, { lat: C.lat, lng: C.lng, radius: 5000 }];
      const before = await Promise.all(q.map(async (x) => names((await search(x)).body.data)));
      await addTariff(F.delta, 'asam-urat', 'tetap', 1);
      const after = await Promise.all(q.map(async (x) => names((await search(x)).body.data)));
      expect(after).toEqual(before);
    });

    it('SQL pencarian tidak menyebut langganan atau pembayaran', () => {
      const source = readFileSync(fileURLToPath(new URL('../src/modules/m1-directory/directory.repo.ts', import.meta.url)), 'utf8');
      expect(source).not.toMatch(/\b(subscriptions?|payments?|plans?|orders?)\b/i);
    });
  });

  describe('kursor dan kompatibilitas', () => {
    it('halaman demi halaman dengan filter aktif = hasil tanpa kursor, tanpa duplikat', async () => {
      const query = { city: CITY, lat: C.lat, lng: C.lng };
      const all = names((await search(query)).body.data);
      const seen: string[] = [];
      let cursor: string | null = null;
      do {
        const res = await api()
          .get('/v1/facilities')
          .query({ ...query, limit: 2, ...(cursor ? { cursor } : {}) });
        expect(res.status).toBe(200);
        seen.push(...names(res.body.data));
        cursor = res.body.meta.nextCursor;
      } while (cursor);
      expect(seen).toEqual(all);
      expect(new Set(seen).size).toBe(seen.length);
    });

    it('parameter lama tetap sah dan item lolos skema kontrak', async () => {
      const res = await search({ q: 'klinik pratma' });
      expect(res.body.data[0]!.slug).toBe('klinik-pratama-sehat-contoh');
      for (const item of res.body.data) facilityListItemSchema.parse(item);
    });

    it('GET /v1/service-categories memuat kategori baru beserta jumlah layanan', async () => {
      const res = await api().get('/v1/service-categories');
      expect(res.status).toBe(200);
      const slugs = res.body.data.map((c: { slug: string }) => c.slug);
      expect(slugs).toEqual(expect.arrayContaining(['laboratorium', 'gaya-hidup-sehat', 'rumah-duka']));
      expect(res.body.data.find((c: { slug: string }) => c.slug === 'rumah-duka').serviceCount).toBeGreaterThan(0);
    });
  });

  describe('EXPLAIN: query utama bisa memakai indeks', () => {
    async function plan(p: Omit<FacilitySearchParams, 'limit' | 'offset'>, opts: { bitmapOnly?: boolean } = {}) {
      return db().transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL enable_seqscan = off`);
        if (opts.bitmapOnly) await tx.execute(sql`SET LOCAL enable_indexscan = off`);
        const r = await tx.execute<{ 'QUERY PLAN': string }>(sql`EXPLAIN ${buildSearchQuery({ limit: 20, offset: 0, ...p })}`);
        return r.rows.map((x) => x['QUERY PLAN']).join('\n');
      });
    }

    it('q memakai indeks trigram nama faskes dan nama layanan', async () => {
      const text = await plan({ q: 'lab' }, { bitmapOnly: true });
      expect(text).toContain('facilities_name_trgm');
      expect(text).toContain('services_name_trgm');
    });

    it('radius memakai indeks GiST lokasi profil', async () => {
      const text = await plan({ lat: C.lat, lng: C.lng, radius: 2000 });
      expect(text).toContain('profile_locations_location_gix');
      expect(text).not.toMatch(/Seq Scan on (facilities|profile_locations)\b/);
    });

    it('layanan + biaya tidak memindai penuh tarif atau faskes', async () => {
      const svc = await db().execute<{ id: string }>(sql`SELECT id FROM services WHERE slug = 'hemoglobin'`);
      const text = await plan({ serviceId: svc.rows[0]!.id, priceMin: 10_000, priceMax: 60_000, sort: 'price_asc' });
      expect(text).not.toMatch(/Seq Scan on (facilities|tariffs|tariff_versions)\b/);
    });
  });
});
