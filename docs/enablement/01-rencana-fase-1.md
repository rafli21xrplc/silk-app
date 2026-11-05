# Rencana Fase 1: Role dan akun (F-01)

Status: **MENUNGGU PERSETUJUAN**. Branch: `enablement/fase-1` (dibuat dari `enablement/fase-0`).

Fase ini menyentuh **auth dan skema**, jadi seluruhnya butuh izin (CLAUDE.md). Rencana ini mengikuti keputusan yang sudah disetujui:
- **T4:** relasi banyak-ke-banyak akun ↔ faskes dipertahankan.
- **T5:** akun tenaga medis ditautkan ke baris `practitioners` lewat klaim.
- **Konflik 6 (infrastruktur):** Better Auth tetap dipakai, ditambah JWT dari plugin resmi.

Better Auth terpasang versi **1.7.15**. Plugin resmi yang tersedia: `email-otp`, `jwt`, `bearer`, `admin`, `two-factor`, `captcha`. Tidak ada dependency baru dan tidak ada JWT buatan sendiri.

## 1. Role

| Role (`user.role`) | Siapa | Cara mendapatkan |
| --- | --- | --- |
| `pasien` | Masyarakat | Daftar mandiri. **Menjadi default baru** (sebelumnya `faskes`) |
| `faskes` | Mitra fasilitas kesehatan (SRS: FasilitasKesehatan) | Daftar sebagai mitra jenis "fasilitas" |
| `tenaga_medis` | Dokter dan tenaga kesehatan | Daftar sebagai mitra |
| `gaya_hidup` | Psikolog, ahli gizi, wellness | Daftar sebagai mitra |
| `apotek` | Apotek mitra | Daftar sebagai mitra |
| `moderator` | Tim SILK | Hanya diubah admin |
| `admin` | Tim SILK | Skrip `create-admin` atau diubah admin |

Cara role diberikan:
- Role **tidak** dikirim bebas dari klien. Form daftar mengirim `accountType` dengan nilai `pasien | fasilitas | tenaga_medis | gaya_hidup | apotek`, divalidasi Zod. Hook `databaseHooks.user.create.before` memetakannya ke role.
- `admin` dan `moderator` tidak mungkin didapat lewat daftar mandiri. Ini ada ujinya.
- Satu akun = satu jenis, sesuai pewarisan di SRS. Pasien yang ingin menjadi mitra memakai akun lain. Perpindahan jenis akun bisa dibahas lagi nanti.
- Pengguna lama tidak berubah. Default kolom `user.role` di DB diganti dari `'faskes'` ke `'pasien'`.

## 2. Model mitra: satu tabel `partners` dengan kolom per jenis + CHECK

Pilihan: **satu tabel dengan kolom nullable dan CHECK per jenis**, bukan tabel detail per jenis.

Alasannya:
- Setiap jenis hanya punya 1–2 atribut khusus (SRS: spesialisasi/STR, jenis/jumlah kamar, bidang, SIA).
- Antrean verifikasi admin (Fase 7) cukup membaca satu tabel tanpa JOIN bercabang.
- CHECK di database tetap menjamin atribut wajib per jenis.

```
partners
  id              uuid PK
  user_id         uuid UNIQUE → user.id (cascade)       -- satu profil mitra per akun
  partner_type    enum partner_type (fasilitas | tenaga_medis | gaya_hidup | apotek)
  business_name   text NOT NULL                        -- nama usaha / nama praktik
  license_no      text                                 -- nomor izin operasional (wajib di Zod untuk pendaftaran baru)
  status          enum partner_status (pending | verified | rejected) DEFAULT pending
  rejection_reason text
  verified_at     timestamptz
  verified_by     uuid → user.id
  specialty       text      -- tenaga_medis
  str_no          text      -- tenaga_medis (wajib)
  practitioner_id uuid → practitioners.id NULL   -- tautan T5, diisi saat klaim disetujui
  facility_kind   facility_type  -- fasilitas (wajib)
  room_count      integer CHECK >= 0  -- fasilitas, opsional
  field           text      -- gaya_hidup (wajib)
  sia_no          text      -- apotek (wajib)
  created_at, updated_at
CHECK: (partner_type <> 'tenaga_medis' OR str_no IS NOT NULL) AND (… 'fasilitas' → facility_kind) AND
       (… 'gaya_hidup' → field) AND (… 'apotek' → sia_no)
CHECK: status = 'verified' ⇔ verified_at IS NOT NULL
CHECK: status = 'rejected' → rejection_reason IS NOT NULL
```

