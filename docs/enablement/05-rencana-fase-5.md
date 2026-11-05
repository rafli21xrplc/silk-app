# Rencana Fase 5: notifikasi dan email (F-09, F-11)

Branch `enablement/fase-5` (dari `enablement/fase-4`). Status: **menunggu persetujuan**.

## 1. Kondisi sekarang

**Email dikirim langsung dari service, satu per satu, tanpa antrean.**
- `apps/api/src/lib/email.ts` hanya punya `sendEmail()` dengan Resend. Tanpa kunci, email ditulis ke log (dev) atau ke `testOutbox` (uji).
- Pemanggil `sendEmail` saat ini:

| Peristiwa | Tempat | Catatan |
| --- | --- | --- |
| OTP verifikasi email, reset sandi | `auth/auth.ts` (callback Better Auth) | sinkron, pengguna menunggu |
| Mitra diverifikasi/ditolak (Fase 1) | `partners.service.ts` | gagal kirim hanya dicatat di log, tidak diulang |
| Klaim disetujui/ditolak | `m7-claims/claims.service.ts` | sama |
| Permintaan harga diajukan/disetujui/ditolak (Fase 2) | `tariff-requests.service.ts` | ke semua pengelola faskes |
| Status laporan data | `m14-reports/reports.service.ts` | ke email kontak pelapor anonim |
| Pengingat tarif usang | job `email.stale-reminder` | **satu job mengirim ke banyak alamat: bila satu gagal, retry mengirim ulang ke semua** |

- **Belum ada notifikasi sama sekali** untuk: revisi profil disetujui/ditolak, foto/video disetujui/ditolak (Fase 2), artikel disetujui/ditolak/diturunkan (Fase 4).
- Tidak ada notifikasi in-app, preferensi email, atau batas kirim per pengguna.
- **Bahan yang bisa dipakai ulang:**
  - tabel `jobs` dengan `dedupe_key`, `attempts`, backoff eksponensial, `FOR UPDATE SKIP LOCKED`, dan cron `process-queue` tiap 10 menit
  - `rate_limit_counters`
  - `recordAudit`
  - `memberEmails` (pengelola faskes)
- Resend 6.37 mendukung `idempotencyKey`. Resend menolak kiriman kedua dengan kunci yang sama dalam 24 jam.

## 2. Keputusan desain (rekomendasi saya)

### B1. Satu pintu: `notify()` menulis notifikasi dan job email dalam transaksi yang sama

```
service (approve/reject/…) ── tx ──┬─ UPDATE data + audit_logs
                                   ├─ INSERT notifications (per penerima)
                                   └─ INSERT jobs 'email.notification' (dedupe_key = notifikasi.id)
setelah commit ── coba kirim segera (maks. 3 dtk) ── sisanya oleh cron process-queue
```

- Karena ditulis dalam transaksi yang sama, notifikasi tidak hilang bila keputusan tersimpan, dan tidak muncul bila keputusan batal. Saat ini email bisa hilang diam-diam bila Resend sedang gagal.
- **Satu job = satu email ke satu penerima.** Retry tidak pernah mengirim ulang ke penerima lain.
- **Tidak ada kiriman ganda:**
  - Job memakai `dedupe_key` per notifikasi.
  - Handler mengunci baris notifikasi dan melewati notifikasi yang `email_status = 'terkirim'`.
  - Resend dipanggil dengan `idempotencyKey = notifikasi.id`, jadi kalau instance mati setelah kirim tetapi sebelum menandai, retry tidak menghasilkan email kedua.
- **Retry:** memakai `failJob` yang ada (maks. 5 percobaan, backoff 60 dtk sampai 1 jam). Setelah habis, status menjadi `gagal` dan `email_status = 'gagal'`; notifikasi in-app tetap ada.
- **Kirim segera:** cron hanya tiap 10 menit, jadi setelah commit API mencoba menjalankan job email milik peristiwa itu, dengan anggaran 3 detik. Bila gagal atau lewat waktu, job tetap antre untuk cron. Tanpa proses latar dan tanpa state di memori (sesuai batas Vercel).

### B2. Registry tipe notifikasi di `@silk/shared`

```ts
NOTIFICATION_TYPES = {
  'partner.verified':  { category: 'akun',    essential: true,  params: z.object({ partnerLabel }) },
  'partner.rejected':  { category: 'akun',    essential: true,  params: z.object({ partnerLabel, reason }) },
  'article.approved':  { category: 'konten',  essential: false, params: z.object({ title, articleId }) },
  …
}
```

