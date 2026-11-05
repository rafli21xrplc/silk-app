import type { Metadata } from 'next';
import { t } from '@/messages/id';

export const metadata: Metadata = { title: t.footer.privacy, alternates: { canonical: '/privasi' } };

/** Ringkasan sesuai UU No. 27/2022 tentang Pelindungan Data Pribadi. Teks final perlu ditinjau penasihat hukum. */
export default function PrivacyPage() {
  return (
    <div className="container narrow prose">
      <h1>{t.footer.privacy}</h1>
      <h2>Data yang kami proses</h2>
      <ul>
        <li>Pengunjung: tidak perlu akun. Analitik anonim hanya aktif setelah Anda memberi izin lewat banner cookie.</li>
        <li>Pelapor data: isi laporan dan email (opsional) untuk kabar tindak lanjut.</li>
        <li>Pengelola faskes: nama, email, kata sandi (disimpan dalam bentuk hash), dokumen izin untuk klaim profil, serta log aktivitas.</li>
      </ul>
      <h2>Dasar dan tujuan pemrosesan</h2>
      <p>
        Persetujuan saat mendaftar atau mengirim laporan, serta kepentingan sah untuk menjaga keakuratan dan keamanan data tarif. Data tidak dijual
        dan tidak dipakai untuk iklan.
      </p>
      <h2>Penyimpanan dan keamanan</h2>
      <p>
        Dokumen izin disimpan di penyimpanan privat dan hanya dapat dibuka moderator lewat tautan berumur pendek. Akses admin wajib memakai
        autentikasi dua langkah. Setiap perubahan data oleh pengguna terautentikasi dicatat dalam log audit.
      </p>
      <h2>Masa simpan</h2>
      <p>Dokumen klaim yang ditolak dan data sesi kedaluwarsa dihapus berkala. Email pelapor dihapus setelah laporan selesai ditangani.</p>
      <h2>Hak Anda</h2>
      <p>
        Anda berhak mengakses, memperbaiki, menghapus data, dan menarik persetujuan. Kirim permintaan ke alamat kontak SILK; kami menanggapi paling
        lambat 3 × 24 jam.
      </p>
    </div>
  );
}
