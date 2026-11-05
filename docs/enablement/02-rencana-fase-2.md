# Rencana Fase 2: profil layanan, jadwal, video, kategori baru (F-02)

Status: **menunggu persetujuan**. Branch: `enablement/fase-2` (dari `enablement/fase-1`).
Acuan: SRS F-02, UC-04, UC-12, UC-13, diagram kelas ProfilLayanan, Lokasi, Layanan, JadwalPraktik.

## 1. Temuan di base yang menentukan desain

1. **Tidak ada status per versi tarif.** `published_tariffs` mengambil versi *terbaru* yang sudah berlaku untuk tarif berstatus `terbit`.
   - Akibatnya, kalau usulan harga mitra disimpan sebagai baris `tariff_versions` "menunggu", usulan itu langsung tampil ke publik.
   - Menandainya "disetujui" belakangan butuh UPDATE, padahal tabel itu append-only.
2. **Faskes terverifikasi saat ini menerbitkan harga langsung** (M6, `portalTariffStatus`). Begitu juga perubahan profil, kecuali teks terkena aturan `tinjau` M17.
3. **Status profil berlaku untuk seluruh faskes.** Mengubah `facilities.status` ke `menunggu_tinjauan` setiap kali deskripsi diedit akan menyembunyikan faskes beserta *semua* tarifnya dari publik.
4. **Belum ada foto, video, jadwal terstruktur, atau lokasi ganda.** Jam operasional sekarang berupa JSON bebas di `facilities.hours`.
5. **Profil hanya ada untuk faskes** (`facilities` + `memberships`).
   - Tenaga medis punya tabel `practitioners` yang minimal.
   - Gaya hidup dan apotek belum punya profil sama sekali.
   - Enum `facility_type` sudah memuat `praktik_dokter` dan `apotek`.
6. **`documents` terikat ke klaim** (`claim_id NOT NULL`).

## 2. Keputusan desain (rekomendasi saya)

### K1. Satu model profil untuk semua jenis mitra
Setiap profil layanan tetap berupa baris `facilities`. Dengan begitu halaman publik, tarif, `published_tariffs`, peta, pencarian, dan ISR yang sudah ada langsung terpakai.

| Jenis mitra | `facilities.type` |
| --- | --- |
| fasilitas | jenis dari data mitra (`rumah_sakit`, `klinik`, …, **`rumah_duka`** baru) |
| tenaga_medis | `praktik_dokter`, plus satu baris `practitioners` (nama, spesialisasi, STR dari data mitra) yang ditautkan |
| gaya_hidup | **`gaya_hidup`** (baru) |
| apotek | `apotek` |

- Enum `facility_type` mendapat 2 nilai baru: `gaya_hidup` dan `rumah_duka`. **Butuh izin** (skema terbit).
- URL publik tetap `/faskes/[slug]`; label jenis disesuaikan. Penggantian URL tidak masuk fase ini.

### K2. Membuat profil
- Mitra berstatus **`verified`** bisa membuat profil baru (`draft`). Keanggotaan dibuat otomatis.
- Mitra non-faskes: maksimal 1 profil (SRS: satu ProfilLayanan per mitra).
- Mitra faskes: boleh membuat profil baru bila faskesnya belum ada di SILK. Bila sudah ada, tetap lewat klaim M7.
- Alur: `draft` → mitra menekan **Ajukan terbit** → `menunggu_tinjauan` → moderator **terbitkan**.
- Selama `draft`, mitra bebas mengedit.

### K3. Perubahan profil terbit lewat revisi
Tabel baru `profile_revisions` berisi usulan perubahan field publik dalam JSON yang divalidasi Zod: nama, deskripsi, telepon, situs, lokasi, jadwal.
- Publik tetap melihat versi lama sampai moderator menyetujui. Saat disetujui, perubahan diterapkan dalam satu transaksi beserta audit dan revalidasi ISR.
- Satu revisi menunggu per profil. Revisi baru menggantikan yang lama dan menandai yang lama `superseded`.
- Field non-publik tidak ada di fase ini.
- **Mengubah perilaku M6:** `PUT /v1/portal/facilities/:id` pada profil terbit tidak lagi langsung tampil. Respons bertambah `revision: { id, status }`. **Butuh izin** (kontrak API).

