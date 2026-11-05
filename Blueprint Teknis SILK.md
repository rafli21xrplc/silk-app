# Blueprint Teknis SILK

Spesifikasi arsitektur dan modul fitur SILK yang siap dieksekusi dengan Claude Code: Next.js, Express, dan Neon (PostgreSQL).

## 1. Keputusan arsitektur

**Tujuan sistem.** Menampilkan tarif layanan kesehatan yang bisa dibandingkan secara adil dan dipercaya (tanggal berlaku, sumber, tingkat verifikasi), dengan jalur data masuk dari data publik dan dari faskes lewat papan tarif.

**Cakupan MVP.** Kota Malang dan Kabupaten Malang, dua kategori (laboratorium dan MCU), modul P0 dari blueprint bisnis (M1 sampai M5, M6, M7, M12, M15 sampai M18).

### Keputusan arsitektur (ADR ringkas)

| # | Keputusan | Alasan | Konsekuensi |
| --- | --- | --- | --- |
| A1 | Monorepo pnpm + Turborepo, TypeScript di semua paket | Tipe dan skema validasi dipakai bersama FE dan BE | Satu repo, satu CI |
| A2 | Next.js (App Router) untuk FE publik dan portal | SSR/ISR untuk SEO, satu codebase UI | Halaman publik server-rendered, portal client-heavy |
| A3 | Express sebagai API terpisah (`apps/api`) | Express di-deploy sebagai Vercel Function (Fluid compute); melayani portal faskes, panel admin, dan handler job impor | Dua project Vercel dari satu monorepo; batas body 4,5 MB dan batas durasi fungsi berlaku (lihat bagian 11) |
| A4 | Neon Postgres, akses lewat Drizzle ORM | SQL transparan, migrasi terversi, tipe otomatis | Migrasi lewat `drizzle-kit`, bukan ubah manual |
| A5 | Pencarian di Postgres (`pg_trgm`, `unaccent`, PostGIS) | Cukup untuk ribuan faskes; tanpa layanan tambahan | Evaluasi ulang bila relevansi atau latensi buruk |
| A6 | Validasi dengan Zod, skema di paket bersama | Satu sumber kebenaran untuk request, respons, dan form | Skema Zod menghasilkan dokumen OpenAPI |
| A7 | Tarif bersifat append-only (riwayat versi) | Syarat lapisan kepercayaan dan audit | Update tarif membuat versi baru, bukan menimpa |
| A8 | Job latar lewat Vercel Cron dan tabel `jobs` di Postgres, diproses per potongan | Tidak ada proses worker yang hidup terus di Vercel; tidak perlu Redis di awal | Setiap job harus idempoten dan dipecah per batch; Cron hanya berjalan di deployment produksi |
| A9 | Auth: Better Auth (sesi cookie), MFA TOTP untuk admin dan faskes | Kontrol penuh, tanpa biaya per pengguna | Tabel auth dibuat oleh Better Auth (plugin twoFactor dan admin); skema Drizzle digenerate dari CLI-nya |
| A10 | Semua mata uang dalam rupiah integer (sen tidak dipakai) | Hindari galat floating point | Kolom `bigint` untuk nominal |

### Prinsip yang tidak boleh dilanggar

1. Peringkat dan urutan hasil tidak pernah dipengaruhi pembayaran.
2. Setiap tarif punya tanggal berlaku, sumber, dan status verifikasi; tarif tanpa itu tidak tampil sebagai fakta.
3. Konten publik melewati filter superlatif dan janji sembuh.
4. Data pribadi pasien tidak dikumpulkan di MVP.
5. Semua perubahan data oleh pengguna terautentikasi masuk audit log.

## 2. Arsitektur sistem dan deployment

### Diagram komponen

```
Pengguna (browser)
   |
   v
Cloudflare (DNS, WAF, Turnstile)  [CDN/proxy opsional]
   |
   +--> apps/web  (Next.js, project Vercel #1)  --- SSR/ISR halaman publik, portal
   |         |
   |         v  HTTPS (server-side fetch + client fetch)
   +--> apps/api  (Express sebagai Vercel Function, project Vercel #2)
             |-- REST /v1/*  (publik, portal, admin, Better Auth)
             |-- handler job: /v1/internal/jobs/* (dipanggil Vercel Cron, dilindungi CRON_SECRET)
             |
             +--> Neon Postgres (utama, PostGIS, pg_trgm, tabel jobs)
             +--> Cloudflare R2 (dokumen izin, CSV impor, tile PMTiles; privat kecuali tile)
             +--> Sanity (CMS artikel, hosted)  +--> Resend (email)
             +--> Sentry   +--> PostHog

Browser --> MapLibre GL JS --> tile peta (penyedia tile atau PMTiles di R2)
```

### Alur data utama

1. **Baca publik:** browser meminta halaman ke Next.js. Server Component memanggil API (`GET /v1/...`), merender HTML, lalu cache lewat ISR dengan revalidasi per tag (`tariff:{facilityId}`).
2. **Faskes mengubah tarif:** portal mengirim `PUT /v1/portal/tariffs/:id`. API membuat versi baru, menulis audit log, lalu memanggil revalidate Next.js lewat webhook bertanda tangan.
3. **Impor data publik:** admin mengunggah CSV atau menjalankan job. CSV diunggah langsung ke R2 lewat signed URL (menghindari batas body 4,5 MB); fungsi pemroses dipicu per potongan baris, memvalidasi dan memasukkan ke tabel staging; admin meninjau, lalu data diterbitkan.
4. **Verifikasi faskes:** faskes mengunggah dokumen izin ke R2 lewat signed URL. Admin meninjau di antrean, lalu mengubah status.
5. **Data usang:** Vercel Cron harian menandai tarif yang melewati batas usia sebagai `stale` dan mengirim pengingat email ke faskes.

### Environment

| Environment | Web | API | Database | Tujuan |
| --- | --- | --- | --- | --- |
| local | `localhost:3000` | `localhost:4000` | Branch Neon `dev` atau Postgres lokal (Docker) | Pengembangan |
| preview | Vercel preview per PR | Satu API staging bersama | Branch Neon per PR | Uji PR |
| staging | `staging.silk...` | API staging | Branch Neon `staging` | Uji sebelum rilis |
| production | `silk...` | API produksi | Branch Neon `main`, autosuspend mati | Pengguna nyata |

Region layanan: Singapura (Neon aws-ap-southeast-1, fungsi Vercel sin1; `ap-southeast-1`) agar latensi ke Indonesia rendah.

### Variabel lingkungan (nama, bukan nilai)

| Variabel | Dipakai oleh | Keterangan |
| --- | --- | --- |
| `DATABASE_URL` | api | Koneksi pooled Neon |
| `DATABASE_URL_UNPOOLED` | api (migrasi) | Koneksi langsung untuk migrasi |
| `BETTER_AUTH_SECRET` | api | Penandatangan sesi |
| `WEB_ORIGIN`, `API_ORIGIN` | web, api | CORS dan tautan |
| `REVALIDATE_SECRET` | web, api | Webhook revalidate |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | api | Penyimpanan dokumen |
| `RESEND_API_KEY` | api | Email transaksional |
| `TURNSTILE_SECRET` | api | Verifikasi anti-bot |
| `SENTRY_DSN`, `POSTHOG_KEY` | web, api | Monitoring dan analitik |

Rahasia tidak pernah dikomit. Sediakan `.env.example` berisi nama variabel tanpa nilai.

Variabel tambahan akibat keputusan 2 November 2026: `CRON_SECRET` (api), `BETTER_AUTH_URL` (api), `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_READ_TOKEN`, `SANITY_WEBHOOK_SECRET` (web), `NEXT_PUBLIC_MAP_STYLE_URL` (web).

### Penyesuaian untuk Vercel Functions

API Express berjalan sebagai fungsi serverless, bukan server yang hidup terus. Aturan yang berlaku untuk semua kode di `apps/api`:

