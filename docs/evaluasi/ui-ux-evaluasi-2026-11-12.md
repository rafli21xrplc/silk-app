# Evaluasi UI/UX SILK (12 November 2026)

## Ringkasan

Dasar visual SILK sudah rapi:
- tipografi tegas dan palet hijau-mint yang tenang;
- kartu konsisten, tidak ada geser-samping di ponsel;
- halaman masuk, katalog layanan, dan tabel banding sudah bagus.

Masalahnya ada pada isi yang tampil, bukan gaya. Ada dua keluhan pemilik:

1. **Komponen terlihat kosong.** Pada data demo, banyak komponen tidak punya isi untuk ditampilkan, dan desainnya tidak menyiapkan keadaan itu:
   - kartu hasil `/cari` tanpa harga;
   - separuh kanan header profil dokter kosong saat tidak ada video;
   - kartu dokter tanpa biaya berlubang besar.
2. **Terlalu banyak ikon, tanpa gambar.** Tidak ada satu pun foto di halaman publik. Semua "visual" adalah ikon: 22 sampai 179 ikon per halaman, nol gambar. Akibatnya halaman terasa seperti kerangka, dan pilar USP **"kenal dokternya"** tidak terlihat sama sekali.

Temuan paling berdampak terhadap USP: **mengetik "hemoglobin" di kotak cari tidak menampilkan harga satu pun**. Harga baru muncul bila pengguna memilih filter "layanan" secara manual.

## 1. Metode

- **Halaman:** 19 halaman publik di dua ukuran, desktop 1366 px dan ponsel 390 px. Tangkapan layar penuh dan di atas lipatan, memakai data demo lokal (seed demo + flag ulasan ON).
- **Pengukuran:** jumlah ikon SVG dan gambar di `<main>` (peta tidak dihitung).
- **Tidak dievaluasi:** portal mitra dan admin (butuh akun); dinilai terpisah.

| Halaman | Ikon | Gambar | Kata |
| --- | --- | --- | --- |
| Beranda `/` | 32 | 0 | 208 |
| Cari faskes `/cari` | 57 | 0 | 366 |
| Cari dokter `/dokter` | 34 | 0 | 321 |
| Profil RS `/faskes/rs-contoh-kepanjen` | **179** | 0 | 1.713 |
| Profil dokter `/dokter/dr-contoh-rahma-putri-sp-a` | 71 | 0 | 699 |
| Katalog `/layanan` | 135 | 0 | 655 |
| Artikel `/artikel` | 22 | 0 | 231 |

Tinggi halaman di ponsel:
- profil RS 11.790 px (± 14 layar);
- katalog layanan 9.704 px;
- `/cari` 5.980 px.

## 2. Temuan

Tingkat: **Kritis** (merusak USP), **Tinggi** (terlihat jelas kosong atau berantakan), **Sedang**, **Rendah**.

### A. Komponen yang terlihat kosong

| # | Tingkat | Di mana | Yang terlihat | Penyebab |
| --- | --- | --- | --- | --- |
| A1 | **Kritis** | `/cari?q=hemoglobin` | Setiap kartu hanya memuat nama, alamat, dan bar "Tarif layanan →" kosong. Tidak ada angka di 20 kartu | Harga hanya dihitung bila parameter `service` diisi. Kata kunci yang persis nama atau alias layanan tidak dipetakan ke layanan itu |
| A2 | Tinggi | `/cari` tanpa kata kunci | Sama: 20 kartu identik tanpa angka, padahal tiap faskes punya 8–18 tarif | Kartu tidak punya ringkasan seperti "18 tarif · mulai Rp14.000" |
| A3 | Tinggi | Header profil dokter | Kolom kanan (tempat video) kosong; separuh kartu putih di desktop | Video hanya dirender bila ada, dan semua dokter demo belum punya video |
| A4 | Tinggi | Kartu di `/dokter` | Dokter tanpa biaya konsultasi menyisakan ruang kosong ± 200 px, karena tinggi kartu disamakan per baris | Kotak biaya dihilangkan, bukan diganti keterangan "belum dicantumkan" |
| A5 | Sedang | Dokter tanpa praktik utama (`/dokter/dr-contoh-satu`) | Header hanya berisi nama dan "Salin tautan". Tidak ada biaya, telepon, atau ulasan, padahal kliniknya punya telepon dan tarif. Satu-satunya tempat praktik berlabel "Juga praktik di" | Semua blok header bergantung pada `primary` |
| A6 | Sedang | Faskes tanpa tarif atau ulasan | Dua kotak kosong berturut-turut tanpa jalan keluar bagi pasien | Kotak kosong tidak menawarkan faskes serupa terdekat atau tautan ke layanan |
| A7 | Sedang | `/layanan` | 5 kartu "Belum ada tarif terbit" (Rumah duka ×3, Gaya hidup ×2) | Kategori tanpa data tetap tampil penuh |
| A8 | Rendah | Detail layanan | Bagian tengah hero kosong lebar; daftar faskes baru ada setelah klik "Bandingkan" | Tidak ada pratinjau 3 harga terendah dan tertinggi |
| A9 | Rendah | `/tentang` | Empat paragraf, tanpa visual, tanpa tim, tanpa cara kerja | Halaman belum dikembangkan |

