import type { CampaignArt } from '@silk/shared';

/**
 * Foto suasana untuk beranda web (banner, ubin, kartu kategori), menggantikan ikon agar terasa nyata.
 *
 * - Semua dari Unsplash dengan Unsplash License (bebas dipakai, termasuk komersial; bukan Unsplash+).
 *   Kredit dicatat di sini dan di public/photos/CREDITS.md.
 * - Hanya benda, ruangan, gedung, atau orang tanpa nama. Foto ini **tidak pernah** mewakili faskes atau
 *   dokter tertentu: profil tetap memakai media yang diunggah mitra dan disetujui moderator.
 * - Berkas: public/photos/<kunci>-sq.jpg (kotak) dan <kunci>-wide.jpg (lebar).
 */
export const PHOTOS = {
  'tabung-darah': { page: 'https://unsplash.com/photos/0jE8ynV4mis', photographer: 'Testalize.me' },
  stetoskop: { page: 'https://unsplash.com/photos/IJ0KiXl4uys', photographer: 'Markus Frieauff' },
  tensimeter: { page: 'https://unsplash.com/photos/i1iqQRLULlg', photographer: 'Mockup Graphics' },
  'kamar-rawat': { page: 'https://unsplash.com/photos/zbpgmGe27p8', photographer: 'Adhy Savala' },
  rontgen: { page: 'https://unsplash.com/photos/tHS9j3HWT1s', photographer: 'Umanoide' },
  'makanan-sehat': { page: 'https://unsplash.com/photos/IGfIGP5ONV0', photographer: 'Anna Pelzer' },
  'gedung-rs': { page: 'https://unsplash.com/photos/1c8sj2IO2I4', photographer: 'National Cancer Institute' },
  'lorong-klinik': { page: 'https://unsplash.com/photos/Pk-KuizxQv8', photographer: 'Tasha Kostyuk' },
  'meja-pendaftaran': { page: 'https://unsplash.com/photos/nMyM7fxpokE', photographer: 'Martha Dominguez de Gouveia' },
  'petugas-lab': { page: 'https://unsplash.com/photos/UJHANmlaHwc', photographer: 'Vitaly Gariev' },
  'analis-lab': { page: 'https://unsplash.com/photos/GcrSgHDrniY', photographer: 'National Cancer Institute' },
  'ruang-gigi': { page: 'https://unsplash.com/photos/yJsMOVwazRU', photographer: 'Kari Bjorn Photography' },
  'rak-obat': { page: 'https://unsplash.com/photos/FLntgQJNjD0', photographer: 'David Trinks' },
  'catatan-medis': { page: 'https://unsplash.com/photos/u2EjDa_hYJI', photographer: 'Abdulai Sayni' },
} as const;
export type PhotoKey = keyof typeof PHOTOS;

export const photoSrc = (key: PhotoKey, size: 'sq' | 'wide') => `/photos/${key}-${size}.jpg`;

/** Ubin "Mau cari apa?" di beranda. */
export const TILE_PHOTOS: Record<string, PhotoKey> = {
  dokter: 'stetoskop',
  rumah_sakit: 'gedung-rs',
  klinik: 'lorong-klinik',
  puskesmas: 'meja-pendaftaran',
  laboratorium: 'petugas-lab',
  apotek: 'rak-obat',
  gaya_hidup: 'makanan-sehat',
  artikel: 'catatan-medis',
};

/** Kategori layanan (slug taksonomi). Kategori tanpa foto memakai ikon. */
const CATEGORY_PHOTOS: Record<string, PhotoKey> = {
  laboratorium: 'tabung-darah',
  konsultasi: 'stetoskop',
  mcu: 'tensimeter',
  'rawat-inap': 'kamar-rawat',
  'radiologi-penunjang': 'rontgen',
  'gaya-hidup-sehat': 'makanan-sehat',
};
export const categoryPhoto = (slug: string): PhotoKey | null => CATEGORY_PHOTOS[slug] ?? null;

/** Banner campaign. */
export const CAMPAIGN_PHOTOS: Record<CampaignArt, PhotoKey> = {
  lab: 'tabung-darah',
  mcu: 'tensimeter',
  doctor: 'stetoskop',
  hospital: 'kamar-rawat',
  guide: 'catatan-medis',
  partner: 'ruang-gigi',
};

/** Foto suasana di hero, di belakang pratinjau profil. */
export const HERO_PHOTO: PhotoKey = 'analis-lab';