1. **Tanpa proses latar permanen.** Tidak ada `setInterval`, worker, atau antrean in-memory. Pekerjaan latar memakai Vercel Cron (GET ke route internal dengan header `Authorization: Bearer $CRON_SECRET`) dan tabel `jobs` di Postgres.
2. **Tanpa state di memori antar-request.** Rate limit, cache sesi, dan penghitung disimpan di Postgres atau diserahkan ke WAF.
3. **Batas durasi.** Menurut dokumentasi Vercel (diperbarui 24 Agustus 2026), fungsi dengan Fluid compute berdurasi default 300 detik; maksimum 300 detik di paket Hobby dan 800 detik di Pro. Job dirancang selesai jauh di bawah itu dengan memproses per potongan (misalnya 500 baris per pemanggilan).
4. **Batas body 4,5 MB** untuk request dan respons fungsi. Unggahan CSV dan dokumen izin tidak melewati API: klien mengunggah ke R2 lewat signed URL, lalu API hanya menerima kunci objek.
5. **Koneksi database.** Pakai connection string pooled Neon; satu pool kecil per instance fungsi; migrasi memakai koneksi tanpa pool.
6. **Berkas.** Sistem berkas read-only kecuali `/tmp`.
7. **Cron hanya berjalan di deployment produksi.** Staging tidak mendapat Cron otomatis: panggil route job secara manual dari panel admin atau jadwalkan lewat GitHub Actions.
8. **Dua project Vercel** dari satu monorepo: `apps/web` dan `apps/api` (masing-masing dengan Root Directory sendiri). Entry API: `apps/api/api/index.ts` mengekspor aplikasi Express; `server.ts` hanya untuk pengembangan lokal.
9. **Paket.** Paket Hobby Vercel ditujukan untuk penggunaan non-komersial menurut ketentuan Vercel; periksa ketentuan terbaru dan siapkan paket Pro sebelum rilis publik.

## 3. Struktur monorepo dan konvensi

### Struktur folder

```
silk/
  apps/
    web/                  Next.js (App Router)
      src/app/            rute (lihat bagian 7)
      src/components/     komponen UI
      src/lib/            klien API, util SEO
    api/                  Express
      src/modules/        satu folder per modul (m1-directory, m2-tariffs, ...)
        <modul>/
          <modul>.routes.ts
          <modul>.controller.ts
          <modul>.service.ts
          <modul>.repo.ts
          <modul>.test.ts
      src/middleware/     auth, rbac, rate-limit, error, request-id
      src/jobs/           handler job (dipanggil Vercel Cron)
      src/server.ts       server lokal; api/index.ts mengekspor app untuk Vercel
      vercel.json         jadwal Cron dan konfigurasi fungsi
  packages/
    db/                   skema Drizzle, migrasi, seed
    shared/               skema Zod, tipe, konstanta, util harga
    config/               tsconfig, eslint, prettier bersama
  docs/                   ADR, spesifikasi modul, catatan data
  .github/workflows/      CI
  CLAUDE.md
  turbo.json  pnpm-workspace.yaml  .env.example
```

### Lapisan di API

- **routes:** hanya memetakan URL ke controller dan memasang middleware.
- **controller:** membaca request tervalidasi, memanggil service, membentuk respons.
- **service:** aturan bisnis; tidak tahu HTTP.
- **repo:** satu-satunya tempat query database (Drizzle).

Aturan: controller tidak boleh memanggil repo langsung; service tidak boleh memakai objek `req` atau `res`.

### Konvensi kode

| Area | Aturan |
| --- | --- |
| Bahasa | TypeScript `strict: true`, tanpa `any` |
| Nama | Berkas `kebab-case`, tipe `PascalCase`, fungsi `camelCase`, tabel dan kolom `snake_case` |
| Validasi | Semua input lewat Zod di `packages/shared`; API menolak data yang tidak lolos skema |
| Error | Kelas `AppError` dengan kode stabil (`TARIFF_NOT_FOUND`); tidak ada `throw new Error` mentah di service |
| Log | `pino` terstruktur, tanpa data pribadi, sertakan `requestId` |
| Waktu | Simpan UTC (`timestamptz`), tampilkan zona `Asia/Jakarta` di FE |
| Uang | Integer rupiah (`bigint`), format di FE dengan `Intl.NumberFormat('id-ID')` |
| Bahasa UI | Bahasa Indonesia; teks disimpan di berkas pesan, bukan hardcode di komponen |
| Komit | Conventional Commits (`feat:`, `fix:`, `chore:`) |
| Cabang | `main` terlindungi; kerja di `feat/<modul>-<ringkas>` lewat PR |

## 4. Skema database

Skema ditulis dengan Drizzle di `packages/db`. Berikut DDL SQL sebagai acuan; Claude Code menerjemahkannya ke skema Drizzle dan membuat migrasi.

### Daftar tabel

| Tabel | Isi | Modul |
| --- | --- | --- |
| `facilities` | Faskes: nama, jenis, alamat, koordinat, status | M1 |
| `practitioners`, `facility_practitioners` | Tenaga medis dan penempatan | M1 |
| `service_categories`, `services` | Taksonomi layanan standar | M2 |
| `packages`, `package_components` | Paket dan komponen termasuk atau tidak | M2, M3 |
| `tariffs`, `tariff_versions` | Entri tarif dan riwayat versi (append-only) | M2, M4 |
| `data_sources` | Asal data: Perda, PMK, faskes, admin | M4, M5 |
| `import_batches`, `import_rows` | Staging impor data publik | M5 |
| `users`, `sessions`, `memberships` | Akun dan sesi dikelola Better Auth; memberships milik SILK | M6 |
| `facility_claims`, `documents` | Klaim profil dan dokumen izin | M7 |
| `data_reports` | Laporan data salah dari publik | M14 |
| `audit_logs` | Jejak semua perubahan | M15 |
| `analytics_events` | Peristiwa ringan (opsional, bila tidak lewat PostHog) | M18 |

### DDL inti

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE facility_type AS ENUM ('rumah_sakit','klinik','puskesmas','laboratorium','praktik_dokter','apotek');
CREATE TYPE verification_level AS ENUM ('publik_belum_diverifikasi','dari_dokumen_publik','diisi_faskes','diverifikasi_admin');
CREATE TYPE price_type AS ENUM ('tetap','rentang','mulai_dari','paket','tanya');
CREATE TYPE entity_status AS ENUM ('draft','menunggu_tinjauan','terbit','ditarik');

CREATE TABLE facilities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,
  name          text NOT NULL,
  type          facility_type NOT NULL,
  address       text NOT NULL,
  city          text NOT NULL,
  province      text NOT NULL,
  location      geography(Point, 4326),
  phone         text,
  website       text,
  license_no    text,
  hours         jsonb,
  verification  verification_level NOT NULL DEFAULT 'publik_belum_diverifikasi',
  status        entity_status NOT NULL DEFAULT 'draft',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX facilities_name_trgm ON facilities USING gin (name gin_trgm_ops);
CREATE INDEX facilities_location_gix ON facilities USING gist (location);
CREATE INDEX facilities_city_type ON facilities (city, type) WHERE status = 'terbit';

CREATE TABLE practitioners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  specialty text,
  str_no text,
  str_verified_at timestamptz,
  status entity_status NOT NULL DEFAULT 'draft'
);
CREATE TABLE facility_practitioners (
  facility_id uuid REFERENCES facilities(id) ON DELETE CASCADE,
  practitioner_id uuid REFERENCES practitioners(id) ON DELETE CASCADE,
  PRIMARY KEY (facility_id, practitioner_id)
);

CREATE TABLE service_categories (
  id smallserial PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  parent_id smallint REFERENCES service_categories(id)
);
CREATE TABLE services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id smallint NOT NULL REFERENCES service_categories(id),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  aliases text[] NOT NULL DEFAULT '{}'
);
CREATE INDEX services_name_trgm ON services USING gin (name gin_trgm_ops);

CREATE TABLE packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id),
  name text NOT NULL,
  notes text
);
CREATE TABLE package_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  label text NOT NULL,
  included boolean NOT NULL DEFAULT true,
  sort_order smallint NOT NULL DEFAULT 0
);

CREATE TABLE data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,            -- perda | pmk | faskes | admin | lainnya
  title text NOT NULL,
  url text,
  document_date date,
  note text
);

CREATE TABLE tariffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id),
  package_id uuid REFERENCES packages(id),
  current_version_id uuid,       -- diisi setelah versi pertama dibuat
  status entity_status NOT NULL DEFAULT 'draft',
  UNIQUE NULLS NOT DISTINCT (facility_id, service_id, package_id)
);

