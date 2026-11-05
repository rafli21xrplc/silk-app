# Hasil Fase 3: pencarian dan filter (F-03)

Branch `enablement/fase-3`. Rencana: `03-rencana-fase-3.md`, disetujui dengan opsi A untuk P4 dan P5, migrasi 0007 ke dev, perubahan perilaku parameter lama, dan endpoint aditif.

## Yang dibuat

**Filter baru di `GET /v1/facilities`** (semuanya opsional; kontrak lama tetap)
- `category`: slug kategori layanan. Cocok bila faskes punya tarif terbit di kategori itu.
- `priceMin` / `priceMax`: rupiah bulat. Wajib bersama `service` atau `category` (bila tidak → 400). `priceMin > priceMax` → 400.
  - Cocok bila rentang tarif beririsan dengan rentang filter: `tetap`/`paket` = [min, min], `rentang` = [min, max], `mulai_dari` = [min, ∞).
  - Tarif `tanya` tidak pernah cocok dengan filter biaya.
- `minRating` (1–5) dan `sort=rating`: di balik flag `reviews_enabled`. Saat flag OFF (default) → 404.

**Lokasi**
- Radius dan jarak memakai lokasi profil **terdekat** (`profile_locations`), dengan cadangan ke lokasi utama.
- Filter kota juga cocok dengan kota cabang.
- Item mendapat `nearestLocation` bila lokasi terdekat adalah cabang.

**Urutan**
- Bawaan:
  - ada `q` → skor relevansi, lalu jarak bila ada titik, lalu nama, lalu id
  - hanya titik → jarak
  - selain itu → nama
- Urut harga: yang punya angka harga diurutkan dulu; yang tidak punya (tanpa tarif atau `tanya`) menyusul sebagai kelompok terpisah dengan urutan bawaan.
- Urut rating: hanya rating dengan minimal `RATING_MIN_COUNT = 3` ulasan yang diperingkat; sisanya menyusul dengan urutan bawaan.
- Pembayaran dan langganan tidak dipakai di query mana pun. Ada uji statis untuk itu.

**Field respons aditif**
- Item: `publishedTariffCount`, `priceAvailable`, `nearestLocation`, `rating` (`null` saat flag OFF atau ulasan kurang dari 3).
- `meta.unpricedCount`: hanya saat filter biaya aktif. Isinya jumlah faskes yang cocok dengan filter lain tetapi tidak punya angka harga.

**Endpoint baru:** `GET /v1/service-categories` → `[{slug, name, serviceCount}]`.

**Performa:** tetap satu query per pencarian, ditambah satu `count` saat filter biaya aktif. Kondisi `q` dan radius ditulis ulang sebagai `f.id IN (… UNION …)` agar indeks trigram dan GiST terpakai. Tidak ada indeks baru. Respons di dev sekitar 0,25 detik, sebagian besar round-trip ke Neon.

**Web `/cari`**
- Filter kategori; daftar layanan menyempit sesuai kategori yang dipilih.
- Rentang biaya (min/maks; menerima "150.000" atau "Rp150.000"). Hanya aktif bila layanan atau kategori dipilih; bila tidak, ada petunjuknya.
- Tombol **"Dekat saya"** memakai geolokasi browser. Setelah lokasi diketahui, muncul pilihan radius (1, 3, 5, 10, 25 km), urutan "Jarak terdekat", dan penanda "Memakai lokasi Anda" dengan tautan "Hapus lokasi". Bila izin ditolak, pesan singkat tampil.
- Rating dan "Rating tertinggi" hanya tampil bila flag menyala. Flag dibaca di server web dari env `FEATURE_FLAGS` yang sama dengan API.
- Saat urut harga, judul pemisah **"Tarif belum tersedia"** muncul sebelum kelompok tanpa harga.
- Saat filter biaya aktif, muncul kotak "N faskes lain menyediakan layanan ini tanpa angka harga…" dengan tautan "Tampilkan tanpa filter biaya".
- Kartu hasil:
  - label "Tarif belum tersedia" bila tidak ada tarif terbit atau tarifnya `tanya`
  - baris "Lokasi terdekat" untuk cabang
  - rating bila ada
- **Peta hasil** (MapLibre): penanda untuk faskes di halaman yang sedang tampil, ditambah titik lokasi pengguna, dengan popup berisi nama, jenis, harga, dan tautan.
  - Desktop: peta menempel di samping daftar.
  - Ponsel: tombol "Lihat peta" / "Lihat daftar" (`view=peta`, berupa tautan biasa).
  - Peta tidak dimuat selama wadahnya tersembunyi, jadi ponsel di tampilan daftar tidak mengunduh MapLibre.