Hubungan dengan data yang sudah ada:
- **Fasilitas:** profil faskes tetap di `facilities`, dihubungkan lewat `memberships` dan alur klaim M7. Tidak ada duplikasi.
- **Tenaga medis:** `practitioner_id` diisi saat admin menyetujui tautan ke baris `practitioners`. Alur klaimnya dibangun di Fase 2 bersama profil.
- **Pasien:** tidak punya baris `partners`. Kolom tambahan di `user` hanya `phone` (text, opsional, untuk OTP SMS di masa depan; belum dipakai). **Tanpa** tanggal lahir dan alamat.

## 3. Alur akun

1. **Daftar** di `/daftar`:
   - Pengguna memilih "Pasien" atau "Mitra", lalu jenis mitranya.
   - Isinya nama, email, dan sandi (minimal 12 karakter, tetap seperti sekarang). Turnstile wajib, rate limit 5 per menit.
2. **Verifikasi email dengan kode OTP 6 digit**, menggantikan tautan verifikasi:
   - Plugin `email-otp` dengan `overrideDefaultEmailVerification`.
   - Berlaku 10 menit, maksimal 3 percobaan per kode, disimpan dalam bentuk **hash**, dan kirim ulang membuat kode baru.
   - Halaman `/verifikasi-email` berisi input 6 kotak dan tombol kirim ulang (dibatasi rate limit).
3. **Masuk:** email dan sandi, Turnstile juga ditambahkan ke login, lalu TOTP bagi yang mengaktifkannya (admin dan moderator wajib, seperti sekarang).
   - **Login tanpa sandi lewat OTP (`/sign-in/email-otp`) dimatikan,** supaya tidak ada jalur masuk yang melewati sandi dan TOTP.
4. **Ubah sandi** di halaman akun baru `/akun` (nama, telepon opsional, ubah sandi, keluar dari semua perangkat). Reset sandi lewat tautan email tetap seperti sekarang.
5. **Mitra setelah masuk:**
   - Diarahkan ke `/portal/mitra` untuk melengkapi data usaha dan izin sesuai jenisnya. Statusnya `pending`.
   - Status tampil sebagai banner: menunggu, terverifikasi, atau ditolak beserta alasannya.
   - Mitra `pending` atau `rejected` **tidak muncul di endpoint publik mana pun**.
6. **Admin** di `/admin/mitra`:
   - Daftar mitra dengan filter status dan jenis, lalu setujui atau tolak (alasan wajib).
   - Ini antrean minimal. Antrean lengkap per jenis dengan dokumen ada di Fase 7.
   - Unggah dokumen izin memakai ulang pola signed URL R2 dari M7. Kalau kamu ingin unggah dokumen menunggu Fase 7, bagian ini bisa ditunda.

## 4. JWT (sesuai SRS 3.4) berdampingan dengan sesi cookie

Web tetap memakai **sesi cookie** (`httpOnly`, `SameSite=Lax`), karena paling aman untuk browser. JWT disediakan untuk klien non-browser (aplikasi mobile atau integrasi) dan memenuhi SRS.

| Aspek | Rencana |
| --- | --- |
| Penerbitan | `GET /v1/auth/token` (plugin `jwt`). Butuh sesi valid, jadi login dan TOTP tetap wajib lebih dulu |
| Algoritme dan kunci | EdDSA (Ed25519). Pasangan kunci di tabel `jwks`; kunci privat dienkripsi dengan `BETTER_AUTH_SECRET` (bawaan plugin) |
| Umur | **15 menit**. Klaim: `sub` (user id), `role`, `sid` (session id), `iss` = API_ORIGIN, `aud` = `silk-api` |
| Rotasi | `rotationInterval` 30 hari, `gracePeriod` 1 hari (token dengan kunci lama tetap sah sampai kedaluwarsa). JWKS publik di `/v1/auth/jwks` |
| Verifikasi | Middleware API: `Authorization: Bearer <jwt>` diverifikasi dengan JWKS lokal (jose, sudah dibawa Better Auth), **lalu** dicek bahwa sesi `sid` masih ada dan akun tidak diblokir |
| Pencabutan | Keluar, ganti sandi, blokir akun, atau "keluar dari semua perangkat" menghapus sesi, sehingga JWT dengan `sid` itu langsung ditolak. Tanpa daftar hitam terpisah |
| CSRF | Request ber-JWT tanpa cookie sesi tidak memerlukan token CSRF. Kalau ada cookie sesi, aturan CSRF lama tetap berlaku |
| Header otomatis | `disableSettingJwtHeader: true`, supaya JWT tidak diterbitkan di setiap `get-session` |