CREATE TABLE tariff_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tariff_id uuid NOT NULL REFERENCES tariffs(id) ON DELETE CASCADE,
  version_no int NOT NULL,
  price_type price_type NOT NULL,
  price_min bigint,              -- rupiah
  price_max bigint,
  effective_from date NOT NULL,
  effective_to date,
  verified_at timestamptz,
  verification verification_level NOT NULL,
  source_id uuid REFERENCES data_sources(id),
  inclusions text,
  exclusions text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tariff_id, version_no),
  CHECK (price_type IN ('tanya') OR price_min IS NOT NULL),
  CHECK (price_max IS NULL OR price_max >= price_min)
);
ALTER TABLE tariffs ADD CONSTRAINT tariffs_current_fk
  FOREIGN KEY (current_version_id) REFERENCES tariff_versions(id);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext UNIQUE NOT NULL,
  name text,
  role text NOT NULL DEFAULT 'faskes',   -- faskes | admin | moderator
  mfa_secret_enc text,
  mfa_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE memberships (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES facilities(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'pengelola',
  PRIMARY KEY (user_id, facility_id)
);

CREATE TABLE facility_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id),
  user_id uuid NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'menunggu',
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  note text
);
CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES facility_claims(id) ON DELETE CASCADE,
  object_key text NOT NULL,
  mime text NOT NULL,
  size_bytes int NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES data_sources(id),
  uploaded_by uuid REFERENCES users(id),
  status text NOT NULL DEFAULT 'diunggah',  -- diunggah | divalidasi | ditinjau | diterbitkan | ditolak
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE import_rows (
  id bigserial PRIMARY KEY,
  batch_id uuid NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  raw jsonb NOT NULL,
  errors jsonb,
  matched_facility_id uuid,
  matched_service_id uuid
);

CREATE TABLE data_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tariff_id uuid NOT NULL REFERENCES tariffs(id),
  reason text NOT NULL,
  contact_email text,
  status text NOT NULL DEFAULT 'baru',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id bigserial PRIMARY KEY,
  actor_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text NOT NULL,
  before jsonb,
  after jsonb,
  ip inet,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_entity_idx ON audit_logs (entity, entity_id, at DESC);