- Setiap tipe punya: kategori, `essential`, skema param Zod `.strict()` (field tak dikenal ditolak), template judul dan pesan (bahasa Indonesia), dan pembuat tautan relatif ke aplikasi.
- Fase berikutnya cukup menambah satu entri (contoh: `review.new` di Fase 6, `subscription.expiring` di Fase 11, `order.status` di Fase 9B). Tiga tipe ini **saya daftarkan sekarang** tanpa pemicu, supaya uji "tanpa data terlarang" ikut menjaganya sejak awal.
- Teks dirender saat notifikasi dibuat dan disimpan (`title`, `message`, `link`). Email memakai teks yang sama ditambah salam, tautan absolut, dan kaki email, jadi pemeriksaan isi cukup di satu tempat.

### B3. Isi tidak memuat data terlarang

- Param hanya berisi:
  - nama atau judul entitas milik penerima sendiri (nama profil, judul artikel, jenis mitra)
  - alasan dari moderator
  - id untuk tautan
- Tidak ada data kesehatan, rincian pesanan obat, harga, dokumen, nomor STR/SIA, alamat email orang lain, atau isi artikel.
- `order.status` hanya berbunyi "Status pesanan Anda diperbarui. Buka SILK untuk melihat rinciannya."
- **Penjaga di kode:**
  1. skema param `.strict()`
  2. daftar kunci terlarang (mis. `diagnosis`, `keluhan`, `obat`, `resep`, `items`, `harga`, `str`, `sia`, `email`, `phone`, `body`); uji gagal bila ada tipe yang memakai kunci itu
  3. uji yang merender setiap tipe dengan data contoh lalu memeriksa hasilnya
- Alasan moderator ditulis staf. Saya batasi 500 karakter di template, dan teksnya tetap dari staf.

### B4. Penerima dan peristiwa Fase 1–4

| Tipe | Pemicu | Penerima | Esensial |
| --- | --- | --- | --- |
| `partner.verified` / `partner.rejected` | keputusan mitra (F1) | akun mitra | ya (keputusan verifikasi) |
| `claim.approved` / `claim.rejected` | keputusan klaim | pemohon | ya (keputusan verifikasi) |
| `profile.published` / `profile.withdrawn` | admin mengubah status profil menjadi `terbit` atau `ditarik` (F2, `PATCH /admin/facilities/:id`); hanya bila status benar-benar berubah | pengelola profil | tidak |
| `revision.approved` / `revision.rejected` | revisi profil (F2) | pengelola profil | tidak |
| `media.approved` / `media.rejected` | foto/video (F2) | pengelola profil | tidak |
| `tariff_request.submitted` / `.approved` / `.rejected` | permintaan harga (F2) | semua pengelola | ya (peringatan keamanan, mitigasi akun diambil alih) |
| `article.approved` / `.rejected` / `.withdrawn_by_staff` | artikel (F4) | akun penulis | tidak |
| `tariff.stale` | pengingat tarif usang | pengelola faskes, maks. 1×/minggu per faskes | tidak |

- Tidak ada notifikasi untuk aksi yang dilakukan pengguna sendiri (mis. mitra menarik artikelnya sendiri).
- **Pengecualian dari jalur jobs:**
  - **OTP dan reset sandi** tetap dikirim langsung dan sinkron lewat `EmailService`. Pengguna sedang menunggu kode yang berlaku 10 menit, dan tombol "kirim ulang" sudah menjadi mekanisme retry. Tidak dibuat notifikasi in-app karena pengguna belum masuk.
  - **Status laporan data** dikirim ke email kontak pelapor anonim (tanpa akun). Saya pindahkan ke job `email.direct` (dedupe per laporan dan status), tanpa notifikasi in-app.

### B5. EmailService dengan adaptor yang dipilih lewat env

```ts
interface EmailService { send(msg: { to; subject; text; html?; idempotencyKey?; headers? }): Promise<void> }
```

