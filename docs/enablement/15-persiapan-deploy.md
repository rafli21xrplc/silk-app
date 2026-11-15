# Persiapan deploy SILK (API, web, mobile)

Status per 2026-11-14. Isi `.env` dan pengaturan Vercel tidak dibaca dari repo, jadi daftar di bawah
adalah checklist: centang yang sudah diisi di masing-masing proyek Vercel.

Keterangan: **W** = wajib di produksi (API menolak start bila kosong atau fitur rusak),
**F** = wajib bila fitur terkait aktif, **O** = opsional (ada adaptor cadangan).

## 1. Variabel lingkungan per proyek Vercel

### API (root `apps/api`)

| Variabel | Status | Catatan |
|---|---|---|
| `DATABASE_URL` | W | Neon pooled (`-pooler`), region ap-southeast-1 |
| `DATABASE_URL_UNPOOLED` | W | Neon direct; dipakai migrasi |
| `BETTER_AUTH_SECRET` | W | `openssl rand -base64 32`; API gagal start bila kosong |
| `BETTER_AUTH_URL` | W | Sama dengan `API_ORIGIN` |
| `API_ORIGIN` | W | mis. `https://api.silk.id` (juga untuk callback Duitku) |
| `WEB_ORIGIN` | W | mis. `https://silk.id`; dipakai CORS dan tautan email |
| `CRON_SECRET` | W | Acak; Vercel Cron mengirimnya otomatis |
| `REVALIDATE_SECRET` | W | Acak; **nilai sama** dengan proyek web |
| `TURNSTILE_SECRET` | W | Dari Cloudflare Turnstile |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | W | Tanpa ini unggahan memakai penyimpanan lokal palsu |
| `R2_BUCKET` | W | Bucket privat (impor, dokumen klaim) |
| `R2_MEDIA_BUCKET`, `MEDIA_PUBLIC_BASE_URL` | W | Persetujuan media gagal di produksi bila kosong |
| `RESEND_API_KEY`, `EMAIL_FROM` | W | Tanpa ini email hanya masuk log (verifikasi, reset sandi tidak terkirim) |
| `SANITY_WEBHOOK_SECRET` | F | Bila artikel/halaman dari Sanity |
| `DUITKU_MERCHANT_CODE`, `DUITKU_API_KEY`, `DUITKU_ENV` | F | Wajib bila `subscriptions_enabled`; `DUITKU_ENV=production` saat live |
| `SENTRY_DSN` | O | Pelacakan galat |
| `POSTHOG_KEY` | O | Analitik sisi server |
| `FEATURE_FLAGS` | O | Daftar dipisah koma; samakan dengan web dan mobile |
| `STALE_AFTER_DAYS`, `LOG_LEVEL` | O | Bawaan sudah wajar |

### Web (root `apps/web`)

| Variabel | Status | Catatan |
|---|---|---|
| `NEXT_PUBLIC_API_ORIGIN` | W | `https://api.silk.id` |
| `NEXT_PUBLIC_SITE_URL` | W | `https://silk.id` (sitemap, canonical, OG) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | W | Pasangan `TURNSTILE_SECRET` |
| `REVALIDATE_SECRET` | W | Sama dengan API |
| `NEXT_PUBLIC_MAP_STYLE_URL` | W | Tanpa ini peta kosong; dev memakai `https://tiles.openfreemap.org/styles/liberty` |
| `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_READ_TOKEN` | F | Bila konten dari Sanity |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | O | Analitik |
| `FEATURE_FLAGS` | O | Sama dengan API |
| `SILK_NOINDEX` | O | `1` = seluruh situs tidak diindeks (preview publik dengan data demo) |

### Mobile (root `MOBILE`)

| Variabel | Status | Catatan |
|---|---|---|
| `SILK_API_ORIGIN` | W | `https://api.silk.id`; kosong = mode demo |
| `SILK_WEB_ORIGIN` | W | `https://silk.id` (tautan masuk/akun) |
| `SILK_DEMO_ONLY` | W | `0` di produksi |
| `SILK_ALLOW_INDEXING` | W | `0` sampai data demo fiktif tidak tampil lagi |
| `SILK_API_TIMEOUT_MS` | O | Bawaan sudah wajar |
| `FEATURE_FLAGS` | O | Sama dengan API |

### Hanya lokal (jangan diisi di Vercel)

`TEST_DATABASE_URL`, `MIGRATE_DATABASE_URL`, `PORT`.

## 2. Langkah sebelum deploy (berurutan)

1. **Domain.** Siapkan satu domain induk: `silk.id` (web), `api.silk.id` (API), `m.silk.id` (mobile).
   Cookie sesi SameSite=Lax, jadi dua alamat `*.vercel.app` yang berbeda tidak bisa dipakai untuk login.
