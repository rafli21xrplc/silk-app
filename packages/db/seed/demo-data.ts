/**
 * Data DEMO FIKTIF untuk pengembangan lokal: faskes dan tarif tambahan agar halaman publik
 * (cari, layanan, bandingkan, peta) tidak kosong. Bukan data nyata; semua nama faskes memakai "Contoh".
 *
 * Deterministik: dibangun dari PRNG berbenih dan tanggal absolut, jadi ID, harga, dan tanggal
 * sama di setiap run. Dipakai oleh `pnpm db:seed:demo` (lihat demo.ts); tidak dipakai uji API.
 */
import type { EntityStatus, FacilityType, PriceType, VerificationLevel } from '@silk/shared';

export const DEMO_CATEGORIES = [{ slug: 'radiologi-penunjang', name: 'Radiologi & penunjang' }] as const;

export interface DemoService {
  slug: string;
  category: 'laboratorium' | 'mcu' | 'radiologi-penunjang';
  name: string;
  description: string;
  aliases: string[];
}

export const DEMO_SERVICES: DemoService[] = [
  { slug: 'trigliserida', category: 'laboratorium', name: 'Trigliserida', description: 'Kadar trigliserida (lemak darah).', aliases: ['tg', 'cek trigliserida'] },
  { slug: 'kolesterol-hdl', category: 'laboratorium', name: 'Kolesterol HDL', description: 'Kadar kolesterol HDL dalam darah.', aliases: ['hdl'] },
  { slug: 'kolesterol-ldl', category: 'laboratorium', name: 'Kolesterol LDL', description: 'Kadar kolesterol LDL dalam darah.', aliases: ['ldl'] },
  { slug: 'fungsi-hati', category: 'laboratorium', name: 'Fungsi hati (SGOT/SGPT)', description: 'Enzim hati SGOT dan SGPT.', aliases: ['sgot', 'sgpt', 'cek fungsi hati'] },
  { slug: 'fungsi-ginjal', category: 'laboratorium', name: 'Fungsi ginjal (ureum/kreatinin)', description: 'Kadar ureum dan kreatinin darah.', aliases: ['ureum', 'kreatinin', 'cek fungsi ginjal'] },
  { slug: 'hba1c', category: 'laboratorium', name: 'HbA1c', description: 'Gambaran rata-rata gula darah 2–3 bulan terakhir.', aliases: ['a1c', 'gula darah 3 bulan'] },
  { slug: 'hbsag', category: 'laboratorium', name: 'HBsAg', description: 'Skrining antigen hepatitis B.', aliases: ['hepatitis b', 'cek hepatitis'] },
  { slug: 'rontgen-thorax', category: 'radiologi-penunjang', name: 'Rontgen thorax', description: 'Foto rontgen dada.', aliases: ['foto thorax', 'rontgen dada', 'x-ray dada'] },
  { slug: 'usg-abdomen', category: 'radiologi-penunjang', name: 'USG abdomen', description: 'Ultrasonografi organ perut.', aliases: ['usg perut'] },
  { slug: 'ekg', category: 'radiologi-penunjang', name: 'EKG', description: 'Rekam listrik jantung (elektrokardiografi).', aliases: ['rekam jantung', 'ecg'] },
];

/** Harga dasar (rupiah) sebelum faktor per faskes. Angka fiktif berskala wajar. */
const BASE_PRICE: Record<string, number> = {
  hemoglobin: 30_000,
  'darah-lengkap': 90_000,
  'gula-darah-puasa': 25_000,
  'kolesterol-total': 40_000,
  'asam-urat': 35_000,
  'urin-lengkap': 45_000,
  trigliserida: 45_000,
  'kolesterol-hdl': 50_000,
  'kolesterol-ldl': 55_000,
  'fungsi-hati': 80_000,
  'fungsi-ginjal': 85_000,
  hba1c: 150_000,
  hbsag: 90_000,
  'rontgen-thorax': 150_000,
  'usg-abdomen': 300_000,
  ekg: 100_000,
  'mcu-dasar': 350_000,
  'mcu-pra-kerja': 250_000,
  'konsultasi-gizi': 150_000,
  'sesi-latihan-pribadi': 200_000,
  'kelas-senam': 50_000,
  'konseling-gaya-hidup': 175_000,
  'pemulasaraan-jenazah': 1_500_000,
  'sewa-ruang-persemayaman': 750_000,
  'mobil-jenazah': 600_000,
};

