import { describe, expect, it } from 'vitest';
import { pickConsultation } from './consultation';

const tariff = (name: string, categorySlug: string, type: 'tetap' | 'tanya' = 'tetap') => ({
  service: { name, categorySlug },
  price: { type },
});

describe('pickConsultation (evaluasi USP R3)', () => {
  it('hanya mengambil tarif kategori konsultasi', () => {
    expect(pickConsultation([tariff('Gula darah puasa', 'laboratorium'), tariff('Kolesterol total', 'laboratorium')])).toBeNull();
    expect(pickConsultation([tariff('Gula darah puasa', 'laboratorium'), tariff('Konsultasi dokter umum', 'konsultasi')])?.service.name).toBe(
      'Konsultasi dokter umum',
    );
  });

  it('tarif berangka didahulukan atas "tanya", lalu nama layanan', () => {
    const picked = pickConsultation([
      tariff('Konsultasi dokter gigi', 'konsultasi', 'tanya'),
      tariff('Konsultasi dokter spesialis', 'konsultasi'),
      tariff('Konsultasi dokter umum', 'konsultasi'),
    ]);
    expect(picked?.service.name).toBe('Konsultasi dokter spesialis');
  });

  it('tetap mengembalikan tarif "tanya" bila hanya itu yang ada', () => {
    expect(pickConsultation([tariff('Konsultasi dokter umum', 'konsultasi', 'tanya')])?.price.type).toBe('tanya');
  });

  it('tidak mengubah urutan larik masukan', () => {
    const input = [tariff('B', 'konsultasi'), tariff('A', 'konsultasi')];
    pickConsultation(input);
    expect(input.map((t) => t.service.name)).toEqual(['B', 'A']);
  });
});