2. **Neon produksi.** Buat proyek di ap-southeast-1. Catat URL pooled dan direct.
   PostGIS dipasang otomatis oleh migrasi `0000_extensions.sql`.
3. **Migrasi produksi** (dijalankan sendiri oleh pemilik, bukan oleh Claude):
   ```bash
   MIGRATE_DATABASE_URL='<url direct produksi>' corepack pnpm db:migrate
   ```
4. **Seed data acuan saja** (wilayah, kategori layanan). Jangan seed uji/demo; keduanya berisi faskes fiktif:
   ```bash
   DATABASE_URL='<url direct produksi>' corepack pnpm --filter @silk/db exec tsx seed/index.ts --reference-only
   ```
5. **Layanan pihak ketiga.**
   - Cloudflare R2: bucket privat + bucket media publik dengan domain kustom (mis. `media.silk.id`);
     CORS mengizinkan `PUT` dari `https://silk.id` untuk unggahan lewat signed URL.
   - Resend: verifikasi domain pengirim (SPF/DKIM), isi `EMAIL_FROM` mis. `SILK <noreply@silk.id>`.
   - Cloudflare Turnstile: situs untuk `silk.id`.
   - Sanity (bila dipakai): webhook ke `https://api.silk.id/v1/webhooks/sanity` dengan `SANITY_WEBHOOK_SECRET`.
   - Duitku (bila langganan aktif): akun merchant produksi, callback
     `https://api.silk.id/v1/payments/duitku/callback`. **Buat ulang API key**, karena kunci sandbox
     pernah ditempel di percakapan.
   - Sentry dan PostHog (opsional).
6. **Proyek Vercel API dulu.** Root `apps/api`, Framework Preset *Other*, region sin1 (sudah di `vercel.json`).
   Build command diambil dari `vercel.json` (`pnpm run build:vercel`): API dibundel jadi `dist/vercel.js` karena paket
   workspace mengekspor berkas `.ts` yang tidak bisa dimuat Node langsung. Isi env bagian 1.
   Cron `process-queue` tiap 10 menit butuh paket Pro; di Hobby jalankan job manual dari `/admin/jobs`.
   Cek: `curl https://api.silk.id/v1/health`.
7. **Proyek Vercel web.** Root `apps/web`, region sin1. Isi env, deploy, pasang domain `silk.id`.
8. **Proyek Vercel mobile.** Root `MOBILE`. Isi env, deploy, pasang `m.silk.id`.
9. **Admin pertama.** Dengan env produksi aktif di shell:
   ```bash
   SILK_ADMIN_PASSWORD='<min 12 karakter>' corepack pnpm --filter @silk/api create-admin -- --email <email> --name "<nama>"
   ```
   Lalu masuk dan atur TOTP di `/admin/mfa`.
10. **Feature flag.** Mulai semua OFF. Nyalakan satu per satu setelah syaratnya terpenuhi
    (mis. `subscriptions_enabled` setelah Duitku produksi dan halaman syarat/refund siap).

## 3. Uji asap setelah deploy

- [ ] Daftar akun baru → email verifikasi masuk (Resend).
- [ ] Masuk di `silk.id`, sesi tetap saat memanggil `api.silk.id`.
- [ ] Cari tarif dan peta tampil.
- [ ] Daftar mitra → admin menyetujui → audit log tercatat.
- [ ] Unggah foto faskes → admin setujui → gambar tampil dari `MEDIA_PUBLIC_BASE_URL`.
- [ ] Impor CSV kecil lewat portal/admin.
- [ ] Ubah artikel → halaman web ter-revalidate.
- [ ] `/admin/jobs` menampilkan job berjalan (cron atau manual).
- [ ] Bila langganan aktif: bayar paket kecil, callback Duitku mengaktifkan langganan.
- [ ] Mobile memuat data asli (bukan banner mode demo).
- [ ] Sentry menerima galat uji (bila diisi).

## 4. Sebelum go-live

- Gabungkan branch `enablement/usp-rekomendasi` ke `main` lewat PR (belum di-push).
- Putuskan `SILK_ALLOW_INDEXING` untuk mobile.
- Ganti foto `klinik-3` di demo mobile (ada tulisan di dinding).
- Pastikan semua teks publik lolos filter konten M17.

## 5. Sumber nilai setiap variabel

Nama menu di dasbor pihak ketiga bisa berubah; patokannya nama halaman di bawah.

### Dibuat sendiri (acak)

