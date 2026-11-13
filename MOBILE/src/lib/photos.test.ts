import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import raw from '../demo/snapshot.json';
import { DOCTOR_PHOTOS, FACILITY_PHOTOS, PHOTOS } from '../demo/photos';
import { doctorPhoto, facilityPhoto } from './photos';

const snap = raw as { facilities: { slug: string }[]; practitioners: { slug: string }[] };
const PUBLIC = path.resolve(__dirname, '../../public');

describe('foto ilustrasi data demo', () => {
  it('setiap dokter dan faskes demo punya foto, dan berkasnya ada', () => {
    for (const d of snap.practitioners) expect(DOCTOR_PHOTOS[d.slug], d.slug).toBeDefined();
    for (const f of snap.facilities) expect(FACILITY_PHOTOS[f.slug], f.slug).toBeDefined();
    for (const key of Object.keys(PHOTOS)) {
      for (const v of ['sq', 'wide']) expect(fs.existsSync(path.join(PUBLIC, `demo/photos/${key}-${v}.jpg`)), `${key}-${v}`).toBe(true);
    }
  });

  it('setiap foto bersumber Unsplash gratis (bukan Unsplash+) dan punya kredit', () => {
    for (const p of Object.values(PHOTOS)) {
      expect(p.unsplash).toMatch(/^photo-/);
      expect(p.page).toMatch(/^https:\/\/unsplash\.com\/photos\//);
      expect(p.photographer.length).toBeGreaterThan(1);
    }
  });

  it('satu wajah = satu dokter (potret tidak dipakai ulang)', () => {
    const used = Object.values(DOCTOR_PHOTOS);
    expect(new Set(used).size).toBe(used.length);
    for (const k of used) expect(PHOTOS[k].kind).toBe('portrait');
    for (const k of Object.values(FACILITY_PHOTOS)) expect(PHOTOS[k].kind).toBe('place');
  });

  it('foto dari API didahulukan; data sungguhan tidak pernah mendapat ilustrasi', () => {
    expect(doctorPhoto('dr-contoh-rahma-putri-sp-a', 'https://r2.example/x.jpg', 'dr. X')).toMatchObject({
      square: 'https://r2.example/x.jpg',
      illustrative: false,
    });
    expect(doctorPhoto('dr-contoh-rahma-putri-sp-a', null, 'dr. X')).toMatchObject({
      illustrative: true,
      square: '/demo/photos/dr-rahma-sq.jpg',
    });
    expect(doctorPhoto('dr-budi-santoso', null, 'dr. Budi')).toBeNull();
    expect(facilityPhoto('rs-sungguhan')).toBeNull();
    expect(facilityPhoto('rs-contoh-kepanjen', [{ kind: 'foto', url: 'https://r2.example/rs.jpg', mime: 'image/jpeg', caption: 'Lobi' }])).toMatchObject({
      illustrative: false,
      alt: 'Lobi',
    });
  });
});
