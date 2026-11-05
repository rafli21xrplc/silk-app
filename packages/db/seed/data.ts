/**
 * Data seed: taksonomi awal, wilayah Malang, aturan konten, dan data uji FIKTIF.
 * Tidak ada data nyata faskes di sini (bagian 4, "Seed"). ID tetap agar uji dapat merujuknya.
 */
import type { FacilityType, PriceType, VerificationLevel, EntityStatus } from '@silk/shared';

export const REGIONS = [
  { code: '35', slug: 'jawa-timur', name: 'Jawa Timur', type: 'provinsi', parentCode: null },
  { code: '35.73', slug: 'kota-malang', name: 'Kota Malang', type: 'kota', parentCode: '35' },
  { code: '35.07', slug: 'kabupaten-malang', name: 'Kabupaten Malang', type: 'kabupaten', parentCode: '35' },
] as const;

export const CATEGORIES = [
  { slug: 'laboratorium', name: 'Laboratorium' },
  { slug: 'mcu', name: 'Medical Check-Up' },
  // Fase 2 (F-02): kategori baru lewat taksonomi, bukan hardcode di kode.
  { slug: 'gaya-hidup-sehat', name: 'Gaya hidup sehat' },
  { slug: 'rumah-duka', name: 'Rumah duka' },
] as const;

export const SERVICES: {
  slug: string;
  category: (typeof CATEGORIES)[number]['slug'];
  name: string;
  description: string;
  aliases: string[];
}[] = [
  { slug: 'hemoglobin', category: 'laboratorium', name: 'Hemoglobin', description: 'Pemeriksaan kadar hemoglobin darah.', aliases: ['hb', 'cek hb'] },
  { slug: 'darah-lengkap', category: 'laboratorium', name: 'Darah lengkap', description: 'Hitung darah lengkap (hematologi rutin).', aliases: ['dl', 'hematologi lengkap', 'cbc', 'cek darah'] },
  { slug: 'gula-darah-puasa', category: 'laboratorium', name: 'Gula darah puasa', description: 'Kadar glukosa darah setelah puasa 8–10 jam.', aliases: ['gdp', 'glukosa puasa', 'cek gula'] },
  { slug: 'kolesterol-total', category: 'laboratorium', name: 'Kolesterol total', description: 'Kadar kolesterol total dalam darah.', aliases: ['kolesterol', 'cek kolesterol'] },
  { slug: 'asam-urat', category: 'laboratorium', name: 'Asam urat', description: 'Kadar asam urat dalam darah.', aliases: ['uric acid', 'cek asam urat'] },
  { slug: 'urin-lengkap', category: 'laboratorium', name: 'Urin lengkap', description: 'Urinalisis rutin.', aliases: ['urinalisis', 'cek urin'] },
  { slug: 'mcu-dasar', category: 'mcu', name: 'Medical Check-Up Dasar', description: 'Paket pemeriksaan kesehatan dasar.', aliases: ['mcu', 'check up', 'cek kesehatan'] },
  { slug: 'mcu-pra-kerja', category: 'mcu', name: 'Medical Check-Up Pra-kerja', description: 'Pemeriksaan kesehatan untuk syarat kerja.', aliases: ['mcu kerja', 'surat sehat kerja'] },
  { slug: 'konsultasi-gizi', category: 'gaya-hidup-sehat', name: 'Konsultasi gizi', description: 'Konsultasi pola makan dengan ahli gizi.', aliases: ['ahli gizi', 'nutrisionis', 'diet'] },
  { slug: 'sesi-latihan-pribadi', category: 'gaya-hidup-sehat', name: 'Sesi latihan pribadi', description: 'Latihan kebugaran satu lawan satu dengan pelatih.', aliases: ['personal trainer', 'pt', 'latihan fisik'] },
  { slug: 'kelas-senam', category: 'gaya-hidup-sehat', name: 'Kelas senam', description: 'Kelas senam atau olahraga berkelompok.', aliases: ['senam', 'aerobik', 'yoga', 'pilates'] },
  { slug: 'konseling-gaya-hidup', category: 'gaya-hidup-sehat', name: 'Konseling gaya hidup', description: 'Pendampingan kebiasaan sehat (tidur, aktivitas, berhenti merokok).', aliases: ['konseling', 'coaching kesehatan'] },
  { slug: 'pemulasaraan-jenazah', category: 'rumah-duka', name: 'Pemulasaraan jenazah', description: 'Perawatan jenazah sebelum persemayaman atau pemakaman.', aliases: ['memandikan jenazah', 'perawatan jenazah'] },
  { slug: 'sewa-ruang-persemayaman', category: 'rumah-duka', name: 'Sewa ruang persemayaman', description: 'Ruang persemayaman jenazah per hari.', aliases: ['ruang duka', 'persemayaman'] },
  { slug: 'mobil-jenazah', category: 'rumah-duka', name: 'Mobil jenazah', description: 'Layanan antar jenazah.', aliases: ['ambulans jenazah', 'kereta jenazah'] },
];