```

### Aturan data

- **Append-only:** `tariff_versions` tidak pernah di-`UPDATE` atau di-`DELETE`; ralat membuat versi baru. Beri hak `INSERT` dan `SELECT` saja ke peran aplikasi untuk tabel ini.
- **Penanda usang:** tarif dianggap `stale` bila `verified_at` lebih lama dari 180 hari (nilai ini dikonfigurasi, bukan di-hardcode). Status dihitung di query, tidak disimpan.
- **Tarif terbit** hanya jika `status = 'terbit'` pada faskes dan tarifnya, dan versi saat ini punya `effective_from` ≤ hari ini.
- **Kolom `price_type = 'tanya'`** menampilkan "Tanyakan ke faskes" tanpa angka.
- **Seed:** `packages/db/seed` memuat taksonomi awal (kategori lab dan MCU), satu kota contoh, dan data uji; tidak berisi data nyata faskes.

### Penyesuaian: Better Auth, wilayah, dan job

- **Auth:** tabel `users` dan `sessions` pada DDL di atas digantikan tabel yang dihasilkan CLI Better Auth (`user`, `session`, `account`, `verification`, `twoFactor`). Peran (`faskes`, `moderator`, `admin`) memakai plugin admin; MFA TOTP memakai plugin two-factor. Kolom `user_id` pada `memberships`, `facility_claims`, `import_batches`, `facility_claims.reviewed_by`, dan `tariff_versions.created_by` mengacu ke `user.id`. Atur pembuatan ID agar seragam (uuid) sebelum menjalankan migrasi pertama.
- **Wilayah:** tambahkan tabel `regions` (`id`, `code`, `name`, `type` kota atau kabupaten atau provinsi, `parent_id`, `source`) dan kolom `facilities.region_id` (tetap simpan `city` dan `province` sebagai teks tampilan). Isi awal dari dataset Country State City, lalu cocokkan dengan kode wilayah resmi Kemendagri sebagai kunci kanonik. Kota Malang dan Kabupaten Malang adalah dua wilayah terpisah; pencarian "Malang" harus mencakup keduanya.
- **Job:** tambahkan tabel `jobs` (`id`, `type`, `payload jsonb`, `status`, `attempts`, `run_after timestamptz`, `locked_at`, `last_error`, `created_at`). Pengambilan job memakai `SELECT ... FOR UPDATE SKIP LOCKED` dengan batas waktu kunci; setiap job idempoten.

## 5. Kontrak API

API REST berversi di `/v1`. Skema request dan respons ditulis sebagai Zod di `packages/shared`, dan dokumen OpenAPI dihasilkan dari skema itu (`/v1/openapi.json`).

### Konvensi

| Aspek | Aturan |
| --- | --- |
| Format | JSON, `Content-Type: application/json` |
| Sukses | `{ "data": ..., "meta": { ... } }` |
| Error | `{ "error": { "code": "TARIFF_NOT_FOUND", "message": "...", "details": [...] }, "requestId": "..." }` |
| Status | 200, 201, 204, 400 (validasi), 401, 403, 404, 409 (konflik), 422, 429, 500 |
| Paginasi | Kursor: `?limit=20&cursor=...`; `meta.nextCursor` |
| Pengurutan | Parameter ?sort dengan nilai price\_asc, price\_desc, name, atau distance; tidak ada parameter pengurutan berbasis pembayaran |
| Autentikasi | Cookie sesi `HttpOnly`, `SameSite=Lax`, `Secure`; token CSRF untuk metode selain GET |
| Rate limit | Publik 60 permintaan/menit/IP; portal 120/menit/pengguna; login 5/menit/IP |
| Cache | Respons publik membawa `Cache-Control: s-maxage` dan `ETag` |

### Endpoint publik (tanpa login)

| Metode | Path | Fungsi | Modul |
| --- | --- | --- | --- |
| GET | `/v1/facilities` | Cari faskes: `q`, `city`, `type`, `service`, `lat`, `lng`, `radius` | M1 |
| GET | `/v1/facilities/:slug` | Detail faskes beserta tarif terbit | M1, M2 |
| GET | `/v1/practitioners/:slug` | Detail tenaga medis | M1 |
| GET | `/v1/services` | Daftar dan cari layanan standar | M2 |
| GET | `/v1/services/:slug` | Detail layanan dan ringkasan harga per kota | M2 |
| GET | `/v1/compare` | Bandingkan: `service=...&facilityIds=a,b,c` atau `service=...&city=...` | M3 |
| GET | `/v1/tariffs/:id/history` | Riwayat versi tarif | M4 |
| POST | `/v1/reports` | Laporkan data salah (Turnstile wajib) | M14 |
| GET | `/v1/sitemap` | Daftar URL untuk sitemap | M12 |
| GET | `/v1/health` | Cek hidup dan versi | semua |

### Endpoint autentikasi

| Metode | Path | Fungsi |
| --- | --- | --- |
| POST | `/v1/auth/register` | Daftar akun faskes (email, kata sandi, Turnstile) |
| POST | `/v1/auth/verify-email` | Konfirmasi email |
| POST | `/v1/auth/login` | Masuk; bila MFA aktif, lanjut ke `/mfa` |
| POST | `/v1/auth/mfa/setup`, `/mfa/verify` | Aktifkan dan verifikasi TOTP |
| POST | `/v1/auth/logout` | Keluar |
| POST | `/v1/auth/forgot-password`, `/reset-password` | Pulihkan kata sandi |
| GET | `/v1/me` | Profil dan keanggotaan faskes |

Catatan: endpoint autentikasi di atas dilayani oleh handler Better Auth yang dipasang di Express pada `/v1/auth/*` (`basePath` dikonfigurasi). Nama path dapat berbeda dari tabel; tabel ini menjelaskan kapabilitas, dan Claude Code menyelaraskan nama dengan rute bawaan Better Auth lalu memperbarui dokumen OpenAPI. Endpoint tambahan: `GET /v1/internal/jobs/:type` (dipanggil Vercel Cron, wajib `CRON_SECRET`) dan `POST /v1/webhooks/sanity` (revalidate dan filter konten artikel, wajib tanda tangan).

### Endpoint portal faskes (login, peran `faskes`)

| Metode | Path | Fungsi | Modul |
| --- | --- | --- | --- |
| POST | `/v1/portal/claims` | Ajukan klaim profil faskes | M7 |
| POST | `/v1/portal/claims/:id/documents/presign` | Minta signed URL unggah dokumen | M7 |
| GET/PUT | `/v1/portal/facilities/:id` | Lihat dan ubah profil | M6 |
| GET | `/v1/portal/facilities/:id/tariffs` | Daftar tarif milik faskes | M6 |
| POST | `/v1/portal/facilities/:id/tariffs` | Tambah tarif | M6 |
| PUT | `/v1/portal/tariffs/:id` | Buat versi baru tarif | M6 |
| POST | `/v1/portal/facilities/:id/tariffs/import` | Unggah CSV tarif | M6 |
| GET | `/v1/portal/facilities/:id/stats` | Statistik tampilan dan klik | M8 |

### Endpoint admin (login, peran `admin` atau `moderator`, MFA wajib)

| Metode | Path | Fungsi | Modul |
| --- | --- | --- | --- |
| GET | `/v1/admin/claims` | Antrean klaim | M7, M15 |
| POST | `/v1/admin/claims/:id/approve`, `/reject` | Putuskan klaim | M7 |
| GET | `/v1/admin/reports` | Antrean laporan data | M14 |
| PATCH | `/v1/admin/reports/:id` | Tangani laporan | M14 |
| POST | `/v1/admin/imports` | Unggah CSV data publik | M5 |
| GET | `/v1/admin/imports/:id` | Status, baris galat | M5 |
| POST | `/v1/admin/imports/:id/publish` | Terbitkan batch | M5 |
| PATCH | `/v1/admin/facilities/:id` | Ubah status, verifikasi | M1, M15 |
| GET | `/v1/admin/audit-logs` | Cari log audit | M15 |
| GET/POST | `/v1/admin/content-rules` | Kelola daftar kata terlarang | M17 |

### Contoh: respons perbandingan

```json
{
  "data": {
    "service": { "slug": "mcu-dasar", "name": "Medical Check-Up Dasar" },
    "columns": ["Hemoglobin", "Gula darah puasa", "Kolesterol total", "Rontgen thorax"],
    "rows": [
      {
        "facility": { "slug": "klinik-contoh", "name": "Klinik Contoh", "city": "Malang" },
        "price": { "type": "tetap", "min": 350000, "max": null, "currency": "IDR" },
        "components": { "Hemoglobin": true, "Gula darah puasa": true, "Kolesterol total": true, "Rontgen thorax": false },
        "effectiveFrom": "2026-09-01",
        "verifiedAt": "2026-10-12T03:00:00Z",
        "verification": "diverifikasi_admin",
        "stale": false,
        "source": { "kind": "faskes", "title": "Papan tarif faskes" }
      }
    ]
  },
  "meta": { "nextCursor": null }
}
```

### Kode error stabil (contoh)

`VALIDATION_FAILED`, `UNAUTHENTICATED`, `FORBIDDEN`, `MFA_REQUIRED`, `FACILITY_NOT_FOUND`, `TARIFF_NOT_FOUND`, `TARIFF_VERSION_CONFLICT`, `IMPORT_ROW_INVALID`, `CONTENT_RULE_VIOLATION`, `RATE_LIMITED`, `TURNSTILE_FAILED`.

## 6. Spesifikasi modul fitur

Setiap modul punya tujuan, aturan bisnis, endpoint, halaman, dan **kriteria penerimaan** (acceptance criteria) yang bisa diuji. Claude Code mengerjakan satu modul per PR. Prioritas P0 dikerjakan lebih dulu (bagian 10).

### M1 Direktori faskes dan tenaga medis (P0)

- **Tujuan:** pengguna menemukan faskes dan melihat profil lengkap.
- **Aturan bisnis:** hanya `status = terbit` yang tampil publik; slug unik dan stabil (tidak berubah walau nama berubah); STR hanya tampil bila `str_verified_at` terisi.
- **Endpoint:** `GET /v1/facilities`, `/v1/facilities/:slug`, `/v1/practitioners/:slug`.
- **Halaman:** `/faskes`, `/faskes/[slug]`, `/dokter/[slug]`.
- **Pencarian:** `q` memakai `similarity()` (trigram) pada nama dan alias layanan; `lat/lng/radius` memakai `ST_DWithin`; filter `city`, `type`, `service`.
- **Kriteria penerimaan:**
  1. Mencari "klinik pratama" dengan salah ketik satu huruf tetap menemukan hasil relevan.
  2. Pencarian radius 5 km mengembalikan faskes terurut menurut jarak.
  3. Faskes berstatus `draft` tidak muncul di daftar, detail, maupun sitemap.
  4. Halaman detail memuat JSON-LD `MedicalOrganization` yang valid.

### M2 Katalog layanan dan tarif (P0)

- **Tujuan:** menyimpan dan menampilkan tarif dengan tipe harga yang benar.
- **Aturan bisnis:** `price_type` menentukan kolom wajib (`tetap`: `price_min`; `rentang`: `price_min` dan `price_max`; `mulai_dari`: `price_min`; `paket`: terkait `package_id`; `tanya`: tanpa angka). Perubahan tarif selalu membuat `tariff_versions` baru dan memperbarui `current_version_id` dalam satu transaksi.
- **Endpoint:** `GET /v1/services`, `/v1/services/:slug`.
- **Halaman:** `/layanan`, `/layanan/[slug]` (ringkasan harga per kota), bagian tarif di halaman faskes.
- **Kriteria penerimaan:**
  1. Tarif `rentang` dengan `price_max < price_min` ditolak (400, `VALIDATION_FAILED`).
  2. Mengubah harga membuat versi nomor +1; versi lama tetap dapat dibaca.
  3. Tarif `tanya` tampil "Tanyakan ke faskes", bukan angka nol.
  4. Harga tampil dalam format `Rp1.250.000`.

### M3 Perbandingan harga (P0)

- **Tujuan:** perbandingan apple-to-apple berdasarkan isi paket.
- **Aturan bisnis:** hanya membandingkan paket pada `service_id` yang sama; kolom perbandingan adalah gabungan label komponen dari semua paket yang dipilih; komponen yang tidak ada ditandai "tidak termasuk", bukan kosong; urutan default berdasarkan harga naik, tidak pernah berdasarkan pembayaran; label "termurah" dan "terbaik" tidak dipakai.
- **Endpoint:** `GET /v1/compare`.
- **Halaman:** `/bandingkan/[service]?kota=...` dengan tabel, filter, dan tombol bagikan tautan.
- **Kriteria penerimaan:**
  1. Membandingkan 3 paket dengan komponen berbeda menampilkan semua komponen dan menandai yang tidak termasuk.
  2. Tarif `stale` ditandai jelas dan dapat disaring.
  3. URL perbandingan dapat dibuka ulang dan menghasilkan tampilan yang sama.

### M4 Lapisan kepercayaan data (P0)

- **Tujuan:** setiap angka punya konteks yang bisa diperiksa.
- **Aturan bisnis:** komponen `TrustBadge` menampilkan tanggal berlaku, tanggal verifikasi, tingkat verifikasi, dan sumber; `stale = verified_at < now() - interval '180 days'` (nilai dari konfigurasi); riwayat versi dapat dibuka dari setiap tarif.
- **Endpoint:** `GET /v1/tariffs/:id/history`.
- **Kriteria penerimaan:**
  1. Tarif tanpa `verified_at` tampil sebagai "belum diverifikasi".
  2. Dengan jam sistem dimajukan 181 hari, tarif otomatis berstatus `stale` tanpa perubahan data.
  3. Riwayat menampilkan semua versi berurutan dengan pembuat dan waktu.

### M5 Data awal publik (P0)

- **Tujuan:** mengisi katalog dari tarif publik (Perda RSUD, PMK 109/2014) agar halaman tidak kosong.
- **Aturan bisnis:** impor melalui staging (`import_rows`); baris valid dan baris galat dipisah; admin harus meninjau sebelum terbit; setiap tarif hasil impor memakai `verification = dari_dokumen_publik` dan `source_id` ke dokumen aslinya; pencocokan faskes dan layanan memakai nama dan alias, dengan antrean untuk kecocokan ambigu.
- **Format CSV:** `facility_name, city, service_slug, price_type, price_min, price_max, effective_from, source_title, source_url`.
- **Endpoint:** `POST /v1/admin/imports`, `GET /v1/admin/imports/:id`, `POST /v1/admin/imports/:id/publish`.
- **Kriteria penerimaan:**
  1. CSV 500 baris dengan 20 baris galat menghasilkan laporan galat per baris tanpa menggagalkan baris valid.
  2. Penerbitan batch bersifat transaksional: gagal sebagian berarti tidak ada yang terbit.
  3. Mengunggah ulang berkas yang sama tidak menggandakan tarif (idempoten berdasarkan faskes, layanan, tanggal berlaku).

### M6 Papan tarif faskes (P0)

- **Tujuan:** faskes mengelola tarif sendiri dengan mudah.
- **Aturan bisnis:** pengguna hanya mengakses faskes yang terdaftar di `memberships`; unggah massal CSV memakai format yang sama dengan M5 tetapi hanya untuk faskes sendiri; perubahan masuk status `menunggu_tinjauan` bila faskes belum terverifikasi, langsung terbit bila sudah.
- **Halaman portal:** `/portal`, `/portal/tarif`, `/portal/tarif/impor`, `/portal/profil`.
- **Kriteria penerimaan:**
  1. Pengelola faskes A yang memanggil API untuk faskes B menerima 403.
  2. Unggah CSV berisi tarif faskes lain ditolak seluruhnya.
  3. Mengubah tarif tercatat di audit log dengan nilai sebelum dan sesudah.

### M7 Verifikasi dan klaim profil (P0)

- **Tujuan:** memastikan pengelola benar-benar mewakili faskes.
- **Aturan bisnis:** klaim memerlukan minimal satu dokumen (izin operasional, format PDF atau gambar, maksimal 5 MB); berkas disimpan di R2 privat dan hanya dapat dilihat admin lewat signed URL berumur pendek; persetujuan klaim menambah `memberships` dan menaikkan verifikasi faskes.
- **Kriteria penerimaan:**
  1. Unggah berkas bertipe `.exe` atau di atas 5 MB ditolak.
  2. Dokumen tidak dapat diakses lewat URL publik.
  3. Klaim yang ditolak menyertakan alasan yang terkirim lewat email.

### M12 Konten edukasi biaya (P0)

- **Tujuan:** artikel "berapa biaya ..." dan checklist pertanyaan biaya sebagai pintu masuk SEO.
- **Implementasi MVP:** artikel ditulis di headless CMS (Sanity, hosted) dan diambil lewat ISR; model konten: judul, slug, deskripsi, tanggal, penulis, kategori, isi, layanan terkait; tautan otomatis ke halaman layanan dan perbandingan terkait.
- **Kriteria penerimaan:** setiap artikel memiliki `<title>`, meta description, canonical, dan JSON-LD `Article`; bidang wajib CMS tidak boleh kosong, dan artikel diperiksa filter konten M17 lewat webhook sebelum terbit.

### M15 Panel admin dan moderasi (P0)

- **Tujuan:** kendali kualitas data.
- **Fitur:** antrean klaim, antrean laporan data, impor, daftar faskes dengan filter status, penelusuran audit log.
- **Aturan bisnis:** semua aksi admin membutuhkan sesi dengan MFA terverifikasi; peran `moderator` tidak dapat menghapus atau mengubah peran pengguna.
- **Kriteria penerimaan:** akun admin tanpa MFA diarahkan ke penyiapan MFA sebelum mengakses `/admin`; setiap aksi muncul di audit log dengan IP.

### M16 Keamanan dan privasi (P0)

Rincian di bagian 8. Kriteria penerimaan: pemindaian dependensi bersih dari kerentanan tinggi; header keamanan lolos pemeriksaan; tidak ada rahasia di repo.

### M17 Filter konten kepatuhan (P0)

- **Tujuan:** mencegah konten yang melanggar aturan iklan kesehatan.
- **Aturan bisnis:** daftar kata dan pola di tabel konfigurasi (misalnya "termurah", "terbaik", "pasti sembuh", "100% aman"); teks yang dikirim faskes (deskripsi profil, catatan tarif) dan artikel diperiksa sebelum terbit; kecocokan memblokir penerbitan atau mengirim ke tinjauan moderator sesuai tingkat aturan.
- **Kriteria penerimaan:** deskripsi berisi "klinik terbaik di Malang" ditolak dengan `CONTENT_RULE_VIOLATION` dan menyebut kata yang melanggar; admin dapat menambah aturan tanpa deploy.

### M18 Analitik produk (P0)

- **Tujuan:** mengukur permintaan nyata untuk keputusan go/no-go.
- **Peristiwa:** `search_performed`, `facility_viewed`, `compare_viewed`, `contact_clicked`, `route_clicked`, `report_submitted`, `claim_started`, `tariff_published`.
- **Aturan bisnis:** tanpa data pribadi; consent banner bila memakai cookie analitik; dasbor internal (PostHog) menampilkan funnel pencarian ke klik kontak.
- **Kriteria penerimaan:** setiap peristiwa terkirim dengan properti `city`, `service`, `facility_id` (bila ada) dan dapat difilter per minggu.

### Modul P1 dan P2 (dikerjakan setelah validasi MVP)

Spesifikasi ringkas; rinciannya diperluas saat modul masuk jadwal.

| Modul | Prioritas | Tujuan | Aturan dan data kunci | Kriteria penerimaan inti |
| --- | --- | --- | --- | --- |
| M8 Dashboard faskes | P1 | Tunjukkan nilai ke faskes | Agregasi harian `facility_viewed`, `contact_clicked`, `route_clicked`; data hanya milik faskes sendiri | Faskes melihat grafik 30 hari terakhir; angka cocok dengan peristiwa mentah |
| M9 Benchmark anonim | P2 | Posisi tarif faskes terhadap kota | Tampilkan agregat hanya bila minimal 5 faskes pada layanan dan kota yang sama; tidak pernah menampilkan harga faskes lain secara individual; wajib pendapat hukum persaingan | Dengan 4 faskes, benchmark tidak ditampilkan |
| M10 Estimator biaya skenario | P1 | Total biaya per kejadian (mis. persalinan) | Skenario disusun dari layanan standar dan rentang; hasil selalu berupa rentang dengan asumsi tertulis dan label "estimasi" | Estimasi menampilkan komponen, asumsi, dan tanggal data; tidak ada satu angka tunggal tanpa rentang |
| M11 Estimasi biaya sendiri | P2 | Selisih biaya dengan BPJS atau asuransi | Tabel referensi tarif INA-CBG dan plafon manfaat yang dimasukkan pengguna; disklaimer wajib | Hasil jelas menyebut batas keakuratan dan bukan jaminan klaim |
| M13 Akun pasien dan simpan | P1 | Retensi | Simpan faskes dan perbandingan; hanya email dan daftar simpanan; persetujuan eksplisit dan hapus akun | Pengguna dapat mengekspor dan menghapus datanya |
| M14 Umpan balik data | P1 | Perbaikan kualitas | Pelaporan harga berbeda lewat form (Turnstile); bukan ulasan bebas; status laporan terlihat oleh pelapor lewat email | Laporan masuk antrean admin dan menautkan ke versi tarif yang dilaporkan |
| M19 Langganan alat faskes | P2 | Pendapatan B2B | Paket fitur alat (dashboard, impor, API); tidak memengaruhi urutan hasil; hanya setelah pendapat hukum tertulis | Berlangganan tidak mengubah posisi di hasil pencarian (uji otomatis) |
| M20 API dan integrasi | P2 | Skala | Kunci API, kuota, dokumentasi OpenAPI; integrasi data master faskes bila tersedia | Kunci dapat dicabut dan kuota ditegakkan |

## 7. Frontend: rute, SEO, komponen

### Peta rute (Next.js App Router)

| Rute | Jenis render | Isi | Modul |
| --- | --- | --- | --- |
| `/` | ISR (1 jam) | Pencarian, kategori populer, kota | M1 |
| `/cari` | Dinamis (SSR) | Hasil pencarian dengan filter | M1 |
| `/faskes/[slug]` | ISR + revalidate per tag | Profil dan tarif faskes | M1, M2, M4 |
| `/dokter/[slug]` | ISR | Profil tenaga medis | M1 |
| `/layanan` dan `/layanan/[slug]` | ISR | Katalog layanan, ringkasan harga per kota | M2 |
| `/bandingkan/[service]` | Dinamis (SSR) | Tabel perbandingan | M3 |
| `/artikel` dan `/artikel/[slug]` | ISR (dari CMS) | Konten edukasi | M12 |
| `/masuk`, `/daftar` | Klien | Autentikasi | M6 |
| `/portal/*` | Klien, terlindungi | Portal faskes | M6, M7, M8 |
| `/admin/*` | Klien, terlindungi + MFA | Panel admin | M15 |
| `/sitemap.xml`, `/robots.txt` | Dinamis | SEO teknis | M12 |
| `/privasi`, `/syarat`, `/tentang`, `/metodologi` | Statis | Halaman kepercayaan | semua |

Halaman `/metodologi` menjelaskan asal data, arti tingkat verifikasi, dan cara membaca estimasi. Halaman ini bagian dari lapisan kepercayaan.

### Aturan SEO

1. Semua halaman publik dirender di server dengan HTML lengkap tanpa menunggu JavaScript.
2. `generateMetadata` per halaman: judul unik ("Biaya MCU di Malang: Perbandingan Tarif, diperbarui \<tanggal>"), deskripsi, canonical, Open Graph.
3. JSON-LD: `MedicalOrganization` (faskes), `Physician` (dokter), `Article` (artikel), `BreadcrumbList` (semua). Jangan memakai markup `Review` atau `AggregateRating` karena tidak ada ulasan.
4. Sitemap dibagi per tipe (maksimal 50.000 URL per berkas) dan hanya memuat entitas berstatus `terbit`.
5. Halaman perbandingan dengan parameter berbeda memakai canonical ke bentuk baku untuk menghindari duplikasi.
6. Pengukuran Core Web Vitals: LCP di bawah 2,5 detik pada 75% kunjungan seluler.
7. Halaman dengan data usang tetap diindeks, tetapi menampilkan penanda usang dan tanggal verifikasi.

### Komponen UI inti

| Komponen | Fungsi |
| --- | --- |
| `SearchBar` | Kolom pencarian dengan saran layanan dan kota |
| `FacilityCard` | Kartu hasil: nama, jenis, jarak, rentang harga, `TrustBadge` |
| `PriceDisplay` | Format harga berdasarkan `price_type` (tetap, rentang, mulai dari, tanya) |
| `TrustBadge` | Tanggal berlaku, verifikasi, sumber, penanda usang |
| `ComparisonTable` | Tabel perbandingan dengan komponen termasuk atau tidak |
| `TariffHistoryDrawer` | Riwayat versi tarif |
| `ReportDataDialog` | Form laporan data salah |
| `DisclaimerBanner` | Peringatan bahwa harga adalah informasi dan dapat berubah |
| `FacilityForm`, `TariffForm`, `CsvImportWizard` | Portal faskes |
| `ReviewQueueTable` | Antrean admin |

### Aksesibilitas dan bahasa

- Kontras warna memenuhi WCAG AA; seluruh fungsi dapat dipakai dengan keyboard.
- Tabel perbandingan memakai elemen tabel semantik dengan `scope` pada header.
- Seluruh teks antarmuka berbahasa Indonesia; tidak memakai istilah "termurah" atau "terbaik".
- Desain mobile-first karena sebagian besar pengguna mengakses lewat ponsel.

### Peta (MapLibre) dan CMS

- **Peta:** MapLibre GL JS dimuat hanya di halaman yang butuh peta (detail faskes, hasil pencarian mode peta) lewat dynamic import; halaman tetap berguna tanpa JavaScript peta (alamat, tautan rute ke aplikasi peta). Gaya peta lewat `NEXT_PUBLIC_MAP_STYLE_URL`.
- **Sumber tile belum dipilih.** MapLibre hanya perenderer. Server tile OSM publik tidak untuk lalu lintas produksi menurut kebijakan penggunaannya (cek kebijakan terbaru). Pilihan: penyedia tile berbayar atau gratis berbatas (MapTiler, Stadia, atau sejenisnya), atau hosting tile sendiri dalam format PMTiles di R2 (Protomaps).
- **Geocoding:** koordinat faskes dihitung sekali saat impor atau input (offline atau lewat penyedia), disimpan di `facilities.location`, dan dikoreksi manual admin. Jangan memanggil geocoder pada setiap permintaan pengguna.
- **CMS (Sanity, pilihan saya; ganti bila Anda lebih suka Payload di Postgres):** model `article`, `author`, `category`; `article.relatedServices` mereferensikan `services.slug`. Next.js membaca lewat GROQ dengan ISR dan tag revalidate; webhook Sanity memanggil `POST /v1/webhooks/sanity` yang menjalankan filter konten M17 dan memicu revalidate. Penulis mengelola konten di Sanity Studio, bukan di panel admin SILK.

## 8. Keamanan, privasi, kepatuhan

### Kontrol keamanan

| Area | Kontrol | Implementasi |
| --- | --- | --- |
| Autentikasi | Kata sandi di-hash argon2id; minimal 12 karakter | Better Auth + argon2 |
| MFA | TOTP wajib untuk admin dan moderator, ditawarkan ke pengelola faskes; rahasia TOTP dienkripsi | `otplib`, kunci enkripsi dari variabel lingkungan |
| Sesi | Cookie `HttpOnly`, `Secure`, `SameSite=Lax`; masa berlaku 7 hari, sesi admin 8 jam; sesi dicabut saat kata sandi diganti | Tabel `sessions` |
| CSRF | Token ganda untuk metode non-GET | Middleware |
| Otorisasi | RBAC (`faskes`, `moderator`, `admin`) plus pemeriksaan kepemilikan faskes di service | `requireRole`, `requireFacilityAccess` |
| Validasi input | Zod di semua endpoint; batas ukuran body | Middleware validasi |
| SQL injection | Hanya query terparameter lewat Drizzle | Aturan review |
| XSS | Tidak memakai `dangerouslySetInnerHTML` untuk input pengguna; CSP ketat | Header di Next.js |
| Header | HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` | `helmet` di API, `next.config` di web |
| Rate limiting | Per IP dan per pengguna; login lebih ketat | WAF (Cloudflare atau Vercel) sebagai lapis utama; penghitung di Postgres untuk login dan laporan, bukan memori instance |
| Anti-bot | Turnstile pada daftar, login berulang gagal, dan laporan data | Verifikasi sisi server |
| Unggahan | Daftar MIME diizinkan, batas ukuran, cek magic bytes, penyimpanan privat, nama objek acak | Signed URL R2 |
| Rahasia | Hanya di variabel lingkungan platform; tidak pernah di repo; pemindaian rahasia di CI | GitHub secret scanning |
| Dependensi | Audit rutin dan pembaruan otomatis | `pnpm audit`, Dependabot |
| Backup | Dump terenkripsi berkala ke R2 di luar Neon; uji pemulihan tiap kuartal | Job terjadwal |

### Privasi dan PDP

1. **Minimalisasi data:** MVP hanya menyimpan email dan nama pengelola faskes dan admin. Tidak ada data kesehatan pasien.
2. **Dasar pemrosesan dan persetujuan:** form pendaftaran memuat persetujuan eksplisit dan tautan kebijakan privasi.
3. **Hak subjek data:** ekspor dan hapus akun lewat portal (atau permintaan email dalam MVP).
4. **Retensi:** audit log disimpan 2 tahun; dokumen izin klaim yang ditolak dihapus setelah 90 hari.
5. **Pencatatan:** audit log mencatat IP; kebijakan privasi menjelaskannya.
6. **Insiden:** prosedur tertulis untuk kebocoran data; hubungi konsultan hukum untuk kewajiban pemberitahuan sesuai UU 27/2022.
7. **Pihak ketiga:** daftar prosesor (hosting, email, analitik) dicantumkan di kebijakan privasi.

### Kepatuhan konten kesehatan

- Filter konten (M17) berjalan di server pada setiap teks yang bisa dilihat publik.
- Tidak ada fitur ulasan atau testimoni, tidak ada klaim kesembuhan, tidak ada tenaga medis sebagai model iklan.
- Setiap halaman tarif menampilkan disklaimer bahwa harga adalah informasi, dapat berubah, dan bukan penawaran mengikat.
- Dokumen kepatuhan hukum (status Permenkes 1787/2010, aturan iklan, benchmark) ditinjau konsultan hukum sebelum fitur terkait diaktifkan.

### Threat model ringkas

| Ancaman | Dampak | Mitigasi |
| --- | --- | --- |
| Akun faskes diambil alih | Tarif palsu terbit | MFA, audit log, notifikasi email saat tarif berubah |
| Pihak lain mengklaim faskes | Informasi menyesatkan | Verifikasi dokumen, tinjauan admin |
| Scraping massal | Data disalin pesaing | Rate limit, WAF, syarat penggunaan |
| Manipulasi harga oleh pesaing | Distorsi pasar | Hanya data dari faskes terverifikasi atau sumber publik; sunting dilacak |
| Kebocoran dokumen izin | Pelanggaran privasi | Bucket privat, signed URL singkat, retensi terbatas |
| Data usang menyesatkan | Pengguna dirugikan | Penanda usang, tanggal verifikasi, disklaimer |

## 9. Testing, CI/CD, observability

### Strategi pengujian

| Lapisan | Alat | Cakupan | Target |
| --- | --- | --- | --- |
| Unit | Vitest | Fungsi murni: format harga, aturan `price_type`, hitung `stale`, filter konten, pembanding komponen | Cakupan tinggi pada `packages/shared` dan service |
| Integrasi API | Vitest + Supertest + Postgres uji (branch Neon atau Docker) | Endpoint, otorisasi, transaksi versi tarif, impor | Setiap endpoint punya uji sukses dan uji gagal |
| Kontrak | Skema Zod + uji respons terhadap OpenAPI | Respons sesuai kontrak | Perubahan skema tanpa pembaruan uji gagal di CI |
| E2E | Playwright | Alur: cari, buka faskes, bandingkan; daftar, klaim, ubah tarif; admin menyetujui klaim | Alur kritis lulus di Chromium dan perangkat seluler |
| Aksesibilitas | `axe` lewat Playwright | Halaman publik utama | Tanpa pelanggaran serius |
| Performa | Lighthouse CI | `/`, `/faskes/[slug]`, `/bandingkan/[service]` | LCP seluler di bawah 2,5 detik |
| Keamanan | `pnpm audit`, pemindaian rahasia, uji otorisasi | Akses lintas faskes, rute admin tanpa MFA | Nol temuan tinggi |

Aturan uji: setiap PR yang mengubah perilaku wajib menyertakan uji; uji otorisasi (faskes A mengakses faskes B) wajib untuk setiap endpoint portal.

### Uji yang spesifik untuk SILK

1. **Urutan tidak dipengaruhi pembayaran:** uji otomatis memastikan status langganan tidak masuk ke fungsi pengurutan.
2. **Append-only:** uji memastikan `UPDATE` dan `DELETE` pada `tariff_versions` ditolak oleh peran aplikasi.
3. **Stale:** uji dengan jam sistem yang dimajukan.
4. **Filter konten:** daftar kasus kata terlarang dan kasus lolos.
5. **Impor idempoten:** mengunggah CSV yang sama dua kali tidak menggandakan data.

### Pipeline CI/CD (GitHub Actions)

1. **Pada setiap PR:** pasang dependensi (cache pnpm) → `lint` → `typecheck` → uji unit dan integrasi (branch Neon sementara) → build semua aplikasi → Playwright pada preview → Lighthouse CI.
2. **Pada merge ke `main`:** jalankan migrasi ke staging → deploy API dan web ke staging → uji asap (`/v1/health`, halaman utama).
3. **Rilis produksi:** dipicu tag `v*` atau persetujuan manual → migrasi produksi (langkah terpisah, dijalankan sebelum deploy aplikasi) → deploy → uji asap → rilis catatan.
4. **Aturan migrasi:** hanya migrasi *expand* (tambah kolom/tabel) pada rilis yang sama dengan kode baru; penghapusan kolom di rilis berikutnya; setiap migrasi berpasangan dengan rencana mundur.

### Observability

| Kebutuhan | Alat | Catatan |
| --- | --- | --- |
| Log aplikasi | `pino` ke stdout, ditarik platform hosting | Sertakan `requestId`; tanpa data pribadi |
| Error | Sentry (web dan api) | Sourcemap diunggah saat build |
| Uptime | Better Stack atau UptimeRobot pada `/v1/health` dan halaman utama | Peringatan ke email atau WhatsApp |
| Metrik produk | PostHog | Funnel dan peristiwa M18 |
| Metrik teknis | Latensi API, durasi query, durasi dan kegagalan job Cron | Peringatan bila job gagal berulang |
| SEO | Google Search Console | Pantau cakupan indeks dan kueri |

### Target layanan (SLO awal)

- Ketersediaan API publik 99,5% per bulan.
- p95 latensi `GET /v1/facilities` di bawah 400 ms.
- Pembaruan tarif tampil di halaman publik dalam 60 detik (revalidate).

## 10. Panduan eksekusi dengan Claude Code

### Cara kerja yang disarankan

1. **Taruh dokumen ini di repo** sebagai `docs/blueprint-teknis.md` (ekspor Markdown dari dokumen), dan pecah menjadi `docs/modul/m1-direktori.md` dan seterusnya bila perlu. Claude Code bekerja jauh lebih baik dengan spesifikasi yang ada di repo.
2. **Satu modul per sesi dan satu PR per modul.** Mulai sesi baru tiap modul agar konteks bersih.
3. **Minta rencana dulu** (plan mode) untuk setiap tahap; tinjau rencana, baru izinkan penulisan kode.
4. **Uji sebelum lanjut:** setiap tahap berakhir dengan `pnpm typecheck && pnpm test` hijau.
5. **Jangan beri akses rahasia produksi.** Claude Code hanya memakai database branch `dev` dan kunci pengembangan.
6. **Tinjau diff secara manusiawi** untuk area sensitif: auth, otorisasi, migrasi, dan kode yang menyentuh uang atau urutan hasil.

### Isi `CLAUDE.md` (taruh di akar repo)

```markdown
# SILK — panduan untuk Claude Code

## Apa ini
SILK: platform transparansi tarif layanan kesehatan Indonesia. Monorepo pnpm + Turborepo.
- apps/web: Next.js (App Router), apps/api: Express, packages/db: Drizzle + Neon Postgres,
  packages/shared: skema Zod dan util.
Spesifikasi lengkap ada di docs/blueprint-teknis.md dan docs/modul/*.md. Baca modul yang relevan sebelum mengerjakan.

## Perintah
- pnpm install
- pnpm dev            # web:3000, api:4000
- pnpm typecheck && pnpm lint && pnpm test
- pnpm db:generate    # buat migrasi dari skema Drizzle
- pnpm db:migrate     # jalankan migrasi (hanya ke branch dev)
- pnpm db:seed

## Aturan wajib
- TypeScript strict, tanpa `any`. Semua input divalidasi dengan Zod dari packages/shared.
- Query database hanya di *.repo.ts. Controller memanggil service, service memanggil repo.
- tariff_versions append-only: jangan pernah UPDATE/DELETE; ralat = versi baru.
- Uang = integer rupiah (bigint). Waktu = UTC (timestamptz).
- Jangan pernah mengurutkan hasil berdasarkan pembayaran atau langganan.
- Teks publik harus lolos filter konten (M17): tanpa kata "termurah", "terbaik", janji sembuh.
- Setiap perubahan data oleh pengguna terautentikasi menulis audit_logs.
- Jangan commit rahasia. Jangan sentuh .env. Tambah variabel baru ke .env.example.
- Jangan menjalankan migrasi ke staging atau produksi.
- API berjalan di Vercel Functions: tanpa proses latar yang hidup terus, tanpa state di memori antar-request, body maksimal 4,5 MB (unggahan lewat signed URL R2), tulis berkas hanya ke /tmp.
- Job latar harus idempoten dan dipecah per potongan; dipanggil Vercel Cron dengan CRON_SECRET.
- UI berbahasa Indonesia; teks dari berkas pesan.

## Alur kerja
1. Baca spesifikasi modul dan kriteria penerimaannya.
2. Buat rencana singkat, lalu tunggu persetujuan.
3. Tulis uji dulu atau bersamaan; semua kriteria penerimaan punya uji.
4. Jalankan typecheck, lint, test sebelum menyatakan selesai.
5. Commit kecil dengan Conventional Commits; satu PR per modul.

## Yang tidak boleh dilakukan tanpa izin
Mengubah skema tabel yang sudah terbit, menambah dependensi besar, mengubah kontrak API, menyentuh auth/otorisasi.
```

### Tahapan build

| Tahap | Cakupan | Keluaran | Pemeriksaan selesai |
| --- | --- | --- | --- |
| T0 | Inisiasi repo, tooling, CI dasar | Monorepo, `CLAUDE.md`, `.env.example`, workflow CI | `pnpm dev` jalan; CI hijau pada PR kosong |
| T1 | Database (`packages/db`) | Skema Drizzle, migrasi pertama, seed | Migrasi berjalan di branch dev; seed membuat data uji |
| T2 | Fondasi API | Server Express, middleware (error, request-id, rate limit, helmet), `AppError`, `/v1/health`, OpenAPI | Uji integrasi health dan error format lulus |
| T3 | Auth dan RBAC (M16 sebagian) | Better Auth (plugin admin dan two-factor), register, login, sesi, MFA TOTP, `requireRole`, `requireFacilityAccess` | Uji otorisasi lintas faskes lulus |
| T4 | Baca publik (M1, M2, M4) | Endpoint faskes, layanan, riwayat tarif; pencarian trigram dan radius | Kriteria penerimaan M1, M2, M4 lulus |
| T5 | Perbandingan (M3) | `/v1/compare` dan logika pembanding komponen | Kriteria M3 lulus |
| T6 | Impor data publik (M5) | Handler job impor (Vercel Cron dan tabel `jobs`, per potongan), staging, tinjau, terbitkan | Kriteria M5 lulus, termasuk idempoten |
| T7 | Portal faskes (M6, M7) | Profil, tarif, CSV, klaim, unggah dokumen ke R2 | Kriteria M6, M7 lulus |
| T8 | Admin dan kepatuhan (M15, M17) | Antrean, audit log, filter konten | Kriteria M15, M17 lulus |
| T9 | Frontend publik | Halaman, komponen inti, SEO teknis | Lighthouse dan axe lulus; JSON-LD valid |
| T10 | Frontend portal dan admin | Form, CSV wizard, antrean | Alur E2E portal dan admin lulus |
| T11 | Konten dan analitik (M12, M18) | Artikel di Sanity (webhook dan ISR), peristiwa PostHog | Peristiwa muncul di dasbor |
| T12 | Pengerasan | Audit keamanan, backup, uji beban ringan, dokumentasi | Daftar periksa bagian 11 terpenuhi |

T1 sampai T3 harus selesai sebelum T4. T9 bisa berjalan paralel dengan T6 setelah T4 selesai.

### Prompt awal per tahap (salin ke Claude Code)

**T0**

```
Baca CLAUDE.md dan docs/blueprint-teknis.md bagian 1-3. Inisiasi monorepo pnpm + Turborepo dengan apps/web (Next.js App Router, TS), apps/api (Express, TS, siap deploy sebagai Vercel Function: api/index.ts dan vercel.json), packages/db, packages/shared, packages/config. Siapkan ESLint, Prettier, Vitest, skrip root (dev, typecheck, lint, test), .env.example, dan workflow GitHub Actions yang menjalankan lint, typecheck, test. Buat rencana dulu; jangan menulis kode sebelum saya setujui.
```

**T1**

```
Baca docs/blueprint-teknis.md bagian 4. Terjemahkan DDL ke skema Drizzle di packages/db, termasuk enum, indeks (trigram, GiST), dan constraint CHECK. Pastikan ekstensi citext aktif dan constraint unik pada tariffs memakai NULLS NOT DISTINCT (butuh Postgres 15 atau lebih baru; verifikasi versi Neon). Buat migrasi dan seed (kategori lab dan MCU, satu kota contoh, data uji). Tambahkan uji yang memastikan peran aplikasi tidak bisa UPDATE/DELETE tariff_versions. Rencana dulu.
```

**T4 (contoh modul baca)**

```
Kerjakan modul M1, M2, M4 sesuai docs/blueprint-teknis.md bagian 5 dan 6. Struktur: apps/api/src/modules/<modul>/ dengan routes, controller, service, repo, test. Skema Zod di packages/shared. Pencarian: pg_trgm similarity untuk q, ST_DWithin untuk radius. Setiap kriteria penerimaan harus punya uji. Jalankan typecheck, lint, test sampai hijau. Buat rencana dan daftar berkas yang akan diubah sebelum menulis kode.
```

**T7 (contoh modul sensitif)**

```
Kerjakan M6 dan M7. Fokus keamanan: setiap endpoint portal wajib requireFacilityAccess; tulis uji otorisasi lintas faskes untuk SEMUA endpoint. Unggah dokumen lewat signed URL R2 dengan validasi MIME dan ukuran; dokumen tidak boleh diakses publik. Perubahan tarif membuat versi baru dalam satu transaksi dan menulis audit_logs. Tampilkan rencana dan tunggu persetujuan sebelum kode.
```

Pola yang sama dipakai untuk tahap lain: sebut modul, rujuk bagian spesifikasi, tegaskan aturan wajib, minta rencana dulu.

## 11. Definition of done dan risiko teknis

### Definition of done per modul

- [ ] Semua kriteria penerimaan modul punya uji otomatis dan lulus.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` hijau di CI.
- [ ] Skema Zod dan OpenAPI diperbarui.
- [ ] Migrasi (bila ada) berpasangan dengan rencana mundur.
- [ ] Perubahan data pengguna menulis audit log.
- [ ] Tidak ada rahasia, `any`, atau `console.log` tersisa.
- [ ] Teks UI berbahasa Indonesia dan lolos filter konten.
- [ ] Dokumentasi modul di `docs/modul/` diperbarui.

### Definition of done untuk rilis MVP

- [ ] Semua modul P0 selesai (M1 sampai M7, M12, M15 sampai M18).
- [ ] Uji E2E alur publik, portal, dan admin lulus.
- [ ] Pemeriksaan keamanan bagian 8 selesai, termasuk uji akses lintas faskes.
- [ ] Backup terjadwal berjalan dan pemulihan sudah dicoba sekali.
- [ ] Halaman `/privasi`, `/syarat`, `/metodologi` terbit dan ditinjau.
- [ ] Pendapat hukum tertulis tentang konten dan disklaimer tersedia sebelum peluncuran publik.
- [ ] Monitoring dan peringatan aktif.

### Risiko teknis dan mitigasi

| Risiko | Kemungkinan | Dampak | Mitigasi |
| --- | --- | --- | --- |
| Pencocokan nama faskes dan layanan pada impor tidak akurat | Tinggi | Sedang | Antrean kecocokan ambigu, alias layanan, tinjauan admin sebelum terbit |
| Cold start Neon membuat respons pertama lambat | Sedang | Sedang | Matikan autosuspend di produksi; cache ISR untuk halaman publik |
| Revalidate Next.js gagal setelah tarif berubah | Sedang | Sedang | Webhook dengan percobaan ulang; TTL ISR maksimal 1 jam sebagai jaring pengaman |
| Pencarian trigram kurang relevan untuk istilah medis | Sedang | Sedang | Tabel alias layanan; evaluasi Meilisearch atau Typesense bila hasil buruk |
| Perubahan skema setelah data terbit | Sedang | Tinggi | Migrasi expand-contract; uji migrasi di branch Neon salinan produksi |
| Claude Code mengubah kontrak atau skema tanpa disadari | Sedang | Tinggi | Aturan di `CLAUDE.md`, uji kontrak di CI, tinjauan manusia untuk auth dan migrasi |
| Kebocoran data akun faskes | Rendah | Tinggi | MFA, enkripsi, audit log, prosedur insiden |
| Biaya layanan pihak ketiga membengkak | Rendah | Sedang | Mulai dari paket gratis; pasang batas biaya dan peringatan |
| Kendala hukum (iklan, persaingan) menghentikan fitur | Sedang | Tinggi | Fitur berisiko (M9, M19) ditunda; pendapat hukum dulu |

### Keputusan terkunci (2 November 2026)

| # | Topik | Keputusan | Tindak lanjut teknis |
| --- | --- | --- | --- |
| 1 | Wilayah dan kategori | Kota Malang dan Kabupaten Malang; kategori laboratorium dan MCU (rekomendasi awal, belum Anda ubah). Data wilayah memakai dataset Country State City | Tabel `regions` dan `facilities.region_id` (bagian 4); samakan dengan kode wilayah Kemendagri; verifikasi dulu cakupan tingkat kota dan kabupaten untuk Indonesia |
| 2 | Hosting API | Vercel (Express sebagai Vercel Function) | Aturan di bagian 2 "Penyesuaian untuk Vercel"; `pg-boss` diganti Vercel Cron dan tabel `jobs`; rate limit tidak di memori |
| 3 | Auth | Better Auth | Plugin admin dan two-factor; skema digenerate CLI; tabel `users` dan `sessions` pada DDL digantikan |
| 4 | Peta | MapLibre | Sumber tile dan geocoding masih harus dipilih (bagian 7) |
| 5 | Konten artikel | Headless CMS | Saya pilih Sanity (hosted, tanpa infrastruktur tambahan); Payload di Postgres adalah alternatifnya |
| 6 | Data awal | RSUD di Kota dan Kabupaten Malang | Inventarisasi RSUD dan dasar hukum tarifnya (Perda atau peraturan kepala daerah) sebelum T6; belum saya telusuri dokumennya |

Catatan tafsir: jawaban "countrystatecity" untuk pertanyaan 1 saya baca sebagai sumber data wilayah (dataset sumber terbuka Country State City). Bila maksud Anda berbeda, ubah baris 1.

### Keputusan yang masih terbuka

1. Sumber tile peta: penyedia tile (MapTiler, Stadia, atau sejenisnya) atau PMTiles sendiri di R2.
2. Konfirmasi CMS: Sanity (default saya) atau Payload.
3. Daftar RSUD pertama di Kota dan Kabupaten Malang beserta dokumen tarifnya.
4. Paket Vercel untuk produksi (Hobby ditujukan untuk penggunaan non-komersial; cek ketentuan terbaru).
5. Hasil verifikasi dataset wilayah: apakah Kota Malang dan Kabupaten Malang tercantum sebagai dua entitas terpisah.

### Risiko tambahan dari keputusan hosting

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Job impor melewati batas durasi fungsi | Impor terpotong | Proses per potongan (sekitar 500 baris), simpan kemajuan di `import_batches`, lanjut pada pemanggilan Cron berikutnya |
| Cron tidak berjalan di staging | Job tidak teruji otomatis | Route job dapat dipanggil manual; jadwalkan GitHub Actions untuk staging |
| Unggahan lebih dari 4,5 MB gagal | Impor CSV dan dokumen izin ditolak | Selalu unggah ke R2 lewat signed URL |
| Koneksi database berlebihan dari banyak instance | Neon menolak koneksi | Connection string pooled, pool kecil per instance |
| Skema Better Auth berubah antar versi | Migrasi auth rusak | Kunci versi paket; jalankan CLI generate pada setiap pembaruan dan tinjau diff |
| Tile peta publik dibatasi | Peta gagal di produksi | Pilih penyedia atau PMTiles sebelum rilis (keputusan terbuka 1)t |