- `EMAIL_PROVIDER=resend` (bawaan) | `smtp` | `log`.
  - `resend`: perilaku sekarang, ditambah `idempotencyKey`.
  - `smtp`: `nodemailer` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`). SMTP tidak punya kunci idempoten, jadi saya pakai `Message-ID` tetap per notifikasi. Jaminan tanpa kiriman ganda pada SMTP bergantung pada penanda di DB; jendela risikonya hanya bila instance mati tepat di antara "terkirim" dan "ditandai".
  - `log`: dev tanpa kunci.
- Saat uji: `testOutbox`, seperti sekarang.
- Produksi menolak start bila provider yang dipilih belum lengkap konfigurasinya, atau bila `log` dipakai.
- Variabel baru masuk `.env.example`. **`.env` tidak saya sentuh.**
- Email berupa teks biasa, seperti email yang ada sekarang. HTML belum.

### B6. Preferensi dan batas kirim

- **Preferensi:** pengguna bisa mematikan email per kategori non-esensial (`konten`, `pengingat`; nanti `ulasan`, `langganan`, `pesanan`).
  - Notifikasi in-app selalu dibuat. Yang dimatikan hanya emailnya (`email_status = 'dilewati'`, alasan `opt_out`).
  - Kategori `akun` (keputusan verifikasi, peringatan keamanan) tidak bisa dimatikan. OTP dan reset sandi berada di luar sistem preferensi.
- Halaman pengaturan di `/akun` (bagian "Email notifikasi"), dan setiap email non-esensial memuat tautan ke sana.
- **Deduplikasi:** `UNIQUE (user_id, dedupe_key)` di `notifications`. Kunci dibentuk dari peristiwa (mis. `article.approved:<id>:<published_at>`), jadi peristiwa yang diproses dua kali tidak menghasilkan notifikasi kedua.
- **Batas kirim:** maksimal 10 email non-esensial per pengguna per jam, memakai `rate_limit_counters`. Yang melebihi batas tetap muncul in-app, tetapi emailnya dilewati (`rate_limited`). Email esensial tidak dibatasi.

### B7. API (aditif, semuanya di `/v1/me`, butuh sesi)

| Endpoint | Isi |
| --- | --- |
| `GET /v1/me/notifications?cursor&limit&unread=true` | daftar terbaru dulu, kursor |
| `GET /v1/me/notifications/unread-count` | `{ count }` (maks. 99+) |
| `POST /v1/me/notifications/:id/read` | tandai dibaca; notifikasi orang lain → 404 |
| `POST /v1/me/notifications/read-all` | tandai semua dibaca |
| `GET` / `PUT /v1/me/notification-preferences` | `{ email: { konten: true, pengingat: false, … } }` |

- POST/PUT memakai CSRF yang ada.
- **Audit:** perubahan preferensi menulis `audit_logs` (`notification.preferences`). Menandai dibaca **tidak** saya audit (lihat P4).

### B8. Web

- **Ikon lonceng** di header untuk pengguna yang masuk, dengan lencana jumlah belum dibaca. Jumlahnya diambil ulang saat pindah halaman, saat tab kembali aktif, dan tiap 2 menit; tanpa websocket. Klik membuka panel 5 notifikasi terbaru dan tautan "Lihat semua".
- **Halaman `/akun/notifikasi`:** daftar dengan kursor "Muat lagi", penanda belum dibaca, "Tandai semua dibaca", dan klik untuk membuka tautan sekaligus menandai dibaca.
- **Pengaturan email** di `/akun`: sakelar per kategori. Kategori `akun` tampil terkunci dengan penjelasan.
- Teks dari `messages/id.ts`, dan lulus filter M17.

## 3. Skema (migrasi 0009, hanya ke DB dev)

Dua tabel baru. Tidak mengubah tabel yang sudah terbit, termasuk `jobs`.

```
notifications
  id uuid PK, user_id text FK user ON DELETE CASCADE, type text, category text,
  title text, message text, link text, dedupe_key text NOT NULL,
  read_at timestamptz NULL,
  email_status text  -- tidak_perlu | antre | terkirim | dilewati | gagal
  email_skip_reason text NULL,  -- opt_out | rate_limited | tanpa_email
  emailed_at timestamptz NULL, created_at timestamptz
  UNIQUE (user_id, dedupe_key)
  INDEX (user_id, created_at DESC, id DESC); INDEX parsial (user_id) WHERE read_at IS NULL

notification_preferences
  user_id text PK FK user ON DELETE CASCADE, email_off text[] NOT NULL DEFAULT '{}', updated_at timestamptz
