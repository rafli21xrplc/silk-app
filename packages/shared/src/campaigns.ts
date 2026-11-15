/**
 * Campaign beranda (web dan SILK Mobile). Keputusan 2026-11-14: campaign adalah konten SILK sendiri
 * (edukasi kesehatan, fitur SILK, ajakan jadi mitra), bukan promo berbayar. Tidak ada campaign yang
 * menyebut atau menonjolkan mitra tertentu, dan campaign tidak pernah memengaruhi urutan hasil (aturan mutlak 1).
 *
 * Mengubah campaign = ubah daftar ini lalu deploy. Teks wajib lolos filter konten M17 (diuji di packages/db).
 */

export const CAMPAIGN_THEMES = ['mint', 'sky', 'peach', 'lilac', 'lemon', 'ink'] as const;
export type CampaignTheme = (typeof CAMPAIGN_THEMES)[number];

/** Ilustrasi banner; tiap aplikasi memetakan ke ikon atau foto miliknya. */
export const CAMPAIGN_ARTS = ['lab', 'mcu', 'doctor', 'hospital', 'partner', 'guide'] as const;
export type CampaignArt = (typeof CAMPAIGN_ARTS)[number];

export interface Campaign {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  /** Tujuan per aplikasi (rute web dan mobile tidak selalu sama). Selalu tautan internal. */
  href: { web: string; mobile: string };
  theme: CampaignTheme;
  art: CampaignArt;
  /** Rentang tayang (ISO, UTC). Kosong = selalu tayang. `endsAt` eksklusif. */
  startsAt?: string;
  endsAt?: string;
}

export const CAMPAIGNS: readonly Campaign[] = [
  {
    id: 'hari-diabetes-2026',
    eyebrow: 'Hari Diabetes Sedunia · 14 November',
    title: 'Kenali tes gula darah puasa',
    body: 'Lihat persiapan dan perkiraan biayanya di faskes Malang sebelum datang.',
    cta: 'Lihat biaya tes',
    href: { web: '/layanan/gula-darah-puasa', mobile: '/layanan/gula-darah-puasa' },
    theme: 'peach',
    art: 'lab',
    startsAt: '2026-10-31T17:00:00Z',
    endsAt: '2026-11-30T17:00:00Z',
  },
  {
    id: 'mcu-sebelum-datang',
    eyebrow: 'Medical check-up',
    title: 'Bandingkan biaya MCU sebelum datang',
    body: 'Isi paket, sumber, dan tanggal berlaku tiap faskes dalam satu tampilan.',
    cta: 'Bandingkan',
    href: { web: '/layanan/mcu-dasar', mobile: '/layanan/mcu-dasar' },
    theme: 'mint',
    art: 'mcu',
  },
  {
    id: 'kenali-dokter-video',
    eyebrow: 'Kenali dokternya',
    title: 'Tonton video perkenalan dokter',
    body: 'Dengar cara dokter menjelaskan sebelum Anda membuat janji.',
    cta: 'Cari dokter',
    href: { web: '/dokter?video=1', mobile: '/dokter?video=1' },
    theme: 'sky',
    art: 'doctor',
  },
  {
    id: 'biaya-rawat-inap',
    eyebrow: 'Rawat inap',
    title: 'Perkiraan biaya kamar per malam',
    body: 'Dari kelas 3 sampai VIP, lengkap dengan sumber dan tanggal berlaku.',
    cta: 'Lihat rentang biaya',
    href: { web: '/layanan/rawat-inap-kelas-3', mobile: '/layanan/rawat-inap-kelas-3' },
    theme: 'lilac',
    art: 'hospital',
  },
  {
    id: 'cara-baca-angka',
    eyebrow: 'Panduan',
    title: 'Cara membaca angka di SILK',
    body: 'Tanggal berlaku, sumber, dan status verifikasi ada di setiap tarif.',
    cta: 'Baca panduan',
    href: { web: '/metodologi', mobile: '/info' },
    theme: 'lemon',
    art: 'guide',
  },
  {
    id: 'jadi-mitra',
    eyebrow: 'Untuk klinik, dokter, dan apotek',
    title: 'Tampilkan layanan Anda di SILK',
    body: 'Profil, tarif, dan jadwal praktik tampil setelah data diverifikasi.',
    cta: 'Jadi mitra',
    href: { web: '/mitra', mobile: '/mitra' },
    theme: 'ink',
    art: 'partner',
  },
];

/** Campaign yang tayang pada `now`, urutan sesuai daftar. */
export function activeCampaigns(now: Date, list: readonly Campaign[] = CAMPAIGNS): Campaign[] {
  const t = now.getTime();
  return list.filter((c) => (!c.startsAt || Date.parse(c.startsAt) <= t) && (!c.endsAt || t < Date.parse(c.endsAt)));
}