export const CONTENT_RULES: { pattern: string; kind: 'kata' | 'regex'; level: 'blokir' | 'tinjau' }[] = [
  { pattern: 'termurah', kind: 'kata', level: 'blokir' },
  { pattern: 'terbaik', kind: 'kata', level: 'blokir' },
  { pattern: 'paling murah', kind: 'kata', level: 'blokir' },
  { pattern: 'nomor satu', kind: 'kata', level: 'blokir' },
  { pattern: 'pasti sembuh', kind: 'kata', level: 'blokir' },
  { pattern: 'dijamin sembuh', kind: 'kata', level: 'blokir' },
  { pattern: '100% aman', kind: 'kata', level: 'blokir' },
  { pattern: 'tanpa efek samping', kind: 'kata', level: 'blokir' },
  { pattern: 'promo', kind: 'kata', level: 'tinjau' },
  { pattern: 'diskon', kind: 'kata', level: 'tinjau' },
];

export const SOURCES = [
  { id: '5e000000-0000-4000-8000-000000000001', kind: 'lainnya', title: 'Data uji SILK (fiktif)', url: null },
  { id: '5e000000-0000-4000-8000-000000000002', kind: 'faskes', title: 'Papan tarif faskes', url: null },
] as const;

export const FACILITY_IDS = {
  klinikPratama: 'fa000000-0000-4000-8000-000000000001',
  labMedika: 'fa000000-0000-4000-8000-000000000002',
  klinikKepanjen: 'fa000000-0000-4000-8000-000000000003',
  rsDraft: 'fa000000-0000-4000-8000-000000000004',
  labBelumKlaim: 'fa000000-0000-4000-8000-000000000005',
} as const;

export const FACILITIES: {
  id: string;
  slug: string;
  name: string;
  type: FacilityType;
  description: string;
  address: string;
  regionSlug: 'kota-malang' | 'kabupaten-malang';
  lat: number;
  lng: number;
  phone: string;
  verification: VerificationLevel;
  status: EntityStatus;
}[] = [
  {
    id: FACILITY_IDS.klinikPratama,
    slug: 'klinik-pratama-sehat-contoh',
    name: 'Klinik Pratama Sehat Contoh',
    type: 'klinik',
    description: 'Klinik pratama fiktif untuk data uji. Melayani pemeriksaan umum dan MCU.',
    address: 'Jl. Contoh Raya No. 1, Klojen',
    regionSlug: 'kota-malang',
    lat: -7.9666,
    lng: 112.6326,
    phone: '0341-000001',
    verification: 'diverifikasi_admin',
    status: 'terbit',
  },
  {
    id: FACILITY_IDS.labMedika,
    slug: 'laboratorium-klinik-contoh-medika',
    name: 'Laboratorium Klinik Contoh Medika',
    type: 'laboratorium',
    description: 'Laboratorium klinik fiktif untuk data uji.',
    address: 'Jl. Contoh Ijen No. 22, Klojen',
    regionSlug: 'kota-malang',
    lat: -7.9771,
    lng: 112.6219,
    phone: '0341-000002',
    verification: 'diisi_faskes',
    status: 'terbit',
  },
  {
    id: FACILITY_IDS.klinikKepanjen,
    slug: 'klinik-utama-contoh-kepanjen',
    name: 'Klinik Utama Contoh Kepanjen',
    type: 'klinik',
    description: 'Klinik utama fiktif di Kabupaten Malang untuk data uji.',
    address: 'Jl. Contoh Kepanjen No. 5, Kepanjen',
    regionSlug: 'kabupaten-malang',
    lat: -8.1304,
    lng: 112.5727,
    phone: '0341-000003',
    verification: 'dari_dokumen_publik',
    status: 'terbit',
  },
  {
    id: FACILITY_IDS.rsDraft,
    slug: 'rs-contoh-draf',
    name: 'RS Contoh Draf',
    type: 'rumah_sakit',
    description: 'Faskes berstatus draf; tidak boleh tampil publik.',
    address: 'Jl. Contoh Draf No. 9, Lowokwaru',
    regionSlug: 'kota-malang',
    lat: -7.9431,
    lng: 112.6145,
    phone: '0341-000004',
    verification: 'publik_belum_diverifikasi',
    status: 'draft',
  },
  {
    id: FACILITY_IDS.labBelumKlaim,
    slug: 'laboratorium-contoh-belum-diklaim',
    name: 'Laboratorium Contoh Belum Diklaim',
    type: 'laboratorium',
    description: 'Laboratorium fiktif yang belum diklaim pengelolanya.',
    address: 'Jl. Contoh Soekarno Hatta No. 3, Lowokwaru',
    regionSlug: 'kota-malang',
    lat: -7.9405,
    lng: 112.6206,
    phone: '0341-000005',
    verification: 'publik_belum_diverifikasi',
    status: 'terbit',
  },
];

