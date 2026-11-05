# Fase 0: Audit base SILK terhadap SRS v1.0

Tanggal: 5 November 2026. Branch: `enablement/fase-0`.

Dasar audit:
- Kode di repo (commit awal `5b33c32`).
- `docs/srs-silk.md` (SRS v1.0, Oktober 2026), termasuk 15 diagram gambarnya.
- `CLAUDE.md`, `docs/blueprint-teknis.md`, `docs/ringkasan-proyek.md`.
- `docs/enablement/prompt-enablement.md`.

Status yang dipakai di dokumen ini:
- **ada**: sudah berfungsi di base.
- **sebagian**: sebagian sudah ada, sebagian belum.
- **belum**: belum ada sama sekali.

## Ringkasan

Base sudah menutup bagian informasi publik SRS, yaitu:
- Direktori dan profil faskes.
- Tarif bersumber dengan riwayat versi.
- Perbandingan tarif.
- Peta.
- Artikel.
- Email transaksional.
- Panel moderasi.

Tiga bagian belum ada sama sekali:
- Role pasien dan tiga jenis mitra baru (tenaga medis, gaya hidup, apotek).
- Interaksi pengguna: ulasan, notifikasi in-app, dan AI chat.
- Semua hal transaksional atau yang menyangkut data pribadi: marketplace apotek, catatan kesehatan, dan langganan.

Tidak ada feature flag di base. Modul flag perlu dibuat di Fase 1, sebelum fitur ber-flag pertama ditulis.

## a. Padanan fitur SRS ke base

### Fitur F-01 sampai F-11

| SRS | Modul base | Status | Yang sudah ada | Celah | File kunci |
| --- | --- | --- | --- | --- | --- |
| F-01 Auth dan pengguna | Auth (M15/M16) | sebagian | Daftar, verifikasi email lewat **tautan**, login cookie, TOTP, reset sandi, rate limit di DB, Turnstile, argon2id | Role pasien dan 3 jenis mitra; OTP berupa **kode**; JWT; atribut izin per jenis mitra | `apps/api/src/auth/auth.ts`, `apps/api/src/middleware/auth.ts`, `apps/web/src/app/(akun)/*` |
| F-02 Profil layanan | M1, M2, M6 | sebagian | Profil faskes (deskripsi, alamat, titik PostGIS, telepon, situs, `hours` jsonb), tarif dengan versi, portal ubah profil | Foto, video, jadwal per hari, lokasi lebih dari satu, profil untuk mitra non-faskes, kategori gaya hidup dan rumah duka | `packages/db/src/schema/domain.ts`, `apps/api/src/modules/m6-portal/*`, `apps/web/src/app/portal/faskes/[id]/*` |
| F-03 Pencarian dan filter | M1, M3 | sebagian | `q` trigram, `city`, `type`, `service`, radius `lat/lng`; perbandingan diurutkan harga naik | Filter rentang biaya di pencarian faskes, filter dan urutan rating, pencarian apotek dan produk | `apps/api/src/modules/m1-directory/*`, `m3-compare/*`, `apps/web/src/app/cari` |
| F-04 AI chat | – | belum | – | Seluruhnya | – |
| F-05 Artikel | M12 | sebagian | Artikel Sanity lewat ISR, filter M17 lewat webhook, JSON-LD | Penulis dari mitra, alur draft → menunggu → terbit di dalam SILK | `apps/web/src/lib/sanity.ts`, `apps/api/src/modules/m12-content/*` |
| F-06 Marketplace apotek | – | belum | Enum `facility_type` sudah memuat `apotek` | Seluruhnya: produk, keranjang, pesanan, Midtrans | – |
| F-07 Riwayat dan rekam medis | – | belum | – | Seluruhnya | – |
| F-08 Rating dan ulasan | M17 (filter) | belum | Filter konten bisa dipakai ulang | Seluruh entitas dan alur | `apps/api/src/modules/m17-content-rules/*` |
| F-09 Notifikasi sistem | – | belum | Laporan data mengirim email status (M14) | Tabel notifikasi in-app, lonceng, preferensi | – |
| F-10 Panel admin | M15, M7, M5, M14, M17 | sebagian | Antrean klaim, laporan, impor, tarif, faskes, audit log, jobs, aturan konten; wajib MFA; sesi admin 8 jam | Verifikasi per jenis mitra, UI kelola pengguna, moderasi ulasan dan artikel mitra | `apps/api/src/modules/m15-admin/*`, `apps/web/src/app/admin/*` |
| F-11 Email | Email adapter | sebagian | `sendEmail` dengan Resend (log/outbox di dev). Jenis: `verify-email`, `reset-password`, `report-status`, `stale-reminder`, `tariff-changed`, `faskes` | Adapter SMTP, email transaksi pesanan, antarmuka `EmailService` | `apps/api/src/lib/email.ts` |

