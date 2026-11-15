/**
 * Alamat situs web SILK (pendaftaran dan portal mitra). SILK Mobile hanya alur publik pasien, jadi pendaftaran
 * mitra diarahkan ke situs web. Kosong = tombol daftar disembunyikan, hanya keterangan teks.
 */
export const WEB_ORIGIN = (process.env.SILK_WEB_ORIGIN || '').replace(/\/+$/, '');

export const registerUrl = (type: string): string | null => (WEB_ORIGIN ? `${WEB_ORIGIN}/daftar?jenis=${encodeURIComponent(type)}` : null);
