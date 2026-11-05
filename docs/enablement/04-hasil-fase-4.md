# Hasil Fase 4: artikel oleh mitra (F-05)

Branch `enablement/fase-4`. Rencana: `04-rencana-fase-4.md`, disetujui untuk keenam butir: penyimpanan di Postgres, izin `portal.articles`, artikel terbit yang diubah tetap tampil, Markdown terbatas, migrasi 0008 ke dev, dan endpoint aditif.

## Yang dibuat

**Penulis dan otorisasi**
- Yang boleh menulis: mitra **terverifikasi** dengan role `faskes`, `tenaga_medis`, atau `gaya_hidup`. Ini lewat izin baru `portal.articles` di matriks `PERMISSIONS`.
- Apotek mendapat 403. Mitra yang belum terverifikasi mendapat `PARTNER_NOT_VERIFIED`.
- Artikel mitra lain selalu dibalas **404** untuk semua aksi.
- Moderasi memakai `requireAdmin` yang sudah ada (moderator/admin + TOTP).

**Alur status:** `draft` → `pending` → `published`, ditambah `rejected` dan `withdrawn`. Transisi yang tidak sah → 409 `ARTICLE_NOT_EDITABLE`.
- **Mengajukan** mensyaratkan:
  - pernyataan bebas promosi (`declaration: true`)
  - isi lengkap: judul 10–140, ringkasan 30–300, isi 300–20.000 karakter
  - lolos M17
  - maksimal 5 artikel `pending` per mitra
- **Artikel terbit yang diubah** langsung menjadi `pending`, dengan pernyataan wajib. Versi terbit tetap tampil sampai moderator menyetujui. Bila revisinya ditolak, versi lama tetap tampil.
- **Tarik:** artikel hilang dari situs dan **tidak muncul lagi** walau diubah atau diajukan ulang, sampai moderator menyetujuinya lagi (kolom `withdrawn_at`).
- **Hapus** hanya untuk artikel yang belum pernah terbit.
- **Moderator** bisa menyetujui, menolak (alasan wajib), dan menurunkan artikel (alasan wajib).
- **Audit:** setiap aksi menulis `audit_logs`: `article.create`, `article.update`, `article.submit`, `article.approve`, `article.reject`, `article.withdraw`, `article.staff_withdraw`, dan `article.delete`. Isi lengkap tidak disalin ke log; yang dicatat judul, status, dan panjang isi.

**Tidak bocor:** endpoint publik hanya membaca kolom salinan terbit (`published_*`). Sebuah artikel tampil bila:
- ada salinan terbit
- tidak ditarik
- mitranya masih `verified`
- tidak diblokir aturan M17 yang aktif saat dibaca

**Revalidate ISR**
- Setujui dan tarik memanggil tag `articles`, `article:<slug>`, dan `sitemap`. Tolak tidak memanggil apa pun, karena tampilan publik tidak berubah.
- Saat mitra terverifikasi mengubah datanya (status kembali `pending`) atau diverifikasi ulang, artikelnya ikut di-revalidate.

**Format isi:** Markdown terbatas diubah oleh `parseArticleBody` (`@silk/shared`) menjadi blok berbentuk Portable Text. Renderer artikel yang ada dipakai ulang. HTML, tautan, dan gambar tampil sebagai teks biasa.

**Endpoint baru** (aditif; `docs/openapi.json` kini 81 path)

| Area | Endpoint |
| --- | --- |
| Portal | `GET`/`POST /v1/portal/articles`, `GET`/`PUT`/`DELETE /v1/portal/articles/:id`, `POST …/:id/submit`, `POST …/:id/withdraw` |
| Admin | `GET /v1/admin/articles?status=`, `GET /v1/admin/articles/:id`, `POST …/:id/approve`, `POST …/:id/reject`, `POST …/:id/withdraw` |
| Publik | `GET /v1/articles`, `GET /v1/articles/:slug` |
| Ringkasan admin | `GET /v1/admin/overview` mendapat field `articles` |

**Web**
- **Portal:**
  - menu "Artikel", hanya untuk role berizin
  - `/portal/artikel`: daftar dengan lencana status dan alasan penolakan
  - `/portal/artikel/baru` dan `/portal/artikel/[id]`: editor dengan penghitung karakter, panduan format, pratinjau langsung, centang pernyataan, serta tombol yang mengikuti status
- **Admin:**
  - tab **Artikel** di `/admin/moderasi` (filter status, tanda "Perlu dicek" untuk M17 `tinjau`)
  - halaman tinjau `/admin/moderasi/artikel/[id]` dengan temuan M17, daftar periksa, pratinjau usulan dan versi terbit berdampingan, setujui, tolak, dan turunkan
  - kartu "Artikel" di ringkasan admin
- **Publik:**
  - `/artikel` menggabungkan artikel editorial Sanity dan artikel mitra, terbaru dulu. Bila satu sumber gagal, sumber lainnya tetap tampil.
  - Halaman artikel mitra menampilkan:
    - lencana "Artikel mitra"
    - nama penulis, ditautkan ke profil publiknya bila ada
    - jenis mitra
    - kotak disclaimer: "Ditulis oleh mitra SILK. Isinya bersifat edukasi, bukan diagnosis atau anjuran pengobatan. Konsultasikan keluhan Anda dengan tenaga medis. SILK tidak menerima bayaran untuk menerbitkan artikel."
  - JSON-LD `Article` memakai penulis yang sama (`Organization`, atau `Person` untuk tenaga medis).
  - Sitemap memuat artikel mitra.