Endpoint admin tetap **hanya lewat sesi cookie + TOTP**. JWT untuk role `admin` dan `moderator` ditolak di `/v1/admin/*`, demi mengecilkan risiko token admin bocor.

## 5. Matriks role × permission

Didefinisikan sekali di `packages/shared/src/permissions.ts` dan ditegakkan middleware `requirePermission()`. Tanda ● = diizinkan, – = ditolak.

| Permission (endpoint) | anonim | pasien | faskes | tenaga_medis | gaya_hidup | apotek | moderator | admin |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Baca publik (`/v1/facilities`, `/services`, `/compare`, …) | ● | ● | ● | ● | ● | ● | ● | ● |
| Lapor data (`POST /v1/reports`, Turnstile) | ● | ● | ● | ● | ● | ● | ● | ● |
| `GET /v1/me`, ubah nama/telepon, ubah sandi | – | ● | ● | ● | ● | ● | ● | ● |
| `GET/PUT /v1/partners/me` (data usaha dan izin) | – | – | ● | ● | ● | ● | – | – |
| Portal faskes M6 dan klaim M7 (+ cek `memberships`) | – | – | ● | – | – | – | – | – |
| `/v1/admin/*` (antrean, faskes, tarif, impor, audit) + TOTP | – | – | – | – | – | – | ● | ● |
| `GET /v1/admin/partners`, setujui/tolak mitra + TOTP | – | – | – | – | – | – | ● | ● |
| Ubah role, blokir akun (endpoint admin Better Auth) + TOTP | – | – | – | – | – | – | – | ● |
| `GET /v1/auth/token` (terbitkan JWT) | – | ● | ● | ● | ● | ● | – | – |

Catatan pada matriks:
- Mitra `pending` boleh mengakses `partners/me`, tetapi permission yang menerbitkan data publik (Fase 2 ke atas) mensyaratkan `status = verified`.
- Portal faskes tetap mensyaratkan keanggotaan faskes seperti sekarang. Pengelola faskes A tetap 403 di faskes B (uji M6 yang sudah ada tetap berlaku).

## 6. Audit log

Semua masuk `audit_logs` dengan IP dan `requestId`.
- `auth.sign-up`: akun dibuat (role, `accountType`).
- `auth.email-verified`: OTP berhasil.
- `auth.sign-in.failed`: setiap login gagal (email dalam bentuk hash SHA-256, IP). "Berulang" dibaca lewat filter audit log. Rate limit DB tetap memblokir setelah 5 kali per menit.
- Audit yang sudah ada tetap: `auth.admin.set-role`, `ban-user`, dan `change-password`.
- `partner.submitted` dan `partner.updated` (sebelum dan sesudah), `partner.verified`, `partner.rejected` (dengan alasan).

## 7. Perubahan skema (migrasi 0005, hanya ke DB lokal/dev)

Ini butuh izinmu karena menyentuh tabel yang sudah terbit (`user`).

1. Enum baru `partner_type` dan `partner_status`. Tabel baru `partners` (bagian 2).
2. `user`: tambah kolom `phone` (nullable). Default `role` diganti `'faskes'` → `'pasien'`.
3. Tabel `jwks` dari plugin JWT. Skemanya digenerate CLI Better Auth, lalu diff-nya ditinjau.
4. **Migrasi data:** setiap pengguna `role = 'faskes'` yang punya `memberships` mendapat baris `partners`:
   - Jenis `fasilitas`, status `verified`.
   - `verified_at` = waktu klaimnya disetujui.
   - Nama usaha dan `facility_kind` diambil dari faskes pertamanya.

   Pengguna `faskes` tanpa keanggotaan dibiarkan tanpa baris `partners`; mereka diminta melengkapi data saat masuk.
5. Rencana mundur ditulis di berkas migrasi, mengikuti pola 0002.

## 8. Perubahan kontrak API (semua aditif)

- `GET /v1/me`: tambah `user.role` dengan nilai baru, plus `partner` (null untuk pasien dan admin). Klien lama yang hanya mengenal 3 role perlu tahu nilai baru ini, tapi tidak ada field yang dihapus.
- Endpoint baru:
  - `GET /v1/partners/me` dan `PUT /v1/partners/me`
  - `GET /v1/admin/partners`
  - `POST /v1/admin/partners/{id}/approve` dan `POST /v1/admin/partners/{id}/reject`
