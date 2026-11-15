# Prompt Enablement SILK: dari Base ke Sistem Penuh (SRS v1.0)

Nov 5, 2026 · @Surya Rafliansyah

Dokumen ini berisi satu master prompt dan 13 prompt fase (Fase 0 sampai 12) yang menambahkan seluruh fitur SRS v1.0 ke base SILK yang sudah ada. Fitur yang berisiko hukum dikunci di balik feature flag.

## Cara pakai

Asumsi saya, mohon dikoreksi bila keliru:

- Saya membaca "enablement all system" sebagai menambah semua fitur F-01 sampai F-11 di atas base repo, bukan membangun ulang dari nol.
- Base saya kenal dari ringkasan-proyek.md dan Blueprint Teknis. Fase 0 memverifikasinya ke kode asli sebelum ada yang ditulis.
- Diagram kelas SRS (hierarki pengguna, profil, ulasan, marketplace, chat) saya pakai sebagai sumber atribut entitas.

Langkah menjalankan:

1. Salin SRS ke repo sebagai docs/srs-silk.md agar Claude Code bisa membacanya.
2. Tempel master prompt (bagian 4) di awal sesi Claude Code, dan masukkan ringkasannya ke CLAUDE.md.
3. Jalankan Fase 0, lalu fase berikutnya secara berurutan. Satu fase = satu branch = satu PR. Setiap prompt memaksa Claude membuat rencana singkat dan menunggu persetujuan Anda.
4. Fase 6 dan 8 sampai 11 tetap OFF di production sampai syarat hukumnya terpenuhi (bagian 3).

| Fase | Isi | Bergantung pada | Status rilis |
| --- | --- | --- | --- |
| 0 | Audit base, git dan CI minimal | - | Wajib |
| 1 | Role dan akun: pasien, 4 jenis mitra | 0 | Rilis |
| 2 | Profil layanan, jadwal, video, kategori baru | 1 | Rilis |
| 3 | Pencarian: filter biaya dan rating | 2 | Rilis, filter rating menunggu Fase 6 |
| 4 | Artikel oleh mitra | 1 | Rilis |
| 5 | Notifikasi in-app dan email | 1 | Rilis |
| 6 | Ulasan dan moderasi | 1, 5 | Flag OFF sampai opini hukum |
| 7 | Panel admin lengkap | 2, 4, 6 | Rilis |
| 8 | AI chat informasi | 3 | Flag OFF |
| 9 | Apotek: 9A katalog, 9B pesanan dan Midtrans | 1, 5 | Flag OFF |
| 10 | Catatan kesehatan pribadi | 1 | Flag OFF |
| 11 | Langganan mitra | 2, 5 | Flag OFF |
| 12 | Hardening, E2E, audit keamanan | Semua | Wajib sebelum go-live |

## Peta SRS ke base

Base sudah menutup sekitar separuh SRS (auth, profil faskes, pencarian, artikel, email, panel moderasi). Yang belum ada adalah role baru, entitas transaksi dan data pribadi pasien. Padanan di bawah berdasar ringkasan base. Fase 0 membuat tabel padanan final ke modul M1 sampai M20 dari kode asli.

| Fitur SRS | Cakupan menurut SRS dan diagram kelas | Padanan di base | Celah utama | Fase |
| --- | --- | --- | --- | --- |
| F-01 Auth dan pengguna | Register, OTP, login, ubah password. User dibagi Pasien, Admin, Mitra. Mitra dibagi TenagaMedis (spesialisasi, nomor STR), FasilitasKesehatan (jenis, jumlah kamar), PenyediaGayaHidup (bidang), ApotekMitra (nomor SIA) | Better Auth: cookie session, TOTP, role faskes, moderator, admin | Role pasien dan tiga jenis mitra baru. Atribut izin per jenis mitra. SRS minta JWT, base memakai cookie session | 1 |
| F-02 Profil layanan | Deskripsi, foto, video, jam operasional, Lokasi (alamat, kota, lat, lng), JadwalPraktik (hari, jam), Layanan (nama, kategori, harga min dan max, aktif) | Profil faskes, foto di R2, PostGIS, tariff\_versions append-only | Video, jadwal per hari, kategori gaya hidup dan rumah duka. Harga min dan max harus lewat model tarif bersumber | 2 |
| F-03 Pencarian dan filter | Kategori, lokasi, biaya, rating | Pencarian pg\_trgm dan PostGIS, VIEW published\_tariffs | Filter rating belum ada. Filter biaya harus membaca tarif terverifikasi saja | 3 |
| F-05 Artikel dan edukasi | Mitra menulis, admin moderasi, status dan tanggal terbit | Sanity dan ISR Next.js, filter konten M17 | Penulis dari mitra dan alur status draft sampai terbit | 4 |
| F-09 dan F-11 Notifikasi dan email | Notifikasi (tipe, pesan, dibaca) dan EmailService | Resend dan tabel jobs dengan Vercel Cron | Tabel notifikasi in-app, preferensi, pemicu per peristiwa. SRS menyebut SMTP atau Gmail, base memakai Resend | 5 |
| F-08 Rating dan ulasan | Rating, komentar, pengalaman, status moderasi, filter komentar | Filter konten M17 | Seluruh entitas dan alur moderasi. Rating rata-rata di profil | 6 |
| F-10 Panel admin | Verifikasi mitra, kelola pengguna, moderasi ulasan dan artikel | Role admin dan moderator, audit log | Antrean verifikasi per jenis mitra, kelola pengguna, antrean moderasi baru | 7 |
| F-04 AI chat informasi | ChatSession, ChatMessage, OpenAIService, rekomendasi spesialisasi ke Layanan, tanpa diagnosis | Belum ada | Seluruhnya. Perlu pagar privasi dan batas diagnosis | 8 |
| F-06 Marketplace apotek | Produk (stok, butuhResep), Keranjang, Pesanan (resepUrl), Pembayaran Midtrans dengan verifikasi signature webhook | Belum ada | Seluruhnya. Perlu kepatuhan farmasi dan pembayaran | 9 |
| F-07 Riwayat dan rekam medis | RekamMedis (keluhan, catatan, tanggal), akses oleh TenagaMedis, bisaDiakses(user) | Belum ada | Seluruhnya. Data kesehatan pribadi | 10 |
| Langganan (kelas di SRS, tanpa kode F) | Paket, biaya bulanan, tanggal mulai dan akhir, aktifkan, cekMasaAktif | Belum ada | Seluruhnya. Tidak boleh memengaruhi urutan | 11 |

