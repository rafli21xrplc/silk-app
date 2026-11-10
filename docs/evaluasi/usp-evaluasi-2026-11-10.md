# Evaluasi sistem berbasis USP SILK

Tanggal: 10 November 2026. Dasar: kode di `enablement/fase-4b-dokter` (`844d525`, memuat Fase 0–4 dan 4b), `docs/usp-silk.md`, laporan `docs/enablement/0*-hasil-*.md`.
USP yang diuji: **"Tahu biayanya, kenal dokternya, sebelum datang."** Bagian 1–9 ditulis dalam mode read-only. Bagian 10 mencatat hasil penerapan rekomendasi di branch `enablement/usp-rekomendasi`.

**Ringkasan.** P1 (biaya) paling kuat: setiap tarif punya tanggal, sumber, dan status verifikasi, tetapi kata "perkiraan", biaya konsultasi dokter, dan rawat inap belum ada. P2 (video dokter) sudah bisa diunggah dan tampil, tetapi belum ada bukti persetujuan tertulis dan belum ada satu pun video contoh. P3 (ulasan pengalaman) adalah **klaim kosong**: belum dibangun dan di balik gate hukum. Klaim integritas (urutan netral) sudah ditulis sebagai uji, tetapi uji integrasinya belum pernah dijalankan.

## 1. Uji USP per pilar

| Pilar | Sudah terbukti di produk | Belum | Status |
| --- | --- | --- | --- |
| **P1 Biaya jelas** | Harga per `price_type`, "tanya" tidak tampil sebagai nol (`components/price-display.tsx`). Tanggal berlaku, tanggal verifikasi, sumber, dan tanda usang (`components/trust-badge.tsx`). Termasuk/tidak termasuk dan isi paket (`components/tariff-card.tsx`). Riwayat versi (`tariff-history-drawer.tsx`). Banding per layanan (`/bandingkan/[service]`). Filter rentang biaya (`/cari`, Fase 3). Harga mitra lewat moderasi (`tariff_change_requests`, Fase 2) | Kata **"perkiraan"** tidak ada di UI (grep `perkiraan` di `apps/web/src` = 0). Tabel banding tidak menampilkan sumber (`comparison-table.tsx`). **Rawat inap** tidak ada di taksonomi (`packages/db/seed/data.ts`: lab, MCU, gaya hidup, rumah duka; radiologi hanya di seed demo). **Biaya konsultasi dokter** tidak ada sebagai layanan; "tarif praktik utama" dokter demo berisi gula darah dan kolesterol (`seed/demo-data.ts`, `MENU.praktik_dokter`). Label "Diisi faskes" juga dipakai untuk mitra non-faskes (`messages/id.ts` `verification`) | Sebagian kuat |
| **P2 Kenal dokternya** | Unggah video MP4/WebM ≤ 100 MB ≤ 120 dtk lewat signed URL, dimoderasi (Fase 2, `profile_media`). Video di `/dokter/[slug]` (baris 118–135). Kartu dokter memberi tanda "ada video" (`doctor/doctor-card.tsx`). Daftar dan pencarian dokter `/dokter` (4b) | **Bukti persetujuan tertulis** tidak disimpan: `profile_media` tidak punya kolom atau relasi persetujuan (`packages/db/src/schema/domain.ts:603`). Tidak ada video di data demo. Batas 120 dtk melebihi format USP 30–60 dtk. Tidak ada poster video (berpengaruh ke LCP dan kesan pertama). Di ponsel, video berada di bawah blok identitas dan kontak | Fondasi ada, bukti belum |
| **P3 Ulasan pengalaman** | Tabel kosong `facility_ratings` dan filter `minRating` di balik `reviews_enabled` (Fase 3). Filter konten M17 bisa dipakai ulang | Entitas ulasan, alur moderasi, tampilan. Tag Fase 6 (kebersihan, keramahan, waktu tunggu, kejelasan biaya) belum memuat "kenyamanan" secara eksplisit | **Klaim kosong** |

**Kalimat USP vs layar.** Tidak ada satu layar yang memuat ketiga pilar:
- Profil dokter memuat P2, P1 hanya bila praktik utamanya punya tarif, dan letaknya di paling bawah (baris 205). P3 tidak ada.
- Hasil pencarian `/cari` memuat P1 (harga + lencana) tetapi tidak menampilkan dokter. `/dokter` memuat P2 tetapi tanpa harga.

