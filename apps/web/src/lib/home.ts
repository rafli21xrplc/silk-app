/**
 * Pilihan konten beranda (evaluasi UI/UX C1, B5): bukti USP di bawah judul, urut menurut USP.
 * Pemilihan berdasarkan daftar tetap dan kategori, tidak pernah berdasarkan pembayaran atau langganan.
 */

/** Urutan kategori di beranda: yang paling sering dicari pasien dulu; rumah duka tidak ditampilkan. */
export const HOME_CATEGORY_ORDER = ['laboratorium', 'konsultasi', 'mcu', 'rawat-inap', 'radiologi-penunjang', 'gaya-hidup-sehat'] as const;

/** Ubin "Jelajahi pemeriksaan": campuran lab, konsultasi, MCU, dan rawat inap. */
export const HOME_TILE_SLUGS = [
  'darah-lengkap',
  'konsultasi-dokter-umum',
  'mcu-dasar',
  'rawat-inap-kelas-3',
  'gula-darah-puasa',
  'konsultasi-dokter-spesialis',
  'kolesterol-total',
  'rontgen-thorax',
] as const;

/** "Perkiraan biaya populer": satu per jenis kebutuhan. */
export const HOME_PRICE_SLUGS = ['hemoglobin', 'konsultasi-dokter-umum', 'mcu-dasar', 'rawat-inap-kelas-3'] as const;

type ServiceLike = { slug: string; category: { slug: string } };

const categoryRank = (slug: string) => {
  const i = (HOME_CATEGORY_ORDER as readonly string[]).indexOf(slug);
  return i === -1 ? Number.POSITIVE_INFINITY : i;
};

/**
 * Layanan untuk ubin beranda: slug pilihan yang ada lebih dulu (urut daftar), lalu sisanya menurut
 * urutan kategori. Kategori di luar daftar (mis. rumah duka) tidak ikut.
 */
export function pickHomeServices<T extends ServiceLike>(services: readonly T[], preferred: readonly string[], n: number): T[] {
  const bySlug = new Map(services.map((s) => [s.slug, s]));
  const picked = preferred.map((slug) => bySlug.get(slug)).filter((s): s is T => s !== undefined);
  const taken = new Set(picked.map((s) => s.slug));
  const rest = services
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !taken.has(s.slug) && Number.isFinite(categoryRank(s.category.slug)))
    .sort((a, b) => categoryRank(a.s.category.slug) - categoryRank(b.s.category.slug) || a.i - b.i)
    .map(({ s }) => s);
  return [...picked, ...rest].slice(0, n);
}