Keputusan arsitektur yang SRS biarkan terbuka dan saya tutup: tetap monorepo pnpm dan Turborepo seperti base. Strapi sudah dibatalkan rapat tim 31 Oktober 2026, jadi API tetap Express 5 yang ada.

## Konflik SRS dengan prinsip base dan keputusan default

SRS meminta sembilan hal yang bertabrakan dengan prinsip CLAUDE.md, aturan platform, atau regulasi. Prompt memakai keputusan di kolom ketiga. Status hukum belum saya verifikasi dan perlu konfirmasi konsultan hukum sebelum flag dinyalakan.

| Konflik | Benturan | Keputusan default dalam prompt | Gate untuk aktif |
| --- | --- | --- | --- |
| Ulasan dan komentar bebas (F-08) | Aturan iklan dan testimoni layanan kesehatan (mis. Permenkes 1787/2010, statusnya belum saya pastikan) dan filter M17 | Rating bintang dan tag pengalaman terstruktur. Komentar bebas lewat pra-moderasi dan M17. Tidak ada klaim hasil klinis. Rating bukan dasar urutan default | Opini hukum tertulis, lalu flag reviews\_enabled |
| Langganan mitra | Prinsip: urutan tidak dipengaruhi pembayaran | Langganan hanya membuka fitur non-peringkat (statistik, jumlah foto, jadwal lanjutan). Tidak ada badge atau posisi khusus | Tinjauan produk bahwa tidak ada pengaruh ke urutan, lalu flag subscriptions\_enabled |
| RekamMedis, riwayat, AI chat | Prinsip: tanpa data pribadi pasien. UU PDP menggolongkan data kesehatan sebagai data spesifik | Fitur dibangun sebagai Catatan Kesehatan Pribadi yang diisi pasien sendiri, bukan rekam medis resmi. Akses tenaga medis hanya dengan izin pasien per tenaga dan masa berlaku. Enkripsi kolom, audit akses, hak hapus. Chat tidak menyimpan riwayat secara default | Persetujuan eksplisit pengguna, penilaian dampak PDP, tinjauan hukum, lalu flag health\_records\_enabled dan ai\_chat\_enabled |
| Marketplace obat dan pembayaran | Izin apotek (SIA), aturan penjualan obat dan resep, merchant Midtrans | 9A: katalog dan ketersediaan tanpa transaksi. 9B: pesanan dan pembayaran. Obat resep wajib unggah resep dan disetujui apotek. Pesanan tidak valid dibatalkan dan dana dikembalikan | Opini hukum farmasi, akun merchant Midtrans, lalu flag pharmacy\_orders\_enabled |
| Layanan dengan harga min dan max | Prinsip: tanpa tarif tanpa tanggal, sumber, status verifikasi. tariff\_versions tidak boleh di-UPDATE | Harga di profil dibaca dari published\_tariffs. Perubahan harga dari mitra menjadi versi tarif baru berstatus menunggu, diverifikasi moderator | Tidak ada, berlaku sejak awal |
| Infrastruktur SRS (AWS, JWT, SMTP) | Base memakai Vercel, Neon, R2, Better Auth, Resend | Neon tetap. Auth tetap Better Auth ditambah penerbitan JWT sesuai SRS (plugin JWT atau bearer Better Auth bila tersedia di versi yang dipakai, tanpa JWT buatan sendiri). EmailService berupa antarmuka dengan adapter Resend dan adapter SMTP | Persetujuan rencana auth di Fase 1 |
| Role dan kategori baru | Perubahan auth dan skema tabel terpublikasi butuh izin | Tambah role pasien, tenaga\_medis, apotek, gaya\_hidup. Tambah kategori gaya hidup sehat dan rumah duka. Claude wajib minta persetujuan sebelum migrasi | Persetujuan per perubahan |
| Video profil | Batas body Vercel 4,5 MB | Unggah langsung ke R2 lewat signed URL, batas ukuran dan durasi, tanpa transkoding di Vercel, tampil setelah moderasi | Tidak ada |
| Data pasien di akun | Prinsip: tanpa data pribadi pasien di MVP | Akun pasien hanya nama dan email (nomor HP opsional untuk OTP). Tanggal lahir dan alamat baru dikumpulkan saat Fase 9B atau 10 | Konfirmasi Anda bahwa akun pasien diperbolehkan |

## Master prompt

Tempel ini di awal setiap sesi Claude Code. Ringkasan aturannya juga layak masuk CLAUDE.md agar berlaku di semua sesi.