### B. Ikon berlebih, tanpa gambar

| # | Tingkat | Di mana | Yang terlihat |
| --- | --- | --- | --- |
| B1 | **Tinggi** | Semua halaman publik | **0 gambar.** Tidak ada foto dokter, foto faskes, sampul artikel, atau ilustrasi produk. Seluruh visual berasal dari ikon garis berwarna pastel |
| B2 | Tinggi | Hero beranda | Lima ubin ikon melayang (tetes, tabung, papan klip, hati) dan sebuah kartu "Status verifikasi" berisi garis abu-abu. Kartu itu terlihat seperti komponen yang belum selesai dimuat (skeleton). Visual pertama situs tidak menunjukkan produknya |
| B3 | Tinggi | Kartu artikel | 7 sampul dengan pola yang sama: gradasi pastel, titik-titik, dan satu ikon kecil di tengah. Antarkartu hanya beda warna, dan sampul mengambil 45% tinggi kartu tanpa informasi |
| B4 | Tinggi | Avatar dokter | Semua inisial diawali "C" (CA, CB, CD, CD, CR, CS, CS) karena nama demo "dr. Contoh …". Dua kartu sama-sama "CD", jadi kartu tidak bisa dibedakan sekilas |
| B5 | Sedang | Ubin "Jelajahi pemeriksaan" (beranda) dan `/layanan` | Ikon tidak cocok dengan maknanya: tabung reaksi untuk *Kelas senam*, *Sesi latihan pribadi*, dan semua *Kamar rawat inap*. Ikon stetoskop yang sama dipakai tiga kali berurutan. Beranda juga dibuka dengan layanan gaya hidup, bukan lab, konsultasi, atau rawat inap |
| B6 | Sedang | Kartu tarif (faskes dan dokter) | 6–8 ikon per kartu: kategori, perisai verifikasi, kalender, jam, timbangan "Bandingkan", bendera "Laporkan", jam "Riwayat harga", panah. Di RS ada 18 kartu, total 179 ikon |
| B7 | Rendah | Hero `/layanan` dan `/artikel` | Ikon dekoratif raksasa (mikroskop, buku) berwarna pudar, mengisi ruang tanpa makna |

### C. Hierarki USP ("tahu biayanya, kenal dokternya, sebelum datang")

| # | Tingkat | Temuan |
| --- | --- | --- |
| C1 | **Kritis** | **Beranda tidak menampilkan satu dokter pun dan satu harga pun.** Kalimat USP ada di judul, tetapi tidak ada bukti di bawahnya. Bagian "Tanggal berlaku / Sumber / Status verifikasi" muncul **dua kali**: tiga kartu, lalu "Cara membaca data SILK" dengan isi yang sama |
| C2 | Tinggi | Halaman faskes **tidak menampilkan dokter yang praktik di sana.** "Praktik Dokter Contoh Arjosari" tidak menyebut nama dokternya; RS dan klinik juga tidak |
| C3 | Tinggi | Ponsel, halaman faskes: tarif (inti USP) baru muncul setelah ± 1,5 layar. Urutannya identitas → alamat → jam buka 7 baris → peta → disclaimer → tarif |
| C4 | Tinggi | RS: 18 kartu tarif datar, tanpa pengelompokan kategori, tanpa lompat ke "Rawat inap" atau "Lab", tanpa pencarian di halaman |
| C5 | Sedang | Kotak disclaimer kuning muncul di setiap daftar harga, dengan bobot visual setara peringatan. Pengguna cepat kebal; sebaiknya satu baris kecil di dekat harga pertama |
| C6 | Sedang | Kartu hasil `/cari` tidak menunjukkan apakah faskes punya dokter, video, atau ulasan. Satu-satunya pembeda antarkartu adalah nama |

