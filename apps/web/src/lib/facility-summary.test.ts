import { describe, expect, it } from 'vitest';
import { facilityHighlights } from './facility-summary';

const base = { publishedTariffCount: 0, consultationFeeMin: null, practitionerCount: 0, hasVideo: false };

describe('facilityHighlights (ringkasan kartu /cari)', () => {
  it('profil lengkap: biaya dulu, lalu dokter dan video', () => {
    const h = facilityHighlights({ publishedTariffCount: 18, consultationFeeMin: 85000, practitionerCount: 3, hasVideo: true });
    expect(h.map((x) => x.key)).toEqual(['tarif', 'konsultasi', 'dokter', 'video']);
    expect(h[0]!.label).toBe('18 tarif tercantum');
    expect(h[1]!.label).toMatch(/^Konsultasi mulai Rp\s?85\.000$/);
    expect(h[2]!.label).toBe('3 dokter');
  });

  it('butir kosong tidak ditampilkan', () => {
    expect(facilityHighlights(base)).toEqual([]);
    expect(facilityHighlights({ ...base, practitionerCount: 2 }).map((x) => x.key)).toEqual(['dokter']);
  });

  it('biaya konsultasi Rp0 tetap ditampilkan (gratis tetap informasi)', () => {
    expect(facilityHighlights({ ...base, consultationFeeMin: 0 }).map((x) => x.key)).toEqual(['konsultasi']);
  });

  it('respons lama tanpa kolom ringkasan (cache ISR) tidak menghasilkan "RpNaN"', () => {
    const stale = { publishedTariffCount: 8 } as unknown as Parameters<typeof facilityHighlights>[0];
    expect(facilityHighlights(stale).map((x) => x.key)).toEqual(['tarif']);
  });
});