const LAB = ['hemoglobin', 'darah-lengkap', 'gula-darah-puasa', 'kolesterol-total', 'asam-urat', 'urin-lengkap', 'trigliserida', 'kolesterol-hdl', 'kolesterol-ldl', 'fungsi-hati', 'fungsi-ginjal', 'hba1c', 'hbsag'];

/** Layanan yang wajar ditawarkan tiap jenis faskes. */
const MENU: Record<FacilityType, string[]> = {
  laboratorium: [...LAB, 'ekg', 'mcu-dasar', 'mcu-pra-kerja'],
  rumah_sakit: [...LAB, 'rontgen-thorax', 'usg-abdomen', 'ekg', 'mcu-dasar', 'mcu-pra-kerja'],
  klinik: ['hemoglobin', 'darah-lengkap', 'gula-darah-puasa', 'kolesterol-total', 'asam-urat', 'urin-lengkap', 'ekg', 'mcu-dasar', 'mcu-pra-kerja'],
  puskesmas: ['hemoglobin', 'gula-darah-puasa', 'kolesterol-total', 'asam-urat', 'urin-lengkap', 'hbsag', 'mcu-pra-kerja'],
  praktik_dokter: ['gula-darah-puasa', 'kolesterol-total', 'asam-urat', 'ekg'],
  apotek: ['gula-darah-puasa', 'kolesterol-total', 'asam-urat'],
  gaya_hidup: ['konsultasi-gizi', 'sesi-latihan-pribadi', 'kelas-senam', 'konseling-gaya-hidup'],
  rumah_duka: ['pemulasaraan-jenazah', 'sewa-ruang-persemayaman', 'mobil-jenazah'],
};

/** Rentang faktor harga per jenis faskes (puskesmas lebih rendah, RS lebih tinggi). */
const PRICE_FACTOR: Record<FacilityType, [number, number]> = {
  puskesmas: [0.45, 0.65],
  praktik_dokter: [0.9, 1.1],
  apotek: [0.85, 1.0],
  laboratorium: [0.85, 1.15],
  klinik: [0.9, 1.2],
  rumah_sakit: [1.1, 1.4],
  gaya_hidup: [0.8, 1.3],
  rumah_duka: [0.8, 1.3],
};

const PACKAGE_COMPONENTS: Record<string, string[]> = {
  'mcu-dasar': ['Pemeriksaan fisik dokter', 'Darah lengkap', 'Urin lengkap', 'Gula darah puasa', 'Kolesterol total', 'Rontgen thorax', 'EKG'],
  'mcu-pra-kerja': ['Pemeriksaan fisik dokter', 'Tes buta warna', 'Darah lengkap', 'Urin lengkap', 'Surat keterangan sehat'],
};

const HOURS: Record<FacilityType, Record<string, string>> = {
  puskesmas: { senin: '07.30–14.00', selasa: '07.30–14.00', rabu: '07.30–14.00', kamis: '07.30–14.00', jumat: '07.30–11.00', sabtu: '07.30–12.30' },
  laboratorium: { senin: '06.00–21.00', selasa: '06.00–21.00', rabu: '06.00–21.00', kamis: '06.00–21.00', jumat: '06.00–21.00', sabtu: '06.00–21.00', minggu: '07.00–12.00' },
  rumah_sakit: { senin: '24 jam', selasa: '24 jam', rabu: '24 jam', kamis: '24 jam', jumat: '24 jam', sabtu: '24 jam', minggu: '24 jam' },
  klinik: { senin: '08.00–21.00', selasa: '08.00–21.00', rabu: '08.00–21.00', kamis: '08.00–21.00', jumat: '08.00–21.00', sabtu: '08.00–17.00' },
  praktik_dokter: { senin: '17.00–21.00', selasa: '17.00–21.00', rabu: '17.00–21.00', kamis: '17.00–21.00', jumat: '17.00–21.00' },
  apotek: { senin: '08.00–22.00', selasa: '08.00–22.00', rabu: '08.00–22.00', kamis: '08.00–22.00', jumat: '08.00–22.00', sabtu: '08.00–22.00', minggu: '08.00–22.00' },
  gaya_hidup: { senin: '06.00–20.00', selasa: '06.00–20.00', rabu: '06.00–20.00', kamis: '06.00–20.00', jumat: '06.00–20.00', sabtu: '06.00–12.00' },
  rumah_duka: { senin: '24 jam', selasa: '24 jam', rabu: '24 jam', kamis: '24 jam', jumat: '24 jam', sabtu: '24 jam', minggu: '24 jam' },
};

