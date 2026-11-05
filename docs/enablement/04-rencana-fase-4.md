# Rencana Fase 4: artikel oleh mitra (F-05)

Branch `enablement/fase-4` (dari `enablement/fase-3`). Status: **menunggu persetujuan**.

## 1. Kondisi sekarang

**Artikel hari ini hanya dari editor SILK di Sanity.**
- Web membaca Sanity lewat GROQ (`apps/web/src/lib/sanity.ts`) dan menyimpan hasilnya dalam cache ISR dengan tag `articles` dan `article:<slug>`.
- Tanpa `SANITY_PROJECT_ID`, dev memakai artikel contoh. Di DB dev saat ini Sanity tidak terpasang, jadi yang tampil adalah artikel contoh.
- Webhook `POST /v1/webhooks/sanity` menjalankan filter M17, menulis audit, lalu memanggil revalidate. Web juga memeriksa M17 sebelum render.
- Isi artikel berupa Portable Text. Renderer `components/portable-text.tsx` hanya mendukung paragraf, h2/h3, kutipan, daftar, tebal, dan miring. Tidak ada HTML mentah dan tidak ada tautan.
- Setiap halaman artikel sudah memuat catatan "Artikel ini bersifat informasi umum dan bukan pengganti konsultasi dengan tenaga medis."

**Yang belum ada:** penulis dari mitra, status draf → menunggu → terbit → ditolak, dan moderasi artikel di panel admin.

**Bahan yang bisa dipakai ulang dari fase sebelumnya**
- Matriks izin `PERMISSIONS` di `@silk/shared`.
- `assertVerifiedPartner`.
- `assertContentAllowed` (M17).
- `recordAudit`.
- `revalidate(tags)`.
- Pola antrean moderasi Fase 2 (`/v1/admin/...`, `/admin/moderasi`).

## 2. Keputusan desain (rekomendasi saya)

### A1. Penyimpanan: tabel Postgres untuk artikel mitra; Sanity tetap untuk artikel editorial

| | Postgres (rekomendasi) | Tulis ke Sanity lewat API server |
| --- | --- | --- |
| Otorisasi "hanya artikel sendiri" | Query biasa dengan `partner_id`, diuji di integrasi | Harus disimpan di Sanity dan dicek di server; mudah bocor lewat GROQ publik |
| Draf tidak bocor | Endpoint publik hanya membaca kolom versi terbit | Bergantung pada konvensi `drafts.**` dan token baca; dataset publik bisa membaca dokumen nondraf yang belum disetujui |
| Audit, M17, transaksi | Satu transaksi bersama `audit_logs` | Dua sistem, tidak atomik |
| Uji integrasi dan dev | Jalan tanpa kunci, seperti modul lain | Butuh proyek Sanity dan token tulis (rahasia baru) |
| Biaya | Tanpa dependensi baru | Token tulis Sanity berarti rahasia baru dan kuota API |

Hasilnya:
- Artikel editorial tetap di Sanity, tanpa perubahan.
- Web menggabungkan dua sumber di `/artikel`, diurutkan menurut tanggal terbit. Halaman `/artikel/[slug]` mencari artikel mitra dulu, lalu Sanity.
- Slug artikel mitra diberi akhiran acak pendek (mis. `cara-membaca-hasil-lab-k7q2`) agar tidak bertabrakan dengan slug editorial.

### A2. Siapa yang boleh menulis
- **Rekomendasi:** mitra **terverifikasi** dengan role `faskes`, `tenaga_medis`, atau `gaya_hidup`. Ini sesuai SRS: "Dokter dan penyedia layanan", "penyedia gaya hidup sehat".
- **Apotek tidak** di fase ini. SRS tidak menyebutnya untuk F-05, dan artikel dari penjual obat paling dekat dengan promosi obat. Bisa dibuka nanti cukup dengan menambah satu role di matriks izin.
- Ada izin baru `portal.articles` di matriks `PERMISSIONS`. **Ini perubahan otorisasi, jadi butuh izinmu.** Moderasi memakai `requireAdmin` yang sudah ada (moderator atau admin, wajib TOTP).
- Artikel milik **mitra** (`partner_id`), bukan profil faskes. Satu mitra bisa punya banyak profil; artikelnya tetap satu kumpulan.

### A3. Status dan alur

Status dalam kode memakai bahasa Inggris, konsisten dengan `review_status` Fase 2. Label UI tetap berbahasa Indonesia.

| Status (kode) | Label UI | Arti |
| --- | --- | --- |
| `draft` | Draf | Belum pernah diajukan, atau dikembalikan ke draf oleh mitra |
| `pending` | Menunggu tinjauan | Diajukan; menunggu moderator |
| `published` | Terbit | Versi terakhir sudah disetujui |
| `rejected` | Ditolak | Ditolak dengan alasan; bisa diubah lalu diajukan lagi |
| `withdrawn` | Ditarik | Diturunkan oleh mitra atau moderator; tidak tampil publik |

