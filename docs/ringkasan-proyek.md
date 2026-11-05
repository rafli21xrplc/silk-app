# Ringkasan Proyek SILK

> Dokumen konteks untuk konsultasi (manusia atau AI). Ditulis 5 November 2026 dari kode dan dokumen di repo ini.
> Tidak memuat rahasia; nama variabel lingkungan saja, tanpa nilai.
> Sumber lengkap: `docs/blueprint-teknis.md` (spesifikasi) dan `CLAUDE.md` (aturan kerja).

## 1. Apa itu SILK

SILK adalah platform **transparansi tarif layanan kesehatan di Indonesia**. Pengguna bisa mencari faskes,
melihat tarif pemeriksaan, dan membandingkan harga antar-faskes secara adil. Setiap angka selalu disertai
**tanggal berlaku, sumber, dan status verifikasi**.

- **Cakupan MVP:** Kota Malang dan Kabupaten Malang. Kategori: laboratorium, Medical Check-Up (MCU), dan radiologi/penunjang.
- **Pengguna:**
  - **Publik / pasien:** mencari dan membandingkan tarif tanpa akun.
  - **Pengelola faskes:** mengklaim profil, lalu mengelola tarif sendiri lewat portal.
  - **Admin / moderator:** meninjau klaim, impor data, laporan data salah, aturan konten, dan audit log.
- **Sumber data:** data publik (Perda RSUD, PMK 109/2014) yang diimpor lewat CSV, ditambah data yang diisi faskes sendiri.
- **Bahasa UI:** Indonesia. Semua teks diambil dari berkas pesan `apps/web/src/messages/id.ts`.

### Prinsip yang tidak boleh dilanggar

1. Peringkat dan urutan hasil **tidak pernah** dipengaruhi pembayaran atau langganan.
2. Tarif tanpa tanggal berlaku, sumber, dan status verifikasi tidak ditampilkan sebagai fakta.
3. Konten publik melewati filter kepatuhan: tanpa "termurah", "terbaik", atau janji sembuh (modul M17).
4. Tidak mengumpulkan data pribadi pasien di MVP.
5. Setiap perubahan data oleh pengguna yang login tercatat di audit log.

## 2. Teknologi

| Lapisan | Pilihan |
| --- | --- |
| Monorepo | pnpm 10 (lewat Corepack) + Turborepo, TypeScript strict di semua paket, Node ≥ 20.11 |
| Frontend `apps/web` | Next.js 15.5 (App Router, SSR/ISR), React 19, Tailwind CSS v4, Radix (dialog/popover), cmdk, lucide-react, GSAP (animasi), MapLibre GL (peta), react-day-picker, PostHog (analitik) |
| Backend `apps/api` | Express 5 (dideploy sebagai Vercel Function), Better Auth (sesi cookie + TOTP 2FA), Zod 4 + zod-to-openapi, pino, helmet, csv-parse, AWS SDK S3 (untuk Cloudflare R2), Resend (email) |
| Database `packages/db` | Neon Postgres + Drizzle ORM 0.45, ekstensi PostGIS, pg_trgm, unaccent, citext |
| Bersama `packages/shared` | Skema Zod, format harga (`Rp1.250.000`), filter konten M17, logika perbandingan |
| Layanan luar | Cloudflare R2 (berkas), Sanity (CMS artikel), Resend (email), Turnstile (captcha), PostHog, Sentry, MapTiler (tile peta) |
| Hosting target | Vercel: dua project (web dan API), region Singapura `sin1`. Neon idealnya di `aws-ap-southeast-1` |

Semua layanan luar punya adaptor yang tetap jalan **tanpa kunci** di dev:

- Unggahan disimpan di folder sementara lokal.
- Email ditulis ke log.
- Captcha dilewati.
- Analitik mati.
- Artikel memakai contoh dev.

## 3. Arsitektur singkat

```
Browser ──> apps/web (Next.js, ISR)   ──HTTPS──> apps/api (Express, /v1/*)
                                                   ├─> Neon Postgres (data, tabel jobs)
                                                   ├─> Cloudflare R2 (dokumen izin, CSV impor; privat)
                                                   ├─> Sanity (artikel), Resend (email)
                                                   └─> PostHog, Sentry
Vercel Cron ──> /v1/internal/jobs/* (dilindungi CRON_SECRET)
```

