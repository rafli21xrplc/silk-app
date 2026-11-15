/**
 * Konten beranda. Daftar tetap per kebutuhan pasien (bukti USP: angka dan dokter),
 * tidak pernah dipilih berdasarkan pembayaran atau langganan.
 */
export const HOME_PRICE_SLUGS = ['hemoglobin', 'konsultasi-dokter-umum', 'mcu-dasar', 'rawat-inap-kelas-3', 'gula-darah-puasa', 'rontgen-thorax'] as const;

/**
 * Grid layanan beranda (pola aplikasi super: ikon bulat, 4 kolom). Urutan tetap per kebutuhan pasien,
 * tidak pernah dipilih berdasarkan pembayaran atau langganan.
 */
export const SERVICE_SHORTCUTS = [
  { key: 'doctor', href: '/dokter', tone: 'sky' },
  { key: 'lab', href: '/layanan?kategori=laboratorium', tone: 'peach' },
  { key: 'mcu', href: '/layanan?kategori=mcu', tone: 'mint' },
  { key: 'inpatient', href: '/layanan?kategori=rawat-inap', tone: 'lilac' },
  { key: 'pharmacy', href: '/cari?type=apotek', tone: 'mint' },
  { key: 'near', href: '/cari?dekat=1', tone: 'sky' },
  { key: 'lifestyle', href: '/layanan?kategori=gaya-hidup-sehat', tone: 'lemon' },
  { key: 'all', href: '/layanan', tone: 'surface' },
] as const;
export type ServiceShortcutKey = (typeof SERVICE_SHORTCUTS)[number]['key'];

/** Wilayah yang dilayani (nilai = nama kota di API). */
export const CITIES = ['Kota Malang', 'Kabupaten Malang'] as const;