```text
PERAN
Kamu engineer utama SILK (Sistem Informasi Layanan Kesehatan). Tugasmu: menambahkan fitur dari SRS v1.0 ke base yang SUDAH ADA, secara bertahap. Jangan menulis ulang apa yang sudah jalan.

SUMBER KEBENARAN (baca sebelum bertindak)
- CLAUDE.md, docs/blueprint-teknis.md, ringkasan-proyek.md
- docs/srs-silk.md (SRS v1.0, Okt 2026): fitur F-01..F-11, use case UC-01..UC-23, diagram kelas
Jika SRS bertentangan dengan CLAUDE.md, CLAUDE.md MENANG. Sebutkan konfliknya, jangan diam-diam memilih.

BASE
pnpm + Turborepo. Next.js 15.5 (App Router, ISR), React 19, Tailwind v4, MapLibre. Express 5 sebagai Vercel Function. Better Auth (cookie session, TOTP; role faskes/moderator/admin). Zod 4 + zod-to-openapi, pino, helmet. Drizzle ORM di Neon Postgres (PostGIS, pg_trgm, unaccent, citext). Cloudflare R2, Sanity, Resend, Turnstile, Sentry. Job lewat tabel jobs + Vercel Cron (CRON_SECRET).

ATURAN MUTLAK (tidak boleh dilanggar walau SRS atau saya memintanya tanpa menyebut aturan ini)
1. Urutan hasil TIDAK PERNAH dipengaruhi pembayaran atau langganan.
2. Tidak ada tarif tanpa tanggal, sumber, dan status verifikasi.
3. Semua teks publik lewat filter konten M17 (tanpa klaim termurah/terbaik, tanpa janji kesembuhan).
4. Tanpa data kesehatan pasien di produksi kecuali flag fitur terkait menyala dan gate hukumnya terpenuhi.
5. Setiap perubahan oleh pengguna terautentikasi masuk audit log.
6. TypeScript strict, tanpa any. Semua input divalidasi Zod.
7. Query DB hanya di file *.repo.ts.
8. DILARANG UPDATE/DELETE tabel tariff_versions. Perubahan harga = baris versi baru.
9. Uang = bigint rupiah. Waktu = UTC.
10. Batas Vercel: body <= 4,5 MB, tulis file hanya ke /tmp, job idempoten dan berpotongan (chunked), tanpa proses menetap atau state di memori. Unggahan besar lewat signed URL ke R2.

MINTA IZIN DULU (berhenti dan tunggu jawaban saya) sebelum:
- mengubah skema tabel yang sudah terpublikasi
- menambah dependency besar
- mengubah kontrak API yang sudah ada
- menyentuh auth atau otorisasi (role, session, middleware)

LARANGAN KERAS
- Jangan jalankan migrasi ke staging/production. Migrasi hanya dibuat dan dijalankan di DB lokal.
- Jangan sentuh file .env. Variabel baru ditambah ke .env.example saja.
- Integration test MENGHAPUS isi DB: pastikan DATABASE_URL menunjuk DB lokal atau branch Neon khusus tes sebelum menjalankannya. Jika ragu, berhenti dan tanya.
- Jangan commit secret, token, atau data pribadi.

FEATURE FLAG
Fitur berisiko hukum dibuat di balik flag (default OFF di semua environment): reviews_enabled, ai_chat_enabled, health_records_enabled, pharmacy_catalog_enabled, pharmacy_orders_enabled, subscriptions_enabled. Flag dibaca server-side dari satu modul config. Saat OFF: endpoint mengembalikan 404, UI tidak menampilkan apa pun, tidak ada job berjalan.

ALUR KERJA SETIAP FASE
1. Baca spesifikasi fase dan bagian SRS yang relevan.
2. Buat rencana singkat (file yang disentuh, skema, endpoint, risiko, hal yang butuh izin). BERHENTI dan tunggu persetujuan saya.
3. Tulis tes dulu (unit + integration), lalu implementasi.
4. Jalankan typecheck, lint, test. Perbaiki sampai hijau.
5. Laporan akhir fase: apa yang dibuat, hasil tes, deviasi dari SRS, hal yang belum dikerjakan, dan langkah manual untuk saya.
Satu fase = satu branch = satu PR. Jangan mengerjakan fase lain di branch yang sama.

BAHASA
Kode dan nama identifier dalam bahasa Inggris. UI, pesan error pengguna, dan dokumentasi dalam bahasa Indonesia. Balas saya dalam bahasa Indonesia.
```

## Prompt bertahap

Setiap prompt dipakai setelah master prompt ditempel. Kerjakan berurutan dan jangan lompat ke fase yang bergantung pada fase yang belum selesai.

### Fase 0: Audit base, git, CI