### D. Konsistensi dan detail

| # | Tingkat | Temuan |
| --- | --- | --- |
| D1 | Sedang | Kartu ulasan contoh menulis "Data contoh" dua kali: sebagai nama penulis dan sebagai lencana |
| D2 | Sedang | Lencana "Contoh dev" tampil publik di daftar artikel; semua artikel "1 menit baca" |
| D3 | Sedang | Halaman bisa menampilkan data lama (ISR, revalidasi 1 jam). Dua tangkapan pertama selama evaluasi menunjukkan isi usang: tempat praktik dan tarif konsultasi hilang. Di produksi ini tertangani revalidasi per tag; di lokal tanpa `REVALIDATE_SECRET` tidak |
| D4 | Rendah | Kartu tarif: "Riwayat harga" berada di baris sendiri di bawah "Bandingkan · Laporkan", sehingga kartu lebih tinggi ± 30 px |
| D5 | Rendah | Lencana "Belum diverifikasi" abu-abu di hampir semua tarif demo melemahkan kesan "data terpercaya". Pertimbangkan data demo yang lebih banyak berstatus "dari dokumen publik" |

### E. Yang sudah baik (pertahankan)

- Tabel banding `/bandingkan/*`: jelas, padat, dan setiap angka punya konteks.
- Detail layanan: rentang per wilayah dengan median dan penanda pada batang.
- Ringkasan ulasan: bintang, per-aspek "x dari y menilai baik", dan label "tidak diverifikasi" yang jujur.
- Kotak biaya konsultasi di profil dokter: angka besar, "Perkiraan", sumber, tanggal, dan catatan "obat ditagih terpisah".
- Bilah aksi melekat di ponsel (Telepon · Petunjuk arah).
- Halaman masuk: rapi dan ramah.
- Tidak ada geser-samping di 19 halaman × 2 ukuran.

## 3. Skor per halaman

Skor 1–5: 5 = siap demo, 3 = berfungsi tetapi terasa kosong atau berat, 1 = merusak kesan.

| Halaman | Visual | Kejelasan | USP | Catatan utama |
| --- | --- | --- | --- | --- |
| Beranda | 3 | 3 | **2** | Tanpa dokter dan harga; hero berisi ikon; konten ganda |
| Cari faskes | 2 | 3 | **2** | Kartu tanpa angka (A1, A2) |
| Cari dokter | 3 | 4 | 4 | Kartu berlubang (A4), inisial seragam (B4) |
| Profil dokter | 3 | 4 | 3 | Separuh header kosong (A3) |
| Profil faskes | 3 | 3 | 3 | Tanpa dokter (C2), tarif jauh di ponsel (C3), 18 kartu datar (C4) |
| Katalog layanan | 4 | 4 | 4 | Ikon salah (B5), kategori kosong (A7) |
| Detail layanan | 4 | 5 | 4 | Hero lowong (A8) |
| Banding | 4 | 5 | 5 | Contoh terbaik saat ini |
| Artikel | 2 | 4 | 3 | Sampul ikon seragam (B3) |
| Masuk/Daftar | 5 | 5 | – | – |
| Tentang | 2 | 4 | 2 | Tipis (A9) |

## 4. Rekomendasi berprioritas

### P0: sebelum demo 20 Desember

1. **Kata kunci = layanan → harga di kartu** (A1).
   - Bila `q` cocok persis dengan nama atau alias satu layanan, perlakukan sebagai `service`.
   - Harga, "Perkiraan", dan sumber langsung tampil di setiap kartu.
   - Beri chip "Menampilkan harga Hemoglobin · ubah" agar transparan.