### K4. Harga lewat permintaan perubahan, bukan versi menunggu
Tabel baru `tariff_change_requests` berisi tarif atau layanan, tipe harga, min, maks, tanggal berlaku, rincian termasuk/tidak termasuk, sumber, dan **dokumen bukti wajib**.
- **Setujui:** service memanggil `appendVersion()` yang sudah ada dengan `verification = 'diverifikasi_admin'`, sumber = sumber dari permintaan, dan status tarif `terbit`. Baru setelah itu tampil lewat `published_tariffs`.
- **Tolak:** alasan wajib. `tariff_versions` tidak tersentuh sama sekali.
- `tariff_versions` tetap append-only dan hanya berisi harga yang sudah lolos verifikasi. VIEW tidak perlu memahami status permintaan.
- **Penyimpangan dari teks spesifikasi:** spesifikasi menyebut "baris `tariff_versions` baru berstatus menunggu". Itu tidak bisa dilakukan tanpa UPDATE (lihat temuan 1); tujuannya tetap tercapai.
- **Mengubah perilaku M6:** semua mitra, termasuk faskes terverifikasi, tidak lagi menerbitkan harga langsung.
  - `POST /portal/facilities/:id/tariffs` dan `PUT /portal/tariffs/:id` mengembalikan `{ requestId, status: 'menunggu' }`.
  - Impor CSV portal menghasilkan satu permintaan per baris.
  - **Butuh izin** (kontrak API). Kolom `expectedVersionNo` tetap dicek saat disetujui.
- Impor admin (M5) dan edit tarif oleh admin tidak berubah.

### K5. Layanan aktif/nonaktif
- Kolom baru `tariffs.active boolean NOT NULL DEFAULT true`. VIEW `published_tariffs` diganti dengan tambahan `AND t.active`, sehingga batas tarif terbit tetap didefinisikan di satu VIEW.
- Menonaktifkan berlaku langsung karena hanya menyembunyikan info. Mengaktifkan kembali juga langsung, kecuali tarif `ditarik` admin.
- **Butuh izin** (skema terbit dan VIEW).

### K6. Lokasi lebih dari satu
- Tabel baru `profile_locations`: alamat, kota, provinsi, `region_id`, `geography(Point,4326)`, `is_primary`, label (mis. "Cabang Dinoyo").
- Lokasi utama tetap disalin ke `facilities.address/city/province/location` dalam transaksi yang sama, supaya pencarian dan peta saat ini tidak berubah. Fase 3 baru memakai semua lokasi.
- Data: setiap faskes yang sudah ada mendapat satu lokasi utama dari kolomnya sekarang.

### K7. Jadwal
- Tabel baru `schedules`: `facility_id`, `practitioner_id` (opsional), `kind` (`operasional` | `praktik`), `weekday` 1–7 (ISO, Senin = 1), `start_time` dan `end_time` bertipe `time`, `timezone` (default `Asia/Jakarta`), dan catatan.
- Jam disimpan sebagai jam lokal plus zona, bukan UTC, karena jadwal berulang.
- CHECK `end_time > start_time`. Jadwal melewati tengah malam ditulis sebagai dua baris.
- Kolom lama `facilities.hours` tidak dihapus. Halaman publik memakainya hanya bila jadwal terstruktur kosong.

### K8. Foto dan video
Tabel baru `profile_media`: jenis, `object_key`, MIME, ukuran, durasi, lebar, tinggi, status (`pending` | `approved` | `rejected`), alasan, urutan, pengunggah.