**Usulan cakupan sampai 20 Desember:** pertahankan kalimat. Penuhi P1 dan P2 sungguhan, dan tampilkan P3 hanya di lingkungan demo dengan data contoh berlabel (lihat 2c). Bila P3 tidak siap, alternatif dari dokumen USP, "Cek biaya, kenali dokter, baru pilih.", tidak menjanjikan ulasan dan bisa dibuktikan penuh.

## 2. Ketegangan dan jawabannya

| # | Ketegangan | Penilaian | Rekomendasi |
| --- | --- | --- | --- |
| a | Posisi "bukan menjual konsultasi atau obat" vs apotek (F-06) dan AI chat (F-04) | 9B (keranjang, Midtrans) bertolak belakang dengan "pra-transaksi" dan butuh gate hukum terberat. 9A (katalog dan ketersediaan) masih informasional. AI chat yang hanya mengarahkan ke spesialisasi bisa mendukung "kenal dokternya", tetapi bukan pembeda dan berbiaya | **Tunda 9B** sampai setelah demo dan keputusan model bisnis. **Ubah 9A** menjadi "ketersediaan obat bebas" tanpa transaksi, setelah demo. **Tunda Fase 8**. |
| b | Video sebagai P2 vs status video | Video sudah masuk web (Fase 2) sehingga keputusan rapat "video masuk MVP" sudah terjawab secara teknis. Perkiraan biaya: 60 dtk 720p H.264 ≈ 15–20 MB; 5 video ≈ 100 MB; 1.000 dokter ≈ 20 GB ≈ US$0,30/bulan di R2 (US$0,015/GB-bulan, 10 GB pertama gratis, egress gratis; harga daftar publik, perlu dicek ulang). Pemutar: `<video>` bawaan, tanpa dependensi. Biaya terbesar ada di **produksi** video, bukan penyimpanan | Batas baru: **20–90 dtk, ≤ 50 MB, MP4 H.264** (WebM tetap diterima), **poster wajib** (frame atau foto dokter), subtitel opsional. Tetap tanpa transkoding di Vercel |
| c | P3 vs gate `reviews_enabled` | Gate berlaku untuk **produksi**. Demo bisa memakai lingkungan terpisah dengan flag ON dan data fiktif berlabel "Data contoh" seperti seed `Contoh` yang sudah ada | Kerjakan Fase 6 versi ramping sebelum demo, flag ON hanya di lingkungan demo. Tag diselaraskan: **kenyamanan ruang tunggu, keramahan dan pelayanan staf, kejelasan penjelasan, waktu tunggu, kesesuaian biaya dengan perkiraan** (tag terakhir mengikat P3 ke P1). Tanpa tag hasil klinis |
| d | Trial 6 bulan dan langganan vs aturan mutlak 1 | Risiko terbesar: bila video atau jumlah foto menjadi fitur berbayar, kualitas profil (dan tanda "ada video" di kartu) bergantung pada pembayaran | **Video, foto, jadwal, dan biaya selalu gratis** untuk semua mitra terverifikasi. Trial dan paket hanya membuka fitur di belakang layar: statistik kunjungan profil, ekspor data, pengingat pembaruan tarif. Tanpa badge, tanpa tanda di kartu. Uji regresi urutan Fase 3 sudah menjadi pagar |
| e | Persetujuan tertulis video dan testimoni | **Belum tersimpan** (lihat P2) | Model data: `media_consents` (media atau praktisi, nama penanda tangan, peran, cakupan `web_profil` / `media_sosial`, versi teks, dokumen bertanda tangan di `documents` polimorfik, `granted_at`, `revoked_at`). Moderator tidak bisa menyetujui video tanpa persetujuan aktif. Pencabutan menyembunyikan video dan memicu revalidate. Testimoni pasien (konten sosial) memakai tabel yang sama |
| f | "Perkiraan dari mitra" vs `tariff_versions` | Tanggal, sumber, dan status sudah terlihat di kartu tarif dan kartu hasil. Kata "perkiraan" dan "dari mitra" tidak ada; tabel banding tanpa sumber | Tambah label "Perkiraan biaya" di `PriceDisplay` konteks publik, sumber di tabel banding, dan label verifikasi "Diisi mitra" untuk non-faskes |
| g | "Bandingkan biaya" yang dijanjikan | **Ada** untuk layanan antar-faskes (`/bandingkan/[service]`, default harga naik, bukan pembayaran). **Belum** untuk biaya konsultasi antar-dokter | Bentuk minimum: layanan `konsultasi-dokter-umum` dan `konsultasi-dokter-spesialis` di taksonomi, sehingga halaman banding yang sudah ada langsung berlaku untuk dokter, plus "Biaya konsultasi" di kartu dan profil dokter |