### Use case UC-01 sampai UC-23

| UC | Nama | Status | Catatan dan file |
| --- | --- | --- | --- |
| UC-01 | Registrasi dan verifikasi | sebagian | Verifikasi lewat tautan email, bukan kode OTP. Role default `faskes`. `(akun)/daftar` |
| UC-02 | Login | sebagian | Cookie session dan TOTP; tanpa JWT. `(akun)/masuk` |
| UC-03 | Cari dan filter | sebagian | Belum ada filter biaya di pencarian faskes dan belum ada rating. `/cari`, `GET /v1/facilities` |
| UC-04 | Profil, harga, video | sebagian | Profil, tarif dengan TrustBadge, dan riwayat versi sudah ada. Video dan ulasan belum. `/faskes/[slug]` |
| UC-05 | Lokasi di peta | ada | Memakai MapLibre dan MapTiler, **bukan Google Maps** (lihat konflik T2). `components/facility-map.tsx` |
| UC-06 | AI chat | belum | – |
| UC-07 | Baca artikel | ada | `/artikel`, `/artikel/[slug]` |
| UC-08 | Beli obat | belum | – |
| UC-09 | Bayar pesanan | belum | – |
| UC-10 | Rating dan ulasan | belum | – |
| UC-11 | Riwayat dan rekam medis | belum | – |
| UC-12 | Kelola profil layanan | sebagian | Hanya pengelola faskes: profil dan tarif lewat versi. `/portal/faskes/[id]` |
| UC-13 | Unggah video | belum | Pola signed URL R2 sudah ada (M7) dan bisa dipakai ulang |
| UC-14 | Tulis artikel | belum | Artikel hanya ditulis editor di Sanity |
| UC-15 | Lihat ulasan | belum | – |
| UC-16 | Akses rekam medis pasien | belum | – |
| UC-17 | Kelola produk dan stok | belum | – |
| UC-18 | Proses pesanan | belum | – |
| UC-19 | Verifikasi mitra | sebagian | Klaim faskes dengan dokumen izin (M7). Jenis mitra lain belum. `/admin/klaim` |
| UC-20 | Kelola data pengguna | sebagian | Endpoint admin Better Auth (`set-role`, `ban-user`, dan seterusnya) ada dan diaudit. Belum ada halaman admin pengguna |
| UC-21 | Moderasi ulasan dan artikel | sebagian | Tinjauan tarif sudah ada. Artikel hanya disaring M17 otomatis. Ulasan belum |
| UC-22 | Pantau aktivitas | sebagian | Audit log, ringkasan antrean, dan jobs. Belum ada dasbor metrik |
| UC-23 | Notifikasi dan email | sebagian | Email sudah ada, notifikasi in-app belum |

### Modul blueprint yang tidak ada di SRS

Fitur-fitur ini tetap dipertahankan:
- M4 lapisan kepercayaan.
- M5 impor data publik.
- M14 laporan data salah.
- M17 filter konten.
- M18 analitik PostHog.

## b. Database dan migrasi

