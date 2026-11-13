import { describe, expect, it } from 'vitest';
import { groupArticleBlocks } from './article';
import { directionsUrl, safeWebsite, telHref, whatsappUrl } from './contact';
import { AVATAR_TONES, avatarTone, doctorInitials } from './doctor';
import { formatDate, formatDuration, formatTime, priceRangeText, priceText } from './format';
import { groupByWeekday } from './schedule';
import { facilityHighlights, summarizeCities } from './summary';

describe('format', () => {
  it('harga: "tanya" tidak pernah jadi angka', () => {
    expect(priceText({ type: 'tanya', min: null, max: null })).toBe('Tanyakan ke faskes');
    expect(priceText({ type: 'tetap', min: 85000, max: null })).toBe('Rp85.000');
    expect(priceRangeText(15000, 45000)).toBe('Rp15.000 – Rp45.000');
    expect(priceRangeText(15000, 15000)).toBe('Rp15.000');
    expect(priceRangeText(null, null)).toBeNull();
  });
  it('tanggal kalender di zona Jakarta, jam, durasi', () => {
    expect(formatDate('2026-10-01')).toBe('1 Oktober 2026');
    expect(formatDate('bukan tanggal')).toBe('–');
    expect(formatTime('08:00:00')).toBe('08.00');
    expect(formatDuration(75)).toBe('1:15');
  });
});

describe('kontak', () => {
  it('telepon, WhatsApp hanya nomor HP, situs hanya http(s)', () => {
    expect(telHref('0341-555 123')).toBe('tel:0341555123');
    expect(whatsappUrl('0812-3456-7890')).toBe('https://wa.me/6281234567890');
    expect(whatsappUrl('0341-555123')).toBeNull();
    expect(safeWebsite('klinik.example')).toBe('https://klinik.example/');
    expect(safeWebsite('javascript:alert(1)')).toBeNull();
    expect(directionsUrl(-7.9, 112.6)).toContain('destination=-7.9,112.6');
  });
});

describe('dokter', () => {
  it('inisial tanpa gelar dan penanda "Contoh"; warna stabil', () => {
    expect(doctorInitials('dr. Contoh Rahma Putri, Sp.A')).toBe('RP');
    expect(doctorInitials('drg. Contoh Dewi Lestari')).toBe('DL');
    expect(avatarTone('dr. A')).toBe(avatarTone('dr. A'));
    expect(AVATAR_TONES).toContain(avatarTone('dr. B'));
  });
});

describe('ringkasan', () => {
  it('rentang harga lintas wilayah', () => {
    const s = summarizeCities([
      { city: 'A', facilityCount: 2, minPrice: 20000, maxPrice: 40000, medianPrice: 30000, latestVerifiedAt: '2026-10-01T00:00:00Z' },
      { city: 'B', facilityCount: 3, minPrice: 15000, maxPrice: null, medianPrice: 15000, latestVerifiedAt: '2026-10-05T00:00:00Z' },
    ]);
    expect(s).toEqual({ minPrice: 15000, maxPrice: 40000, facilityCount: 5, cityCount: 2, latestVerifiedAt: '2026-10-05T00:00:00Z' });
  });
  it('kartu faskes: butir kosong tidak tampil, biaya konsultasi Rp0 tetap tampil', () => {
    expect(facilityHighlights({ publishedTariffCount: 0, consultationFeeMin: null, practitionerCount: 0, hasVideo: false })).toEqual([]);
    expect(facilityHighlights({ publishedTariffCount: 8, consultationFeeMin: 0, practitionerCount: 1, hasVideo: true }).map((h) => h.key)).toEqual([
      'tarif',
      'konsultasi',
      'dokter',
      'video',
    ]);
  });
});

describe('jadwal dan artikel', () => {
  it('jadwal per hari, jam urut', () => {
    expect(groupByWeekday([
      { weekday: 3, start: '13:00', end: '15:00' },
      { weekday: 1, start: '08:00', end: '12:00', note: 'Poli anak' },
      { weekday: 3, start: '08:00', end: '10:00' },
    ])).toEqual([
      { weekday: 1, times: ['08.00–12.00 · Poli anak'] },
      { weekday: 3, times: ['08.00–10.00', '13.00–15.00'] },
    ]);
  });
  it('butir daftar berurutan digabung', () => {
    const b = (key: string, listItem?: 'bullet' | 'number') => ({ _type: 'block' as const, _key: key, style: 'normal' as const, listItem, children: [] });
    expect(groupArticleBlocks([b('a'), b('b', 'bullet'), b('c', 'bullet'), b('d', 'number')]).map((n) => (n.kind === 'list' ? `${n.ordered ? 'ol' : 'ul'}${n.items.length}` : 'p'))).toEqual(['p', 'ul2', 'ol1']);
  });
});