## 3. Peta perjalanan pengguna

Langkah dihitung dari kode (klik atau isian), bukan dari uji pengguna. U = mendukung USP, N = netral, G = mengganggu.

| Peran | Tujuan | Langkah / layar | Titik bingung | Tanda |
| --- | --- | --- | --- | --- |
| Pasien | Bandingkan biaya MCU dan lihat dokternya | ±7 / 4: beranda → ketik "MCU" → hasil → faskes → "Bandingkan" → tabel; dokter lewat kartu dokter di halaman faskes | Tabel banding tidak menyebut sumber dan dokter; tidak ada kata "perkiraan" | U, kecuali langkah dokter (N) |
| Pasien | Kenal dokter anak di dekat saya | ±5 / 3: menu Dokter → spesialisasi → "Dekat saya" (izin lokasi) → kartu → profil, gulir ke video | Kartu tanpa biaya konsultasi; di ponsel video di bawah lipatan | U |
| Pasien | Lihat pengalaman pasien lain | Tidak bisa | Klaim kosong | G |
| Tenaga medis | Daftar, unggah video, profil tayang | ±25 isian / 7 layar, **3 kali menunggu moderator** (verifikasi mitra → terbit profil → setujui video). Tanpa notifikasi (Fase 5 belum), dokter tidak tahu kapan kembali | Target "selesai dalam satu sesi" **tidak tercapai** | G pada jeda tunggu |
| Tenaga medis | Cantumkan biaya konsultasi | Tidak ada layanan konsultasi di daftar; dokter harus memilih layanan lab | Tidak bisa dilakukan dengan benar | G |
| Tenaga medis | Ubah jadwal | 3–4 / 1 (editor profil, salin Senin ke Senin–Jumat). Jadwal profil terbit masuk revisi | Revisi menunggu moderasi untuk perubahan jadwal kecil | N |
| Fasilitas | Tampil di pencarian | Dua jalur: klaim faskes (M7, `/portal/klaim`) **atau** daftar mitra fasilitas (`/portal/mitra`) | Dua pintu untuk tujuan yang sama | G |
| Fasilitas | Ajukan harga | Ajukan → sumber wajib → unggah bukti → moderasi | Wajar untuk P1 | U |
| Fasilitas | Tautkan dokternya | Lewat jadwal praktik dengan praktisi | Tidak ada panduan di portal | N |
| Moderator | Proses antrean | 6 halaman: `/admin/mitra`, `/admin/klaim`, `/admin/moderasi` (5 tab), `/admin/laporan`, `/admin/impor`, `/admin/tarif` | Antrean tersebar; satu antrean adalah lingkup Fase 7 | N |
| Moderator | Setujui video dokter | Tab Media → pratinjau → setujui | Tidak ada pemeriksaan persetujuan tertulis | G |
| Moderator | Tinjau artikel | Tab Artikel → halaman tinjau dengan temuan M17 | Baik | U |

## 4. Skor lima dimensi

| Dimensi | Skor | Bukti utama | Yang menurunkan skor |
| --- | --- | --- | --- |
| A. Detail | 3 | Tarif: tanggal, sumber, verifikasi, termasuk/tidak, paket, riwayat (`tariff-card.tsx`). Dokter: STR, jadwal per tempat, video | Tanpa rawat inap dan konsultasi dokter; profil dokter tanpa pendidikan/pengalaman (Tahap B 4b ditunda); **semua data adalah data contoh**, cakupan data nyata Malang Raya = 0 |
| B. Jelas | 3 | Lencana dengan popover, "Tarif belum tersedia", tanda usang, penafian harga (`messages/id.ts:40`) | Tidak ada "perkiraan"; banding tanpa sumber; "Diisi faskes" untuk mitra non-faskes; deskripsi situs masih "laboratorium dan medical check-up" saja (`id.ts:8–10, 35`) dan tidak menyebut dokter |
| C. Compact | 2 | 47 halaman, 36 tabel, 7 role, 4 jenis mitra | Dua sistem artikel (Sanity + mitra), dua jalur onboarding faskes, kategori rumah duka dan gaya hidup tanpa kaitan pilar, JWT tanpa klien non-browser, role apotek tanpa fitur |
| D. Memudahkan | 3 | 390 px tanpa geser mendatar (laporan Fase 2–4b), form GET jalan tanpa JS, pencarian toleran salah ketik (pg_trgm), "Dekat saya" | LCP belum pernah diukur; video tanpa poster; onboarding dokter 3 jeda moderasi tanpa notifikasi |
| E. Integritas USP | 3 | Tidak ada kolom pembayaran di query dan ada uji statis (`apps/api/test/fase3-search.test.ts:297`); `published_tariffs` satu sumber; aturan tampil dokter `publicPractitionerCondition`; M17 di semua teks mitra | **Uji integrasi Fase 1–4b belum pernah dijalankan** (laporan hasil tiap fase); video bisa tayang tanpa persetujuan tercatat |