- **Migrasi terakhir:** `0004_tariff_ask_no_price`, yaitu CHECK yang memastikan tarif `tanya` tidak punya angka.
- **0000:** ekstensi PostGIS, pg_trgm, unaccent, citext.
- **0001:** skema awal.
- **0002:** trigger `tariff_versions_append_only` (fungsi `silk_forbid_tariff_version_mutation`) yang menolak UPDATE dan DELETE.
- **0003:** VIEW `published_tariffs`, satu-satunya definisi "tarif terbit".

Tabel yang ada sekarang:
- **Auth (Better Auth):** `user`, `session`, `account`, `verification`, `two_factor`, `rate_limit`
- **Katalog:** `regions`, `service_categories`, `services`, `facilities`, `practitioners`, `facility_practitioners`
- **Tarif:** `tariffs`, `tariff_versions`, `packages`, `package_components`, `data_sources`
- **Operasional:** `memberships`, `facility_claims`, `documents`, `import_batches`, `import_rows`, `data_reports`, `content_rules`, `audit_logs`, `jobs`, `rate_limit_counters`

Enum:
- `entity_status`: draft, menunggu_tinjauan, terbit, ditarik
- `facility_type`: rumah_sakit, klinik, puskesmas, laboratorium, praktik_dokter, apotek
- `price_type`: tetap, rentang, mulai_dari, paket, tanya
- `verification_level`: publik_belum_diverifikasi, dari_dokumen_publik, diisi_faskes, diverifikasi_admin

Kategori layanan saat seed: `laboratorium`, `mcu`, `radiologi-penunjang`. Kategori disimpan di tabel, jadi kategori baru (gaya hidup, rumah duka) bisa ditambah lewat seed atau migrasi data tanpa mengubah kode.

Catatan untuk fase berikut:
- Tenaga medis (`practitioners`) adalah entitas data, bukan akun pengguna.
- `memberships` menghubungkan banyak pengguna ke banyak faskes, dengan kolom `role` berupa teks (default `pengelola`).

## c. Role dan permission saat ini

| Role (`USER_ROLES`) | Cara didapat | Akses |
| --- | --- | --- |
| `faskes` | Default saat daftar (plugin admin Better Auth `defaultRole`) | Portal untuk faskes tempat ia punya `memberships`; mengajukan klaim |
| `moderator` | Diubah oleh admin | `/v1/admin/*` lewat `requireAdmin` (wajib TOTP, sesi maksimal 8 jam). Tidak bisa memakai endpoint admin Better Auth |
| `admin` | Skrip `create-admin` atau diubah admin | Semua akses moderator, ditambah endpoint admin Better Auth (`adminRoles: ['admin']`) dan rute `requireRole('admin')` |

- **Sesi:** cookie `silk.*`, `httpOnly`, `SameSite=Lax`, berlaku 7 hari (diperbarui harian).
- **Pendaftaran:** verifikasi email wajib, sandi minimal 12 karakter.
- **Audit log:** semua rute Better Auth sensitif dicatat (`AUDITED_PATHS`).
- **Belum ada:** role pasien atau mitra lain, JWT atau bearer token, OTP kode.

## d. Endpoint dan kontrak

Ada 49 operasi di `docs/openapi.json`, dibuat dari Zod lewat `corepack pnpm --filter @silk/api openapi`.

- **Publik (10):** facilities, practitioners, services, compare, tariff history, reports, sitemap, content-rules/active
- **Autentikasi dan portal (13):** `/me`, `/portal/facilities*`, `/portal/tariffs/:id`, impor CSV faskes, klaim dan dokumen
- **Admin (24):** klaim, laporan, impor, overview, faskes, tarif (publish/withdraw), audit log, jobs, aturan konten
- **Internal dan webhook (2):** `/internal/jobs/:type` (CRON_SECRET), `/webhooks/sanity`
- **Better Auth:** rute di `/v1/auth/*`, tidak tercantum di OpenAPI

