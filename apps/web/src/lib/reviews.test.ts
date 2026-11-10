import { describe, expect, it } from 'vitest';
import { aspectRows, emptyReviewDraft, reviewBodyFromDraft, toggleAspect } from './reviews';

describe('formulir ulasan (R8)', () => {
  it('wajib bintang dan pernyataan', () => {
    expect(reviewBodyFromDraft(emptyReviewDraft())).toEqual({ problem: 'pickRating' });
    expect(reviewBodyFromDraft({ ...emptyReviewDraft(), rating: 4 })).toEqual({ problem: 'needDeclaration' });
  });

  it('komentar dirapikan; kosong jadi null', () => {
    const r = reviewBodyFromDraft({ rating: 5, aspects: { keramahan_staf: 'baik' }, comment: '  Ramah.  ', declaration: true });
    expect(r).toEqual({ body: { rating: 5, aspects: { keramahan_staf: 'baik' }, comment: 'Ramah.', declaration: true } });
    expect(reviewBodyFromDraft({ rating: 3, aspects: {}, comment: '   ', declaration: true })).toMatchObject({ body: { comment: null } });
  });

  it('memilih nilai aspek yang sama lagi menghapus jawabannya', () => {
    const a = toggleAspect(emptyReviewDraft(), 'waktu_tunggu', 'kurang');
    expect(a.aspects).toEqual({ waktu_tunggu: 'kurang' });
    expect(toggleAspect(a, 'waktu_tunggu', 'baik').aspects).toEqual({ waktu_tunggu: 'baik' });
    expect(toggleAspect(a, 'waktu_tunggu', 'kurang').aspects).toEqual({});
  });
});

describe('ringkasan per aspek', () => {
  it('urutan tetap, persen dibulatkan, null bila belum dijawab', () => {
    const rows = aspectRows({
      count: 3,
      average: 4.3,
      distribution: [0, 0, 0, 2, 1],
      aspects: [{ aspect: 'keramahan_staf', good: 2, answered: 3 }],
      sampleCount: 0,
    });
    expect(rows.map((r) => r.aspect)).toEqual(['kenyamanan_tempat', 'keramahan_staf', 'kejelasan_penjelasan', 'waktu_tunggu', 'kesesuaian_biaya']);
    expect(rows[1]).toEqual({ aspect: 'keramahan_staf', good: 2, answered: 3, percent: 67 });
    expect(rows[0]!.percent).toBeNull();
  });
});