```text
FASE 0: AUDIT BASE, GIT, CI (tanpa mengubah kode fitur)
Tujuan: pastikan asumsi kita tentang base benar sebelum membangun.

Kerjakan (read-only kecuali poin 5):
1. Baca CLAUDE.md, docs/blueprint-teknis.md, ringkasan-proyek.md, dan docs/srs-silk.md (teks dan semua diagram).
2. Tulis docs/enablement/00-audit.md berisi:
   a. Tabel padanan: tiap F-01..F-11 dan UC-01..UC-23 -> modul M1..M20 yang ada -> status (ada / sebagian / belum) -> file kunci.
   b. Daftar tabel DB dan migrasi saat ini (nomor migrasi terakhir, trigger tariff_versions, VIEW published_tariffs).
   c. Role dan permission Better Auth saat ini.
   d. Endpoint dan kontrak OpenAPI yang sudah ada.
   e. Cara config env, dan apakah sudah ada modul feature flag.
3. Periksa konfigurasi tes: pastikan integration test tidak bisa berjalan ke DB non-lokal. Tambahkan guard yang menolak jalan jika host DB bukan localhost atau nama DB tidak diawali test_. Jangan jalankan tes ke DB lain.
4. Cari konflik SRS vs CLAUDE.md di luar daftar konflik yang saya berikan (reviews, langganan, rekam medis, apotek, harga vs tariff_versions, infrastruktur, role, video, data akun pasien) dan laporkan.
5. SETELAH saya setuju: inisialisasi git bila belum ada, buat .gitignore yang benar (termasuk .env), dan CI minimal di GitHub Actions (install, typecheck, lint, unit test) tanpa secret produksi.

Selesai bila: 00-audit.md ada, guard tes terpasang, CI hijau di branch kosong.
```

### Fase 1: Role dan akun

```text
FASE 1: ROLE DAN AKUN (F-01)
Baca: SRS F-01, use case registrasi, login, verifikasi OTP, dan diagram kelas hierarki pengguna.

Lingkup:
- Role baru: pasien, tenaga_medis, apotek, gaya_hidup. Role faskes, moderator, admin tetap. Role tidak bisa dipilih bebas: pasien daftar mandiri, mitra mendaftar dengan status verifikasi pending.
- Model mitra (partners): user_id, partner_type (tenaga_medis | fasilitas | gaya_hidup | apotek), nama_usaha, nomor_izin, status_verifikasi (pending | verified | rejected), verified_at, verified_by. Atribut per tipe: tenaga_medis(spesialisasi, nomor_str), fasilitas(jenis, jumlah_kamar), gaya_hidup(bidang), apotek(nomor_sia). Usulkan satu tabel dengan tabel detail per tipe, atau kolom nullable dengan CHECK, dan jelaskan pilihanmu di rencana. Hubungkan ke entitas faskes yang sudah ada, jangan duplikasi.
- Pasien: akun minimal (nama, email, nomor HP opsional). TANPA tanggal lahir dan alamat di fase ini.
- Alur: register -> verifikasi OTP email (pakai mekanisme OTP Better Auth). Token: arsitektur mengikuti SRS, jadi sediakan penerbitan JWT lewat plugin JWT atau bearer Better Auth bila tersedia di versi yang dipakai, berdampingan dengan sesi cookie untuk web. Jangan membuat implementasi JWT sendiri. Jelaskan di rencana: umur token, kunci dan rotasi, siapa yang memverifikasi, dan cara pencabutan -> login -> ubah password -> logout. Rate limit dan Turnstile di register dan login.
- Mitra tidak tampil publik sebelum status_verifikasi = verified.
- Audit log: register, login gagal berulang, perubahan role, perubahan status verifikasi.

Butuh izin: SELURUH fase ini (menyentuh auth dan skema). Ajukan matriks role x permission sebagai bagian dari rencana.

Tes: matriks otorisasi tiap role x endpoint (ditolak dan diizinkan), OTP kedaluwarsa, brute force dibatasi, mitra pending tidak muncul di endpoint publik.

Selesai bila: pasien dan 4 jenis mitra bisa daftar dan login, matriks otorisasi hijau, OpenAPI diperbarui.
```

### Fase 2: Profil layanan, jadwal, video, kategori baru

```text
FASE 2: PROFIL LAYANAN, JADWAL, VIDEO, KATEGORI BARU (F-02)
Baca: SRS F-02 dan diagram kelas ProfilLayanan, Lokasi, Layanan, JadwalPraktik.

Lingkup:
- Profil layanan per mitra: deskripsi, foto (R2, signed URL), jam operasional, video profil. Lokasi: alamat, kota, lat, lng (PostGIS), boleh lebih dari satu per profil. JadwalPraktik: hari, jam_mulai, jam_selesai, banyak per profil; simpan jam lokal + zona waktu, bukan UTC, karena jadwal berulang.
- Layanan: nama, kategori, aktif. Harga TIDAK disimpan di kolom bebas. Mitra mengajukan perubahan harga -> baris tariff_versions baru (status menunggu, wajib tanggal berlaku, sumber, dokumen bukti) -> moderator memverifikasi -> baru tampil lewat published_tariffs. Tidak ada UPDATE/DELETE tariff_versions.
- Kategori baru: penyedia gaya hidup sehat dan rumah duka. Tambahkan lewat taxonomy yang ada, bukan hardcode.
- Video profil: unggah langsung ke R2 (signed URL, multipart bila perlu), batas 100 MB dan durasi maksimum yang kamu usulkan, hanya mp4 atau webm, tanpa transkoding di Vercel. Status pending sampai dimoderasi. Alternatif: tautan YouTube atau Vimeo. Jelaskan pilihanmu di rencana.
- Semua teks deskripsi lewat M17. Setiap perubahan profil masuk audit log, dan kembali ke status menunggu moderasi bila field publik berubah.

Butuh izin: perubahan skema tabel faskes yang terpublikasi, penambahan kategori, dependency pemutar video bila ada.

Tes: mitra hanya bisa mengubah profilnya sendiri, unggahan di atas batas ditolak, teks berisi 'termurah' ditolak, perubahan harga tidak mengubah tarif lama.

Selesai bila: mitra terverifikasi bisa mengelola profil lengkap dan hasilnya tampil di halaman publik (ISR) setelah moderasi.
```