Pagination memakai cursor (`limit` 1–100, `meta.nextCursor`). Galat memakai format `{ error: { code, message }, requestId }`.

## e. Konfigurasi env dan feature flag

- **API:** env divalidasi Zod di `apps/api/src/lib/env.ts` (nilai di-cache). Produksi wajib punya `BETTER_AUTH_SECRET`, `CRON_SECRET`, `REVALIDATE_SECRET`, dan `TURNSTILE_SECRET`.
- **Web:** env dibaca langsung lewat `process.env` (`lib/config.ts`, `lib/sanity.ts`).
- **Feature flag: belum ada.** Usulan untuk Fase 1:
  - Modul `packages/shared/src/flags.ts` berisi daftar flag dan default OFF.
  - Dibaca dari env `FEATURE_FLAGS` (daftar dipisah koma) lewat `env.ts` di server.
  - Middleware `requireFlag()` mengembalikan 404 bila flag OFF.
  - Web membaca flag di server lewat helper yang sama.

## f. Uji dan guard database

- **Guard baru di Fase 0:** `packages/db/src/test-db-guard.ts`, dipanggil dari `apps/api/test/load-env.ts`. Uji integrasi hanya jalan bila:
  1. `TEST_DATABASE_URL` terisi; tidak ada lagi fallback ke `DATABASE_URL`.
  2. Host-nya lokal, atau nama database diawali `test_`.
  3. Bukan database yang sama dengan `DATABASE_URL` (host pooler dan non-pooler dianggap sama).
- **Unit test guard:** 6 kasus di `packages/db`, semuanya lulus.
- **Kondisi `.env` saat ini:** guard **menolak** database uji yang sekarang (`silk_test` di endpoint Neon yang sama dengan dev). Langkah manual: buat database `test_silk` (sebaiknya di branch Neon khusus uji), lalu arahkan `TEST_DATABASE_URL` ke sana. Sampai itu selesai, uji integrasi API tidak akan berjalan, dan itu memang disengaja.
- **CI:** bila secret `TEST_DATABASE_URL` kosong, CI sekarang menjalankan unit test `shared`, `db`, dan `web`. Sebelumnya hanya `shared`.

## g. Konflik SRS di luar 9 konflik yang sudah terdaftar

Sembilan konflik di `prompt-enablement.md` (ulasan, langganan, rekam medis, apotek, harga vs `tariff_versions`, infrastruktur, role, video, data akun pasien) tetap berlaku. Audit ini menemukan konflik tambahan berikut. Kolom "Usulan" adalah default yang akan saya pakai kecuali Anda memutuskan lain.