## 5. Inventaris compact

| Butir | Keputusan | Alasan |
| --- | --- | --- |
| Tarif bersumber, banding, cari, profil faskes, profil dan daftar dokter, video, moderasi | PERTAHANKAN | Inti P1 dan P2 |
| Artikel mitra (Fase 4) | PERTAHANKAN | Pilar konten "Edukasi singkat" dan kredibilitas dokter |
| Artikel editorial Sanity | SEMBUNYIKAN (setelah ada artikel mitra) | Sistem konten kedua yang perlu dirawat; bisa tetap hidup untuk halaman statis |
| Klaim faskes (M7) + mitra fasilitas | GABUNG | Satu pintu "Daftarkan fasilitas" yang memakai alur klaim bila faskes sudah ada di direktori |
| Kategori rumah duka dan gaya hidup | SEMBUNYIKAN dari beranda dan filter sampai ada mitra | Tidak menopang P1–P3 untuk demo; data tetap |
| Role dan portal apotek | SEMBUNYIKAN pilihan "Apotek" di `/daftar` | Tidak ada fitur apotek sebelum Fase 9 |
| JWT `/v1/auth/token` | PERTAHANKAN, tanpa pengembangan | Sudah jadi dan diaudit; belum ada klien |
| Halaman `/layanan/[slug]` vs `/bandingkan/[service]` | PERTAHANKAN, cek tumpang tindih setelah demo | Ringkasan wilayah dan tabel banding berbeda fungsi |
| Fase 8, 9B, 10 | TUNDA | Tidak relevan dengan USP pra-transaksi; gate hukum berat |
| Form daftar dokter | GABUNG langkah | Lihat rekomendasi 9 |

## 6. SRS dan fase vs USP, jalur demo

| SRS / Fase | Kontribusi | Risiko ke USP | Prioritas usulan |
| --- | --- | --- | --- |
| F-01 / Fase 1 Akun | Pendukung | – | Selesai |
| F-02 / Fase 2 Profil, video | P1, P2 | Video tanpa persetujuan | Selesai, perlu R5–R7 |
| F-03 / Fase 3 Cari | P1 | – | Selesai |
| 4b Profil dokter | P2 | – | Selesai, perlu R3–R4 |
| F-05 / Fase 4 Artikel | Pendukung (kredibilitas) | – | Selesai |
| F-09, F-11 / Fase 5 Notifikasi | Pendukung (onboarding dokter) | – | Setelah butir P1/P2 demo |
| F-08 / Fase 6 Ulasan | **P3** | Testimoni tanpa izin hukum | **Naik**, versi ramping sebelum demo, flag hanya di demo |
| F-10 / Fase 7 Admin | Pendukung | – | Setelah demo |
| F-04 / Fase 8 AI chat | Tidak relevan | Bergeser ke "konsultasi" | Tunda |
| F-06 / Fase 9A Katalog | Tidak relevan | Melebarkan fokus | Tunda, ubah bentuk |
| F-06 / Fase 9B Pesanan | Tidak relevan | Bertentangan dengan "pra-transaksi" | Tunda |
| F-07 / Fase 10 Catatan kesehatan | Tidak relevan | Data sensitif | Tunda |
| Langganan / Fase 11 | Pendukung (trial dokter) | Pengaruh ke urutan | Setelah demo, desain 2d |
| Fase 12 Hardening | Pendukung | – | Sebagian sebelum demo (uji integrasi, LCP) |

