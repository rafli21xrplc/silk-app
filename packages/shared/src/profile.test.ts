import { describe, expect, it } from 'vitest';
import { profileTypeForPartner } from './constants';
import { facilityUpdateSchema, tariffCreateSchema } from './schemas/portal';
import { demoVideoManifestSchema, locationsSchema, mediaPresignSchema, profileCreateSchema, scheduleInputSchema } from './schemas/profile';

const loc = { address: 'Jl. Ijen No. 1', city: 'Kota Malang', province: 'Jawa Timur', lat: -7.97, lng: 112.63, isPrimary: true };

describe('lokasi profil', () => {
  it('tepat satu lokasi utama', () => {
    expect(locationsSchema.safeParse([loc]).success).toBe(true);
    expect(locationsSchema.safeParse([loc, { ...loc, label: 'Cabang' }]).success).toBe(false);
    expect(locationsSchema.safeParse([{ ...loc, isPrimary: false }]).success).toBe(false);
    expect(locationsSchema.safeParse([]).success).toBe(false);
  });
  it('profil baru wajib punya lokasi', () => {
    expect(profileCreateSchema.safeParse({ name: 'Klinik Uji', locations: [] }).success).toBe(false);
    expect(profileCreateSchema.safeParse({ name: 'Klinik Uji', locations: [loc] }).success).toBe(true);
  });
  it('locations tidak boleh dicampur dengan address/lat/lng lama', () => {
    expect(facilityUpdateSchema.safeParse({ locations: [loc], address: 'Jl. Lain 2' }).success).toBe(false);
    expect(facilityUpdateSchema.safeParse({ locations: [loc] }).success).toBe(true);
  });
});

describe('jadwal', () => {
  it('jam lokal HH:MM, selesai setelah mulai, zona default Asia/Jakarta', () => {
    const ok = scheduleInputSchema.parse({ kind: 'praktik', weekday: 1, start: '08:00', end: '12:30' });
    expect(ok.timezone).toBe('Asia/Jakarta');
    expect(scheduleInputSchema.safeParse({ kind: 'praktik', weekday: 1, start: '22:00', end: '02:00' }).success).toBe(false);
    expect(scheduleInputSchema.safeParse({ kind: 'praktik', weekday: 8, start: '08:00', end: '09:00' }).success).toBe(false);
    expect(scheduleInputSchema.safeParse({ kind: 'praktik', weekday: 1, start: '8:00', end: '09:00' }).success).toBe(false);
  });
});

describe('batas media', () => {
  const consent = { method: 'pernyataan_akun', subjectName: 'dr. Contoh Rahma', scopes: ['profil_web'], declaration: true };

  it('foto maks 5 MB; video 20–90 detik dan maks 50 MB (evaluasi USP R5), MIME terbatas', () => {
    const MB = 1024 * 1024;
    expect(mediaPresignSchema.safeParse({ kind: 'foto', fileName: 'a.jpg', mime: 'image/jpeg', sizeBytes: 5 * MB }).success).toBe(true);
    expect(mediaPresignSchema.safeParse({ kind: 'foto', fileName: 'a.jpg', mime: 'image/jpeg', sizeBytes: 5 * MB + 1 }).success).toBe(false);
    expect(mediaPresignSchema.safeParse({ kind: 'foto', fileName: 'a.gif', mime: 'image/gif', sizeBytes: 10 }).success).toBe(false);
    const video = { kind: 'video', fileName: 'v.mp4', mime: 'video/mp4', sizeBytes: 50 * MB, durationSec: 90, consent };
    expect(mediaPresignSchema.safeParse(video).success).toBe(true);
    expect(mediaPresignSchema.safeParse({ ...video, durationSec: 20 }).success).toBe(true);
    expect(mediaPresignSchema.safeParse({ ...video, sizeBytes: 50 * MB + 1 }).success).toBe(false);
    expect(mediaPresignSchema.safeParse({ ...video, durationSec: 91 }).success).toBe(false);
    expect(mediaPresignSchema.safeParse({ ...video, durationSec: 19 }).success).toBe(false);
    expect(mediaPresignSchema.safeParse({ ...video, mime: 'video/quicktime' }).success).toBe(false);
  });

  it('video wajib membawa persetujuan orang yang tampil (evaluasi USP R6)', () => {
    const video = { kind: 'video', fileName: 'v.mp4', mime: 'video/mp4', sizeBytes: 1000, durationSec: 45 };
    expect(mediaPresignSchema.safeParse(video).success).toBe(false);
    expect(mediaPresignSchema.safeParse({ ...video, consent: { ...consent, declaration: false } }).success).toBe(false);
    expect(mediaPresignSchema.safeParse({ ...video, consent: { ...consent, scopes: ['media_sosial'] } }).success).toBe(false);
    expect(mediaPresignSchema.safeParse({ ...video, consent: { ...consent, scopes: ['profil_web', 'profil_web'] } }).success).toBe(false);
    expect(mediaPresignSchema.safeParse({ ...video, consent: { ...consent, scopes: ['profil_web', 'media_sosial'] } }).success).toBe(true);
    expect(mediaPresignSchema.safeParse({ ...video, consent: { ...consent, subjectName: ' ' } }).success).toBe(false);
    // Metode dokumen wajib menyertakan berkas formulir PDF/JPEG/PNG maks. 5 MB.
    const doc = { ...consent, method: 'dokumen' };
    expect(mediaPresignSchema.safeParse({ ...video, consent: doc }).success).toBe(false);
    const form = { fileName: 'persetujuan.pdf', mime: 'application/pdf', sizeBytes: 2000 };
    expect(mediaPresignSchema.safeParse({ ...video, consent: { ...doc, document: form } }).success).toBe(true);
    expect(mediaPresignSchema.safeParse({ ...video, consent: { ...doc, document: { ...form, mime: 'image/gif' } } }).success).toBe(false);
    expect(mediaPresignSchema.safeParse({ ...video, consent: { ...doc, document: { ...form, sizeBytes: 5 * 1024 * 1024 + 1 } } }).success).toBe(false);
  });
});

