import type { Metadata } from 'next';
import { t } from '@/messages/id';

export const metadata: Metadata = { title: t.footer.terms, alternates: { canonical: '/syarat' } };

export default function TermsPage() {
  return (
    <div className="container narrow prose">
      <h1>{t.footer.terms}</h1>
      <h2>Sifat informasi</h2>
      <p>{t.disclaimer}</p>
      <p>SILK bukan penyedia layanan kesehatan, tidak memberi nasihat medis, dan tidak menjamin hasil layanan faskes mana pun.</p>
      <h2>Akun pengelola faskes</h2>
      <ul>
        <li>Anda bertanggung jawab atas kebenaran tarif yang Anda terbitkan dan wajib memperbaruinya bila berubah.</li>
        <li>Dilarang memakai klaim superlatif, janji kesembuhan, atau ajakan menyesatkan. Teks yang melanggar ditolak otomatis.</li>
        <li>Jaga kerahasiaan kata sandi. Kami memberi tahu semua pengelola setiap kali tarif diubah.</li>
      </ul>
      <h2>Penggunaan data</h2>
      <p>Pengambilan data otomatis dalam jumlah besar tanpa izin tertulis tidak diperbolehkan.</p>
      <h2>Perubahan syarat</h2>
      <p>Syarat dapat diperbarui. Perubahan penting diumumkan di situs ini.</p>
    </div>
  );
}