### Fase 3: Pencarian dan filter

```text
FASE 3: PENCARIAN DAN FILTER (F-03)
Baca: SRS F-03 dan modul pencarian yang sudah ada.

Lingkup:
- Tambah filter: kategori (termasuk kategori baru), lokasi (radius dari titik atau kota), biaya (rentang), rating (minimum bintang).
- Filter dan sort biaya HANYA membaca published_tariffs, dengan tanggal dan sumber ditampilkan. Layanan tanpa tarif terverifikasi tetap muncul dengan label 'tarif belum tersedia' dan tidak dipaksa ke posisi atas atau bawah.
- Urutan default tetap relevansi + jarak. Pembayaran, langganan, dan rating TIDAK memengaruhi urutan default. Sort berdasarkan rating hanya bila pengguna memilihnya, dengan label jelas.
- Filter rating bergantung pada data Fase 6: sebelum itu, sembunyikan di balik flag reviews_enabled.
- Pertahankan cursor pagination. Jangan mematahkan kontrak API lama: tambah parameter opsional saja.
- Target halaman hasil <= 3 detik. Tambah indeks yang perlu dan jelaskan di rencana (butuh izin bila menyentuh tabel terpublikasi).
- Peta MapLibre menampilkan hasil dengan filter yang sama.

Tes: kombinasi filter, hasil tanpa tarif, urutan tidak berubah saat mitra berlangganan (uji regresi eksplisit), EXPLAIN query utama memakai indeks.

Selesai bila: semua filter SRS berfungsi dan tes regresi urutan hijau.
```

### Fase 4: Artikel oleh mitra

```text
FASE 4: ARTIKEL OLEH MITRA (F-05)
Baca: SRS F-05, kelas Artikel, dan integrasi Sanity yang sudah ada.

Lingkup:
- Mitra terverifikasi bisa menulis artikel (judul, isi, status: draft | menunggu | terbit | ditolak, published_at). Tentukan di rencana: tetap di Sanity (penulis mitra lewat API server ke Sanity) atau tabel artikel di Postgres dengan Sanity khusus konten editorial. Pilih yang risikonya paling kecil dan jelaskan alasannya.
- Alur: draft -> ajukan -> moderator atau admin menyetujui -> terbit. Setiap artikel lewat M17. Artikel terbit memicu revalidate ISR.
- Artikel menampilkan penulis dan jenis mitra, tanpa klaim pengobatan, dengan disclaimer tetap bahwa isi bersifat edukasi dan bukan diagnosis. Tidak ada advertorial berbayar, dan artikel tidak boleh memengaruhi urutan profil mitra.
- Mitra hanya bisa melihat dan mengubah artikelnya sendiri. Artikel terbit yang diubah kembali ke status menunggu.

Butuh izin: otorisasi untuk peran penulis, dan perubahan kontrak API.

Tes: otorisasi per status, M17 menolak klaim kesembuhan, revalidate terpanggil, artikel draft tidak bocor ke endpoint publik.

Selesai bila: mitra bisa menulis dan mengajukan, admin bisa menyetujui, artikel tampil di situs publik.
```

### Fase 5: Notifikasi dan email

```text
FASE 5: NOTIFIKASI DAN EMAIL (F-09, F-11)
Baca: SRS F-09 dan F-11, kelas Notifikasi dan EmailService.

Lingkup:
- Tabel notifications: user_id, tipe, pesan, dibaca, created_at. API: daftar (cursor), tandai dibaca, hitung belum dibaca. UI: ikon lonceng dan halaman daftar.
- Peristiwa pemicu: mitra disetujui atau ditolak, profil, video, artikel disetujui atau ditolak (dengan alasan), ulasan baru untuk mitra (Fase 6), langganan hampir habis (Fase 11), status pesanan (Fase 9B). Buat registry tipe notifikasi agar fase berikut tinggal mendaftar.
- Email lewat antarmuka EmailService dengan adapter Resend (default) dan adapter SMTP (sesuai SRS), dipilih lewat env. Pengiriman lewat tabel jobs: idempoten, ada batas percobaan ulang, tidak ada kiriman ganda. Template bahasa Indonesia.
- Isi notifikasi dan email TIDAK memuat data kesehatan atau rincian pesanan obat; cukup pemberitahuan dan tautan ke aplikasi.
- Preferensi pengguna: email non-esensial bisa dimatikan. Email transaksional (OTP, reset password, keputusan verifikasi) selalu terkirim.
- Rate limit dan deduplikasi agar tidak spam.

Butuh izin: hanya bila menyentuh skema tabel jobs yang sudah ada.

Tes: idempotensi job kirim email, retry, opt-out, isi email tidak memuat field terlarang.

Selesai bila: tiap peristiwa Fase 1 sampai 4 menghasilkan notifikasi in-app dan email yang benar.
```

### Fase 6: Ulasan dan moderasi