**Jalur demo 20 Desember** (±40 hari):

| Butir wajib | Data contoh | Usaha |
| --- | --- | --- |
| Uji integrasi Fase 1–4b dijalankan dan hijau | DB uji `test_silk` | S (langkah manual Anda) + perbaikan bila gagal |
| Label perkiraan dan sumber (R2) | – | S |
| Biaya konsultasi dokter (R3) | Tarif konsultasi untuk 3–5 dokter contoh | S–M |
| Profil dokter: video dan biaya di atas lipatan, poster (R4, R5) | – | S |
| Persetujuan video tercatat (R6) | Formulir persetujuan bertanda tangan | M |
| 3–5 profil dokter dengan video sungguhan (R7) | Video 30–60 dtk + persetujuan | S teknis; produksi video oleh tim |
| Ulasan pengalaman versi demo (R8) | ±20 ulasan fiktif berlabel "Data contoh" | M–L |
| Rawat inap dan lab di banding (R9) | Tarif kamar per malam di RS contoh | S |
| **Aman ditunda:** Fase 5, 7, 8, 9, 10, 11; email SMTP; Tahap B profil dokter | | |

## 7. Rekomendasi

Format: masalah (bukti) → usulan → pilar → usaha → risiko → perlu izin.

**QUICK WIN (< 1 hari)**

| # | Masalah → usulan | Pilar | Usaha | Risiko | Izin |
| --- | --- | --- | --- | --- | --- |
| R1 | Uji integrasi belum pernah jalan (laporan hasil Fase 1–4b) → buat `test_silk` di branch Neon khusus uji, jalankan `corepack pnpm --filter @silk/api test`, perbaiki yang gagal | Semua (E) | S | Uji mengosongkan DB bila salah arah; guard Fase 0 menahan | Tidak; langkah manual Anda |
| R2 | Tidak ada "perkiraan" dan sumber di banding (`comparison-table.tsx`) → label "Perkiraan biaya" di harga publik, sumber di tabel banding, "Diisi mitra" untuk non-faskes, deskripsi situs menyebut dokter | P1 | S | Teks publik harus lolos M17 | Teks publik (konfirmasi) |
| R3 | Dokter tidak punya biaya konsultasi (`seed/data.ts`) → kategori `konsultasi` dengan layanan konsultasi dokter umum dan spesialis; "Biaya konsultasi" di kartu dan header profil dokter | P1+P2 | S–M | Harga lewat alur permintaan harga yang ada | Kategori baru (data), field aditif di daftar dokter |
| R4 | Di ponsel video dan biaya di bawah lipatan (`dokter/[slug]/page.tsx:118, 205`) → urutan baru sesuai wireframe bagian 8 | P2 | S | – | Tidak |
| R5 | Batas 120 dtk dan tanpa poster (Fase 2) → 20–90 dtk, ≤ 50 MB, poster wajib | P2 | S | Video lama > 90 dtk (belum ada) | Perubahan validasi (kontrak) |

**PERBAIKAN (1–3 hari)**

| # | Masalah → usulan | Pilar | Usaha | Risiko | Izin |
| --- | --- | --- | --- | --- | --- |
| R6 | Persetujuan tertulis tidak tersimpan (`profile_media`) → `media_consents` + syarat sebelum setujui video + pencabutan | P2 | M | Bila dilewati, video demo melanggar syarat USP | Skema baru |
| R7 | Tidak ada video di data demo → seed 3–5 dokter contoh dengan video dan persetujuan (berkas di penyimpanan lokal atau R2 dev) | P2 | S | Video sungguhan berisi orang sungguhan: wajib R6 | Tidak |
| R8 | P3 kosong → Fase 6 ramping: rating, tag pengalaman (2c), komentar pra-moderasi, label "Ulasan pengguna, tidak diverifikasi"; flag ON hanya di lingkungan demo | P3 | M–L | Gate hukum produksi tetap OFF | Skema, kontrak API |
| R9 | Rawat inap tidak ada → kategori `rawat-inap` dengan layanan "Kamar kelas 1/2/3/VIP (per malam)" | P1 | S | Biaya total rawat inap tidak bisa diperkirakan; tampilkan per malam dan beri catatan | Kategori baru (data) |

**STRATEGIS (butuh keputusan Anda)**

