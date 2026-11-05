# Hasil Fase 2: profil layanan untuk semua mitra, media, revisi, permintaan harga

Branch `enablement/fase-2`. Rencana: `02-rencana-fase-2.md` (disetujui, termasuk keempat butir yang butuh izin).

## Yang dibuat

**Profil untuk semua jenis mitra (K1, K2, K11)**
- Setiap profil adalah baris `facilities`. Jenisnya diturunkan dari jenis mitra; ada jenis baru `gaya_hidup` dan `rumah_duka`.
- Hanya mitra **terverifikasi** yang bisa membuat profil. Non-faskes dibatasi satu profil, faskes boleh lebih dari satu.
- Tenaga medis otomatis mendapat entri praktisi yang tertaut ke profilnya.
- Alur: draf → ajukan → menunggu tinjauan → moderator menerbitkan.
- Portal `/portal` terbuka untuk semua role mitra. Halaman klaim (M7) tetap khusus faskes.

**Revisi profil terbit (K3)**
- Perubahan pada profil terbit menjadi revisi. Halaman publik tetap memakai data lama sampai moderator menyetujui.
- Revisi kedua menggantikan yang masih menunggu dan menggabungkan isinya.
- Profil draf dan yang sedang ditinjau diubah langsung. Profil yang ditarik tidak bisa diubah (409).

**Lokasi dan jadwal (K6, K7)**
- Maksimal 10 lokasi, tepat satu lokasi utama. Lokasi utama disalin ke kolom faskes untuk pencarian dan peta.
- Jadwal per hari disimpan dalam jam lokal ditambah zona waktu (WIB, WITA, WIT), dengan jenis `operasional` atau `praktik`.

**Foto dan video (K8)**
- Maksimal 10 foto (JPEG, PNG, atau WebP, ≤ 5 MB) dan 1 video (MP4 atau WebM, ≤ 100 MB, ≤ 120 detik).
- Alur unggah: presign → PUT langsung ke penyimpanan → konfirmasi.
- Saat konfirmasi, API memeriksa ukuran, magic bytes, dan durasi MP4 dari atom `mvhd`.
- Media tampil setelah moderator menyetujui; saat itu berkas disalin ke penyimpanan publik.

**Harga lewat permintaan (K4, K5, K10)**
- Harga dari mitra tidak pernah langsung masuk `tariff_versions`. Harga masuk `tariff_change_requests` dulu.
- Setiap permintaan wajib mencantumkan sumber. Dokumen bukti wajib ada sebelum permintaan bisa disetujui.
- Bila disetujui, terbentuk satu versi baru `diverifikasi_admin`, dicek terhadap versi dasar.
- Impor CSV dari portal menjadi **satu** permintaan per berkas. Admin tidak bisa menerbitkan batch portal secara langsung.
- Layanan bisa diaktifkan atau dinonaktifkan (`tariffs.active`). Layanan nonaktif disaring di VIEW `published_tariffs`.

**Web**
- **Portal:**
  - Beranda "Profil layanan saya".
  - `/portal/profil-baru`.
  - Editor profil: banner status/revisi, lokasi dengan pemilih titik di peta, jadwal per hari (dengan tombol salin Senin ke Senin–Jumat), serta galeri foto dan video. Durasi video diukur di browser sebelum diunggah.
  - Halaman tarif: "Ajukan harga" / "Ajukan perubahan harga", aktif/nonaktif, daftar permintaan beserta statusnya, dan unggah bukti.
  - Impor CSV menghasilkan permintaan harga, dengan langkah unggah bukti.
- **Admin:** `/admin/moderasi` dengan tab Profil baru, Revisi (dengan tabel saat ini vs usulan), Media (pratinjau), dan Harga (harga lama vs baru, dokumen, setujui, atau tolak dengan alasan). Ringkasan admin mendapat empat kartu baru.
- **Publik `/faskes/[slug]`:** galeri foto, video (`preload="none"`), jam buka per hari dengan zona waktu (kembali ke teks jam lama bila jadwal kosong), jadwal praktik dengan tautan ke dokter, dan lokasi lain.

**Audit:** aksi yang dicatat:
- `profile.create`, `profile.submit`, `profile.revision.submit|approve|reject`
- `media.presign|upload|delete|reorder|approve|reject`
- `tariff.request.create|approve|reject`, `tariff.request.document.presign|confirm`
- `tariff.active.toggle`, `facility.update`, `import.create`

## Endpoint

Daftar lengkap ada di rencana bagian 4 dan di `docs/openapi.json` (69 path).

Perubahan perilaku yang perlu diketahui klien:

