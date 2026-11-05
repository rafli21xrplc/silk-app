import { describe, expect, it } from 'vitest';
import { checkContent, type ContentRule } from './content-filter';

const rules: ContentRule[] = [
  { id: 1, pattern: 'termurah', kind: 'kata', level: 'blokir' },
  { id: 2, pattern: 'terbaik', kind: 'kata', level: 'blokir' },
  { id: 3, pattern: 'pasti sembuh', kind: 'kata', level: 'blokir' },
  { id: 4, pattern: '100% aman', kind: 'kata', level: 'blokir' },
  { id: 5, pattern: 'promo', kind: 'kata', level: 'tinjau' },
  { id: 6, pattern: 'dijamin\\s+\\w+', kind: 'regex', level: 'blokir' },
];

describe('checkContent (M17)', () => {
  it.each([
    ['klinik terbaik di Malang', 'terbaik'],
    ['Harga TERMURAH se-Jawa Timur', 'termurah'],
    ['Pasien  pasti   sembuh', 'pasti sembuh'],
    ['Prosedur 100% aman', '100% aman'],
    ['Hasil dijamin akurat', 'dijamin akurat'],
    ['Térbaik dengan diakritik', 'terbaik'],
  ])('memblokir "%s"', (text, match) => {
    const r = checkContent({ description: text }, rules);
    expect(r.blocked).toBe(true);
    expect(r.violations.map((v) => v.match)).toContain(match);
  });

  it.each([
    'Laboratorium klinik dengan layanan lengkap',
    'Kami berusaha memberikan hasil yang baik',
    'Pemeriksaan darah lengkap tersedia setiap hari',
    'terbaikan bukan kata terlarang', // bukan kata utuh
  ])('meloloskan "%s"', (text) => {
    const r = checkContent({ description: text }, rules);
    expect(r.blocked).toBe(false);
    expect(r.needsReview).toBe(false);
  });

  it('aturan tingkat tinjau mengirim ke moderator, tidak memblokir', () => {
    const r = checkContent({ notes: 'Ada promo bulan ini' }, rules);
    expect(r.blocked).toBe(false);
    expect(r.needsReview).toBe(true);
  });

  it('menyebut bidang yang melanggar', () => {
    const r = checkContent({ name: 'Klinik A', description: 'termurah' }, rules);
    expect(r.violations[0]?.field).toBe('description');
  });
});
