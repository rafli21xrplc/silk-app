import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import raw from '../../demo/snapshot.json';

vi.mock('server-only', () => ({}));

const facility = (raw as { facilityDetails: Record<string, unknown> }).facilityDetails['klinik-contoh-sawojajar'];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Modul dimuat ulang per uji: pemutus sirkuit dan variabel lingkungan dibaca saat impor. */
async function load(env: Record<string, string> = {}) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import('./api');
}

describe('sumber data: API dengan cadangan demo', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('API sehat → data live yang lolos skema', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ data: facility }));
    vi.stubGlobal('fetch', fetchMock);
    const api = await load({ SILK_API_ORIGIN: 'http://api.test' });
    const r = await api.getFacility('klinik-contoh-sawojajar');
    expect(r?.source).toBe('live');
    expect(fetchMock.mock.calls[0]![0]).toBe('http://api.test/v1/facilities/klinik-contoh-sawojajar');
  });

  it('API mati → data cadangan, lalu permintaan berikutnya tidak menunggu API (pemutus 15 detik)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    vi.stubGlobal('fetch', fetchMock);
    const api = await load();
    expect((await api.getFacility('klinik-contoh-sawojajar'))?.source).toBe('demo');
    expect((await api.getServices()).source).toBe('demo');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('API 5xx atau respons tidak lolos skema → cadangan', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ data: { slug: 1 } })));
    let api = await load();
    expect((await api.getFacility('klinik-contoh-sawojajar'))?.source).toBe('demo');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'x' }, 503)));
    api = await load();
    expect((await api.getFacility('klinik-contoh-sawojajar'))?.source).toBe('demo');
  });

  it('API 404 → benar-benar tidak ditemukan, tidak memakai cadangan', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: { code: 'NOT_FOUND' } }, 404)));
    const api = await load();
    expect(await api.getFacility('klinik-contoh-sawojajar')).toBeNull();
  });

  it('cadangan juga tidak punya → null (halaman 404)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    const api = await load();
    expect(await api.getFacility('tidak-ada')).toBeNull();
  });

  it('SILK_DEMO_ONLY=1 → tidak pernah memanggil API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const api = await load({ SILK_DEMO_ONLY: '1' });
    const page = await api.searchFacilities({ service: 'hemoglobin' });
    expect(page.source).toBe('demo');
    expect(page.items.length).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('pencarian live meneruskan parameter yang sudah dinormalkan dan kursor API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ data: [], meta: { nextCursor: 'abc' } }));
    vi.stubGlobal('fetch', fetchMock);
    const api = await load({ SILK_API_ORIGIN: 'http://api.test' });
    const page = await api.searchFacilities({ service: 'hemoglobin', sort: 'price_asc', city: 'Kota Malang' });
    expect(page).toEqual({ items: [], nextCursor: 'abc', source: 'live' });
    expect(fetchMock.mock.calls[0]![0]).toBe('http://api.test/v1/facilities?city=Kota+Malang&limit=20&service=hemoglobin&sort=price_asc');
  });

  it('slug tidak sah → 404 tanpa memanggil API; kunci prototipe tidak terbaca dari cadangan', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    vi.stubGlobal('fetch', fetchMock);
    const api = await load({ SILK_API_ORIGIN: 'http://api.test' });
    expect(await api.getFacility('%00')).toBeNull();
    expect(await api.getService('Bukan Slug')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    // Slug sah tetapi API mati: cadangan dibaca, dan `constructor` bukan data.
    expect(await api.getService('constructor')).toBeNull();
    expect(await api.getPractitioner('constructor')).toBeNull();
    expect(await api.getCompare('constructor', 'Kota Malang', false)).toBeNull();
  });

  it('di Vercel tanpa SILK_API_ORIGIN → mode demo, tidak mencoba API lokal', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('SILK_API_ORIGIN', '');
    const api = await load({ VERCEL: '1' });
    expect((await api.getServices()).source).toBe('demo');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