export const PRACTITIONERS = [
  { id: 'dc000000-0000-4000-8000-000000000001', slug: 'dr-contoh-satu', name: 'dr. Contoh Satu', specialty: 'Dokter umum', strNo: 'STR-UJI-0001', strVerified: true, facilityIds: [FACILITY_IDS.klinikPratama] },
  { id: 'dc000000-0000-4000-8000-000000000002', slug: 'dr-contoh-dua-spm', name: 'dr. Contoh Dua, Sp.PK', specialty: 'Patologi klinik', strNo: 'STR-UJI-0002', strVerified: false, facilityIds: [FACILITY_IDS.labMedika] },
] as const;

export const PACKAGE_IDS = {
  mcuPratama: 'ac000000-0000-4000-8000-000000000001',
  mcuMedika: 'ac000000-0000-4000-8000-000000000002',
  mcuKepanjen: 'ac000000-0000-4000-8000-000000000003',
} as const;

export const PACKAGES = [
  {
    id: PACKAGE_IDS.mcuPratama,
    facilityId: FACILITY_IDS.klinikPratama,
    serviceSlug: 'mcu-dasar',
    name: 'MCU Dasar',
    notes: 'Puasa 10 jam sebelum pemeriksaan.',
    components: [
      ['Pemeriksaan fisik dokter', true],
      ['Hemoglobin', true],
      ['Gula darah puasa', true],
      ['Kolesterol total', true],
      ['Rontgen thorax', false],
    ],
  },
  {
    id: PACKAGE_IDS.mcuMedika,
    facilityId: FACILITY_IDS.labMedika,
    serviceSlug: 'mcu-dasar',
    name: 'Paket MCU Basic',
    notes: null,
    components: [
      ['Hemoglobin', true],
      ['Gula darah puasa', true],
      ['Asam urat', true],
      ['Urin lengkap', true],
    ],
  },
  {
    id: PACKAGE_IDS.mcuKepanjen,
    facilityId: FACILITY_IDS.klinikKepanjen,
    serviceSlug: 'mcu-dasar',
    name: 'MCU Dasar Kepanjen',
    notes: null,
    components: [
      ['Pemeriksaan fisik dokter', true],
      ['Hemoglobin', true],
      ['Kolesterol total', true],
      ['Rontgen thorax', true],
      ['EKG', true],
    ],
  },
] as const;

export const TARIFF_IDS = {
  pratamaMcu: '7a000000-0000-4000-8000-000000000001',
  medikaMcu: '7a000000-0000-4000-8000-000000000002',
  kepanjenMcu: '7a000000-0000-4000-8000-000000000003',
  pratamaHb: '7a000000-0000-4000-8000-000000000004',
  medikaHb: '7a000000-0000-4000-8000-000000000005',
  medikaDarahLengkap: '7a000000-0000-4000-8000-000000000006',
  kepanjenGula: '7a000000-0000-4000-8000-000000000007',
  draftHb: '7a000000-0000-4000-8000-000000000008',
} as const;