| # | Masalah → usulan | Pilar | Usaha | Risiko | Izin |
| --- | --- | --- | --- | --- | --- |
| R10 | Onboarding dokter 3 jeda moderasi, tanpa notifikasi; urutan fase belum mengikuti USP → (a) satu wizard dokter: data mitra + profil + video diajukan sekali, moderator meninjau sekaligus; (b) urutan fase: R1–R9 → Fase 5 → Fase 7 → Fase 12 → setelah demo: 11, 9A; tunda 8, 9B, 10 | P2, semua | M (wizard) | Wizard menyentuh alur verifikasi mitra | Auth/otorisasi (alur verifikasi) |

Aturan satu masuk satu keluar: R3, R6, R8, R9 langsung memperkuat pilar. R10 menggabungkan langkah, bukan menambah fitur. Kandidat keluar ada di bagian 5 (Sanity, pilihan Apotek, kategori non-pilar di beranda).

## 8. Wireframe halaman inti

**Profil dokter (pesan: "kenal dokternya, tahu biayanya")**
```
[Foto/inisial] dr. Nama, Sp.A · Anak · Kota Malang
[Lencana STR terverifikasi] [Mitra terverifikasi]
┌──────────── VIDEO 16:9 (poster) ───────────┐   ← di atas lipatan, juga di ponsel
└────────────────────────────────────────────┘
Biaya konsultasi  Rp150.000  · Perkiraan dari mitra · berlaku 1 Okt 2026 · [Bandingkan]
Pengalaman pasien ★ 4,6 (12) · Kenyamanan · Keramahan staf · Waktu tunggu   (bila flag ON)
[Telepon] [WhatsApp] [Petunjuk arah]
── di bawah lipatan: jadwal per tempat · tempat praktik + peta · tarif lain · tentang · artikel
Dibuang: tombol "Salin tautan" pindah ke menu bagikan; STR teks penuh pindah ke popover lencana
```

**Hasil pencarian / perbandingan biaya (pesan: "bandingkan biaya sebelum datang")**
```
[Layanan: Konsultasi dokter anak ▼] [Kota ▼] [Dekat saya] [Urutkan: relevan ▼]
Perkiraan biaya dari mitra. Urutan tidak dipengaruhi pembayaran.
┌ Kartu ─────────────────────────────────────────┐
│ Faskes/Praktik · Kota · 1,2 km                  │
│ Rp150.000  Perkiraan · Diisi mitra · 1 Okt 2026 │
│ Dokter: [foto] dr. Nama ▶ video  · ★ (flag)     │
└─────────────────────────────────────────────────┘
Tarif belum tersedia (kelompok terpisah)
Dibuang dari kartu: alamat lengkap (cukup kota + jarak)
```

**Halaman fasilitas (pesan: "biaya dan pengalaman di satu tempat")**
```
Nama · Jenis · Kota · [Telepon] [Petunjuk arah]
Tarif utama (3 teratas menurut kategori) · Perkiraan · sumber · tanggal · [Lihat semua] [Bandingkan]
Dokter yang praktik di sini (kartu dengan tanda video)
Pengalaman pasien (flag)
── bawah: galeri, jam buka, lokasi lain, riwayat harga, lapor data
```

## 9. Pertanyaan untuk Anda

1. Rekomendasi mana yang disetujui (R1–R10)? Saran saya untuk minggu ini: R1–R5, lalu R6–R7.
2. Rencana Fase 5 (`docs/enablement/05-rencana-fase-5.md`) masih menunggu persetujuan. Ditunda sampai butir jalur demo selesai (saran saya), atau tetap dikerjakan sekarang?
3. Apakah demo 20 Desember memakai lingkungan terpisah dari produksi, sehingga `reviews_enabled` boleh ON dengan data contoh?
4. Video contoh: dari dokter sungguhan (wajib persetujuan tertulis, R6) atau pemeran dengan label "Contoh"? Siapa yang menyimpan formulir persetujuannya?
5. Batas video 20–90 dtk dan ≤ 50 MB, setuju?
6. Konfirmasi bahwa video, foto, jadwal, dan biaya tidak pernah menjadi fitur berbayar (2d).
7. Kalimat USP final: tetap "Tahu biayanya, kenal dokternya, sebelum datang", atau "Cek biaya, kenali dokter, baru pilih" bila P3 tidak siap untuk demo?

## 10. Hasil penerapan (10 November 2026)