Alur kerja utama:

- **Halaman publik:** Server Component memanggil API, lalu hasilnya di-cache lewat ISR (1 jam) dengan tag per entitas. Setelah data berubah, API memanggil webhook revalidate Next.js.
- **Tarif append-only:** setiap perubahan membuat baris baru di `tariff_versions`. Larangan UPDATE/DELETE di tabel ini ditegakkan oleh trigger database (migrasi 0002).
- **Batas "tarif terbit":** didefinisikan sekali di VIEW `published_tariffs` (migrasi 0003).
- **Unggahan:** browser mengunggah langsung ke R2 lewat signed URL, karena body request ke Vercel dibatasi 4,5 MB.
- **Job latar:** disimpan di tabel `jobs` dan diproses per potongan oleh Vercel Cron. Job harus idempoten. Tidak ada proses yang hidup terus, dan tidak ada state di memori.
- **Auth:** Better Auth dengan peran `faskes`, `moderator`, dan `admin`. Admin wajib mengaktifkan TOTP. Cookie `SameSite=Lax`, jadi web dan API harus berada di domain induk yang sama.

## 4. Struktur repo

```
apps/web        Next.js: halaman publik, /masuk, /portal/*, /admin/*
apps/api        Express: src/modules/m*-*/ (routes → controller → service → repo), src/jobs, test/
packages/db     Skema Drizzle, drizzle/ (migrasi 0000–0004), seed/
packages/shared Skema Zod, util harga, filter konten
packages/config tsconfig + ESLint bersama
docs/           blueprint-teknis.md, openapi.json, ops/pindah-region-neon.md, ringkasan-proyek.md
```

Pola backend: query database **hanya** boleh ada di `*.repo.ts`. Controller memanggil service, dan service memanggil repo.

### Tabel database utama

- **Auth (Better Auth):** `user`, `session`, `account`, `verification`, `two_factor`, `rate_limit`
- **Katalog:** `regions`, `service_categories`, `services`, `facilities`, `practitioners`, `facility_practitioners`
- **Tarif:** `tariffs`, `tariff_versions` (append-only), `packages`, `package_components`, `data_sources`
- **Operasional:** `memberships`, `facility_claims`, `documents`, `import_batches`, `import_rows`, `data_reports`, `content_rules`, `audit_logs`, `jobs`, `rate_limit_counters`

Aturan data: uang disimpan sebagai rupiah integer (`bigint`), waktu dalam UTC (`timestamptz`).
Tipe harga (`price_type`): `tetap`, `rentang`, `mulai_dari`, `paket`, `tanya`. Tipe `tanya` tampil "Tanyakan ke faskes", tidak pernah sebagai angka 0.

## 5. Modul dan status

| Modul | Isi | Status di repo |
| --- | --- | --- |
| M1 Direktori | Cari faskes (trigram, radius PostGIS, filter), profil faskes dan dokter, JSON-LD | Ada (API + `/cari`, `/faskes/[slug]`, `/dokter/[slug]`) |
| M2 Katalog dan tarif | Layanan, tipe harga, versi tarif | Ada (`/layanan`, `/layanan/[slug]`) |
| M3 Perbandingan | Bandingkan isi paket apple-to-apple; komponen yang tidak ada ditandai "tidak termasuk" | Ada (`/bandingkan/[service]?kota=`) |
| M4 Lapisan kepercayaan | TrustBadge, tarif usang (`stale`) setelah 180 hari, riwayat versi | Ada |
| M5 Impor data publik | CSV → staging → tinjau → terbit (transaksional, idempoten) | Ada (`/admin/impor`) |
| M6 Portal faskes | Kelola tarif sendiri, impor CSV khusus faskes sendiri | Ada (`/portal/*`) |
| M7 Klaim profil | Unggah dokumen izin (≤ 5 MB, PDF/gambar) ke R2 privat; admin menyetujui | Ada (`/portal/klaim`, `/admin/klaim`) |
| M12 Artikel | Sanity CMS lewat ISR, diperiksa filter M17 | Ada; Sanity **belum dikonfigurasi** (dev memakai 6 artikel contoh) |
| M14 Laporan data salah | Form publik (Turnstile) → antrean admin | Ada (`/admin/laporan`) |
| M15 Panel admin | Antrean, faskes, tarif, audit log, jobs; wajib MFA | Ada (`/admin/*`) |
| M16 Keamanan | Header keamanan, rate limit di DB, tanpa rahasia di repo | Sebagian (helmet, rate limit); audit akhir belum |
| M17 Filter konten | Aturan kata/pola di DB, level `blokir`/`tinjau` | Ada (`/admin/aturan-konten`) |
| M18 Analitik | Peristiwa PostHog dan consent banner | Ada di web (`lib/analytics.ts`); butuh kunci PostHog |
| M8–M11, M13, M19, M20 | Dashboard faskes, benchmark, estimator, akun pasien, langganan, API publik | **Belum** (P1/P2, setelah validasi MVP) |

