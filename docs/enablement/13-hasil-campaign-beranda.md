# Hasil: campaign beranda dan penyegaran SILK Mobile

Cabang: `enablement/usp-rekomendasi`. Tanpa perubahan skema, API, atau dependensi.

## Keputusan (2026-11-14)

- Campaign adalah **konten SILK sendiri**: edukasi kesehatan, fitur SILK, dan ajakan jadi mitra.
  Tidak ada promo berbayar mitra, tidak ada label "Dipromosikan", dan campaign tidak menyebut mitra tertentu.
  Campaign tidak pernah memengaruhi urutan hasil (aturan mutlak 1).
- Campaign disimpan sebagai **berkas konfigurasi** `packages/shared/src/campaigns.ts` (`CAMPAIGNS`,
  `activeCampaigns(now)`), dipakai web dan mobile. Mengubah campaign = ubah daftar lalu deploy.
  Rentang tayang opsional (`startsAt`, `endsAt` eksklusif, UTC).

## Uji

- `packages/db/seed/campaigns.test.ts`: teks lolos filter konten M17 (`CONTENT_RULES`), ID unik, tautan internal,
  slug layanan yang dituju ada di seed, rentang tayang.
- `MOBILE/src/lib/campaigns.test.ts`: tujuan mobile, penyaringan tanggal, foto ilustrasi ada, rute ada.

## SILK Mobile (beranda)

- Kepala hijau bergradasi: logo, chip wilayah "Kota & Kab. Malang", sapaan "Mau cek apa hari ini?", tagline,
  dan kotak cari besar yang menimpa tepi bawah kepala. Warna bilah status ponsel ikut hijau di beranda.
- Grid layanan 4 × 2 dengan ikon bulat berwarna: Dokter, Cek lab, MCU, Rawat inap, Apotek, Terdekat,
  Gaya hidup, Lainnya (`SERVICE_SHORTCUTS` di `src/lib/home.ts`). Menggantikan ubin foto kategori.
- Karusel campaign (`src/components/campaign-carousel.tsx`): geser dengan snap, banner berikutnya mengintip,
  titik indikator yang bisa diklik, berganti otomatis tiap 5 detik. Berhenti saat disentuh, disorot, difokus,
  tab disembunyikan, atau lewat tombol jeda; tidak berganti otomatis bila "kurangi gerak" aktif.
  ARIA: `aria-roledescription="carousel"`, tiap banner "1 dari 6".

## Web (desktop)

- Deret "Info dari SILK" di bawah hero (`components/home/campaign-rail.tsx`): 3 banner terlihat di desktop,
  2 di tablet, 1 + intip di ponsel; tombol sebelumnya/berikutnya, nonaktif di ujung. Tidak berganti otomatis.
- Beranda web memakai ISR 1 jam, jadi campaign bertanggal bisa muncul/hilang paling lambat 1 jam setelah batasnya.

## Pemeriksaan

- typecheck dan lint bersih (api, web, shared, db, mobile).
- Uji: shared 188, web 360, mobile 415, db campaign 8.
- Browser: mobile 390 px dan web 1366/390 px tanpa luapan horizontal, tanpa galat konsol baru;
  karusel berganti otomatis, berhenti saat dijeda, titik dan tombol berfungsi.