| Endpoint | Sebelum | Sekarang |
| --- | --- | --- |
| `PUT /v1/portal/facilities/:id` | langsung tersimpan | profil terbit → revisi, respons `needsReview: true` |
| `POST /v1/portal/facilities/:id/tariffs`, `PUT /v1/portal/tariffs/:id` | versi langsung terbit | `{requestId, status: "pending", needsReview}`; `sourceTitle` wajib |
| `POST /v1/portal/facilities/:id/tariffs/import` | `{created, skipped}` | `{batchId, requestId, status, rowsValid}` |
| `GET /v1/me` | `memberships` hanya untuk faskes | `memberships` untuk semua role mitra |

## Migrasi 0006

- Berkas: `packages/db/drizzle/0006_fase2_profile.sql`. Rencana mundur ada di komentar kepala berkas.
- Isinya:
  - nilai enum baru
  - `tariffs.active`
  - tabel `profile_locations`, `schedules`, `profile_media`, `profile_revisions`, `tariff_change_requests`
  - `documents` polimorfik
  - VIEW `published_tariffs` diganti
- Sudah dijalankan di DB **dev**. Belum dijalankan di staging maupun produksi.
- Seed referensi (`db:seed -- --reference-only`) juga dijalankan di dev untuk menambah layanan kategori baru. Seed ini bersifat upsert dan idempoten.

## Penyimpangan dari rencana

- **Status permintaan:** bernilai `pending`, bukan `menunggu`. Status revisi, media, dan permintaan harga memakai satu enum `review_status`: `pending`, `approved`, `rejected`, `superseded`.
- **Impor CSV:** satu permintaan per berkas, bukan per baris. Moderator memeriksa satu dokumen sumber untuk seluruh berkas, dan penolakan berlaku untuk seluruh batch.
- **Revisi:** yang masih menunggu digabung saat digantikan, bukan dibuang. Usulan sebelumnya tidak hilang ketika mitra mengubah isian lain.
- **Penyimpanan media di dev:** tanpa `R2_MEDIA_BUCKET`, URL publik media diarahkan lewat rute dev `/v1/dev/storage/public/*`. Rute ini hanya ada di luar produksi dan hanya melayani media yang sudah disetujui. Di produksi, menyetujui media tanpa bucket akan gagal.
- **Perbaikan tambahan `/me`:** `/me` sebelumnya tidak memuat profil mitra non-faskes, sehingga portal menolak halaman profil mereka. Ini ditemukan saat uji tampilan, diperbaiki, dan ditambah uji.

## Belum termasuk / tindak lanjut

- Tab "Profil baru" di admin hanya menampilkan nama, jenis, kota, dan tanggal. Belum ada pratinjau isi profil draf, karena itu butuh endpoint admin baru. Untuk saat ini, isi profil sudah melewati filter M17.
- Lencana verifikasi profil non-faskes masih berlabel "Diisi faskes" (enum `diisi_faskes`). Perlu label netral seperti "Diisi mitra"; ini perubahan teks publik, jadi saya tidak mengubahnya tanpa izin.
- Halaman admin moderasi sudah lolos typecheck dan terkompilasi, tetapi belum saya tangkap layarnya karena akun staf memerlukan TOTP. API di baliknya sudah diuji lewat smoke test.

## Langkah manual

1. **Uji integrasi** (belum saya jalankan sendiri): `corepack pnpm --filter @silk/api test`. Uji ini mengosongkan DB, jadi pastikan `TEST_DATABASE_URL` mengarah ke `test_silk` atau branch Neon khusus uji.
   - Berkas baru: `fase2-profile.test.ts` (26 uji).
   - Berkas yang disesuaikan: `m6-portal`, `m15-m17-admin`, dan `fase1-auth`.
2. **R2 media publik:** buat bucket media dengan domain publik, lalu isi `R2_MEDIA_BUCKET` dan `MEDIA_PUBLIC_BASE_URL` (contoh ada di `.env.example`).
3. **Migrasi 0006 ke staging/produksi** hanya setelah uji lolos dan dengan persetujuan.

## Data uji yang tertinggal di DB dev

- **Akun:** `uji-fase2-gh@contoh.test`, sandi `SandiUji-Fase2!`, role `gaya_hidup`, mitra terverifikasi.
- **Profil:** `studio-sehat-uji-fase-2-kota-malang`, status terbit, dengan 2 lokasi, jadwal Senin–Sabtu, dan 2 tarif (konsultasi gizi Rp150.000, kelas senam Rp50.000).
- **Media:** satu foto asli "Uji tampilan" berstatus **menunggu**, bisa dipakai untuk mencoba tab Media di `/admin/moderasi`. Foto palsu dari smoke test sudah dihapus.

## Pemeriksaan

- `corepack pnpm -r typecheck` dan `corepack pnpm -r lint` bersih.
- Uji unit: shared 131 lolos, web 157 lolos (termasuk 13 uji `lib/profile`).
- Smoke test API di dev lolos untuk semua alur di atas.
- Screenshot portal dan halaman publik (desktop 1280 px dan ponsel 390 px): tidak ada geser mendatar.