const TYPE_LABEL: Record<FacilityType, string> = {
  rumah_sakit: 'Rumah sakit',
  klinik: 'Klinik',
  puskesmas: 'Puskesmas',
  laboratorium: 'Laboratorium klinik',
  praktik_dokter: 'Praktik dokter',
  apotek: 'Apotek',
  gaya_hidup: 'Penyedia gaya hidup sehat',
  rumah_duka: 'Rumah duka',
};

type RegionSlug = 'kota-malang' | 'kabupaten-malang';

/** [nama, jenis, wilayah, kecamatan, lat, lng, tingkat verifikasi]. Koordinat mendekati pusat kecamatan. */
const FACILITY_ROWS: [string, FacilityType, RegionSlug, string, number, number, VerificationLevel][] = [
  ['Klinik Contoh Sawojajar', 'klinik', 'kota-malang', 'Kedungkandang', -7.9725, 112.664, 'diverifikasi_admin'],
  ['Laboratorium Contoh Dinoyo', 'laboratorium', 'kota-malang', 'Lowokwaru', -7.9395, 112.6075, 'diisi_faskes'],
  ['RS Contoh Sukun', 'rumah_sakit', 'kota-malang', 'Sukun', -7.9958, 112.6155, 'diverifikasi_admin'],
  ['Puskesmas Contoh Blimbing', 'puskesmas', 'kota-malang', 'Blimbing', -7.9415, 112.651, 'dari_dokumen_publik'],
  ['Klinik Contoh Tlogomas', 'klinik', 'kota-malang', 'Lowokwaru', -7.9255, 112.5985, 'diisi_faskes'],
  ['Laboratorium Contoh Kayutangan', 'laboratorium', 'kota-malang', 'Klojen', -7.979, 112.63, 'diverifikasi_admin'],
  ['Praktik Dokter Contoh Arjosari', 'praktik_dokter', 'kota-malang', 'Blimbing', -7.93, 112.656, 'publik_belum_diverifikasi'],
  ['RS Contoh Lowokwaru', 'rumah_sakit', 'kota-malang', 'Lowokwaru', -7.948, 112.633, 'diisi_faskes'],
  ['Klinik Contoh Bunulrejo', 'klinik', 'kota-malang', 'Blimbing', -7.959, 112.652, 'publik_belum_diverifikasi'],
  ['Puskesmas Contoh Mulyorejo', 'puskesmas', 'kota-malang', 'Sukun', -7.988, 112.598, 'dari_dokumen_publik'],
  ['Laboratorium Contoh Buring', 'laboratorium', 'kota-malang', 'Kedungkandang', -8.015, 112.655, 'dari_dokumen_publik'],
  ['Klinik Contoh Singosari', 'klinik', 'kabupaten-malang', 'Singosari', -7.893, 112.666, 'diisi_faskes'],
  ['Laboratorium Contoh Lawang', 'laboratorium', 'kabupaten-malang', 'Lawang', -7.835, 112.695, 'diisi_faskes'],
  ['RS Contoh Kepanjen', 'rumah_sakit', 'kabupaten-malang', 'Kepanjen', -8.129, 112.57, 'dari_dokumen_publik'],
  ['Puskesmas Contoh Turen', 'puskesmas', 'kabupaten-malang', 'Turen', -8.169, 112.69, 'dari_dokumen_publik'],
  ['Klinik Contoh Pakis', 'klinik', 'kabupaten-malang', 'Pakis', -7.955, 112.715, 'publik_belum_diverifikasi'],
  ['Klinik Contoh Karangploso', 'klinik', 'kabupaten-malang', 'Karangploso', -7.905, 112.597, 'diverifikasi_admin'],
  ['Praktik Dokter Contoh Dau', 'praktik_dokter', 'kabupaten-malang', 'Dau', -7.918, 112.57, 'diisi_faskes'],
  ['Laboratorium Contoh Bululawang', 'laboratorium', 'kabupaten-malang', 'Bululawang', -8.08, 112.64, 'publik_belum_diverifikasi'],
  ['Puskesmas Contoh Tumpang', 'puskesmas', 'kabupaten-malang', 'Tumpang', -8.005, 112.755, 'dari_dokumen_publik'],
];