- Better Auth: `/v1/auth/email-otp/*`, `/v1/auth/token`, `/v1/auth/jwks`.
- `docs/openapi.json` diperbarui, dan rute Better Auth yang dipakai klien didokumentasikan di `docs/enablement/`.

## 9. Feature flag (fondasi untuk fase 6, 8–11)

Modul `packages/shared/src/flags.ts` berisi daftar flag, semuanya default OFF:
`reviews_enabled`, `ai_chat_enabled`, `health_records_enabled`, `pharmacy_catalog_enabled`, `pharmacy_orders_enabled`, `subscriptions_enabled`.

- Dibaca dari env `FEATURE_FLAGS` (daftar dipisah koma, divalidasi Zod di `env.ts`) dan ditambahkan ke `.env.example`.
- `requireFlag()` mengembalikan 404 bila flag mati.
- Web punya helper server yang sama.

Belum ada fitur yang memakai flag di Fase 1, tapi uji 404-nya sudah disiapkan.

## 10. UI (teks dari berkas pesan, bahasa Indonesia)

- `/daftar`: pilihan Pasien atau Mitra (4 kartu jenis), lalu langkah OTP.
- `/verifikasi-email`: input OTP dan kirim ulang.
- `/akun`: profil, ubah sandi, keluar dari semua perangkat. Menu akun di header disesuaikan per role.
- `/portal/mitra`: formulir data usaha per jenis dan banner status.
- `/admin/mitra`: tabel dengan `DataPanel`, pagination, setujui/tolak.

Semua memakai desain auth dan admin yang sudah ada.

## 11. Uji

**Unit** (berjalan tanpa database):
- Matriks permission: setiap role × setiap permission, dibandingkan dengan tabel bagian 5.
- Skema Zod `accountType` menolak `admin` dan `moderator`.
- Validasi atribut wajib per jenis mitra.
- Modul flag (default OFF, parsing env).

**Integrasi** (`apps/api/test/fase1-auth.test.ts`):
- Matriks otorisasi role × endpoint: setiap baris bagian 5 diuji dengan respons diizinkan atau ditolak.
- Daftar dengan `role: 'admin'` atau `accountType: 'admin'` ditolak atau diabaikan, sehingga role tetap `pasien`.
- OTP: benar → terverifikasi; kedaluwarsa (jam dimajukan) → ditolak; lebih dari 3 percobaan → kode hangus.
- Brute force: login ke-6 dalam satu menit → 429. Rate limit bisa diaktifkan khusus di uji ini.
- Mitra `pending` atau `rejected` tidak muncul di endpoint publik dan sitemap; setelah `verified`, data mitra tercatat di audit log.
- JWT: token sah diterima; kedaluwarsa ditolak; sesi dicabut → ditolak; JWT admin di `/v1/admin/*` → ditolak.
- Migrasi data: pengguna faskes lama dengan keanggotaan → baris `partners` terverifikasi.
- Seluruh uji M1–M7 dan M15/M17 yang sudah ada tetap hijau.

## 12. Hambatan yang perlu kamu tahu

1. **Uji integrasi belum bisa berjalan.** Guard Fase 0 menolak database uji yang sekarang (`silk_test`), dan menjalankan uji integrasi juga ditolak sistem izin sesi ini karena uji itu mengosongkan database. Agar kriteria "matriks otorisasi hijau" bisa dibuktikan:
   - Buat database `test_silk`, lalu ubah `TEST_DATABASE_URL`.
   - Jalankan sendiri `! corepack pnpm --filter @silk/api test` di prompt ini, **atau** izinkan perintah itu di pengaturan izin Claude Code.

   Sampai itu terjadi, saya hanya bisa menjalankan unit test, typecheck, dan lint.
2. **Migrasi 0005** hanya akan saya jalankan ke database **dev** lokal setelah kamu setuju, tidak pernah ke staging atau produksi.

## 13. Di luar lingkup Fase 1

Bagian berikut dikerjakan di fase lain:
- Profil publik mitra non-faskes, foto, video, jadwal, dan alur klaim tenaga medis → Fase 2.
- Antrean verifikasi lengkap dengan dokumen per jenis → Fase 7.
- Notifikasi in-app untuk keputusan verifikasi → Fase 5. Di Fase 1, keputusan dikirim lewat email saja.
- OTP lewat SMS: kolom `phone` disiapkan, tanpa pengiriman.
