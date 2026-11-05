# SILK

Platform transparansi tarif layanan kesehatan (laboratorium dan MCU, Malang). Spesifikasi: [`docs/blueprint-teknis.md`](docs/blueprint-teknis.md). Aturan kerja: [`CLAUDE.md`](CLAUDE.md).

| Paket | Isi |
| --- | --- |
| `apps/web` | Next.js 15 (App Router): halaman publik (ISR), `/masuk`, `/portal/*`, `/admin/*` |
| `apps/api` | Express 5, dideploy sebagai Vercel Function (`api/index.ts`, `vercel.json`) |
| `packages/db` | Skema Drizzle, migrasi SQL, seed |
| `packages/shared` | Skema Zod, konstanta, format harga, filter konten, logika perbandingan |
| `packages/config` | tsconfig dan ESLint bersama |

## Menjalankan secara lokal

Butuh Node 20+, Corepack, dan Postgres dengan ekstensi **PostGIS**, `pg_trgm`, `unaccent`, `citext` (disarankan branch dev Neon).

```sh
corepack enable            # atau awali setiap perintah dengan `corepack pnpm`
pnpm install
cp .env.example .env       # isi minimal DATABASE_URL dan DATABASE_URL_UNPOOLED
pnpm db:migrate            # hanya ke branch dev, jangan ke staging/produksi
pnpm db:seed               # taksonomi layanan, wilayah, aturan konten
pnpm db:seed:demo          # + 20 faskes dan ~200 tarif FIKTIF untuk dev lokal (idempoten)
pnpm dev                   # web http://localhost:3000, api http://localhost:4000
```

Akun admin pertama (wajib mengaktifkan TOTP di `/admin/mfa` saat masuk):

```sh
pnpm --filter @silk/api create-admin -- --email admin@contoh.id --name "Nama Admin"
```

Tanpa kunci R2/Resend/Turnstile/Sanity/PostHog aplikasi tetap jalan di dev: unggahan disimpan di folder sementara lokal, email ditulis ke log API, captcha dilewati, daftar artikel kosong, analitik mati.

## Pemeriksaan

```sh
pnpm lint && pnpm typecheck && pnpm test
```

`pnpm test` menjalankan uji unit `packages/shared` dan uji integrasi `apps/api`. **Uji integrasi mengosongkan lalu mengisi ulang database** di `TEST_DATABASE_URL` (atau `DATABASE_URL` bila kosong). Pakai branch Neon terpisah untuk uji.

## Deploy (ringkas)

- Dua proyek Vercel dari repo yang sama: root `apps/api` dan root `apps/web`. Deploy API lebih dulu agar build web bisa mengambil data; bila API belum bisa dihubungi saat build, halaman dirender saat request.
- Variabel lingkungan: lihat `.env.example`. Produksi wajib `BETTER_AUTH_SECRET`, `CRON_SECRET`, `REVALIDATE_SECRET` (sama di web dan API), `TURNSTILE_SECRET`.
- Cron (`apps/api/vercel.json`): `process-queue` tiap 10 menit butuh paket Vercel Pro; di Hobby jalankan job manual dari `/admin/jobs`.
- **Domain satu situs.** Cookie sesi memakai `SameSite=Lax`, jadi web dan API harus berada di domain induk yang sama, misalnya `silk.id` dan `api.silk.id`. Dua alamat `*.vercel.app` yang berbeda dianggap situs berbeda (vercel.app ada di Public Suffix List), sehingga login dari web ke API tidak berfungsi di sana.
- **Region harus sama.** API dideploy di `sin1` (Singapura, `apps/api/vercel.json`). Database Neon sebaiknya di AWS `ap-southeast-1` (Singapura). Database di `us-east-2` menambah ±200–300 ms pada setiap query dari Singapura.
- Migrasi produksi adalah langkah terpisah sebelum deploy aplikasi.