2. **Ringkasan di kartu `/cari` tanpa layanan** (A2, C6). Ganti bar kosong "Tarif layanan" dengan ringkasan nyata, misalnya:
   - "18 tarif · konsultasi Rp85.000";
   - "3 dokter · 1 video";
   - "★ 3,7 (3)".
3. **Header dokter tanpa video** (A3).
   - Desktop satu kolom penuh: kotak biaya dan kontak berdampingan.
   - Atau tampilkan bingkai "Video perkenalan belum tersedia" bergaya poster dengan foto atau inisial besar, agar ruang terisi dan pembaca tahu fitur ini ada.
4. **Kartu dokter tanpa biaya** (A4). Tampilkan kotak abu-abu tipis "Biaya konsultasi belum dicantumkan · tanyakan ke tempat praktik", agar tinggi seragam dan kekosongannya terjelaskan.
5. **Gambar nyata** (B1, B4).
   - Foto dokter untuk 3–5 dokter demo yang videonya direkam: ambil frame dari video yang sama, sesuai persetujuan.
   - Avatar cadangan memakai warna stabil per nama.
   - Inisial dari nama inti, tanpa gelar dan tanpa "Contoh" di data demo, atau ganti nama demo menjadi bervariasi.
6. **Beranda membuktikan USP** (C1, B2).
   - Ganti kolase ikon di hero dengan **pratinjau produk nyata**: satu kartu dokter (foto, biaya konsultasi, tombol putar video) dan satu baris harga.
   - Ganti salah satu dari dua bagian "tanggal/sumber/verifikasi" dengan **"Kenalan sama dokter"** (3 kartu dokter) dan **"Perkiraan biaya populer"** (hemoglobin, konsultasi umum, rawat inap kelas 3, beserta rentangnya).

### P1: setelah demo, atau bila waktu cukup

7. **Halaman faskes:**
   - tambahkan bagian "Dokter di sini" (C2);
   - kelompokkan tarif per kategori dengan tab atau lompatan (C4);
   - di ponsel, letakkan tarif sebelum jam buka dan peta, dan lipat jam buka menjadi "Buka hari ini 08.00–21.00 ›" (C3).
8. **Kartu tarif ringkas** (B6, D4). Satu baris aksi:
   - "Bandingkan" sebagai tombol;
   - "Riwayat" dan "Laporkan" dalam menu ⋯;
   - konteks kepercayaan dalam satu baris teks tanpa ikon per atribut;
   - target: ± 3 ikon per kartu.
9. **Audit ikon** (B5, B7).
   - Satu ikon per makna, perbaiki ikon yang salah (gaya hidup, rawat inap).
   - Hapus ikon dekoratif raksasa di hero.
   - Urutkan kategori menurut USP: Konsultasi → Laboratorium → MCU → Radiologi → Rawat inap → lainnya.
10. **Kategori dan layanan tanpa data** (A7). Lipat menjadi satu baris "Segera hadir: Rumah duka, …", jangan tampil sebagai kartu kosong.
11. **Kotak kosong yang menuntun** (A6). Untuk "Belum ada tarif", sertakan tautan ke faskes serupa terdekat dan ke "Klaim profil".

### P2

12. Disclaimer dijadikan satu baris kecil di dekat harga pertama (C5).
13. Sampul artikel: foto atau ilustrasi per topik, atau tanpa sampul dengan tata letak teks (B3). Sembunyikan "Contoh dev" dari publik (D2).
14. "Data contoh" cukup sebagai lencana, bukan juga sebagai nama (D1).
15. Halaman Tentang: cara kerja dalam 3 langkah bergambar, tim, dan kontak (A9).

## 5. Dampak yang diharapkan

P0 saja (± 2–3 hari kerja) menutup kedua keluhan pemilik di halaman yang dilihat saat demo:
- beranda, `/cari`, `/dokter`, dan profil dokter tidak lagi tampak kosong;
- bukti USP terlihat di layar pertama, yaitu harga, dokter, dan video;
- gambar nyata muncul begitu foto dan video dokter dari tim masuk.

Tangkapan layar evaluasi disimpan di luar repo (scratchpad sesi), karena berisi data demo.