```text
FASE 6: ULASAN DAN MODERASI (F-08)  [flag reviews_enabled, default OFF]
Baca: SRS F-08, kelas Ulasan, alur moderasi ulasan, dan bagian konflik hukum ulasan.

Lingkup:
- Tabel reviews: pasien, layanan, rating (1-5), pengalaman (tag terstruktur: kebersihan, keramahan, waktu tunggu, kejelasan biaya), komentar (opsional), status_moderasi (menunggu | disetujui | ditolak), alasan, created_at. Satu pasien satu ulasan per layanan (UNIQUE); edit memicu moderasi ulang.
- Komentar bebas: pra-moderasi (tidak tampil sebelum disetujui) ditambah filter M17 otomatis (menolak klaim hasil klinis, janji kesembuhan, data pribadi orang lain, tautan).
- Rating rata-rata dan jumlah ulasan dihitung dari ulasan disetujui saja (job idempoten atau materialized view) dan disimpan di profil sebagai angka turunan.
- Anti-penyalahgunaan: mitra tidak bisa mengulas dirinya, rate limit, deteksi duplikat, tombol lapor. Mitra boleh membalas, balasan juga dimoderasi.
- Jangan menyebut ulasan 'terverifikasi' kecuali ada mekanisme nyata (misalnya bukti kunjungan). Beri label 'ulasan pengguna, tidak diverifikasi'.
- Rating tidak mengubah urutan default pencarian (aturan mutlak 1).
- Pasien bisa menghapus ulasannya sendiri.

Butuh izin: kolom turunan rating di profil layanan, dan kontrak API publik.

Tes: alur moderasi, flag OFF = 404, M17 menolak kasus uji, rata-rata benar setelah moderasi, pasien tidak bisa mengulas dua kali.

Selesai bila: seluruh alur jalan di lokal dengan flag ON, dan semua endpoint 404 dengan flag OFF.
```

### Fase 7: Panel admin lengkap

```text
FASE 7: PANEL ADMIN LENGKAP (F-10)
Baca: SRS F-10 dan kelas Admin (verifikasiMitra, kelolaPengguna, moderasiUlasan, moderasiArtikel).

Lingkup:
- Antrean verifikasi mitra per jenis: tampilkan nomor izin, STR, atau SIA, dan dokumen bukti dari R2 (signed URL baca berumur pendek). Setujui atau tolak dengan alasan wajib.
- Kelola pengguna: cari, lihat peran dan status, tangguhkan atau aktifkan. Admin tidak bisa melihat password atau data kesehatan. Perubahan role hanya oleh admin dengan TOTP aktif.
- Satu antrean moderasi untuk profil dan video, artikel, ulasan, dan perubahan tarif (tarif tetap memakai alur versi). Filter, urut berdasarkan usia antrean, tindakan massal yang aman.
- Semua tindakan admin dan moderator masuk audit log append-only dengan aktor, target, alasan, waktu.
- Pemisahan tugas: moderator memoderasi konten, hanya admin yang mengubah role atau menangguhkan akun.
- Dashboard ringkas: jumlah antrean, usia antrean tertua, mitra aktif per kategori. Tanpa data pribadi pasien.

Butuh izin: otorisasi (permission moderator vs admin).

Tes: matriks otorisasi admin vs moderator, audit log tercatat untuk tiap tindakan, tindakan admin ditolak tanpa TOTP.

Selesai bila: seluruh antrean SRS bisa diproses dari panel dan ada jejak audit.
```

### Fase 8: AI chat informasi

```text
FASE 8: AI CHAT INFORMASI (F-04)  [flag ai_chat_enabled, default OFF]
Baca: SRS F-04 dan kelas ChatSession, ChatMessage, OpenAIService.

Lingkup:
- Chat informasi umum yang membantu pasien memilih JENIS layanan atau spesialisasi, lalu menautkan ke hasil pencarian Fase 3. TIDAK mendiagnosis, tidak menyarankan obat atau dosis, tidak menafsirkan hasil lab.
- OpenAIService hanya di server (kunci di env): kirimPrompt dan ekstrakSpesialisasi memakai structured output (JSON schema) agar rekomendasi hanya berupa kategori atau spesialisasi yang ada di taxonomy, bukan teks bebas.
- Pagar: system prompt tetap. Deteksi kata kunci darurat (nyeri dada, sesak berat, pingsan, niat bunuh diri) -> jawaban baku yang mengarahkan ke 119 atau IGD terdekat, tanpa memanggil model. Semua output lewat filter M17. Disclaimer tampil di tiap sesi. Tolak pertanyaan di luar lingkup.
- Privasi: hapus PII (nomor telepon, email, NIK, nama) sebelum dikirim ke penyedia model. Jangan simpan isi percakapan secara default (sesi stateless di klien atau TTL pendek). ringkasan_keluhan hanya disimpan bila pengguna menyalakan opsi riwayat DAN health_records_enabled ON. Syarat gate: kontrak penyedia model menyatakan data tidak dipakai melatih.
- Biaya dan penyalahgunaan: rate limit per pengguna dan per IP, Turnstile, batas panjang pesan dan jumlah giliran, batas anggaran harian dengan fallback 'layanan sedang dibatasi'. Perhatikan batas durasi fungsi Vercel (streaming atau timeout yang jelas).
- Rekomendasi tidak boleh dipengaruhi pembayaran atau langganan.

Butuh izin: dependency SDK model bila besar, dan tabel baru bila riwayat disimpan.

Tes: kasus darurat tidak memanggil model, permintaan diagnosis ditolak, PII terhapus (pakai mock penyedia), output di luar taxonomy dibuang, flag OFF = 404.

Selesai bila: dengan flag ON pengguna mendapat rekomendasi spesialisasi dengan tautan pencarian dan semua pagar teruji.
```

### Fase 9: Marketplace apotek