Transisi yang diizinkan:

| Aksi | Oleh | Dari → ke | Catatan |
| --- | --- | --- | --- |
| buat | mitra | → `draft` | |
| ubah | mitra | `draft`/`rejected` → `draft`; `pending` → `pending` | |
| ubah artikel terbit | mitra | `published` → `pending` | Sesuai prompt: "Artikel terbit yang diubah kembali ke status menunggu." **Versi terbit tetap tampil** sampai perubahan disetujui (lihat A4) |
| ajukan | mitra | `draft`/`rejected`/`withdrawn` → `pending` | M17 `blokir` → 422; M17 `tinjau` → ditandai untuk moderator |
| setujui | moderator/admin | `pending` → `published` | M17 diperiksa ulang; revalidate ISR |
| tolak | moderator/admin | `pending` → `rejected` | Alasan wajib. Versi terbit sebelumnya, bila ada, tetap tampil |
| tarik | mitra (miliknya) atau moderator/admin | `published`/`pending` → `withdrawn` | Alasan wajib bila oleh moderator; revalidate ISR |
| hapus | mitra | hanya artikel yang **belum pernah terbit** | |

Transisi lain → 409. Setiap aksi menulis `audit_logs`: `article.create`, `article.update`, `article.submit`, `article.approve`, `article.reject`, `article.withdraw`, dan `article.delete`.

### A4. Versi terbit vs salinan kerja (tanpa tabel revisi)
- Satu baris artikel menyimpan **salinan kerja** (`title`, `summary`, `body`) dan **salinan terbit** (`published_title`, `published_summary`, `published_body`).
- Persetujuan menyalin salinan kerja ke salinan terbit.
- Endpoint publik **hanya membaca salinan terbit**. Dengan begitu, draf dan perubahan yang menunggu tidak bisa bocor walau ada kesalahan logika status.
- Publik melihat artikel bila: ada salinan terbit, statusnya bukan `withdrawn`, mitranya masih `verified`, dan tidak diblokir M17 saat dibaca (aturan bisa berubah setelah terbit).

### A5. Format isi: Markdown terbatas, tanpa tautan dan gambar
- Mitra menulis di textarea dengan format sederhana: paragraf, `## Subjudul`, `### Sub-subjudul`, `- daftar`, `1. daftar`, `> kutipan`, `**tebal**`, `*miring*`. Ada pratinjau langsung.
- Parser murni baru `parseArticleBody` di `@silk/shared` mengubah teks itu menjadi blok yang sama dengan Portable Text. Renderer `PortableText` yang ada dipakai ulang.
- Parser ini tanpa dependensi baru dan diuji unit.
- HTML ditampilkan sebagai teks biasa. **Tanpa tautan dan gambar di fase ini**, untuk mencegah advertorial, tautan afiliasi, dan spam SEO. URL yang ditulis tampil sebagai teks.
- Batas:
  - judul 10–140 karakter
  - ringkasan 30–300 karakter
  - isi 300–20.000 karakter
  - maksimal **5 artikel `pending` per mitra**, agar antrean tidak dibanjiri

### A6. Tampilan publik: penulis, jenis mitra, disclaimer, tanpa pengaruh urutan
- Kepala artikel menampilkan nama penulis dan jenis mitra, plus tautan ke profil publiknya bila ada:
  - nama: nama praktisi untuk tenaga medis, nama usaha untuk yang lain
  - jenis mitra: "Tenaga medis", "Fasilitas kesehatan", "Gaya hidup sehat"
- Lencana "Artikel mitra" membedakannya dari artikel editorial SILK.
- Kotak disclaimer tetap di setiap artikel mitra: "Ditulis oleh mitra SILK. Isinya bersifat edukasi, bukan diagnosis atau anjuran pengobatan. Konsultasikan keluhan Anda dengan tenaga medis. SILK tidak menerima bayaran untuk menerbitkan artikel." Teks ini harus lolos M17.
- Saat mengajukan, mitra mencentang pernyataan "Artikel ini tidak berbayar, tidak berisi promosi harga, dan tidak menjanjikan hasil pengobatan." Pernyataan ini disimpan bersama artikel.
- Artikel **tidak** menyentuh query pencarian profil. Uji regresi urutan Fase 3 diperluas: menerbitkan artikel tidak mengubah urutan hasil.
- JSON-LD `Article` memakai penulis yang sama. Sitemap memuat artikel mitra.