| | Foto | Video |
| --- | --- | --- |
| Format | JPEG, PNG, WebP | MP4, WebM |
| Ukuran | ≤ 5 MB | ≤ 100 MB |
| Jumlah | maks 10 per profil | maks 1 per profil |
| Durasi | – | **maks 120 detik** |

- Alur unggah: presign → PUT langsung ke R2 (satu PUT; R2 menerima hingga 5 GB, jadi multipart tidak perlu) → confirm.
- Saat confirm, API memeriksa ukuran sebenarnya dan magic bytes. Berkas yang tidak sah dihapus.
- Durasi diukur di browser sebelum unggah dan, untuk MP4, dicek ulang di server dari header `mvhd`. WebM tidak bisa diukur andal tanpa ffprobe (tidak tersedia di Vercel), jadi durasinya dicek moderator.
- Tanpa transkoding. Pemutar memakai `<video controls preload="none">` bawaan browser, **tanpa dependency baru**.
- Media hanya tampil setelah disetujui moderator. Objek di bucket privat diakses lewat URL bertanda tangan berumur pendek, atau di produksi lewat domain publik R2 khusus media yang sudah disetujui (lihat bagian 8).
- **Tautan YouTube/Vimeo tidak saya ambil di fase ini.** Isi embed bisa berubah setelah dimoderasi, memasang pelacak pihak ketiga, dan butuh pengecualian CSP. Bisa ditambah nanti bila diminta.

### K9. Kategori baru lewat taksonomi
- `service_categories` (taksonomi yang ada) mendapat `gaya-hidup-sehat` dan `rumah-duka`, ditambahkan lewat `seedReference` yang idempoten, tanpa hardcode di kode.
- Layanan awal di katalog:
  - Gaya hidup sehat: konsultasi gizi, sesi latihan pribadi, kelas senam, konseling gaya hidup.
  - Rumah duka: pemulasaraan jenazah, sewa ruang persemayaman, mobil jenazah.
- Mitra memilih dari katalog. Usulan layanan baru oleh mitra ditunda ke Fase 7 (kelola katalog di panel admin).
- **Butuh izin** (penambahan kategori).

### K10. Dokumen bukti harga
- `documents.claim_id` dijadikan nullable. Tambah kolom `tariff_change_request_id`, dengan CHECK tepat satu induk terisi.
- Alur presign, confirm, dan lihat dengan URL singkat dipakai ulang dari M7.
- **Butuh izin** (skema terbit).

### K11. Akses portal untuk semua mitra
- Permission `portal.facility` diperluas dari `faskes` ke semua role mitra. Akses per profil tetap dicek lewat `memberships`.
- Klaim M7 tetap khusus faskes (permission baru `portal.claims`).
- Membuat profil, mengajukan revisi, harga, dan media mensyaratkan `partners.status = 'verified'`.
- **Butuh izin** (otorisasi).

## 3. Skema (migrasi 0006, hanya ke DB dev setelah disetuju)

- **Enum:**
  - `facility_type` mendapat `gaya_hidup` dan `rumah_duka` (`ALTER TYPE … ADD VALUE`, di statement terpisah).
  - Enum baru: `schedule_kind`, `media_kind`, `review_status` (`pending`, `approved`, `rejected`, `superseded`).
- **Tabel baru:**
  - `profile_locations`
  - `schedules`
  - `profile_media`
  - `profile_revisions`: `facility_id`, `payload` jsonb, `status`, `submitted_by`, `reviewed_by`, `reviewed_at`, `rejection_reason`, `created_at`, plus indeks unik parsial "satu pending per profil".
  - `tariff_change_requests`: `facility_id`, `tariff_id` (null bila layanan baru), `service_id`, `package_id`, kolom harga sama seperti `tariff_versions`, `source_title`, `source_url`, `status`, `decided_by`, `decided_at`, `rejection_reason`, `resulting_version_id`.
