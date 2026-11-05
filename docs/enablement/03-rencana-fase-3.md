# Rencana Fase 3: pencarian dan filter (F-03)

Branch `enablement/fase-3` (dari `enablement/fase-2`). Status: **menunggu persetujuan**.

## 1. Kondisi sekarang

**API `GET /v1/facilities`** (`m1-directory/directory.repo.ts`)
- Parameter yang ada:
  - `q` (trigram nama faskes, nama layanan, alias)
  - `city`, `type`, `service`
  - `lat`/`lng`/`radius`
  - `sort` = `price_asc | price_desc | name | distance`
  - kursor offset
- Urutan bawaan:
  - ada `q` → skor relevansi
  - ada titik → jarak
  - selain itu → nama
- Pembayaran tidak dipakai di mana pun.
- Harga dibaca dari VIEW `published_tariffs`, dengan tanggal, sumber, dan status verifikasi.
- Celah:
  - Belum ada filter kategori layanan, rentang biaya, maupun rating.
  - Radius dan jarak hanya memakai lokasi utama, padahal sejak Fase 2 profil bisa punya hingga 10 lokasi.
  - Saat urut harga, faskes dengan tarif "tanya" atau tanpa angka dipaksa ke bawah (`NULLS LAST`), tanpa label.

**Web `/cari`**
- Formulir GET (tetap jalan tanpa JavaScript) dengan filter jenis, layanan, dan urutan.
- Belum ada peta hasil, tombol "Dekat saya" (teksnya sudah ada di berkas pesan), radius, kategori, maupun biaya.

**Data dev:** 24 faskes terbit, 197 tarif terbit, 25 layanan, 5 kategori (termasuk `gaya-hidup-sehat` dan `rumah-duka`). Respons API sekitar 0,25 detik, sebagian besar waktu round-trip ke Neon.

## 2. Keputusan desain (rekomendasi saya)

### P1. Filter baru, semuanya parameter opsional (kontrak lama tetap)

| Parameter | Arti |
| --- | --- |
| `category` | Slug kategori layanan. Faskes yang punya tarif terbit di kategori itu. Kategori baru otomatis ikut. |
| `priceMin`, `priceMax` | Rentang biaya dalam rupiah (bilangan bulat). **Wajib bersama `service` atau `category`**, karena "biaya" tanpa layanan tidak bermakna. Cocok bila rentang tarif beririsan dengan rentang filter. |
| `minRating` (1–5), `sort=rating` | Di balik flag `reviews_enabled` (lihat P5). |

Rumus irisan rentang tarif:
- `tetap` dan `paket` = [min, min]
- `rentang` = [min, max]
- `mulai_dari` = [min, ∞)
- `tanya` tidak punya angka, jadi tidak cocok dengan filter biaya.

### P2. Lokasi: titik + radius, atau kota, untuk semua lokasi profil
- Radius dan jarak memakai **lokasi profil terdekat** (`profile_locations`, sudah ada indeks GiST), bukan hanya lokasi utama.
- Filter kota juga cocok dengan kota cabang.
- Kartu hasil mendapat field aditif `nearestLocation {label, address, city}` bila lokasi terdekat bukan lokasi utama.
- Web: tombol **"Dekat saya"** memakai geolokasi browser untuk mengisi `lat`/`lng`. Pilihan radius 1, 3, 5, 10, atau 25 km, dan urut "Jarak terdekat", baru muncul setelah lokasi diketahui.

### P3. Urutan
- **Bawaan tetap relevansi + jarak:**
  - ada `q` → skor relevansi, lalu jarak sebagai pemecah seri bila ada titik (baru)
  - hanya titik → jarak
  - selain itu → nama
- Harga, rating, pembayaran, dan langganan **tidak pernah** masuk urutan bawaan.
- Urut harga dan urut rating hanya dipakai bila pengguna memilihnya, dengan label jelas.

### P4. Tarif yang belum tersedia (perlu keputusanmu, lihat bagian 8)
- **Tanpa urut atau filter harga:** faskes dengan dan tanpa tarif terverifikasi bercampur sesuai urutan bawaan. Kartu tanpa tarif diberi label **"Tarif belum tersedia"**.
  - Tarif `tanya` juga ditampilkan dengan label itu, ditambah "tanyakan ke faskes".
  - Untuk itu, item hasil mendapat field aditif `publishedTariffCount`.
- **Urut harga (rekomendasi A):**
  - Hasil dibagi dua kelompok: yang punya harga diurutkan; yang belum punya harga tampil setelahnya di bawah judul terpisah "Tarif belum tersedia", diurutkan dengan urutan bawaan.
  - Mereka tidak ikut diperingkat sebagai "termurah" atau "termahal".
  - Respons memberi `priceAvailable` per item agar web bisa menaruh pemisah.