- Formulir tetap GET biasa, jadi filter berjalan tanpa JavaScript. Hanya "Dekat saya" dan peta yang butuh JavaScript.
- Parameter dibersihkan oleh `lib/search-params.ts` sebelum dikirim ke API, agar URL yang tidak valid tidak menghasilkan 400. Contohnya: filter biaya tanpa layanan, urut harga tanpa layanan, radius tanpa titik, atau rating saat flag mati.

## Migrasi 0007

- Berkas: `packages/db/drizzle/0007_fase3_facility_ratings.sql`. Rencana mundur ada di komentar kepala berkas (`DROP TABLE facility_ratings;`).
- Isinya tabel kosong `facility_ratings` (`facility_id` PK dan FK cascade, `rating_avg numeric(2,1)` 1–5, `rating_count ≥ 0`, `updated_at`). Fase 6 yang mengisinya.
- Sudah dijalankan di DB **dev** saja. Belum di staging maupun produksi.

## Penyimpangan dari rencana

- **`price-range-fields.tsx` tidak dibuat.** Isian biaya hanya dipakai di `/cari`, jadi saya tulis langsung di halaman itu.
- **Teks tautan `unpricedCount`** menjadi "N faskes lain menyediakan layanan ini tanpa angka harga, sehingga tidak masuk rentang biaya." Artinya sama dengan rencana, tetapi tidak memakai kata "terverifikasi", karena tarif `tanya` bisa saja sudah terverifikasi.
- **"Dekat saya"** membulatkan koordinat ke 4 desimal (sekitar 11 m) sebelum masuk URL, dan memilih urut "Jarak terdekat" bila pengguna belum memilih urutan.
- **Label urut rating** menjadi "Rating tertinggi" (lolos M17). Label ini hanya tampil saat flag menyala.

## Uji

- **Shared:** 137 lolos, termasuk 6 uji baru untuk skema pencarian dan irisan rentang harga.
- **Web:** 164 lolos, termasuk 7 uji baru `lib/search-params`.
- **Integrasi API `apps/api/test/fase3-search.test.ts` (27 uji), belum saya jalankan sendiri.** Isinya:
  - setiap filter sendiri dan dalam kombinasi
  - cabang dalam radius dan kota cabang
  - pengelompokan saat urut harga dan `unpricedCount`
  - rating dengan flag OFF (404) dan ON (ambang 3 ulasan)
  - **regresi urutan:** urutan untuk semua opsi urut tetap identik setelah status mitra, keanggotaan, media, permintaan harga, klaim, dan rating diubah
  - uji statis bahwa SQL tidak menyebut `subscriptions`, `payments`, `plans`, atau `orders`
  - kursor halaman 1 + 2 sama dengan tanpa kursor
  - kompatibilitas parameter lama dan endpoint kategori
  - EXPLAIN: `q` memakai indeks trigram, radius memakai GiST `profile_locations`, layanan + biaya tanpa seq scan

  Hasil yang diharapkan sudah saya cocokkan dengan fixture yang sama di DB dev, dalam transaksi yang di-rollback.
- `corepack pnpm -r typecheck` dan `corepack pnpm -r lint` bersih.
- **Screenshot `/cari`** (desktop 1280 px dan ponsel 390 px, termasuk tampilan peta ponsel dan pemisah kelompok): tidak ada geser mendatar.

## Langkah manual

1. **Jalankan uji integrasi:** `corepack pnpm --filter @silk/api test`. Uji ini **mengosongkan DB**, jadi pastikan `TEST_DATABASE_URL` mengarah ke branch Neon khusus uji. Uji ini juga membutuhkan migrasi 0007 di DB uji.
2. **Migrasi 0007 ke staging/produksi** hanya setelah uji lolos dan dengan persetujuan.
3. **Mencoba rating di dev:** tambahkan `reviews_enabled` ke `FEATURE_FLAGS` di API dan web, lalu isi `facility_ratings` secara manual. Tanpa itu, kontrol rating memang tidak tampil.

## Commit

- `a4f4833` docs: rencana
- `f2cc64b` shared
- `9722d38` db (migrasi 0007)
- `95bf288` api
- `4faef0c` web
- `d5e7551` perbaikan label kartu