- **Perubahan tabel terbit:**
  - `tariffs.active`
  - `documents.claim_id` nullable dan `documents.tariff_change_request_id`
  - VIEW `published_tariffs` diganti (tambah `t.active`)
- **Data:** satu `profile_locations` utama untuk setiap faskes yang sudah ada.
- **Rencana mundur** ditulis di kepala berkas SQL.

## 4. Endpoint (semua aditif, kecuali yang ditandai K3/K4)

**Portal mitra** (`/v1/portal`, sesi + CSRF + keanggotaan):
- `POST /profiles`: buat profil baru (K2).
- `GET /facilities/:id`: bertambah `locations`, `schedules`, `media`, `pendingRevision`.
- `PUT /facilities/:id`: draft diterapkan langsung, profil terbit menjadi revisi (K3). Body bertambah `locations[]` dan `schedules[]`.
- `POST /facilities/:id/submit`: draft → menunggu tinjauan.
- `POST /facilities/:id/media/presign`, `POST /facilities/:id/media/:mediaId/confirm`, `DELETE /facilities/:id/media/:mediaId`, `PUT /facilities/:id/media/order`.
- `POST /facilities/:id/tariffs` dan `PUT /tariffs/:id`: menjadi permintaan harga (K4).
- `PATCH /tariffs/:id/active` (K5).
- `GET /facilities/:id/tariff-requests`.
- `POST /tariff-requests/:id/documents/presign` dan `…/:documentId/confirm`.

**Admin** (`/v1/admin`, moderator dan admin, TOTP):
- `GET /profile-revisions`, `POST /profile-revisions/:id/approve|reject`
- `GET /media?status=pending`, `POST /media/:id/approve|reject`
- `GET /tariff-requests`, `GET /tariff-requests/:id` (dokumen lewat signed URL singkat), `POST /tariff-requests/:id/approve|reject`
- Publikasi profil baru memakai `PATCH /admin/facilities/:id` (status) yang sudah ada.

**Publik:**
- `GET /v1/facilities/:slug` bertambah `locations`, `schedules`, `media`. Hanya media `approved` dan data versi yang sudah terbit.

## 5. Aturan yang ditegakkan

- **M17:** semua teks publik (nama, deskripsi, label lokasi, catatan jadwal, rincian tarif) diperiksa saat diajukan *dan* saat disetujui. Kata "termurah" dan sejenisnya ditolak dengan 422.
- **Audit:** `profile.create`, `profile.submit`, `profile.revision.submit|approve|reject`, `media.upload|approve|reject|delete`, `tariff.request.create|approve|reject`, `tariff.active.toggle`.
- **Keamanan:**
  - Mitra hanya mengakses profil yang dia kelola; profil orang lain diperlakukan seperti tidak ada (403 atau 404 seperti sekarang).
  - Objek media diberi nama acak di bawah `profiles/{facilityId}/`.
  - MIME dan ukuran ikut ditandatangani di URL unggah.
- **Uang:** bigint rupiah. **Waktu:** `timestamptz` UTC, kecuali jam jadwal (lokal + zona, K7).
- **Urutan:** tidak ada yang berubah; foto dan video tidak memengaruhi urutan.

## 6. Web

- **Portal `/portal/faskes/[id]/profil`** diperluas:
  - deskripsi
  - daftar lokasi dengan pemilih titik di peta (MapLibre yang sudah ada)
  - editor jadwal per hari
  - galeri foto (unggah, urutkan, hapus) dan satu video, masing-masing dengan status moderasi
  - banner "ada perubahan menunggu tinjauan"