- **Filter biaya:** yang tidak punya angka memang tidak cocok dengan filter. Respons memberi `meta.unpricedCount`, jumlah faskes yang cocok dengan filter lain tapi belum punya tarif. Web menampilkan tautan "N faskes lain menawarkan layanan ini tanpa tarif terverifikasi", yang membuka pencarian yang sama tanpa filter biaya.

### P5. Rating (bergantung Fase 6)
- **Rekomendasi:** tabel ringkasan baru `facility_ratings` (`facility_id` PK, `rating_avg numeric(2,1)`, `rating_count int`, `updated_at`).
  - Tabelnya dibuat sekarang dalam keadaan kosong, dan Fase 6 yang mengisinya dari ulasan yang disetujui.
  - Dengan begitu, query, uji, dan UI bisa ditulis sekarang tanpa menebak skema ulasan.
- **Ambang:** rating dianggap ada bila `rating_count ≥ 3` (konstanta `RATING_MIN_COUNT`).
  - `minRating` hanya mencocokkan faskes di atas ambang.
  - `sort=rating`: yang di atas ambang diurutkan rata-rata, lalu jumlah ulasan. Sisanya dikelompokkan seperti P4.
- **Flag OFF** (default di semua environment):
  - `minRating` atau `sort=rating` → 404, seperti fitur flag lain.
  - Web tidak menampilkan kontrol rating.
  - Web membaca flag di server dari env `FEATURE_FLAGS` yang sama, lewat `parseFeatureFlags` dari shared.
- **Alternatif B:** tidak membuat tabel sekarang. Parameter hanya mengembalikan 404 sampai Fase 6. Lebih sedikit kode sekarang, tapi uji dan UI rating tertunda.

### P6. Peta hasil
- Komponen MapLibre baru `ResultsMap` menampilkan penanda **dari respons yang sama** dengan daftar. Filternya identik dengan sendirinya.
- Peta mengikuti halaman yang sedang tampil (maksimal 20 penanda), dengan popup berisi nama, jenis, harga (bila ada), dan tautan.
- Desktop: peta di samping daftar. Ponsel: tombol beralih "Daftar / Peta".
- Hanya dirender bila `MAP_STYLE_URL` diisi. Tanpa JavaScript, halaman tetap berupa daftar.

### P7. Kategori untuk formulir
- Endpoint aditif `GET /v1/service-categories` (slug, nama, jumlah layanan), di-cache seperti `/services`.
- Filter "Jenis" (`type`) tetap ada dan sudah memuat `gaya_hidup` dan `rumah_duka`.

### P8. Performa (target halaman ≤ 3 detik)
- Tetap satu query per pencarian. Hanya `meta.unpricedCount` yang menambah satu query `count` kecil, dan hanya saat filter biaya aktif.
- Indeks yang dipakai semuanya **sudah ada**:
  - `facilities_name_trgm`, `services_name_trgm`
  - `facilities_location_gix`, `profile_locations_location_gix`
  - `tariffs_facility_service_package`, `tariffs_service_status_idx`
- **Tidak ada indeks baru di tabel terbit.** Bila uji EXPLAIN di DB uji menunjukkan perlu (mis. `tariff_versions (tariff_id, effective_from DESC)` untuk VIEW), saya minta izin terpisah.
- Uji EXPLAIN memakai `SET LOCAL enable_seqscan = off` agar terbukti indeksnya **bisa** dipakai walau datanya kecil.

## 3. Skema (migrasi 0007, hanya ke DB dev)

- `CREATE TABLE facility_ratings`, dengan FK ke `facilities` (cascade), CHECK rata-rata 1–5, dan `rating_count ≥ 0`. Tanpa data. (Hanya bila P5 opsi A disetujui.)
- Tidak ada perubahan pada tabel terbit dan tidak ada perubahan VIEW.

## 4. Kontrak API

| Endpoint | Perubahan |
| --- | --- |
| `GET /v1/facilities` | Parameter aditif `category`, `priceMin`, `priceMax`, `minRating`, `sort=rating`. Field item aditif `publishedTariffCount`, `priceAvailable`, `nearestLocation`. `meta.unpricedCount`. |
| `GET /v1/service-categories` | Baru. |

Perubahan perilaku pada parameter lama (perlu izin):
- `radius`, `sort=distance`, dan `distanceM` memakai lokasi terdekat, bukan hanya lokasi utama.
- `city` juga cocok dengan kota cabang.
- Saat ada `q` dan titik, jarak menjadi pemecah seri.
- Saat urut harga, yang tanpa harga dikelompokkan setelahnya (P4). Posisinya di bawah tetap seperti sekarang, tapi kini diberi tanda.

## 5. Web