```

- Retensi: notifikasi berumur lebih dari 1 tahun dihapus oleh cron `retention` yang sudah ada.
- Rencana mundur di kepala berkas migrasi.

## 4. Perubahan pada kode yang ada

- `partners`, `claims`, dan `tariff-requests` beralih dari `sendEmail` langsung ke `notify()`. Teks emailnya setara; ditambah tautan ke aplikasi.
- `profiles` (revisi, media), `m15-admin` (status profil terbit/ditarik), dan `articles` (setujui, tolak, turunkan) memanggil `notify()` di dalam transaksinya.
- Job `email.stale-reminder` diganti dengan pembuatan notifikasi `tariff.stale` per pengelola. Job lama yang masih antre tetap punya handler sampai habis.
- `reports`: email lewat job `email.direct`.
- `auth`: lewat `EmailService` (adaptor dipilih env), tetap sinkron.

## 5. Uji

**Shared**
- Registry: setiap tipe punya kategori, template, dan skema `.strict()`.
- Kategori `akun` selalu esensial.
- Tidak ada tipe yang memakai kunci terlarang.
- Render setiap tipe dengan data contoh: tidak memuat pola terlarang, alasan dipotong 500 karakter.

**API integrasi** (`apps/api/test/fase5-notifications.test.ts`)
- **Peristiwa Fase 1–4:** setiap baris tabel B4 menghasilkan tepat satu notifikasi untuk penerima yang benar dan satu email di `testOutbox` dengan subjek yang benar. Pengguna lain tidak menerima apa pun.
- **Idempotensi:** menjalankan job yang sama dua kali, atau mensimulasikan job `berjalan` yang macet lalu diambil ulang, tetap menghasilkan satu email. Memproses peristiwa yang sama dua kali menghasilkan satu notifikasi.
- **Retry:** adaptor uji dibuat gagal dua kali. Hasilnya `attempts = 3`, satu email, dan `email_status = terkirim`. Setelah 5 kali gagal, job berstatus `gagal`, notifikasi in-app tetap ada, dan tidak ada email.
- **Opt-out:** kategori `konten` dimatikan, jadi notifikasi artikel tetap ada di in-app tetapi tanpa email. `partner.rejected` tetap terkirim. `PUT` preferensi menulis audit.
- **Batas kirim:** email non-esensial ke-11 dalam satu jam dilewati (`rate_limited`), sedangkan email esensial tetap terkirim.
- **Transaksi:** bila keputusan gagal (rollback), tidak ada notifikasi dan tidak ada job.
- **Otorisasi:** daftar, tandai dibaca, dan hitung hanya untuk notifikasi milik sendiri (milik orang lain → 404); anonim → 401; tanpa CSRF → 403.
- **Isi email:** untuk setiap email di outbox, tidak ada kunci atau pola terlarang dan tidak ada alamat penerima lain.
- **Regresi:** pengingat tarif usang maksimal satu kali per minggu per faskes, dan satu email per pengelola.

**Web:** komponen lonceng (lencana dan 99+), helper format waktu relatif, dan sakelar preferensi.

**Smoke di dev:** saya picu peristiwa artikel dan profil lalu memeriksa lonceng, halaman notifikasi, dan email di log. Screenshot desktop dan ponsel.

## 6. Risiko

- **Email terlambat** hingga 10 menit bila pengiriman segera gagal. Bisa dipersempit dengan cron tiap menit (paket Vercel Pro), dan itu keputusanmu.
- **Alamat pengirim:** Resend butuh domain terverifikasi untuk `EMAIL_FROM` di produksi. SMTP Gmail punya batas harian. Keduanya urusan konfigurasi di luar kode.
- **SMTP tanpa idempotensi bawaan.** Jendela risiko kiriman ganda kecil, tetapi tidak nol (lihat B5).
- **Notifikasi tumbuh terus.** Ini diatasi retensi 1 tahun dan indeks per pengguna.

## 7. Yang butuh keputusan atau izinmu

1. **Dependensi `nodemailer`** (dan `@types/nodemailer`) untuk adaptor SMTP sesuai SRS. Paketnya kecil dan tanpa dependensi turunan, tetapi tetap dependensi baru. Alternatifnya: hanya Resend sekarang, SMTP nanti.
2. **Migrasi 0009** (dua tabel baru) ke DB dev. Tabel `jobs` tidak diubah.
3. **Endpoint aditif** di B7. Tidak ada kontrak lama yang berubah.
4. **Menandai notifikasi dibaca tidak ditulis ke `audit_logs`.** CLAUDE.md meminta setiap perubahan data oleh pengguna terautentikasi diaudit, tetapi status dibaca hanyalah status tampilan milik pengguna sendiri dan akan membanjiri audit. Preferensi email tetap diaudit. Bila kamu ingin dibaca juga diaudit, saya ikuti.
5. **Pengecualian jalur jobs** untuk OTP/reset sandi (tetap sinkron) dan email laporan anonim (job tanpa notifikasi in-app), seperti di B4.
6. **Kategori esensial:** keputusan verifikasi mitra, keputusan klaim, dan pemberitahuan permintaan harga tidak bisa dimatikan. Moderasi konten dan pengingat bisa dimatikan.

Tidak menyentuh auth/otorisasi: callback Better Auth hanya diganti pemanggil emailnya, perilakunya tetap.

## 8. Belum termasuk

- Push notification dan notifikasi realtime (websocket/SSE).
- Email HTML berdesain. Teks biasa dulu.
- Tautan berhenti langganan sekali klik tanpa login (butuh token bertanda tangan); untuk sekarang tautan menuju halaman pengaturan.
- Pemicu Fase 6, 9B, dan 11. Tipenya sudah terdaftar, pemicunya dibuat di fase masing-masing.
