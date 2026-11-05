import { readingMinutes } from './article-meta';
import type { Article, PortableBlock } from './sanity';

/**
 * Artikel CONTOH untuk pengembangan lokal saat Sanity belum dikonfigurasi. Tidak pernah dipakai di produksi
 * (lihat lib/sanity.ts). Isinya umum dan fiktif; angka rupiah hanya ilustrasi. Teks lolos filter konten M17.
 */

type Line = string | [style: 'h2' | 'h3' | 'quote', text: string] | ['ul' | 'ol', items: string[]];

function blocks(lines: Line[]): PortableBlock[] {
  const out: PortableBlock[] = [];
  const block = (text: string, extra: Partial<PortableBlock> = {}): PortableBlock => ({
    _type: 'block',
    _key: `b${out.length}`,
    style: 'normal',
    children: [{ _key: `c${out.length}`, text }],
    ...extra,
  });
  for (const line of lines) {
    if (typeof line === 'string') {
      out.push(block(line));
    } else if (Array.isArray(line[1])) {
      const listItem = line[0] === 'ul' ? 'bullet' : 'number';
      for (const item of line[1]) out.push(block(item, { listItem }));
    } else {
      out.push(block(line[1], { style: line[0] === 'quote' ? 'blockquote' : line[0] }));
    }
  }
  return out;
}

const AUTHOR = 'Redaksi SILK (contoh)';