export interface DemoFacility {
  id: string;
  slug: string;
  name: string;
  type: FacilityType;
  description: string;
  address: string;
  regionSlug: RegionSlug;
  lat: number;
  lng: number;
  phone: string;
  hours: Record<string, string>;
  verification: VerificationLevel;
  status: EntityStatus;
}

export interface DemoPackage {
  id: string;
  facilityId: string;
  serviceSlug: string;
  name: string;
  notes: string | null;
  components: { label: string; included: boolean }[];
}

export interface DemoVersion {
  priceType: PriceType;
  priceMin: number | null;
  priceMax: number | null;
  /** Tanggal berlaku (YYYY-MM-DD). */
  effectiveFrom: string;
  /** Waktu versi dicatat dan diverifikasi (ISO, UTC). Seed membatasi keduanya agar tidak melewati "sekarang". */
  createdAt: string;
  verifiedAt: string | null;
  verification: VerificationLevel;
  /** 0 = data uji fiktif, 1 = papan tarif faskes (lihat SOURCES di data.ts). */
  sourceIndex: 0 | 1;
}

export interface DemoTariff {
  id: string;
  facilityId: string;
  serviceSlug: string;
  packageId: string | null;
  status: EntityStatus;
  versions: DemoVersion[];
}

export interface DemoData {
  facilities: DemoFacility[];
  packages: DemoPackage[];
  tariffs: DemoTariff[];
}

/** Titik acuan tanggal agar data tetap sama di setiap run. */
const ANCHOR = '2026-11-01';
/** Satu tarif sesekali punya perubahan harga terjadwal (belum berlaku). */
const UPCOMING = '2027-01-01';