describe('usulan harga', () => {
  it('sumber wajib', () => {
    const base = { serviceId: '0b9f3c1e-2d4a-4b6c-8e0f-1a2b3c4d5e6f', priceType: 'tetap', priceMin: 50000, effectiveFrom: '2026-12-01' };
    expect(tariffCreateSchema.safeParse(base).success).toBe(false);
    expect(tariffCreateSchema.safeParse({ ...base, sourceTitle: 'Papan tarif klinik' }).success).toBe(true);
  });
});

describe('jenis profil per jenis mitra', () => {
  it('memetakan jenis mitra ke jenis profil', () => {
    expect(profileTypeForPartner({ partnerType: 'tenaga_medis', facilityKind: null })).toBe('praktik_dokter');
    expect(profileTypeForPartner({ partnerType: 'gaya_hidup', facilityKind: null })).toBe('gaya_hidup');
    expect(profileTypeForPartner({ partnerType: 'apotek', facilityKind: null })).toBe('apotek');
    expect(profileTypeForPartner({ partnerType: 'fasilitas', facilityKind: 'rumah_duka' })).toBe('rumah_duka');
  });
});

describe('manifest video demo (USP R7)', () => {
  const item = {
    practitionerSlug: 'dr-contoh-sari-wulandari-sp-og',
    videoFile: 'sari.mp4',
    consentFile: 'sari-persetujuan.pdf',
    subjectName: 'dr. Sari Wulandari',
  };

  it('menerima manifest sah dan mengisi default media sosial', () => {
    const r = demoVideoManifestSchema.parse({ videos: [item] });
    expect(r.videos[0]?.socialMedia).toBe(false);
  });

  it('menolak berkas di luar folder manifest dan video selain MP4', () => {
    expect(demoVideoManifestSchema.safeParse({ videos: [{ ...item, videoFile: '../rahasia.mp4' }] }).success).toBe(false);
    expect(demoVideoManifestSchema.safeParse({ videos: [{ ...item, consentFile: 'a/b.pdf' }] }).success).toBe(false);
    expect(demoVideoManifestSchema.safeParse({ videos: [{ ...item, videoFile: 'sari.webm' }] }).success).toBe(false);
  });

  it('wajib nama orang yang tampil dan satu video per dokter', () => {
    expect(demoVideoManifestSchema.safeParse({ videos: [{ ...item, subjectName: 'dr' }] }).success).toBe(false);
    expect(demoVideoManifestSchema.safeParse({ videos: [item, { ...item, videoFile: 'lain.mp4' }] }).success).toBe(false);
    expect(demoVideoManifestSchema.safeParse({ videos: [] }).success).toBe(false);
  });
});