```text
FASE 9: MARKETPLACE APOTEK (F-06)
Flag: pharmacy_catalog_enabled (9A) dan pharmacy_orders_enabled (9B), keduanya default OFF.
Baca: SRS F-06, kelas Produk, Keranjang, Pesanan, Pembayaran, MidtransService, dan alur checkout.

FASE 9A: katalog dan ketersediaan, tanpa transaksi
- Apotek mitra (terverifikasi, nomor SIA ada) mengelola produk: nama, kategori, harga, stok, butuh_resep. Pasien melihat ketersediaan dan harga. Tidak ada keranjang atau pembayaran.
- Harga produk punya tanggal pembaruan. Obat resep tidak dipromosikan. Tidak ada diskon atau iklan yang memengaruhi urutan.

FASE 9B: pesanan dan pembayaran (kerjakan hanya setelah 9A disetujui, gate hukum terpenuhi, dan akun merchant Midtrans siap)
- Catatan 2026-11-14: penyedia pembayaran diganti ke Duitku. Pakai ulang modul pembayaran Fase 11 (lib/duitku.ts, payment_orders, payment_events); aturan webhook di bawah berlaku dengan tanda tangan HMAC Duitku menggantikan signature_key Midtrans.
- Keranjang -> checkout -> Pesanan (kode_pesanan unik, status, total_bayar bigint rupiah, resep_url) -> Pembayaran Midtrans Snap (snap_token, order_id_midtrans, metode, status, paid_at).
- Satu keranjang hanya untuk satu apotek. Harga dan stok diverifikasi ulang di server saat checkout. Stok dikurangi atomik (transaksi + constraint) dan dikembalikan saat batal atau kedaluwarsa.
- Obat resep: wajib unggah resep (R2 signed URL, bucket privat, akses hanya pasien pemilik dan apotek terkait, retensi terbatas). Apotek memeriksa resep dan stok. Pesanan tidak valid dibatalkan dan pembayaran dikembalikan lewat mekanisme yang didukung Midtrans.
- Webhook Midtrans: verifikasi signature_key dengan server key (perbandingan waktu-konstan), idempoten (order_id + status), pastikan gross_amount sama dengan pesanan, tolak perubahan status mundur. Server key hanya di env dan tidak pernah dilog.
- Status pesanan: menunggu bayar -> dibayar -> diproses apotek -> siap atau dikirim -> selesai; cabang: dibatalkan, kedaluwarsa, dikembalikan. Notifikasi lewat Fase 5 tanpa rincian obat.
- Data pasien: alamat dan nomor HP baru dikumpulkan di sini, hanya yang perlu untuk pengiriman, dienkripsi di level kolom, dihapus sesuai kebijakan retensi.
- Cron kedaluwarsa pesanan: idempoten dan berpotongan.

Butuh izin: skema baru yang menyentuh data pasien, dependency Midtrans, auth untuk role apotek.

Tes: signature palsu ditolak, webhook ganda tidak menggandakan efek, stok tidak negatif saat konkuren, obat resep tanpa resep tidak bisa diproses, akses resep oleh pihak lain ditolak, flag OFF = 404.

Selesai bila: 9A jalan dengan flag dan 9B lulus semua tes di sandbox Midtrans.
```

### Fase 10: Catatan kesehatan pribadi

```text
FASE 10: CATATAN KESEHATAN PRIBADI (F-07)  [flag health_records_enabled, default OFF]
Baca: SRS F-07, kelas RekamMedis (keluhan, catatan, tanggal, bisaDiakses), dan bagian konflik data kesehatan.

Lingkup:
- Posisi produk: catatan yang diisi pasien sendiri (keluhan, catatan, tanggal), BUKAN rekam medis elektronik resmi fasilitas kesehatan. Tampilkan penjelasan itu di UI.
- Persetujuan eksplisit sebelum fitur dipakai (tujuan, data, pihak yang bisa mengakses, hak menarik persetujuan), disimpan dengan versi dan waktu. Tanpa persetujuan tidak ada data yang tersimpan.
- Enkripsi level kolom untuk keluhan dan catatan (kunci di env atau KMS; jelaskan rotasi kunci di rencana). Isi catatan tidak boleh muncul di log, Sentry, PostHog, atau email.
- Akses tenaga medis: pasien memberi izin per tenaga medis terverifikasi dengan masa berlaku dan bisa mencabutnya kapan saja. bisaDiakses(user) memeriksa izin aktif. Setiap pembacaan oleh pihak selain pasien masuk log akses yang bisa dilihat pasien.
- Hak pasien: lihat, ekspor, dan hapus permanen catatan dan izin. Hapus akun = hapus catatan.
- Admin dan moderator TIDAK bisa membaca isi catatan.
- Tidak ada event analitik yang memuat isi catatan.

Butuh izin: seluruh fase (skema data sensitif dan auth). Ajukan rencana enkripsi dan model izin lebih dulu.

Tes: pengguna lain dan admin ditolak, izin kedaluwarsa ditolak, kolom di DB terenkripsi (periksa nilai mentah), log bersih, hapus akun menghapus semua, flag OFF = 404.

Selesai bila: alur izin dan hak pasien teruji dan checklist PDP di bagian 6 terpenuhi.
```

### Fase 11: Langganan mitra

