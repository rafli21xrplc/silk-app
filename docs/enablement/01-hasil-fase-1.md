# Hasil Fase 1: akun, role, verifikasi mitra, JWT

Branch `enablement/fase-1`. Rencana: `01-rencana-fase-1.md` (disetujui).

## Yang dibuat

**Role dan permission (F-01)**
- Role: `pasien`, `faskes`, `tenaga_medis`, `gaya_hidup`, `apotek`, `moderator`, `admin`.
- Matriks role × permission ada di satu tempat: `packages/shared/src/permissions.ts`.
  - API menegakkannya lewat `requirePermission()`.
  - Web memakainya untuk menu.
- Saat daftar, role ditetapkan **server** dari `accountType`.
  - Nilai yang tidak dikenal (termasuk `admin`/`moderator`) menjadi `pasien`.
  - Field `role` di body ditolak (400).

**Verifikasi email lewat OTP**
- Plugin Better Auth `emailOTP`: 6 digit, berlaku 10 menit, maksimal 3 percobaan, disimpan ter-hash.
- Kirim ulang membuat kode baru.
- Masuk dengan email yang belum terverifikasi mengirim OTP baru, lalu web mengarahkan ke `/verifikasi-email`.
- Masuk tanpa sandi lewat OTP, reset lewat OTP, dan ganti email lewat OTP dimatikan (`disabledPaths`).

**Turnstile**
- Melindungi daftar, masuk, lupa sandi, dan kirim ulang OTP.
- Perbaikan bug lama: web sebelumnya tidak mengirim token `x-captcha-response`, dan CORS tidak mengizinkan header itu.

**Mitra**
- Tabel `partners`, satu baris per akun mitra.
- Data per jenis:
  - Tenaga medis: spesialisasi dan STR.
  - Fasilitas: jenis dan jumlah tempat tidur.
  - Gaya hidup: bidang.
  - Apotek: SIA.
- Status `pending` → `verified`/`rejected`.
- Mengubah data mengembalikan status ke `pending`.
- Belum ada endpoint publik yang menampilkan mitra, jadi mitra `pending`/`rejected` tidak bocor.

**JWT untuk klien non-browser**
- `GET /v1/auth/token`: EdDSA, berlaku 15 menit, klaim `sub`, `role`, `sid`, `iss`, `aud=silk-api`.
- Diverifikasi di Express dengan jose dan kunci publik dari tabel `jwks`.
- Token ikut tidak berlaku bila sesinya dicabut atau akun diblokir.
- Staf tidak bisa menerbitkan JWT, dan `/v1/admin/*` menolak JWT.
- Role dibaca dari DB, bukan dari klaim token.

**Audit**
- Aksi yang dicatat:
  - `auth.sign-up`, `auth.email-verified`
  - `auth.sign-in.failed` (dengan hash SHA-256 email, tanpa alamat polos)
  - `account.profile.update`
  - `partner.submitted`, `partner.updated`, `partner.verified`, `partner.rejected`
- Perbaikan bug lama: aksi Better Auth yang gagal tidak lagi tercatat sebagai perubahan.

**Feature flag**
- `FEATURE_FLAGS` di env, semua default OFF.
- Nama salah ketik membuat start gagal.
- `requireFlag()` mengembalikan 404 saat flag OFF.

**Web**
- `/daftar`: pilih jenis akun.
- `/verifikasi-email`: 6 kotak OTP dan tombol kirim ulang.
- `/akun`: profil, nomor HP, ubah sandi, keluar dari semua perangkat.
- `/portal/mitra`: form per jenis dan banner status.
- `/admin/mitra`: antrean dengan tombol setujui/tolak; alasan wajib saat menolak.
- Menu akun di header disesuaikan per role.

## Endpoint baru

| Endpoint | Siapa |
| --- | --- |
| `GET/PATCH /v1/me` (PATCH: nama, HP) | semua yang masuk |
| `GET/PUT /v1/partners/me` | mitra |
| `GET /v1/admin/partners?status=&type=` | moderator, admin (TOTP) |
| `POST /v1/admin/partners/{id}/approve` | moderator, admin (TOTP) |
| `POST /v1/admin/partners/{id}/reject` `{reason}` | moderator, admin (TOTP) |

Rute Better Auth yang dipakai klien, semuanya di bawah `/v1/auth`:

| Rute | Body / header | Catatan |
| --- | --- | --- |
| `POST /sign-up/email` | `name, email, password, accountType`; header `x-captcha-response` | OTP dikirim otomatis |
| `POST /email-otp/verify-email` | `email, otp` | 3 kali salah → minta kode baru |
| `POST /email-otp/send-verification-otp` | `email, type: "email-verification"`; captcha | kirim ulang |
| `POST /sign-in/email` | `email, password`; captcha | `403 EMAIL_NOT_VERIFIED` → OTP baru dikirim |
| `POST /change-password` | `currentPassword, newPassword, revokeOtherSessions` | |
| `POST /revoke-sessions` | `{}` | keluar dari semua perangkat |
| `GET /token` | sesi cookie | JWT 15 menit (pasien dan mitra) |
| `GET /jwks` | | kunci publik |

Klien non-browser mengirim `Authorization: Bearer <jwt>` dan tidak memerlukan token CSRF.

## Migrasi 0005

- Membuat enum dan tabel `partners` dan `jwks`, menambah kolom `user.phone`, dan mengubah default role menjadi `pasien`.
- Data: pengelola faskes lama yang punya keanggotaan menjadi mitra `fasilitas` berstatus `verified`.
- Rencana mundur ada di komentar kepala berkas SQL.
- Sudah dijalankan di DB **dev**. Di dev belum ada akun faskes, jadi 0 baris data dipindahkan. Belum dijalankan di staging maupun produksi.

## Penyimpangan dari rencana

- `jose@6.2.15` ditambahkan sebagai dependensi eksplisit `apps/api`. Versi ini sudah ada di lockfile lewat Better Auth, jadi tidak ada paket baru yang diunduh.
- Dua uji integrasi memakai pengaturan khusus:
  - `SILK_TEST_RATE_LIMIT=1` menyalakan rate limit Better Auth hanya di `fase1-ratelimit.test.ts`.
  - `resetEnvCacheForTests()` hanya bisa dipakai saat `NODE_ENV=test`.

## Langkah manual

1. Buat database uji `test_silk` (atau branch Neon khusus uji) dan arahkan `TEST_DATABASE_URL` ke sana.
2. Jalankan uji integrasi: `corepack pnpm --filter @silk/api test`. Berkas baru: `fase1-auth.test.ts` dan `fase1-ratelimit.test.ts`.
3. Di produksi, isi `TURNSTILE_SECRET` dan `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Tanpa keduanya, captcha dilewati.
4. Opsional: `corepack enable` agar `pnpm` dan `turbo` bisa dipakai langsung.