| # | Konflik | Di SRS | Benturan | Usulan default |
| --- | --- | --- | --- | --- |
| T1 | "Komentar negatif difilter otomatis" | 2.2 butir 7, F-08, UC-10 | Menyaring komentar karena **sentimen negatif** membuat rating bias dan menyesatkan konsumen. Ini bertentangan dengan tujuan transparansi dan berisiko terhadap perlindungan konsumen | Filter hanya untuk konten **tidak pantas** (kasar, data pribadi, tautan, klaim klinis, pelanggaran M17). Komentar negatif yang sopan tetap tayang setelah moderasi |
| T2 | Google Maps API | 2.1, 3.3, UC-05 | Keputusan terkunci #4 memilih MapLibre, dan base sudah memakai MapLibre dengan MapTiler | Tetap MapLibre. Google Maps hanya dipertimbangkan bila ada kebutuhan yang tidak bisa dipenuhi (mis. geocoding alamat) |
| T3 | "Media promosi digital bagi tenaga medis" | 1.3 butir 2 | Bertabrakan dengan aturan iklan layanan kesehatan, prinsip M17, dan prinsip urutan tanpa bayaran | Posisikan sebagai **profil informasi**, bukan iklan. Tanpa "promosi", badge berbayar, atau slot unggulan |
| T4 | Satu Mitra memiliki satu ProfilLayanan | Diagram 4.3 | Di base, satu pengguna bisa mengelola banyak faskes dan satu faskes bisa punya banyak pengelola (`memberships`) | Pertahankan banyak-ke-banyak. Profil melekat pada entitas (faskes, praktik, apotek), bukan pada akun |
| T5 | TenagaMedis adalah akun pengguna | Diagram 4.2 | Di base, `practitioners` adalah data publik tanpa akun, dan STR hanya tampil bila sudah diverifikasi | Akun tenaga medis **ditautkan** ke baris `practitioners` lewat klaim (pola M7), bukan entitas baru yang terpisah |
| T6 | `id: int`, harga `decimal` | Semua diagram kelas | Base memakai `uuid` dan rupiah `bigint` (CLAUDE.md) | Tetap `uuid` dan `bigint`. Diagram dipakai untuk atribut saja, bukan tipe data |
| T7 | Admin tunggal, tanpa moderator | Diagram 4.2 | Base memisahkan admin dan moderator (pemisahan tugas M15) | Pertahankan moderator. Admin = superset |
| T8 | "Riwayat konsultasi" | F-07, 3.2, UC-11 | SRS 2.4 menyatakan SILK tidak menyediakan konsultasi klinis, jadi tidak ada konsultasi yang bisa dicatat | Tafsirkan sebagai riwayat sesi AI chat (bila opsi riwayat aktif) dan riwayat pesanan. Mohon konfirmasi |
| T9 | Dokter mengakses rekam medis pasien, dengan rujukan Permenkes 24/2022 (Rekam Medis Elektronik) | 1.5, F-07, UC-16 | Bila dokter memakai data ini untuk pelayanan, fitur bisa dianggap sistem RME yang tunduk pada aturan RME. Ini berbeda dari posisi "catatan pribadi pasien" | Akses tenaga medis hanya baca, atas izin pasien, dengan label "catatan dari pasien, bukan rekam medis". Perlu tinjauan hukum sebelum flag ON |
| T10 | Bayar dulu, resep diperiksa setelahnya, lalu dana dikembalikan bila tidak valid | 4.4 b, diagram 4.15 | Membuka banyak pengembalian dana dan biaya transaksi | Untuk obat resep: apotek memeriksa resep **sebelum** pembayaran dibuka. Obat bebas: bayar dulu. Diputuskan di Fase 9B |
| T11 | Beranda sebagai "beranda marketplace" berisi apotek mitra | 3.2 | Beranda sekarang berfokus pada informasi tarif. Daftar apotek di beranda berisiko menjadi slot promosi | Beranda tetap berfokus pada informasi. Apotek tampil lewat pencarian dengan urutan relevansi dan jarak |
| T12 | Strapi dan Flutter | 3.3, 3.4 Maintainability | Strapi sudah dibatalkan (rapat 31 Oktober 2026). Flutter untuk tahap lanjut | Tidak dikerjakan. Teks SRS 3.4 perlu diperbarui oleh tim |
| T13 | Uptime 99% dan backup harian otomatis | 3.4 Reliability | Bergantung pada paket Neon (rentang PITR) dan Vercel, bukan pada kode | Didokumentasikan dan diuji di Fase 12. Butuh keputusan paket |

## h. Langkah manual untuk Anda

1. Buat database `test_silk` (disarankan di branch Neon khusus uji), jalankan migrasi ke sana, lalu ubah `TEST_DATABASE_URL` di `.env`. Setelah itu uji integrasi bisa dijalankan lagi.
2. Tambahkan remote GitHub, push `main` dan `enablement/fase-0`, lalu isi secret `TEST_DATABASE_URL` di repo (database `test_*` khusus CI). Bila secret kosong, CI tetap menjalankan unit test.
3. Tinjau konflik T1–T13. Terutama T1 (filter komentar negatif), T4/T5 (model akun mitra, menentukan desain Fase 1), dan T8.