const RAW: (Omit<Article, 'body' | 'updatedAt' | 'readingMinutes'> & {
  updatedAt?: string;
  body: Line[];
})[] = [
  {
    slug: 'contoh-biaya-medical-check-up-malang',
    title: 'Berapa biaya medical check-up di Malang? Cara membaca rentangnya',
    description:
      'Tarif MCU bisa berbeda jauh antarfaskes. Kenali isi paket, tanggal berlaku, dan sumber tarif sebelum memilih.',
    publishedAt: '2026-11-02T02:00:00Z',
    updatedAt: '2026-11-03T04:30:00Z',
    author: AUTHOR,
    body: [
      'Medical check-up (MCU) biasanya dijual dalam bentuk paket. Satu paket bisa berisi pemeriksaan fisik, tes darah lengkap, gula darah, profil lemak, hingga rontgen dada. Karena isi paket berbeda-beda, membandingkan harga saja sering tidak cukup.',
      ['h2', 'Kenapa rentang harganya lebar'],
      'Perbedaan tarif umumnya berasal dari jumlah pemeriksaan di dalam paket, jenis alat yang dipakai, serta apakah konsultasi dokter sudah termasuk. Faskes yang sama juga bisa punya beberapa tingkatan paket.',
      [
        'ul',
        [
          'Jumlah dan jenis pemeriksaan di dalam paket',
          'Konsultasi hasil dengan dokter: termasuk atau terpisah',
          'Biaya administrasi atau pendaftaran',
          'Tanggal berlaku tarif yang dipakai faskes',
        ],
      ],
      ['h2', 'Cara membaca tarif di SILK'],
      'Setiap tarif di SILK ditampilkan bersama tanggal berlaku, sumber, dan status verifikasi. Bila tarif berupa rentang, artinya faskes menyebut batas bawah dan batas atas, misalnya karena ada pilihan tambahan.',
      [
        'quote',
        'Angka pada artikel ini hanya ilustrasi. Selalu cek tarif terbaru langsung di halaman faskes.',
      ],
      ['h2', 'Langkah sebelum memilih paket'],
      [
        'ol',
        [
          'Tentukan pemeriksaan yang memang Anda perlukan, sebaiknya bersama dokter.',
          'Bandingkan isi paket, bukan hanya angka totalnya.',
          'Periksa tanggal berlaku dan sumber tarif.',
          'Tanyakan biaya yang belum termasuk sebelum datang.',
        ],
      ],
      'Dengan cara ini, Anda bisa memilih paket yang sesuai kebutuhan tanpa terkejut oleh biaya tambahan di kasir.',
    ],
  },
  {
    slug: 'contoh-checklist-pertanyaan-biaya-lab',
    title: 'Checklist pertanyaan biaya sebelum tes laboratorium',
    description:
      'Daftar singkat yang bisa Anda tanyakan ke laboratorium agar total biaya jelas sejak awal.',
    publishedAt: '2026-10-28T03:00:00Z',
    author: AUTHOR,
    body: [
      'Menanyakan biaya sebelum pemeriksaan adalah hal yang wajar. Petugas laboratorium umumnya terbiasa menjelaskan rincian tarif bila ditanya dengan jelas.',
      ['h2', 'Sebelum datang'],
      [
        'ul',
        [
          'Apakah tarif ini masih berlaku hari ini?',
          'Apakah perlu surat pengantar dokter?',
          'Apakah ada persiapan khusus, misalnya puasa?',
          'Berapa lama hasil keluar dan bagaimana cara mengambilnya?',
        ],
      ],
      ['h2', 'Tentang rincian biaya'],
      [
        'ul',
        [
          'Apakah ada biaya pendaftaran atau administrasi?',
          'Apakah pengambilan sampel dikenakan biaya terpisah?',
          'Apakah hasil dalam bentuk cetak dikenakan biaya?',
          'Metode pembayaran apa saja yang diterima?',
        ],
      ],
      ['h2', 'Setelah pemeriksaan'],
      'Simpan kuitansi dan salinan hasil. Bila tarif yang Anda bayar berbeda dari yang tercantum di SILK, Anda bisa mengirim laporan data dari halaman faskes agar tim kami memeriksanya.',
    ],
  },
  {
    slug: 'contoh-tarif-paket-atau-satuan',
    title: 'Tarif paket atau tarif satuan: mana yang sesuai kebutuhan Anda?',
    description:
      'Paket terlihat praktis, tetapi tes satuan kadang lebih pas. Begini cara menimbangnya.',
    publishedAt: '2026-10-21T01:30:00Z',
    author: AUTHOR,
    body: [
      'Banyak laboratorium menawarkan dua cara: membeli pemeriksaan satu per satu, atau memilih paket berisi beberapa pemeriksaan sekaligus.',
      ['h2', 'Kapan paket masuk akal'],
      'Paket cocok bila Anda memang memerlukan sebagian besar pemeriksaan di dalamnya, misalnya untuk syarat kerja atau pemeriksaan rutin tahunan yang disarankan dokter.',
      ['h2', 'Kapan tes satuan lebih pas'],
      'Bila dokter hanya meminta satu atau dua pemeriksaan, membeli tes satuan sering lebih sederhana. Anda tidak membayar pemeriksaan yang tidak diperlukan.',
      ['h2', 'Cara membandingkan'],
      [
        'ol',
        [
          'Daftar pemeriksaan yang Anda perlukan.',
          'Jumlahkan tarif satuannya di faskes yang sama.',
          'Bandingkan dengan paket yang isinya paling mendekati.',
          'Perhatikan tanggal berlaku kedua tarif.',
        ],
      ],
    ],
  },
  {
    slug: 'contoh-status-verifikasi-tarif',
    title: 'Memahami status verifikasi tarif di SILK',
    description:
      'Dari dokumen publik hingga diverifikasi admin: arti setiap label dan cara memakainya.',
    publishedAt: '2026-10-14T05:00:00Z',
    author: AUTHOR,
    body: [
      'Setiap tarif di SILK membawa label verifikasi. Label ini membantu Anda menilai seberapa kuat dasar sebuah angka, bukan menilai mutu layanan faskes.',
      ['h2', 'Arti setiap label'],
      [
        'ul',
        [
          'Publik, belum diverifikasi: berasal dari sumber terbuka dan belum dicek ulang.',
          'Dari dokumen publik: tercantum pada dokumen resmi seperti peraturan daerah.',
          'Diisi faskes: dimasukkan langsung oleh pengelola faskes yang terverifikasi.',
          'Diverifikasi admin: sudah dicocokkan oleh tim SILK.',
        ],
      ],
      ['h2', 'Tanggal berlaku tetap penting'],
      'Label verifikasi tidak menggantikan tanggal berlaku. Tarif lama yang sudah diverifikasi tetap bisa berubah. Karena itu SILK menandai tarif yang sudah lama tidak diperbarui.',
      ['quote', 'Peringkat dan urutan hasil di SILK tidak pernah dipengaruhi pembayaran.'],
    ],
  },
  {
    slug: 'contoh-persiapan-tes-gula-darah-puasa',
    title: 'Persiapan tes gula darah puasa: hal yang perlu diketahui',
    description:
      'Informasi umum tentang persiapan, waktu kedatangan, dan biaya yang perlu ditanyakan.',
    publishedAt: '2026-10-07T02:15:00Z',
    author: AUTHOR,
    body: [
      'Tes gula darah puasa umumnya meminta Anda tidak makan selama beberapa jam sebelum pengambilan darah. Lama puasa yang tepat sebaiknya mengikuti arahan dokter atau petugas laboratorium.',
      ['h2', 'Sebelum pemeriksaan'],
      [
        'ul',
        [
          'Tanyakan berapa jam puasa yang diminta.',
          'Tanyakan apakah obat rutin boleh diminum.',
          'Datang sesuai jam yang disarankan laboratorium.',
        ],
      ],
      ['h2', 'Soal biaya'],
      'Tes gula darah puasa sering tersedia sebagai tes satuan maupun bagian dari paket. Bandingkan keduanya dengan cara yang sama seperti pemeriksaan lain: lihat isi, tanggal berlaku, dan sumber tarif.',
    ],
  },
  {
    slug: 'contoh-kenapa-tarif-berbeda-antarfaskes',
    title: 'Kenapa tarif pemeriksaan bisa berbeda antarfaskes?',
    description:
      'Alat, tenaga, lokasi, dan isi layanan ikut membentuk tarif. Ini faktor yang perlu Anda pahami.',
    publishedAt: '2026-09-30T03:45:00Z',
    author: AUTHOR,
    body: [
      'Pemeriksaan dengan nama yang sama bisa punya tarif berbeda di dua faskes. Perbedaan ini tidak selalu berarti salah satunya lebih baik atau lebih buruk.',
      ['h2', 'Faktor yang memengaruhi tarif'],
      [
        'ul',
        [
          'Jenis alat dan metode pemeriksaan',
          'Layanan yang termasuk, seperti konsultasi atau pengiriman hasil',
          'Biaya operasional dan lokasi faskes',
          'Jenis faskes: klinik, laboratorium mandiri, atau rumah sakit',
        ],
      ],
      ['h2', 'Yang bisa Anda lakukan'],
      'Gunakan halaman perbandingan SILK untuk melihat tarif beberapa faskes sekaligus, lengkap dengan tanggal berlaku dan sumbernya. Bila ragu, tanyakan langsung rincian layanan yang termasuk.',
    ],
  },
];

const plain = (body: PortableBlock[]) =>
  body.map((b) => (b.children ?? []).map((c) => c.text ?? '').join('')).join('\n');

export const SAMPLE_ARTICLES: Article[] = RAW.map((a) => {
  const body = blocks(a.body);
  return {
    ...a,
    updatedAt: a.updatedAt ?? a.publishedAt,
    body,
    readingMinutes: readingMinutes(plain(body)),
    sample: true,
  };
});