### A7. Revalidate ISR
- Setujui, tarik, atau perubahan status mitra yang menyembunyikan artikel memanggil `revalidate([articles, article:<slug>, sitemap])`.
- Gagal revalidate hanya dicatat. TTL ISR 1 jam tetap menjadi jaring pengaman, seperti sekarang.

## 3. Skema (migrasi 0008, hanya ke DB dev)

- Enum baru `article_status` (`draft`, `pending`, `published`, `rejected`, `withdrawn`).
- Tabel baru `partner_articles`:

| Kolom | Isi |
| --- | --- |
| `id` | uuid PK |
| `partner_id` | FK `partners`, cascade |
| `author_user_id` | FK `user`, set null |
| `slug` | citext unik |
| `status` | `article_status` |
| `title`, `summary`, `body` | salinan kerja; `body` = teks Markdown terbatas |
| `published_title`, `published_summary`, `published_body` | salinan terbit (CHECK: ketiganya null bersama atau terisi bersama) |
| `first_published_at`, `published_updated_at` | timestamptz |
| `submitted_at`, `reviewed_at`, `reviewed_by`, `rejection_reason` | moderasi |
| `needs_review` | boolean, hasil M17 `tinjau` |
| `withdrawn_reason` | alasan penarikan |
| `declaration_at` | waktu pernyataan bebas promosi dicentang |
| `created_at`, `updated_at` | |

- Indeks:
  - `(status, submitted_at)` untuk antrean
  - `(partner_id, updated_at DESC)` untuk portal
  - parsial `(published_updated_at DESC) WHERE published_body IS NOT NULL` untuk daftar publik
- Tabel baru saja. **Tidak ada perubahan pada tabel yang sudah terbit.** Rencana mundur ditulis di kepala berkas migrasi.

## 4. Kontrak API (semuanya aditif)

**Portal mitra** (`portal.articles`, mitra terverifikasi)

| Endpoint | Fungsi |
| --- | --- |
| `GET /v1/portal/articles` | Daftar artikel milik mitra (semua status) |
| `POST /v1/portal/articles` | Buat draf |
| `GET /v1/portal/articles/:id` | Detail, termasuk salinan kerja dan salinan terbit |
| `PUT /v1/portal/articles/:id` | Ubah |
| `POST /v1/portal/articles/:id/submit` | Ajukan (`{ declaration: true }`) |
| `POST /v1/portal/articles/:id/withdraw` | Tarik |
| `DELETE /v1/portal/articles/:id` | Hapus (hanya yang belum pernah terbit) |

Artikel mitra lain → **404**, bukan 403, agar keberadaannya tidak bisa ditebak.

**Admin** (`requireAdmin`)

| Endpoint | Fungsi |
| --- | --- |
| `GET /v1/admin/articles?status=` | Antrean |
| `GET /v1/admin/articles/:id` | Usulan vs versi terbit, temuan M17 |
| `POST /v1/admin/articles/:id/approve` | Setujui |
| `POST /v1/admin/articles/:id/reject` | Tolak (alasan wajib) |
| `POST /v1/admin/articles/:id/withdraw` | Turunkan (alasan wajib) |

**Publik**

| Endpoint | Fungsi |
| --- | --- |
| `GET /v1/articles` | Artikel mitra terbit, dengan kursor |
| `GET /v1/articles/:slug` | Satu artikel: salinan terbit + penulis `{name, partnerType, profilePath}`, isi dalam bentuk blok |

Tidak ada endpoint lama yang berubah. `/v1/admin/overview` mendapat hitungan aditif `articlesPending`.

## 5. Web

**Portal**
- `/portal/artikel`: daftar dengan lencana status dan alasan penolakan.
- `/portal/artikel/baru` dan `/portal/artikel/[id]`:
  - judul, ringkasan, dan isi dengan panduan format serta pratinjau langsung (parser dan renderer yang sama dengan publik)
  - tombol Simpan draf, Ajukan (dengan centang pernyataan), Tarik, dan Hapus
  - banner "Versi terbit tetap tampil sampai perubahan disetujui"
- Menu "Artikel" muncul di navigasi akun hanya untuk role yang berhak.

**Admin:** `/admin/moderasi` mendapat tab **Artikel** (jumlah, daftar menunggu, tanda M17 `tinjau`). Halaman detail menampilkan pratinjau usulan; bila artikel sudah pernah terbit, versi terbit ditampilkan berdampingan. Ada tombol setujui, tolak dengan alasan, dan turunkan.

**Publik**
- Modul baru `lib/articles.ts` menggabungkan Sanity dan artikel mitra. `lib/sanity.ts` hanya menjadi salah satu sumber.
- Halaman artikel menampilkan penulis dan jenis mitra, lencana "Artikel mitra", dan kotak disclaimer.
- Sitemap memuat artikel mitra.
- Semua teks baru ada di `messages/id.ts` dan lolos M17.