Uji otomatis:

- **Unit web:** 109 test lulus.
- **Unit shared:** ada.
- **Integrasi API:** `apps/api/test` (append-only, RBAC, M1–M7, M15/M17, jobs). **Uji ini mengosongkan database**, jadi hanya boleh diarahkan ke branch Neon khusus uji.

## 6. Pekerjaan UI terbaru (sesi November 2026)

- **Login:** halaman masuk/daftar/lupa sandi didesain ulang menjadi dua kolom, tanpa navbar dan footer.
- **Kecepatan:** pengambilan data dipercepat (cache query di klien, ISR), dan semua halaman punya skeleton loading.
- **Admin:**
  - Tampilan antrean kosong memakai komponen `EmptyState` yang rapi.
  - Semua tabel admin dibungkus `DataPanel` dengan pagination (10/20/50 baris, nomor halaman). Kontrak API tidak diubah; pagination memakai cursor.
- **Artikel:**
  - Daftar bergaya majalah: header pastel, pencarian, artikel terbaru ditonjolkan, sampul otomatis per topik, dan waktu baca.
  - Detail artikel: daftar isi yang menempel, garis kemajuan baca, artikel terkait, dan ajakan ke pencarian tarif.
- **Layanan:**
  - Katalog: pencarian (termasuk nama lain pemeriksaan), filter kategori, ikon berwarna per kategori, serta rentang harga dan jumlah faskes/wilayah per kartu.
  - Detail: kartu per wilayah dengan bar posisi rentang dan median, plus layanan terkait.
- **Data demo:** `pnpm db:seed:demo` mengisi 20 faskes dan sekitar 200 tarif **fiktif** untuk dev lokal.
- **Panduan ops:** cara memindahkan database Neon ke region Singapura ada di `docs/ops/pindah-region-neon.md`.

## 7. Aturan kerja yang wajib diikuti (ringkas dari CLAUDE.md)

- TypeScript strict tanpa `any`. Semua input divalidasi dengan Zod dari `packages/shared`.
- Jangan UPDATE/DELETE `tariff_versions`. Ralat dilakukan dengan membuat versi baru.
- Jangan mengurutkan hasil berdasarkan pembayaran.
- Jangan commit rahasia, jangan menyentuh `.env`, dan tambahkan variabel baru ke `.env.example`.
- Jangan menjalankan migrasi ke staging atau produksi.
- **Perlu izin dulu untuk:** mengubah skema tabel yang sudah terbit, menambah dependensi besar, mengubah kontrak API, atau menyentuh auth/otorisasi.
- **Alur kerja:** baca spesifikasi modul → rencana singkat → tunggu persetujuan → tulis uji → jalankan typecheck, lint, dan test.
- **Batasan Vercel:** body maksimal 4,5 MB, tulis berkas hanya ke `/tmp`, dan job harus idempoten serta dipecah per potongan.
- **Performa database:** hindari query per baris di dalam loop. Pakai INSERT/UPDATE massal (`jsonb_to_recordset`).

## 8. Menjalankan secara lokal

