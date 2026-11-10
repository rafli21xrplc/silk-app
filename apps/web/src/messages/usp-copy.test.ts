import { checkContent } from '@silk/shared';
import { describe, expect, it } from 'vitest';
import { RULES, texts } from './copy-test-utils';
import { t } from './id';

/** Teks publik yang membawa USP "Tahu biayanya, kenal dokternya, sebelum datang" (evaluasi USP R2). */
describe('teks publik USP', () => {
  const all = [
    ...texts(t.site, 'site'),
    ...texts(t.footer, 'footer'),
    ...texts(t.home, 'home'),
    ...texts(t.price, 'price'),
    ...texts(t.verification, 'verification'),
    ...texts(t.trustHelp, 'trustHelp'),
    ...texts(t.doctors, 'doctors'),
  ];

  it.each(all)('%s lolos filter konten (M17)', (_path, text) => {
    expect(checkContent({ text }, RULES).violations).toEqual([]);
  });

  it('harga publik diberi label perkiraan beserta penjelasannya', () => {
    expect(t.price.estimate).toBe('Perkiraan');
    expect(t.price.estimateHelp).toMatch(/perkiraan/i);
    expect(t.price.estimateHelp).toMatch(/konfirmasikan/i);
  });

  it('label verifikasi netral untuk semua jenis mitra', () => {
    expect(t.verification.diisi_faskes).toBe('Diisi mitra');
    expect(t.sourceKind.faskes).toBe('Mitra');
  });

  it('deskripsi situs menyebut biaya dan dokter, bukan hanya laboratorium', () => {
    expect(t.site.description).toMatch(/perkiraan biaya/i);
    expect(t.site.description).toMatch(/dokter/i);
    expect(t.home.heroTitle).toMatch(/dokter/i);
  });
});
