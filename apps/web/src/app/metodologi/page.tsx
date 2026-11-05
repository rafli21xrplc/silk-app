import type { Metadata } from 'next';
import { DEFAULT_STALE_AFTER_DAYS } from '@silk/shared';
import { t } from '@/messages/id';

export const metadata: Metadata = {
  title: t.footer.methodology,
  description: 'Cara SILK mengumpulkan, memverifikasi, dan menampilkan tarif layanan kesehatan.',
  alternates: { canonical: '/metodologi' },
};

export default function MethodologyPage() {
  return (
    <div className="container narrow prose">
      <h1>{t.footer.methodology}</h1>
      <h2>Sumber data</h2>
      <ul>
        <li>
          <strong>{t.sourceKind.perda}</strong> dan <strong>{t.sourceKind.pmk}</strong>: tarif resmi dari dokumen publik, diimpor tim SILK dan
          ditandai &ldquo;{t.verification.dari_dokumen_publik}&rdquo;.
        </li>
        <li>
          <strong>{t.sourceKind.faskes}</strong>: diisi pengelola faskes lewat portal dan ditandai &ldquo;{t.verification.diisi_faskes}&rdquo;. Faskes
          yang belum diklaim dan diverifikasi masuk antrean tinjauan moderator sebelum terbit.
        </li>
        <li>
          <strong>{t.sourceKind.admin}</strong>: dicek langsung oleh tim SILK dan ditandai &ldquo;{t.verification.diverifikasi_admin}&rdquo;.
        </li>
      </ul>
      <h2>Riwayat harga</h2>
      <p>
        Setiap perubahan tarif membuat versi baru; versi lama tidak pernah diubah atau dihapus. Riwayat lengkap dapat dibuka dari tombol &ldquo;
        {t.trust.history}&rdquo; pada setiap tarif.
      </p>
      <h2>Tarif usang</h2>
      <p>
        Tarif yang belum diverifikasi ulang lebih dari {DEFAULT_STALE_AFTER_DAYS} hari diberi label &ldquo;{t.trust.stale}&rdquo;. Pengelola faskes
        menerima pengingat untuk memperbarui datanya.
      </p>
      <h2>Urutan hasil</h2>
      <p>
        Hasil pencarian diurutkan berdasarkan relevansi, harga, nama, atau jarak sesuai pilihan Anda. {t.footer.note} SILK tidak menampilkan iklan
        di dalam hasil.
      </p>
      <h2>Membandingkan paket</h2>
      <p>
        Perbandingan menampilkan komponen paket berdampingan. Komponen yang tidak dicantumkan faskes ditandai &ldquo;{t.compare.notIncluded}&rdquo;, sehingga
        angka yang tampak lebih rendah dapat dinilai bersama isinya.
      </p>
      <h2>Melaporkan data</h2>
      <p>Bila harga di faskes berbeda, gunakan tombol &ldquo;{t.facility.report}&rdquo;. Setiap laporan ditinjau moderator.</p>
    </div>
  );
}
