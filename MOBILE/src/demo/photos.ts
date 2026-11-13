/**
 * Foto ilustrasi untuk data demo SILK Mobile (dokter dan faskes "Contoh" yang fiktif).
 *
 * - Semua foto dari Unsplash dengan Unsplash License (bebas dipakai, termasuk komersial; bukan Unsplash+).
 *   Kredit tetap dicatat di sini dan di public/demo/photos/CREDITS.md.
 * - Hanya dipakai bila API tidak mengirim foto, dan hanya untuk slug data demo di bawah. Data sungguhan
 *   (slug lain) tidak pernah mendapat foto ilustrasi; fotonya harus dari media yang disetujui.
 * - Di layar selalu diberi keterangan "Foto ilustrasi".
 * - Berkas diunduh oleh `pnpm --filter @silk/mobile photos` (scripts/photos.ts) ke public/demo/photos.
 */

export interface PhotoSource {
  /** ID gambar di images.unsplash.com. */
  unsplash: string;
  /** Halaman foto (untuk kredit dan pemeriksaan lisensi). */
  page: string;
  photographer: string;
  alt: string;
  /** portrait = wajah dokter, place = tempat, category = ubin kategori (benda, tanpa wajah). */
  kind: 'portrait' | 'place' | 'category';
}

export const PHOTOS = {
  'dr-arif': {
    unsplash: 'photo-1612523138351-4643808db8f3',
    page: 'https://unsplash.com/photos/dDPnX86E0Uc',
    photographer: 'Usman Yousaf',
    alt: 'Potret dokter pria berkacamata dengan stetoskop',
    kind: 'portrait',
  },
  'dr-bima': {
    unsplash: 'photo-1622902046580-2b47f47f5471',
    page: 'https://unsplash.com/photos/ZCztndOWdjs',
    photographer: 'Dalton Ngangi',
    alt: 'Potret dokter pria muda berjas putih',
    kind: 'portrait',
  },
  'dr-dua': {
    unsplash: 'photo-1758691462651-611d730c5272',
    page: 'https://unsplash.com/photos/_zbqco3m7dA',
    photographer: 'Vitaly Gariev',
    alt: 'Potret dokter perempuan berkacamata di meja praktik',
    kind: 'portrait',
  },
  'dr-rahma': {
    unsplash: 'photo-1652946619040-1388aa7e819f',
    page: 'https://unsplash.com/photos/J6kMThsc41M',
    photographer: 'Mufid Majnun',
    alt: 'Potret dokter perempuan berhijab putih',
    kind: 'portrait',
  },
  'dr-sari': {
    unsplash: 'photo-1659353888906-adb3e0041693',
    page: 'https://unsplash.com/photos/H9lg5Noj660',
    photographer: 'Fotos',
    alt: 'Potret dokter perempuan berjas putih dengan stetoskop',
    kind: 'portrait',
  },
  'dr-satu': {
    unsplash: 'photo-1758691463582-11aea602cd4a',
    page: 'https://unsplash.com/photos/XqMo4OlBnh0',
    photographer: 'Vitaly Gariev',
    alt: 'Potret dokter pria berkacamata, tangan bersilang',
    kind: 'portrait',
  },
  'drg-dewi': {
    unsplash: 'photo-1758600587683-d86675a2f6e9',
    page: 'https://unsplash.com/photos/5V6takmtNUM',
    photographer: 'Vitaly Gariev',
    alt: 'Potret dokter gigi perempuan tersenyum',
    kind: 'portrait',
  },
  'rs-1': {
    unsplash: 'photo-1586773860418-d37222d8fce3',
    page: 'https://unsplash.com/photos/1c8sj2IO2I4',
    photographer: 'National Cancer Institute',
    alt: 'Gedung rumah sakit bata dengan pintu masuk beratap',
    kind: 'place',
  },
  'rs-2': {
    unsplash: 'photo-1626315869436-d6781ba69d6e',
    page: 'https://unsplash.com/photos/8PB_TFEy2XQ',
    photographer: 'Acton Crawford',
    alt: 'Gedung rumah sakit bertingkat dengan taman di depannya',
    kind: 'place',
  },
  'rs-3': {
    unsplash: 'photo-1586773860383-dab5f3bc1bcc',
    page: 'https://unsplash.com/photos/cP6Z_VKMCuo',
    photographer: 'National Cancer Institute',
    alt: 'Kompleks rumah sakit dilihat dari atas',
    kind: 'place',
  },
  'klinik-1': {
    unsplash: 'photo-1519494026892-80bbd2d6fd0d',
    page: 'https://unsplash.com/photos/nMyM7fxpokE',
    photographer: 'Martha Dominguez de Gouveia',
    alt: 'Meja pendaftaran klinik',
    kind: 'place',
  },
  'klinik-2': {
    unsplash: 'photo-1771574204208-b47e2d863bc5',
    page: 'https://unsplash.com/photos/2d3cHa8RMSY',
    photographer: 'Adhitya Sibikumar',
    alt: 'Kursi ruang tunggu di dekat jendela',
    kind: 'place',
  },
  'klinik-3': {
    unsplash: 'photo-1762625570087-6d98fca29531',
    page: 'https://unsplash.com/photos/pxOQ-P97sA8',
    photographer: 'Amy Vosters',
    alt: 'Ruang tunggu klinik yang terang',
    kind: 'place',
  },
  'klinik-4': {
    unsplash: 'photo-1777269749032-d8d458ae594d',
    page: 'https://unsplash.com/photos/Pk-KuizxQv8',
    photographer: 'Tasha Kostyuk',
    alt: 'Lorong klinik dengan bangku tunggu',
    kind: 'place',
  },
  'klinik-5': {
    unsplash: 'photo-1479839672679-a46483c0e7c8',
    page: 'https://unsplash.com/photos/RFDP7_80v5A',
    photographer: 'Joel Filipe',
    alt: 'Gedung putih modern',
    kind: 'place',
  },
  'ruang-1': {
    unsplash: 'photo-1538108149393-fbbd81895907',
    page: 'https://unsplash.com/photos/zbpgmGe27p8',
    photographer: 'Adhy Savala',
    alt: 'Ruang perawatan dengan tempat tidur pasien',
    kind: 'place',
  },
  'ruang-2': {
    unsplash: 'photo-1576085898384-b3cdb88736e9',
    page: 'https://unsplash.com/photos/S5meg_j_W1U',
    photographer: 'charlesdeluvio',
    alt: 'Ruang periksa dengan ranjang periksa dan jendela',
    kind: 'place',
  },
  'ruang-3': {
    unsplash: 'photo-1512678080530-7760d81faba6',
    page: 'https://unsplash.com/photos/KF-h9HMxRKg',
    photographer: 'Martha Dominguez de Gouveia',
    alt: 'Ruang rawat dengan ranjang dan sofa',
    kind: 'place',
  },
  gigi: {
    unsplash: 'photo-1704455306925-1401c3012117',
    page: 'https://unsplash.com/photos/yJsMOVwazRU',
    photographer: 'Kari Bjorn Photography',
    alt: 'Ruang praktik dokter gigi',
    kind: 'place',
  },
  'lab-1': {
    unsplash: 'photo-1606206591513-adbfbdd7a177',
    page: 'https://unsplash.com/photos/0jE8ynV4mis',
    photographer: 'Testalize.me',
    alt: 'Deretan tabung sampel darah di laboratorium',
    kind: 'place',
  },
  'lab-2': {
    unsplash: 'photo-1518152006812-edab29b069ac',
    page: 'https://unsplash.com/photos/gKUC4TMhOiY',
    photographer: 'Ousa Chea',
    alt: 'Mikroskop di meja laboratorium',
    kind: 'place',
  },
  'lab-3': {
    unsplash: 'photo-1578496480240-32d3e0c04525',
    page: 'https://unsplash.com/photos/GcrSgHDrniY',
    photographer: 'National Cancer Institute',
    alt: 'Petugas laboratorium memeriksa tabung sampel',
    kind: 'place',
  },
  'lab-4': {
    unsplash: 'photo-1532187863486-abf9dbad1b69',
    page: 'https://unsplash.com/photos/pwcKF7L4-no',
    photographer: 'Louis Reed',
    alt: 'Pipet mengisi tabung sampel',
    kind: 'place',
  },
  'lab-5': {
    unsplash: 'photo-1630959305790-4c956ce6c0b6',
    page: 'https://unsplash.com/photos/JxoWb7wHqnA',
    photographer: 'National Cancer Institute',
    alt: 'Petugas laboratorium melihat melalui mikroskop',
    kind: 'place',
  },
  'lab-6': {
    unsplash: 'photo-1758685848543-5c8ba81bc822',
    page: 'https://unsplash.com/photos/UJHANmlaHwc',
    photographer: 'Vitaly Gariev',
    alt: 'Tabung sampel di tangan petugas laboratorium',
    kind: 'place',
  },
  // Ubin kategori layanan: benda atau ruangan, tanpa wajah. Berlaku untuk semua data (bukan ilustrasi
  // dokter atau faskes tertentu), jadi tanpa label "Foto ilustrasi".
  'kat-lab': {
    unsplash: 'photo-1606206591513-adbfbdd7a177',
    page: 'https://unsplash.com/photos/0jE8ynV4mis',
    photographer: 'Testalize.me',
    alt: '',
    kind: 'category',
  },
  'kat-konsultasi': {
    unsplash: 'photo-1584982751601-97dcc096659c',
    page: 'https://unsplash.com/photos/IJ0KiXl4uys',
    photographer: 'Markus Frieauff',
    alt: '',
    kind: 'category',
  },
  'kat-mcu': {
    unsplash: 'photo-1615486511484-92e172cc4fe0',
    page: 'https://unsplash.com/photos/i1iqQRLULlg',
    photographer: 'Mockup Graphics',
    alt: '',
    kind: 'category',
  },
  'kat-rawat-inap': {
    unsplash: 'photo-1538108149393-fbbd81895907',
    page: 'https://unsplash.com/photos/zbpgmGe27p8',
    photographer: 'Adhy Savala',
    alt: '',
    kind: 'category',
  },
  'kat-radiologi': {
    unsplash: 'photo-1616012480717-fd9867059ca0',
    page: 'https://unsplash.com/photos/tHS9j3HWT1s',
    photographer: 'Umanoide',
    alt: '',
    kind: 'category',
  },
  'kat-gaya-hidup': {
    unsplash: 'photo-1512621776951-a57141f2eefd',
    page: 'https://unsplash.com/photos/IGfIGP5ONV0',
    photographer: 'Anna Pelzer',
    alt: '',
    kind: 'category',
  },
} as const satisfies Record<string, PhotoSource>;