## 6. Uji

**Unit**
- **Shared:**
  - `parseArticleBody`: semua bentuk format; HTML dan `<script>` tetap berupa teks; URL tidak menjadi tautan; daftar campuran; baris kosong
  - skema masukan beserta batas panjang
- **Web:** penggabungan dua sumber artikel (urutan tanggal, prioritas slug).

**Integrasi API (`fase4-articles.test.ts`)**
- **Otorisasi:**
  - anonim → 401
  - pasien → 403
  - apotek → 403
  - mitra belum terverifikasi → `PARTNER_NOT_VERIFIED`
  - mitra B membaca, mengubah, mengajukan, menarik, atau menghapus artikel mitra A → 404
  - non-staf ke `/v1/admin/articles` → 403
- **Per status:** matriks transisi A3. Setiap transisi yang tidak diizinkan → 409, termasuk menyetujui artikel `draft` dan menghapus artikel yang pernah terbit.
- **M17:**
  - "pasti sembuh" di isi → ajukan ditolak dengan 422 `CONTENT_RULE_VIOLATION`, status tetap `draft`
  - aturan `tinjau` → `needs_review`
  - aturan `blokir` yang ditambahkan setelah artikel terbit → artikel hilang dari endpoint publik
- **Revalidate terpanggil:** modul `lib/revalidate` di-mock di uji. Setujui dan tarik memanggil tag `articles`, `article:<slug>`, dan `sitemap`. Tolak tidak memanggil apa pun.
- **Draf tidak bocor:**
  - `draft`, `pending`, `rejected`, dan `withdrawn` tidak muncul di `GET /v1/articles`, dan `GET /v1/articles/:slug` → 404
  - perubahan atas artikel terbit tidak tampil sebelum disetujui, lalu tampil setelahnya
  - mitra yang statusnya dicabut → artikelnya tersembunyi
- **Batas:** artikel `pending` ke-6 → 409.
- **Audit:** setiap aksi menulis baris `audit_logs` dengan aktor.
- **Regresi urutan:** urutan `GET /v1/facilities` identik sebelum dan sesudah artikel mitra terbit.

## 7. Risiko

- **Beban moderasi:** setiap artikel dan setiap perubahan ditinjau manual. Batas 5 artikel `pending` per mitra dan penanda M17 `tinjau` membantu, tetapi antrean tetap perlu petugas. Ini sama dengan gate di checklist.
- **Konten medis keliru di luar jangkauan M17:** M17 hanya menyaring kata. Kebenaran isi tetap bergantung pada moderator. Disclaimer dan label "Artikel mitra" menurunkan risiko, tetapi tidak menghapusnya.
- **Promosi terselubung:** dikurangi dengan tanpa tautan, tanpa gambar, pernyataan bebas promosi, dan moderasi. Kata seperti "diskon" atau "promo" **tidak** saya tambahkan ke aturan M17, karena aturan itu berlaku global (juga untuk profil). Itu keputusanmu bila diinginkan.
- **Dua sumber artikel** menambah satu panggilan API di `/artikel`. Keduanya di-cache dengan tag yang sama, jadi dampaknya kecil.

## 8. Yang butuh keputusan atau izinmu

1. **A1, penyimpanan:** tabel Postgres untuk artikel mitra; Sanity tetap untuk editorial. Alternatifnya menulis ke Sanity lewat API server.
2. **A2, otorisasi penulis:** izin baru `portal.articles` untuk `faskes`, `tenaga_medis`, dan `gaya_hidup` yang terverifikasi; apotek tidak. Ini perubahan otorisasi.
3. **A3/A4, artikel terbit yang diubah:** status menjadi `pending` dan versi terbit tetap tampil sampai disetujui. Alternatifnya artikel langsung turun dari publik sampai disetujui ulang; ini lebih harfiah terhadap prompt, tetapi membuat tautan yang sudah dibagikan menjadi 404.
4. **A5, format isi:** Markdown terbatas tanpa tautan dan gambar.
5. **Migrasi 0008** (enum dan tabel baru `partner_articles`) ke DB dev.
6. **Endpoint aditif** di bagian 4, termasuk `articlesPending` di `/v1/admin/overview`.

Tidak ada dependensi baru. Tidak mengubah kontrak API yang ada. Notifikasi ke penulis (disetujui atau ditolak) baru dikerjakan di Fase 5.

## 9. Belum termasuk

- Gambar sampul unggahan dan gambar di dalam isi. Sampul memakai pola warna per slug yang sudah ada.
- Kategori atau tag artikel, komentar, dan halaman daftar artikel per penulis.
- Email atau notifikasi ke penulis (Fase 5).
