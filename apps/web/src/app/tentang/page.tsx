import type { Metadata } from 'next';
import Link from 'next/link';
import { t } from '@/messages/id';

export const metadata: Metadata = { title: t.footer.about, description: t.site.description, alternates: { canonical: '/tentang' } };

export default function AboutPage() {
  return (
    <div className="container narrow prose">
      <h1>{t.footer.about}</h1>
      <p>{t.site.description}</p>
      <p>
        SILK membantu pasien mengetahui perkiraan biaya sebelum berangkat ke faskes. Setiap angka disertai tanggal berlaku, sumber, dan tingkat
        verifikasi, sehingga pengguna dapat menilai sendiri seberapa mutakhir datanya.
      </p>
      <p>
        SILK tidak memberikan nasihat medis dan tidak menjamin hasil layanan. {t.disclaimer}
      </p>
      <p>
        Pengelola faskes dapat <Link href="/daftar">mendaftar</Link> lalu mengklaim profil untuk memperbarui tarif secara langsung. Baca{' '}
        <Link href="/metodologi">{t.footer.methodology.toLowerCase()}</Link> untuk detail cara kerja kami.
      </p>
    </div>
  );
}