export type PhotoKey = keyof typeof PHOTOS;

/** Dokter demo → potret. */
export const DOCTOR_PHOTOS: Record<string, PhotoKey> = {
  'dr-contoh-arif-nugroho-sp-pd': 'dr-arif',
  'dr-contoh-bima-pratama': 'dr-bima',
  'dr-contoh-dua-spm': 'dr-dua',
  'dr-contoh-rahma-putri-sp-a': 'dr-rahma',
  'dr-contoh-sari-wulandari-sp-og': 'dr-sari',
  'dr-contoh-satu': 'dr-satu',
  'drg-contoh-dewi-lestari': 'drg-dewi',
};

/** Faskes demo → foto tempat (tanpa orang yang bisa dikira dokternya). */
export const FACILITY_PHOTOS: Record<string, PhotoKey> = {
  'rs-contoh-kepanjen': 'rs-1',
  'rs-contoh-lowokwaru': 'rs-2',
  'rs-contoh-sukun': 'rs-3',
  'klinik-contoh-bunulrejo': 'klinik-2',
  'klinik-contoh-karangploso': 'klinik-3',
  'klinik-contoh-pakis': 'klinik-5',
  'klinik-contoh-sawojajar': 'klinik-1',
  'klinik-contoh-singosari': 'klinik-4',
  'klinik-contoh-tlogomas': 'ruang-3',
  'klinik-pratama-sehat-contoh': 'klinik-3',
  'klinik-utama-contoh-kepanjen': 'klinik-5',
  'laboratorium-contoh-belum-diklaim': 'lab-1',
  'laboratorium-contoh-bululawang': 'lab-2',
  'laboratorium-contoh-buring': 'lab-3',
  'laboratorium-contoh-dinoyo': 'lab-4',
  'laboratorium-contoh-kayutangan': 'lab-5',
  'laboratorium-contoh-lawang': 'lab-6',
  'laboratorium-klinik-contoh-medika': 'lab-3',
  'praktik-dokter-contoh-arjosari': 'ruang-2',
  'praktik-dokter-contoh-dau': 'ruang-3',
  'praktik-dr-contoh-arif-nugroho-sp-pd': 'ruang-1',
  'praktik-dr-contoh-rahma-putri-sp-a': 'klinik-3',
  'praktik-dr-contoh-sari-wulandari-sp-og': 'ruang-2',
  'praktik-drg-contoh-dewi-lestari': 'gigi',
  'puskesmas-contoh-blimbing': 'klinik-4',
  'puskesmas-contoh-mulyorejo': 'klinik-2',
  'puskesmas-contoh-tumpang': 'ruang-1',
  'puskesmas-contoh-turen': 'klinik-1',
};