```text
FASE 11: LANGGANAN MITRA  [flag subscriptions_enabled, default OFF]
Baca: kelas Langganan (paket, biayaBulanan, tanggalMulai, tanggalAkhir, aktifkan, cekMasaAktif) dan aturan mutlak 1.

Lingkup:
- Paket mitra dengan fitur NON-peringkat saja: statistik kunjungan profil, jumlah foto lebih banyak, jadwal lanjutan, ekspor data. Dilarang: posisi lebih tinggi, badge 'rekomendasi', penandaan khusus di hasil pencarian, atau bobot apa pun di algoritma.
- Tabel subscriptions (partner_id, paket, biaya bigint, tanggal_mulai, tanggal_akhir, status). aktifkan() dan cekMasaAktif() sebagai fungsi service; masa aktif dihitung di server dalam UTC.
- Pembayaran memakai Duitku POP (keputusan 2026-11-14, menggantikan Midtrans): tagihan dibuat di server, status hanya dari callback bertanda tangan HMAC atau cek status, sandbox dulu. Cron pengingat dan kedaluwarsa bersifat idempoten. Hasil: docs/enablement/11-hasil-fase-11.md.
- Saat langganan berakhir, profil dan posisi di hasil pencarian tidak berubah; hanya fitur tambahan yang berhenti.
- Uji regresi wajib: urutan hasil pencarian identik untuk mitra berlangganan dan tidak berlangganan.

Butuh izin: skema baru, dependency, perubahan kontrak API.

Selesai bila: tes regresi urutan hijau dan langganan tidak mengubah apa pun selain fitur non-peringkat.
```

### Fase 12: Hardening dan persiapan go-live

```text
FASE 12: HARDENING DAN PERSIAPAN GO-LIVE

Lingkup:
1. E2E (Playwright) untuk alur utama: daftar -> verifikasi -> login; mitra isi profil -> moderasi -> tampil publik; pencarian dengan filter; artikel; notifikasi. Alur fitur ber-flag diuji dengan flag ON hanya di lingkungan tes.
2. Audit keamanan: OWASP ASVS L1 sebagai checklist; cek otorisasi tiap endpoint (IDOR), rate limit, header (helmet, CSP), validasi unggahan, secret scanning, audit dependency. Laporkan temuan berperingkat. Jangan memperbaiki hal yang menyentuh auth tanpa izin.
3. Backup dan pemulihan: dokumentasikan dan UJI pemulihan Neon (point-in-time restore ke branch), catat RPO dan RTO. Backup harian sesuai SRS.
4. Observabilitas: Sentry, log pino terstruktur tanpa PII, alert untuk webhook error dan job gagal, health check, pemantauan uptime (target 99% sesuai SRS).
5. Performa: ukur LCP dan TTFB halaman utama dan hasil pencarian terhadap target 3 detik; laporkan angkanya.
6. Vercel: konfirmasi paket yang mendukung cron tiap 10 menit, dan batas durasi fungsi untuk job dan AI chat.
7. Dokumen: runbook insiden, daftar feature flag beserta syarat gate, matriks kepatuhan SRS (tiap F dan UC -> status -> bukti tes).

Selesai bila: semua tes hijau, temuan keamanan kritis nol, pemulihan teruji, matriks kepatuhan lengkap.
```

## Checklist gate dan pertanyaan terbuka

Flag hanya boleh menyala di production setelah syarat di tabel berikut terpenuhi. Semua syarat hukum perlu dikonfirmasi ke konsultan; saya belum memverifikasi status regulasinya.

| Flag | Syarat sebelum ON di production | Pemilik |
| --- | --- | --- |
| reviews\_enabled | Opini hukum tertulis soal ulasan dan testimoni layanan kesehatan. Kebijakan moderasi tertulis. Antrean moderasi punya petugas | Anda dan konsultan hukum |
| ai\_chat\_enabled | Kontrak penyedia model menyatakan data tidak dipakai melatih. Skenario darurat dan penolakan diagnosis lulus uji. Batas anggaran diset | Anda |
| health\_records\_enabled | Penilaian dampak PDP. Teks persetujuan disetujui hukum. Enkripsi kolom dan uji hapus akun lulus. Penunjukan penanggung jawab data | Anda dan konsultan hukum |
| pharmacy\_catalog\_enabled | Hanya apotek dengan SIA terverifikasi. Kebijakan konten obat | Anda |
| pharmacy\_orders\_enabled | Opini hukum farmasi dan penjualan obat daring. Akun merchant Midtrans aktif. Prosedur pembatalan dan pengembalian dana tertulis | Anda dan konsultan hukum |
| subscriptions\_enabled | Tinjauan produk bahwa langganan tidak memengaruhi urutan. Tes regresi urutan hijau. Syarat pajak dan faktur | Anda |

Keputusan Anda pada 5 November 2026:

1. Ruang lingkup: semua fitur SRS ditambahkan di atas base. Dikonfirmasi.
2. Akun pasien (nama dan email) diperbolehkan. Dikonfirmasi.
3. Arsitektur tetap Neon dan JWT sesuai SRS. Prompt diperbarui: Better Auth tetap, ditambah penerbitan JWT, dan email lewat adapter Resend dan SMTP. Belum jelas: JWT berdampingan dengan sesi cookie (asumsi saya) atau menggantikannya sepenuhnya. Fase 1 meminta rencana auth sebelum apa pun diubah.
4. Rekam medis diposisikan sebagai catatan kesehatan pribadi yang diisi pasien. Dikonfirmasi.
5. Marketplace apotek tetap target rilis, dikerjakan 9A lalu 9B, tetap di balik flag dan gate hukum.

Sumber: SRS SILK dengan Perancangan Sistem v1.0 (lampiran Anda), termasuk diagram kelas dan urutan di dalamnya.
