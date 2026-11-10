import { describe, expect, it } from 'vitest';
import { shortAuthorName, summarizeReviews } from './review';
import { reviewInputSchema } from './schemas/review';

describe('input ulasan (R8)', () => {
  const ok = { rating: 4, aspects: { keramahan_staf: 'baik' }, comment: '  Antrean tertib.  ', declaration: true };

  it('menerima input sah, merapikan komentar, komentar kosong jadi null', () => {
    expect(reviewInputSchema.parse(ok)).toEqual({ rating: 4, aspects: { keramahan_staf: 'baik' }, comment: 'Antrean tertib.', declaration: true });
    expect(reviewInputSchema.parse({ ...ok, comment: '   ' }).comment).toBeNull();
    expect(reviewInputSchema.parse({ rating: 5, declaration: true })).toMatchObject({ aspects: {}, comment: null });
  });

  it('menolak bintang di luar 1–5, aspek tak dikenal, dan tanpa pernyataan', () => {
    expect(reviewInputSchema.safeParse({ ...ok, rating: 0 }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ ...ok, rating: 4.5 }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ ...ok, aspects: { kesembuhan: 'baik' } }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ ...ok, aspects: { waktu_tunggu: 'luar biasa' } }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ ...ok, declaration: false }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ ...ok, comment: 'a'.repeat(1001) }).success).toBe(false);
  });
});

describe('ringkasan ulasan', () => {
  it('kosong: rata-rata null, sebaran nol', () => {
    const s = summarizeReviews([]);
    expect(s).toMatchObject({ count: 0, average: null, distribution: [0, 0, 0, 0, 0], sampleCount: 0 });
    expect(s.aspects.every((a) => a.answered === 0)).toBe(true);
  });

  it('rata-rata satu desimal; aspek yang tidak dijawab tidak dihitung kurang', () => {
    const s = summarizeReviews([
      { rating: 5, aspects: { keramahan_staf: 'baik', waktu_tunggu: 'kurang' }, sample: false },
      { rating: 4, aspects: { keramahan_staf: 'baik' }, sample: true },
      { rating: 4, aspects: {}, sample: false },
    ]);
    expect(s.average).toBe(4.3);
    expect(s.distribution).toEqual([0, 0, 0, 2, 1]);
    expect(s.aspects.find((a) => a.aspect === 'keramahan_staf')).toEqual({ aspect: 'keramahan_staf', good: 2, answered: 2 });
    expect(s.aspects.find((a) => a.aspect === 'waktu_tunggu')).toEqual({ aspect: 'waktu_tunggu', good: 0, answered: 1 });
    expect(s.aspects.find((a) => a.aspect === 'kesesuaian_biaya')?.answered).toBe(0);
    expect(s.sampleCount).toBe(1);
  });
});

describe('nama penulis disingkat', () => {
  it('nama depan + inisial; satu kata tetap; kosong → null', () => {
    expect(shortAuthorName('Rina Susanti Putri')).toBe('Rina S.');
    expect(shortAuthorName('  budi  ')).toBe('budi');
    expect(shortAuthorName('rina susanti')).toBe('rina S.');
    expect(shortAuthorName('')).toBeNull();
    expect(shortAuthorName(null)).toBeNull();
  });
});