/** Ukuran berkas yang diunduh (lebar × tinggi). Potret dipotong di wajah. */
export const PHOTO_SIZES = {
  portrait: { sq: [320, 320], wide: [960, 720] },
  place: { sq: [160, 160], wide: [960, 540] },
  category: { sq: [240, 240], wide: [640, 400] },
} as const;

export interface DemoPhoto {
  /** Gambar persegi kecil (avatar, gambar mini di daftar). */
  square: string;
  /** Gambar lebar (header profil). */
  wide: string;
  alt: string;
  credit: string;
}

const toPhoto = (key: PhotoKey): DemoPhoto => ({
  square: `/demo/photos/${key}-sq.jpg`,
  wide: `/demo/photos/${key}-wide.jpg`,
  alt: PHOTOS[key].alt,
  credit: `${PHOTOS[key].photographer} / Unsplash`,
});

export function demoDoctorPhoto(slug: string): DemoPhoto | null {
  const key = DOCTOR_PHOTOS[slug];
  return key ? toPhoto(key) : null;
}

export function demoFacilityPhoto(slug: string): DemoPhoto | null {
  const key = FACILITY_PHOTOS[slug];
  return key ? toPhoto(key) : null;
}

/** Kategori layanan → foto ubin (benda, tanpa wajah). Rumah duka sengaja tanpa foto. */
export const CATEGORY_PHOTOS: Record<string, PhotoKey> = {
  laboratorium: 'kat-lab',
  konsultasi: 'kat-konsultasi',
  mcu: 'kat-mcu',
  'rawat-inap': 'kat-rawat-inap',
  'radiologi-penunjang': 'kat-radiologi',
  'gaya-hidup-sehat': 'kat-gaya-hidup',
};

export function categoryPhoto(slug: string): { square: string; wide: string } | null {
  const key = CATEGORY_PHOTOS[slug];
  return key ? { square: `/demo/photos/${key}-sq.jpg`, wide: `/demo/photos/${key}-wide.jpg` } : null;
}