```sh
corepack pnpm install
cp .env.example .env          # minimal DATABASE_URL dan DATABASE_URL_UNPOOLED
corepack pnpm db:migrate      # hanya ke branch dev
corepack pnpm db:seed         # taksonomi, wilayah, aturan konten
corepack pnpm db:seed:demo    # data demo fiktif
corepack pnpm dev             # web :3000, api :4000
corepack pnpm --filter @silk/api create-admin -- --email ... --name "..."
corepack pnpm typecheck && corepack pnpm lint && corepack pnpm test
```

Variabel lingkungan (nama saja):

- **Database:** `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `TEST_DATABASE_URL`
- **Auth dan alamat:** `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `WEB_ORIGIN`, `API_ORIGIN`, `NEXT_PUBLIC_API_ORIGIN`, `NEXT_PUBLIC_SITE_URL`
- **Rahasia internal:** `REVALIDATE_SECRET`, `CRON_SECRET`
- **Penyimpanan R2:** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`
- **Email:** `RESEND_API_KEY`, `EMAIL_FROM`
- **Captcha:** `TURNSTILE_SECRET`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- **Monitoring dan analitik:** `SENTRY_DSN`, `POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`
- **CMS:** `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_READ_TOKEN`, `SANITY_WEBHOOK_SECRET`
- **Lainnya:** `NEXT_PUBLIC_MAP_STYLE_URL`, `STALE_AFTER_DAYS`

## 9. Hal terbuka dan keterbatasan saat ini

**Keputusan yang belum diambil**

1. Paket Vercel untuk produksi (Hobby tidak untuk komersial; cron tiap 10 menit butuh Pro).
2. Daftar RSUD pertama di Malang beserta dokumen tarif resminya, sebagai data awal yang nyata.
3. Konfirmasi CMS: Sanity (default) atau Payload. Sanity belum disiapkan (project, skema, webhook).
4. Verifikasi dataset wilayah: Kota dan Kabupaten Malang harus tercatat sebagai dua entitas terpisah.

**Pekerjaan teknis yang belum selesai**

- Database dev masih di region AS. Pindah ke Singapura mengikuti `docs/ops/pindah-region-neon.md`.
- Uji integrasi API belum dijalankan ulang setelah perubahan UI terakhir. Perlu branch Neon khusus uji.
- Katalog `/layanan` memanggil detail tiap layanan untuk menampilkan harga (paralel 6, di-cache 1 jam). Kalau layanan sudah ratusan, sebaiknya API menyediakan ringkasan harga langsung di daftar. Ini perubahan kontrak API, jadi perlu izin.
- Artikel belum punya bidang gambar sampul dan kategori dari CMS; sampul saat ini dibuat otomatis secara dekoratif.
- Folder `docs/modul/` masih kosong, padahal Definition of Done meminta dokumentasi per modul.
- Repo belum di-git (belum ada riwayat commit atau CI).

**Syarat rilis MVP yang belum terpenuhi**

- Uji E2E belum ada.
- Audit keamanan akhir belum dilakukan.
- Uji backup dan pemulihan belum dicoba.
- Pendapat hukum tertulis (konten iklan kesehatan, persaingan) belum ada.
- Monitoring dan peringatan belum aktif.

**Risiko utama**

- Pencocokan nama faskes dan layanan saat impor tidak akurat.
- Cold start Neon membuat respons pertama lambat.
- Pencarian trigram kurang relevan untuk istilah medis.
- Kendala hukum, terutama untuk fitur benchmark dan langganan.
- Biaya layanan pihak ketiga membengkak.

## 10. Contoh topik konsultasi

- Strategi mengumpulkan data tarif RSUD/klinik Malang yang sah dan cara memverifikasinya.
- Model bisnis yang tidak melanggar prinsip "urutan tidak dipengaruhi pembayaran" (M19 langganan alat faskes).
- Kepatuhan hukum Indonesia: iklan layanan kesehatan, UU PDP, dan persaingan usaha untuk fitur benchmark (M9).
- Rencana go-to-market dan metrik go/no-go dari peristiwa analitik M18 (pencarian → klik kontak).
- Prioritas teknis menuju rilis: E2E test, CI/CD, monitoring, pindah region, dan kesiapan produksi Vercel + Neon.
- Skalabilitas pencarian: kapan beralih dari pg_trgm ke Meilisearch atau Typesense.