`BETTER_AUTH_SECRET`, `CRON_SECRET`, `REVALIDATE_SECRET`, `SANITY_WEBHOOK_SECRET`:
```bash
openssl rand -base64 32   # jalankan sekali per variabel; REVALIDATE_SECRET dipakai sama di web dan API
```
Vercel otomatis mengirim `CRON_SECRET` sebagai `Authorization: Bearer` ke endpoint cron.

### Ditentukan dari domain sendiri

| Variabel | Nilai |
|---|---|
| `API_ORIGIN`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_API_ORIGIN`, `SILK_API_ORIGIN` | `https://api.silk.id` |
| `WEB_ORIGIN`, `NEXT_PUBLIC_SITE_URL`, `SILK_WEB_ORIGIN` | `https://silk.id` |
| `EMAIL_FROM` | `SILK <noreply@silk.id>` (domain harus terverifikasi di Resend) |
| `MEDIA_PUBLIC_BASE_URL` | Domain kustom bucket media, mis. `https://media.silk.id` |

Domain dibeli di registrar (mis. Niagahoster, Cloudflare Registrar), lalu dipasang di Vercel → Project → Settings → Domains.

### Layanan pihak ketiga

| Variabel | Tempat mengambil |
|---|---|
| `DATABASE_URL` | console.neon.tech → proyek → **Connect** → aktifkan *Connection pooling* → salin (host berisi `-pooler`) |
| `DATABASE_URL_UNPOOLED` | Dialog **Connect** yang sama, *Connection pooling* dimatikan |
| `R2_ACCOUNT_ID` | dash.cloudflare.com → **R2 Object Storage** → Account ID di panel kanan halaman ringkasan |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | R2 → **Manage API tokens** → Create token (izin *Object Read & Write*, batasi ke dua bucket SILK). Secret hanya tampil sekali |
| `R2_BUCKET`, `R2_MEDIA_BUCKET` | Nama bucket yang Anda buat di R2 → **Create bucket** (mis. `silk-private`, `silk-media`) |
| `MEDIA_PUBLIC_BASE_URL` | R2 → bucket media → **Settings** → *Custom Domains* → hubungkan `media.silk.id` |
| `TURNSTILE_SECRET`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | dash.cloudflare.com → **Turnstile** → Add widget (domain `silk.id`) → *Secret Key* dan *Site Key* |
| `RESEND_API_KEY` | resend.com → **API Keys** → Create (izin *Sending access*) |
| Verifikasi `EMAIL_FROM` | resend.com → **Domains** → Add domain → tambahkan rekaman DNS (SPF, DKIM) di pengelola DNS |
| `DUITKU_MERCHANT_CODE`, `DUITKU_API_KEY` | Dasbor Duitku → **Proyek Saya** → detail proyek. Sandbox: sandbox.duitku.com; produksi: dashboard.duitku.com (perlu verifikasi usaha). Isi juga *Callback URL* `https://api.silk.id/v1/payments/duitku/callback` |
| `DUITKU_ENV` | `sandbox` atau `production` (pilih sendiri) |
| `NEXT_PUBLIC_MAP_STYLE_URL` | Gratis tanpa kunci: `https://tiles.openfreemap.org/styles/liberty`. Alternatif berbayar: MapTiler (cloud.maptiler.com → Maps → salin URL style berisi `?key=`) |
| `SENTRY_DSN` | sentry.io → buat proyek Node.js → **Settings → Client Keys (DSN)** |
| `POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_KEY` | PostHog → **Project settings** → *Project API key* (`phc_...`); keduanya boleh sama |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://eu.i.posthog.com` atau `https://us.i.posthog.com`, sesuai region akun PostHog |
| `SANITY_PROJECT_ID` | sanity.io/manage → proyek → *Project ID* di bagian atas |
| `SANITY_DATASET` | sanity.io/manage → **Datasets** (biasanya `production`) |
| `SANITY_READ_TOKEN` | sanity.io/manage → **API → Tokens** → Add API token (izin *Viewer*) |
| Webhook Sanity | sanity.io/manage → **API → Webhooks** → URL `https://api.silk.id/v1/webhooks/sanity`, secret = `SANITY_WEBHOOK_SECRET` |

### Pilihan sendiri (tidak diambil dari mana pun)

| Variabel | Saran nilai |
|---|---|
| `FEATURE_FLAGS` | Kosong saat awal; nanti mis. `reviews_enabled,subscriptions_enabled` |
| `SILK_DEMO_ONLY` | `0` |
| `SILK_ALLOW_INDEXING` | `0` sampai data demo mobile diganti |
| `SILK_API_TIMEOUT_MS` | `3500` (bawaan) |
| `STALE_AFTER_DAYS` | Kosongkan (bawaan kode) |
| `LOG_LEVEL` | `info` |