## Migrasi 0008

- Berkas: `packages/db/drizzle/0008_fase4_partner_articles.sql`. Isinya enum `article_status` dan tabel `partner_articles`, dengan CHECK, indeks antrean, indeks portal, dan indeks publik parsial. Rencana mundur ada di kepala berkas.
- Tidak mengubah tabel yang sudah terbit.
- Sudah dijalankan di DB **dev** saja.
- **Catatan:** migrasi ini sempat saya jalankan di dev, lalu saya mundurkan dan buat ulang. Waktu menulis service, saya menemukan bahwa artikel yang ditarik lalu diedit bisa tampil lagi sebelum ditinjau. Perbaikannya adalah kolom `withdrawn_at` dan dua CHECK baru.
  - Tabel saat itu kosong.
  - Rollback hanya di dev: `DROP TABLE`, `DROP TYPE`, dan menghapus baris 0008 dari `drizzle.__drizzle_migrations`.
  - Hasilnya tetap satu migrasi 0008, bukan dua.

## Penyimpangan dari rencana

- **Kolom tambahan `withdrawn_at`** (lihat di atas). Tanpa kolom ini, aturan A4 ("tidak bocor") bisa dilanggar lewat artikel tarikan.
- **Tarik:** juga diizinkan untuk artikel yang revisinya ditolak tetapi versi terbitnya masih tampil. Rencana hanya menyebut `published`/`pending`.
- **Ringkasan admin:** field bernama `articles`, bukan `articlesPending`, agar seragam dengan field lain (`revisions`, `media`, …).
- **Aturan M17 "promo" dan "diskon"** ternyata sudah ada di seed sebagai `tinjau`. Artikel yang memuat kata itu otomatis ditandai untuk moderator; tidak ada aturan yang saya tambahkan.
- **Perbaikan tampilan di luar lingkup:** `AppShell` mendapat `min-w-0` pada kolom navigasi. Dengan menu keempat ("Artikel"), tab akun di ponsel melebarkan halaman portal menjadi 445 px.

## Uji

- **Shared:** 151 lolos, termasuk 6 uji `parseArticleBody` dan pembaruan matriks izin.
- **Web:** 167 lolos, termasuk 3 uji penggabungan sumber artikel.
- **Integrasi API `apps/api/test/fase4-articles.test.ts` (19 uji), belum saya jalankan sendiri.** Isinya:
  - otorisasi per role dan per pemilik
  - alur lengkap dan matriks transisi
  - artikel terbit yang diubah
  - revisi ditolak
  - tarik dan muncul kembali hanya setelah disetujui
  - turunkan oleh moderator
  - hapus
  - M17: kata `blokir` ditolak 422, `tinjau` ditandai, aturan `blokir` baru menyembunyikan artikel terbit
  - mitra dicabut atau diubah datanya → artikel tersembunyi, lalu tampil lagi setelah verifikasi ulang
  - batas 5 artikel `pending`
  - audit
  - revalidate (modul di-mock)
  - regresi urutan pencarian profil
- **Smoke test di dev:** M17 menolak "dijamin sembuh" (422), ajukan tanpa pernyataan → 400, artikel `pending` → 404 publik, setelah disetujui tampil dengan penulis dan tautan profil, daftar, dan sitemap.
- `corepack pnpm -r typecheck` dan `corepack pnpm -r lint` bersih.
- **Screenshot:** portal (daftar dan editor) dan halaman artikel publik, desktop 1280 px dan ponsel 390 px, tanpa geser mendatar. Halaman admin lolos typecheck tetapi belum saya tangkap layarnya, karena akun staf membutuhkan TOTP.

## Data uji yang tertinggal di DB dev

- Artikel terbit "Pemanasan dan pendinginan saat berolahraga" milik akun `uji-fase2-gh@contoh.test` (Studio Sehat Uji).
  - Karena di dev tidak ada akun staf ber-TOTP, persetujuannya saya lakukan lewat skrip yang memanggil service langsung.
  - Di audit log, aksi ini tercatat tanpa aktor, dengan `requestId` `dev-smoke-fase4`.
- Satu draf uji berisi klaim terlarang sudah dihapus. Penghapusannya tercatat di audit.

## Langkah manual

1. **Jalankan uji integrasi:** `corepack pnpm --filter @silk/api test`. Arahkan `TEST_DATABASE_URL` ke branch Neon khusus uji, karena uji ini mengosongkan DB. DB uji juga butuh migrasi 0007 dan 0008.
2. **Migrasi 0008 ke staging/produksi** hanya setelah uji lolos dan dengan persetujuan.
3. **Petugas moderasi artikel** perlu ditetapkan sebelum fitur ini dipakai mitra sungguhan. Setiap artikel dan setiap perubahan ditinjau manual.

## Belum termasuk

- Gambar sampul unggahan, gambar di dalam isi, dan tautan.
- Kategori atau tag artikel, serta halaman daftar artikel per penulis.
- Email atau notifikasi ke penulis saat disetujui atau ditolak (Fase 5).

## Commit

- `bdf9f63` rencana
- `8f4782a` shared
- `16de9cc` db
- `4dc0616` api
- `5377adb` web
- `e2ecbb8` revalidate saat status mitra berubah