export interface SeedTariff {
  id: string;
  facilityId: string;
  serviceSlug: string;
  packageId: string | null;
  status: EntityStatus;
  versions: {
    priceType: PriceType;
    priceMin: number | null;
    priceMax: number | null;
    effectiveFrom: string;
    /** Hari sebelum waktu seed; null = belum diverifikasi. */
    verifiedDaysAgo: number | null;
    verification: VerificationLevel;
    sourceIndex: 0 | 1;
  }[];
}

export const TARIFFS: SeedTariff[] = [
  {
    id: TARIFF_IDS.pratamaMcu,
    facilityId: FACILITY_IDS.klinikPratama,
    serviceSlug: 'mcu-dasar',
    packageId: PACKAGE_IDS.mcuPratama,
    status: 'terbit',
    versions: [
      { priceType: 'paket', priceMin: 325000, priceMax: null, effectiveFrom: '2026-01-01', verifiedDaysAgo: 120, verification: 'diisi_faskes', sourceIndex: 1 },
      { priceType: 'paket', priceMin: 350000, priceMax: null, effectiveFrom: '2026-09-01', verifiedDaysAgo: 20, verification: 'diverifikasi_admin', sourceIndex: 1 },
    ],
  },
  {
    id: TARIFF_IDS.medikaMcu,
    facilityId: FACILITY_IDS.labMedika,
    serviceSlug: 'mcu-dasar',
    packageId: PACKAGE_IDS.mcuMedika,
    status: 'terbit',
    versions: [
      { priceType: 'paket', priceMin: 295000, priceMax: null, effectiveFrom: '2026-03-01', verifiedDaysAgo: 200, verification: 'diisi_faskes', sourceIndex: 1 },
    ],
  },
  {
    id: TARIFF_IDS.kepanjenMcu,
    facilityId: FACILITY_IDS.klinikKepanjen,
    serviceSlug: 'mcu-dasar',
    packageId: PACKAGE_IDS.mcuKepanjen,
    status: 'terbit',
    versions: [
      { priceType: 'paket', priceMin: 450000, priceMax: null, effectiveFrom: '2026-07-01', verifiedDaysAgo: 30, verification: 'dari_dokumen_publik', sourceIndex: 0 },
    ],
  },
  {
    id: TARIFF_IDS.pratamaHb,
    facilityId: FACILITY_IDS.klinikPratama,
    serviceSlug: 'hemoglobin',
    packageId: null,
    status: 'terbit',
    versions: [
      { priceType: 'tetap', priceMin: 35000, priceMax: null, effectiveFrom: '2026-09-01', verifiedDaysAgo: 20, verification: 'diverifikasi_admin', sourceIndex: 1 },
    ],
  },
  {
    id: TARIFF_IDS.medikaHb,
    facilityId: FACILITY_IDS.labMedika,
    serviceSlug: 'hemoglobin',
    packageId: null,
    status: 'terbit',
    versions: [
      { priceType: 'rentang', priceMin: 30000, priceMax: 45000, effectiveFrom: '2026-08-15', verifiedDaysAgo: null, verification: 'diisi_faskes', sourceIndex: 1 },
    ],
  },
  {
    id: TARIFF_IDS.medikaDarahLengkap,
    facilityId: FACILITY_IDS.labMedika,
    serviceSlug: 'darah-lengkap',
    packageId: null,
    status: 'terbit',
    versions: [
      { priceType: 'tanya', priceMin: null, priceMax: null, effectiveFrom: '2026-08-15', verifiedDaysAgo: 10, verification: 'diisi_faskes', sourceIndex: 1 },
    ],
  },
  {
    id: TARIFF_IDS.kepanjenGula,
    facilityId: FACILITY_IDS.klinikKepanjen,
    serviceSlug: 'gula-darah-puasa',
    packageId: null,
    status: 'terbit',
    versions: [
      { priceType: 'mulai_dari', priceMin: 25000, priceMax: null, effectiveFrom: '2026-07-01', verifiedDaysAgo: 30, verification: 'dari_dokumen_publik', sourceIndex: 0 },
    ],
  },
  {
    id: TARIFF_IDS.draftHb,
    facilityId: FACILITY_IDS.rsDraft,
    serviceSlug: 'hemoglobin',
    packageId: null,
    status: 'terbit',
    versions: [
      { priceType: 'tetap', priceMin: 40000, priceMax: null, effectiveFrom: '2026-01-01', verifiedDaysAgo: 5, verification: 'publik_belum_diverifikasi', sourceIndex: 0 },
    ],
  },
];
