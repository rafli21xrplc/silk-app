# Hasil Fase 4b: profil dan pencarian dokter

Cabang: `enablement/fase-4b-dokter`. Rencana: `04b-rencana-profil-dokter.md` (disetujui).

## Yang dikerjakan

**API (aditif, kontrak lama tidak berubah)**
- `GET /v1/practitioners/:slug` diperkaya: lencana verifikasi (STR, mitra), foto, tentang, kontak,
  video, tempat praktik (lokasi + jadwal per tempat), tarif praktik utama, artikel, `rating: null`.
- `GET /v1/practitioners`: cari `q`, filter `specialty`/`city`, titik + `radius`, urut
  relevansi/jarak/nama, kursor. Tidak ada urutan berdasarkan pembayaran.
- `GET /v1/practitioner-specialties`: daftar spesialisasi dengan jumlah dokter.
- Aturan tampil satu sumber (`publicPractitionerCondition`): dokter `terbit` dan terhubung ke minimal
  satu faskes `terbit`. Dipakai detail, daftar, sitemap, dan tautan penulis artikel.
- Revalidate tag `practitioner:<slug>` dan `practitioners` saat profil, media, jadwal, tarif, impor,
  atau status faskes berubah.

**Web**
- `/dokter/[slug]`: foto/inisial, lencana, nomor STR, kota, Telepon/WhatsApp (hanya nomor HP)/Situs/
  Petunjuk arah, salin tautan, tentang, video, jadwal per tempat praktik, daftar tempat praktik + peta,
  tarif praktik utama, artikel, penafian. JSON-LD `Physician` diperkaya.
- `/dokter`: pencarian, filter spesialisasi dan kota, "Dekat saya", radius, urutan; kartu dokter.
  Halaman dengan filter `noindex`; kanonik `/dokter`.
- Menu "Dokter" di header dan footer; tautan "Cari dokter" di `/cari`; kartu dokter di halaman faskes.
- Portal: petunjuk "foto pertama = foto profil" pada profil bertipe `praktik_dokter`.

**Data demo (dev)**: 2 dokter fiktif (dr. Contoh Rahma Putri, Sp.A; dr. Contoh Bima Pratama), 1 praktik
dokter dengan cabang, jadwal, dan tarif.

## Penyimpangan dari rencana
1. Detail faskes: item `practitioners` mendapat `photoUrl` (aditif).
2. `practices[].facility` mendapat `id` (aditif) agar kartu tarif bisa dipakai ulang.
3. Tautan penulis artikel kini mengarah ke `/dokter/<slug>` bila dokternya tampil publik.
4. Seed demo: ID dokter demo semula bertabrakan dengan data uji (`dc…`), sehingga 4 tautan dokter-faskes
   salah tercatat di DB dev. Sudah dihapus, prefiks diganti `d0`, dan ada uji anti-tabrakan.
   Tarif faskes demo tambahan memakai ruang ID `df` sendiri.
5. Respons cache lama: `withDoctorDefaults` mencegah error seperti kasus halaman faskes sebelumnya.

## Pemeriksaan
- `typecheck` dan `lint` semua paket: bersih.
- Uji unit: shared 155, web 178, db 17, semuanya lulus.
- `next build` produksi: lulus.
- Smoke dev: `/dokter` (+ q, spesialisasi, kota, jarak, kursor), dua profil dokter demo, 404 dokter,
  halaman faskes dengan kartu dokter, `/cari`, `/portal`: semua 200 tanpa galat. Tangkapan layar desktop
  dan 390 px tanpa gulir horizontal.
- **Belum dijalankan:** uji integrasi API `apps/api/test/fase4b-doctors.test.ts` (±17 uji). Uji ini
  mengosongkan database, jadi harus dijalankan pemilik repo ke branch Neon khusus uji:
  `corepack pnpm --filter @silk/api test`.

## Catatan
- Cache data Next bisa menyimpan respons faskes lama sampai TTL 1 jam atau revalidate. Seed yang menulis
  langsung ke DB tidak memicu revalidate.
- Masalah lama yang belum diperbaiki: `loading.tsx` membuat `notFound()` mengembalikan HTTP 200
  (soft 404) di halaman detail.