Pemilik mendelegasikan keputusan ("jalankan sesuai referensi terbaik"). Jawaban bawaan untuk bagian 9 ada di 10.4. Satu rekomendasi = satu commit; uji ditulis bersamaan; `typecheck`, `lint`, dan uji unit hijau di setiap commit (shared 176, db 20, web 290).
**Uji integrasi API (`apps/api/test`) sudah ditulis untuk R3, R5–R8 tetapi belum dijalankan** (menunggu R1).

### 10.1 Status rekomendasi

| # | Status | Commit | Yang dikerjakan / catatan |
| --- | --- | --- | --- |
| R1 | **Ditunda (langkah manual Anda)** | – | Butuh DB uji: branch Neon khusus uji, atau Postgres lokal dengan PostGIS (belum terpasang di mesin ini). Uji integrasi mengosongkan DB, jadi tidak dijalankan ke DB yang ada di `.env` |
| R2 | Selesai | `4181d0a` | Label "Perkiraan" + penjelasan di kartu tarif, kartu hasil, dan tabel banding; sumber di tabel banding; "Diisi mitra"; tagline, deskripsi situs, dan hero memuat kalimat USP. Uji M17 untuk seluruh teks pesan |
| R3 | Selesai | `9bb2b46` | Kategori `konsultasi` (umum, spesialis, gigi). Biaya konsultasi di kartu dan header profil dokter, dari VIEW `published_tariffs` (field aditif `consultation`). Tiga dokter contoh tambahan dengan profil praktik dan tarif konsultasi |
| R4 | Selesai | `9d07a72` | Video (ketuk-untuk-putar, poster tanpa unduh video) dan biaya konsultasi di atas lipatan, juga di ponsel; tarif lain tanpa duplikasi konsultasi |
| R5 | Selesai, dengan deviasi | `62ed142` | 20–90 dtk, ≤ 50 MB, dicek di browser, presign, dan dari header MP4 saat konfirmasi. **Deviasi:** "poster wajib" dipenuhi dengan poster otomatis (foto dokter, atau inisial), bukan unggahan poster terpisah |
| R6 | Selesai | `62ed142` | Tabel `media_consents` (migrasi 0009). Pernyataan di akun hanya untuk tenaga medis yang tampil sendiri; selain itu formulir bertanda tangan (PDF/JPEG/PNG ≤ 5 MB, diperiksa magic bytes). Moderator tidak bisa menyetujui video tanpa persetujuan aktif; video lama tanpa persetujuan disembunyikan dari publik; hapus video = cabut persetujuan. Semua tercatat di audit log |
| R7 | Selesai (teknis); video oleh tim | `4308eef` | Bukan seed (video dan formulir memuat data pribadi): skrip `demo-videos` membaca `demo-media/` (di-gitignore), memeriksa berkas seperti portal, lalu memasukkan ke antrean moderasi atau langsung disetujui lewat `--moderator`. Panduan, brief rekaman, dan templat formulir: `docs/demo-video.md` |
| R8 | Selesai, versi ramping | `a25e606` | Tabel `reviews` (migrasi 0010): bintang 1–5, lima aspek P3 bernilai baik/kurang, komentar pra-moderasi lewat M17, label "Ulasan pengguna, tidak diverifikasi", satu ulasan per akun pasien per profil, pasien bisa ubah/hapus. 24 ulasan "Data contoh" di seed demo. Data contoh tidak masuk `facility_ratings`. Flag OFF = semua rute 404, UI kosong |
| R9 | Selesai | `9bb2b46` | Kategori `rawat-inap`: kamar kelas 3/2/1/VIP (per malam) di RS contoh, sebagian berupa rentang |
| R10 | (b) dicatat, (a) ditunda | – | Urutan fase di 10.3. Wizard dokter menyentuh alur verifikasi mitra (auth/otorisasi), jadi butuh izin eksplisit dan rencana tersendiri |

Perubahan yang menyentuh daftar "perlu izin" di CLAUDE.md, semuanya aditif:
- **Tabel baru:** `media_consents`, `reviews`. Tidak ada tabel terbit yang diubah.
- **Kontrak API:**
  - field baru `consultation`;
  - presign video kini wajib `consent` dan berdurasi 20–90 dtk;
  - rute ulasan baru.
- **Matriks izin:** satu izin baru, `review.write` (pasien).

Tidak ada dependensi baru.

### 10.2 Skor ulang