function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const uuid = (prefix: string, n: number) => `${prefix}000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Waktu pukul 09.00 WIB (02.00 UTC) pada tanggal tertentu. */
const at9Wib = (isoDate: string) => `${isoDate}T02:00:00.000Z`;

/** Bulatkan ke kelipatan wajar: 1.000 di bawah Rp100 rb, 5.000 di atasnya. */
function roundPrice(value: number): number {
  const step = value < 100_000 ? 1_000 : 5_000;
  return Math.max(step, Math.round(value / step) * step);
}

export function buildDemoData(): DemoData {
  const rand = mulberry32(20261101);
  const between = (min: number, max: number) => min + rand() * (max - min);
  const int = (min: number, max: number) => Math.floor(between(min, max + 1));

  const facilities: DemoFacility[] = FACILITY_ROWS.map(([name, type, regionSlug, district, lat, lng, verification], i) => {
    const city = regionSlug === 'kota-malang' ? 'Kota Malang' : 'Kabupaten Malang';
    return {
      id: uuid('fd', i + 1),
      slug: slugify(name),
      name,
      type,
      description: `${TYPE_LABEL[type]} fiktif di ${district}, ${city}, untuk data demo SILK.`,
      address: `Jl. Contoh ${district} No. ${int(1, 120)}, ${district}`,
      regionSlug,
      lat,
      lng,
      phone: `0341-0${String(100 + i + 1).padStart(5, '0')}`,
      hours: HOURS[type],
      verification,
      status: 'terbit',
    };
  });

  const packages: DemoPackage[] = [];
  const tariffs: DemoTariff[] = [];

  for (const f of facilities) {
    const [fMin, fMax] = PRICE_FACTOR[f.type];
    const factor = between(fMin, fMax);
    for (const serviceSlug of MENU[f.type]) {
      if (rand() < 0.15) continue; // tidak semua faskes menawarkan semua layanan
      const base = BASE_PRICE[serviceSlug];
      if (base === undefined) throw new Error(`Harga dasar ${serviceSlug} belum ada`);

      const isPackage = serviceSlug in PACKAGE_COMPONENTS;
      let packageId: string | null = null;
      if (isPackage) {
        packageId = uuid('db', packages.length + 1);
        const labels = PACKAGE_COMPONENTS[serviceSlug] ?? [];
        packages.push({
          id: packageId,
          facilityId: f.id,
          serviceSlug,
          name: serviceSlug === 'mcu-dasar' ? 'Paket MCU Dasar' : 'Paket MCU Pra-kerja',
          notes: rand() < 0.5 ? 'Puasa 10 jam sebelum pemeriksaan.' : null,
          // Komponen pertama dan kedua selalu termasuk; sisanya bervariasi antar-faskes.
          components: labels.map((label, i) => ({ label, included: i < 2 || rand() < 0.75 })),
        });
      }

      // Jenis harga versi terkini.
      const roll = rand();
      const priceType: PriceType = isPackage ? 'paket' : roll < 0.05 ? 'tanya' : roll < 0.17 ? 'rentang' : roll < 0.27 ? 'mulai_dari' : 'tetap';

      // Jumlah versi dan apakah verifikasinya sudah lama (> 180 hari, label "perlu diperbarui").
      const versionCount = rand() < 0.5 ? 1 : rand() < 0.7 ? 2 : 3;
      const stale = rand() < 0.18;
      const latestFrom = stale ? addDays(ANCHOR, -int(200, 330)) : addDays(ANCHOR, -int(5, 150));

      // Harga dari versi terbaru mundur ke yang lama (naik 5–12% per perubahan).
      const prices: number[] = [roundPrice(base * factor * between(0.92, 1.08))];
      for (let v = 1; v < versionCount; v++) prices.unshift(roundPrice((prices[0] ?? base) / between(1.05, 1.12)));
      const dates: string[] = [latestFrom];
      for (let v = 1; v < versionCount; v++) dates.unshift(addDays(dates[0] ?? latestFrom, -int(150, 330)));

      const versions: DemoVersion[] = prices.map((price, v) => {
        const latest = v === versionCount - 1;
        const effectiveFrom = dates[v] ?? latestFrom;
        const type: PriceType = latest ? priceType : isPackage ? 'paket' : 'tetap';
        const unverified = latest && rand() < 0.1;
        return {
          priceType: type,
          priceMin: type === 'tanya' ? null : price,
          priceMax: type === 'rentang' ? roundPrice(price * between(1.15, 1.4)) : null,
          effectiveFrom,
          createdAt: at9Wib(addDays(effectiveFrom, -int(3, 20))),
          verifiedAt: unverified ? null : at9Wib(addDays(effectiveFrom, int(0, 10))),
          verification: latest ? f.verification : rand() < 0.5 ? 'dari_dokumen_publik' : 'publik_belum_diverifikasi',
          // Versi terkini dari faskes yang mengisi sendiri/diverifikasi admin bersumber papan tarif faskes.
          sourceIndex: latest && (f.verification === 'diisi_faskes' || f.verification === 'diverifikasi_admin') ? 1 : 0,
        };
      });

      // Sebagian kecil tarif sudah punya perubahan harga terjadwal.
      const current = versions[versions.length - 1];
      if (current && current.priceMin !== null && current.priceType !== 'rentang' && rand() < 0.06) {
        versions.push({
          ...current,
          priceMin: roundPrice(current.priceMin * 1.07),
          effectiveFrom: UPCOMING,
          createdAt: at9Wib(addDays(ANCHOR, -int(2, 10))),
          verifiedAt: at9Wib(addDays(ANCHOR, -1)),
        });
      }

      tariffs.push({ id: uuid('de', tariffs.length + 1), facilityId: f.id, serviceSlug, packageId, status: 'terbit', versions });
    }
  }

  return { facilities, packages, tariffs };
}