- **`/portal/mitra`:** tombol "Buat profil layanan" untuk mitra terverifikasi yang belum punya profil.
- **Tarif portal:** form harga menjadi "Ajukan perubahan harga", dengan tanggal berlaku, sumber, dan dokumen bukti wajib. Ada daftar permintaan beserta statusnya, dan tombol aktif/nonaktif per layanan.
- **Admin:** halaman baru `/admin/moderasi` dengan tab Revisi profil, Media, dan Harga. Tab Harga menampilkan perbandingan harga lama dan baru, dokumen, setujui, dan tolak dengan alasan.
- **Publik `/faskes/[slug]`:** galeri foto, video (dimuat saat diputar), jadwal per hari, dan daftar lokasi. Label jenis untuk gaya hidup dan rumah duka.
- Semua teks lewat `messages/id.ts`.

## 7. Uji

**Unit (shared/web):**
- skema lokasi, jadwal, media, permintaan harga, dan revisi
- parser durasi MP4 (`mvhd`)
- urutan hari dan format jam
- batas ukuran dan jumlah media

**Integrasi (`apps/api/test/fase2-profile.test.ts`):**
- mitra A tidak bisa membaca atau mengubah profil, media, harga, atau jadwal mitra B
- mitra yang belum terverifikasi tidak bisa membuat profil
- non-faskes tidak bisa membuat profil kedua
- unggahan di atas batas (foto 5 MB+1, video 100 MB+1, MIME salah, magic bytes salah) ditolak
- teks berisi "termurah" ditolak dengan 422 di deskripsi, label lokasi, catatan jadwal, dan rincian tarif
- usulan harga **tidak mengubah** tarif lama: `published_tariffs` tetap sama sampai disetujui, jumlah baris `tariff_versions` tetap, ditolak tetap sama
- disetujui menambah tepat satu versi dengan `diverifikasi_admin`
- permintaan harga tanpa dokumen bukti tidak bisa disetujui
- revisi profil terbit: publik tetap versi lama sampai disetujui; revisi kedua menggantikan yang pertama
- media pending atau ditolak tidak muncul di endpoint publik
- `active = false` menyembunyikan tarif dari publik dan `published_tariffs`
- migrasi data: setiap faskes lama punya tepat satu lokasi utama
- semua aksi tercatat di `audit_logs`
- uji M6 dan M5 lama yang terdampak K3 dan K4 diperbarui sesuai perilaku baru

## 8. Risiko dan hal terbuka

- **Perubahan alur M6 (K3, K4)** memperlambat faskes terverifikasi karena harga dan profil kini menunggu moderator. Ini sesuai keputusan tabel konflik ("berlaku sejak awal"), tapi butuh petugas moderasi.
- **Penyajian media di produksi:** URL bertanda tangan berumur pendek merusak cache ISR halaman. Usul saya: bucket atau domain publik R2 terpisah (`MEDIA_PUBLIC_BASE_URL`) yang hanya berisi media `approved`. Objek disalin saat disetujui; objek yang ditolak tidak pernah masuk ke sana. Di dev dan uji memakai adaptor lokal. Variabel baru masuk ke `.env.example`. Langkah manual untukmu: membuat bucket dan domain R2.
- **Durasi WebM** tidak bisa dipastikan di server (lihat K8). Moderator menjadi gerbang terakhir.
- Pencarian dan peta baru memakai lokasi tambahan dan kategori baru di Fase 3.

## 9. Yang butuh izinmu

1. Enum `facility_type` mendapat `gaya_hidup` dan `rumah_duka`; kategori layanan `gaya-hidup-sehat` dan `rumah-duka` (K1, K9).
2. Perubahan tabel terbit: `tariffs.active`, `documents` polimorfik, dan VIEW `published_tariffs` diganti (K5, K10).
3. Perubahan kontrak dan perilaku M6: revisi profil dan permintaan harga, sehingga faskes terverifikasi tidak lagi terbit langsung (K3, K4).
4. Perluasan otorisasi portal ke semua role mitra (K11).
5. Bucket atau domain publik R2 untuk media yang sudah disetujui (bagian 8).
6. Tanpa dependency baru (pemutar video bawaan browser, parser MP4 kecil ditulis sendiri).