- `/cari`:
  - Filter kategori, rentang biaya (min/maks rupiah, aktif bila layanan atau kategori dipilih), dan "Dekat saya" + radius.
  - Rating hanya bila flag ON.
  - Urutan "Jarak terdekat" bila lokasi diketahui.
  - Label "Tarif belum tersedia", pemisah kelompok harga, tautan `unpricedCount`.
  - Peta hasil.
- Komponen baru:
  - `components/search/results-map.tsx`
  - `near-me-button.tsx` (client, geolokasi)
  - `price-range-fields.tsx`
- Helper murni `lib/search-params.ts`: membangun dan membersihkan parameter (mis. membuang filter biaya bila tidak ada layanan atau kategori), lengkap dengan uji unit.
- Teks baru di `messages/id.ts`. Semua teks lolos aturan M17; tidak ada kata "termurah" maupun "terbaik". Label urut harga tetap "Harga naik" dan "Harga turun".

## 6. Uji

**Unit (shared, web)**
- Validasi skema: `priceMin ≤ priceMax`, biaya tanpa `service`/`category` → 400, rating 1–5.
- Helper parameter pencarian.
- Rumus irisan rentang harga.

**Integrasi API (`fase3-search.test.ts`)**
- Setiap filter sendiri dan dalam kombinasi:
  - kategori + kota + biaya
  - layanan + radius + urut jarak
  - kategori baru `gaya-hidup-sehat`
- Lokasi cabang: profil dengan cabang di dalam radius ikut muncul, `distanceM` diambil dari cabang, dan `nearestLocation` terisi.
- Tarif belum tersedia:
  - faskes tanpa tarif tetap muncul pada urutan bawaan, di posisi yang sama dengan bila ia punya tarif
  - tarif `tanya` diberi label
  - urut harga mengelompokkan
  - `unpricedCount` benar
- Rating:
  - flag OFF → 404
  - flag ON dengan baris `facility_ratings` → filter dan urut rating berfungsi, ambang `RATING_MIN_COUNT` berlaku
  - rating tidak mengubah urutan bawaan
- **Regresi urutan (eksplisit):**
  - Simpan urutan untuk semua opsi urut pada data uji tetap.
  - Lalu ubah setiap atribut "komersial" yang ada sekarang: status mitra, keanggotaan, jumlah media, permintaan harga menunggu, klaim, dan rating di luar `sort=rating`.
  - Urutan harus identik.
  - Ditambah uji statis: SQL pencarian tidak menyebut `subscription`, `payment`, atau `plan`.
  - Fase 11 memperluas uji ini dengan baris langganan sungguhan.
- Kursor: halaman 1 + halaman 2 = hasil tanpa kursor, tanpa duplikat, dengan filter aktif.
- Kompatibilitas: parameter lama memberi hasil yang sama seperti sebelumnya pada data tanpa cabang.
- EXPLAIN: query `q`, radius, dan layanan memakai indeks trigram, GiST, dan tarif.

## 7. Risiko

- **Pengelompokan "tarif belum tersedia" saat urut harga** tetap menaruh kelompok itu setelah yang berharga. Ini kompromi yang menurut saya paling jujur, karena tanpa angka tidak ada posisi harga yang benar. Opsi lain ada di bagian 8.
- **Jarak ke lokasi terdekat** membuat query sedikit lebih berat (subquery `min(ST_Distance)` per profil). Dengan maksimal 10 lokasi per profil dan indeks GiST, saya perkirakan aman. Uji EXPLAIN dan pengukuran di DB uji menjadi penentunya.
- **Geolokasi browser** butuh izin pengguna. Bila ditolak, pesan singkat tampil dan pencarian tetap memakai kota.

## 8. Yang butuh keputusan atau izinmu

1. **P4, posisi faskes tanpa tarif saat urut harga.**
   - A (rekomendasi): kelompok terpisah berlabel setelah yang berharga.
   - B: disembunyikan saat urut harga, ditampilkan sebagai tautan jumlah seperti pada filter biaya.
2. **P5, rating.**
   - A (rekomendasi): tabel `facility_ratings` sekarang, kosong, diisi Fase 6.
   - B: hanya parameter ber-flag (404) sampai Fase 6.
3. **Migrasi 0007** (tabel baru `facility_ratings`) ke DB dev.
4. **Perubahan perilaku parameter lama** di bagian 4: radius, jarak, dan kota memakai semua lokasi profil; jarak sebagai pemecah seri; pengelompokan saat urut harga.
5. **Endpoint aditif** `GET /v1/service-categories`, serta field dan meta aditif pada `GET /v1/facilities`.

Tidak ada dependensi baru: MapLibre dan geolokasi browser sudah tersedia. Tidak menyentuh auth atau otorisasi.