| Dimensi | Sebelum | Sesudah | Alasan |
| --- | --- | --- | --- |
| A. Detail | 3 | 4 | Konsultasi dokter, rawat inap, rincian persetujuan video, aspek pengalaman per profil. Masih: semua data adalah data contoh; profil dokter tanpa pendidikan/pengalaman (Tahap B) |
| B. Jelas | 3 | 4 | "Perkiraan" di setiap harga berangka, sumber di banding, "Diisi mitra", label "tidak diverifikasi" dan "Data contoh", situs menyebut dokter |
| C. Compact | 2 | 2 | Fitur bertambah (persetujuan, ulasan), belum ada yang dikeluarkan dari bagian 5 (Sanity, pilihan Apotek, dua pintu faskes, kategori non-pilar di beranda) |
| D. Memudahkan | 3 | 3 | Video dan biaya di atas lipatan; poster tanpa unduh video. Masih: onboarding dokter 3 jeda moderasi tanpa notifikasi; LCP belum diukur |
| E. Integritas USP | 3 | 3 → 4 setelah R1 hijau | Persetujuan video ditegakkan di query publik dan saat moderasi; data contoh tidak pernah memengaruhi rating; urutan tetap netral. Skor tertahan karena uji integrasi belum pernah jalan |

Pilar:
- **P1:** sebagian kuat → **kuat**.
- **P2:** fondasi ada → **fondasi + persetujuan**; tinggal video sungguhan dari tim.
- **P3:** klaim kosong → **ada di balik flag**, bisa didemokan dengan data contoh berlabel; produksi tetap OFF sampai opini hukum.

### 10.3 Urutan fase (R10b)

1. Selesaikan jalur demo: R1, migrasi 0009 dan 0010 ke DB dev/demo, video tim (R7), dan flag `reviews_enabled` ON hanya di lingkungan demo (API dan web memakai `FEATURE_FLAGS` yang sama).
2. Fase 5 (notifikasi): memperpendek jeda tunggu onboarding dokter; juga notifikasi ulasan baru untuk mitra.
3. Fase 7 (satu antrean admin): menggabungkan tab moderasi, termasuk ulasan.
4. Fase 12 (hardening): uji integrasi di CI, ukur LCP.
5. Setelah demo: Fase 11 (langganan, tanpa memengaruhi tampilan publik; 2d) dan 9A versi informasional.
6. Ditunda: Fase 8, 9B, 10. Fase 6 penuh (opini hukum, kebijakan moderasi tertulis) mengikuti gate hukumnya.

### 10.4 Jawaban bawaan untuk bagian 9

Silakan koreksi.

1. Rekomendasi: R1–R9 dikerjakan; R10(b) dicatat; R10(a) ditunda.
2. Fase 5 ditunda sampai jalur demo selesai.
3. Demo diasumsikan memakai lingkungan terpisah dari produksi; `reviews_enabled` hanya ON di sana.
4. Video: keduanya didukung. Sarannya dokter sungguhan dengan formulir persetujuan. Formulir disimpan tim di luar git, dan salinannya ada di penyimpanan privat (bukan publik).
5. Batas video 20–90 dtk dan ≤ 50 MB sudah diterapkan.
6. Video, foto, jadwal, dan biaya tetap gratis. Belum ada kode langganan, jadi belum ada yang perlu dikunci.
7. Kalimat USP tetap "Tahu biayanya, kenal dokternya, sebelum datang", karena P3 sudah bisa didemokan. Bila flag tidak boleh ON di demo, pakai "Cek biaya, kenali dokter, baru pilih."

### 10.5 Langkah manual yang tersisa

- **R1:**
  1. Buat branch Neon khusus uji (atau Postgres lokal + PostGIS).
  2. Jalankan `TEST_DATABASE_URL=… corepack pnpm --filter @silk/api test`.
  3. Perbaiki yang gagal.
- **Migrasi:** jalankan `corepack pnpm db:migrate` ke DB dev/demo saja (0009, 0010), lalu `corepack pnpm db:seed:demo`.
- **Video demo:** rekam 3–5 video sesuai `docs/demo-video.md`, kumpulkan formulir, lalu jalankan `corepack pnpm --filter @silk/api demo-videos -- --moderator <email>`.
- **Lingkungan demo:** `FEATURE_FLAGS=reviews_enabled` untuk API dan web. Produksi tetap kosong.
