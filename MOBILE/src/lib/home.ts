/**
 * Konten beranda. Daftar tetap per kebutuhan pasien (bukti USP: angka dan dokter),
 * tidak pernah dipilih berdasarkan pembayaran atau langganan.
 */
export const HOME_PRICE_SLUGS = ['hemoglobin', 'konsultasi-dokter-umum', 'mcu-dasar', 'rawat-inap-kelas-3', 'gula-darah-puasa', 'rontgen-thorax'] as const;

/** Pintasan kebutuhan: kategori layanan (ke katalog) atau dokter. */
export const QUICK_LINKS = [
  { key: 'laboratorium', href: '/layanan?kategori=laboratorium' },
  { key: 'konsultasi', href: '/dokter' },
  { key: 'mcu', href: '/layanan?kategori=mcu' },
  { key: 'rawat-inap', href: '/layanan?kategori=rawat-inap' },
  { key: 'radiologi-penunjang', href: '/layanan?kategori=radiologi-penunjang' },
  { key: 'gaya-hidup-sehat', href: '/layanan?kategori=gaya-hidup-sehat' },
] as const;

/** Wilayah yang dilayani (nilai = nama kota di API). */
export const CITIES = ['Kota Malang', 'Kabupaten Malang'] as const;
