# Hasil: fitur SILK versi lama ke versi terbaru (web + mobile)

Sumber: https://silk-care-gamma.vercel.app (dipelajari 2026-11-14). Lingkup disetujui: hanya fitur tanpa perubahan
skema, plus harga langganan mitra mengikuti versi lama (lihat `11-hasil-fase-11.md`).

## Dikerjakan

| Versi lama | Web (apps/web) | Mobile (MOBILE) |
|---|---|---|
| Bar "Punya klinik atau apotek? Daftar mitra" | `PartnerBar` di atas header, bisa ditutup (disimpan per peramban), tidak tampil di /mitra, /portal, /admin, /akun | Kartu "Jadi mitra" di beranda |
| Menu "Jadi mitra", /mitra/daftar, /mitra/harga | `/mitra`: jenis mitra, langkah bergabung, harga (bila `subscriptions_enabled`); `/mitra/harga` → `/mitra#harga`; menu header dan kolom footer "Untuk mitra" | `/mitra` dengan harga (flag yang sama) dan tombol Daftar ke situs web (`SILK_WEB_ORIGIN`); tautan dari Info |
| /daftar per jenis mitra | `/daftar?jenis=<tipe>` memilihkan jenis akun | lewat situs web |
| Ubin kategori di beranda | 8 ubin: dokter, RS, klinik, puskesmas, lab, apotek, gaya hidup sehat, artikel | sudah ada (bento berfoto) |
| Konsultasi spesialis | 6 spesialisasi dengan dokter terbanyak → `/dokter?specialty=` | baris chip di beranda |
| Kartu dokter "Hari ini 09.00–13.00" | kartu dokter di beranda (dihitung di peramban, WIB) | sudah ada (sesi terdekat) |
| Layanan di sekitar Anda (peta) | peta faskes di beranda bila `NEXT_PUBLIC_MAP_STYLE_URL` diisi | tidak (perlu dependensi peta baru); "Faskes terdekat" tetap ada |
| Cari fasilitas per jenis | formulir jenis di beranda; chip jenis di `/cari`; `/fasilitas` → `/cari` | chip jenis di `/cari` |

## Tidak dikerjakan (bertentangan dengan aturan SILK)

- "Promo hari ini / Dipromosikan": promosi berbayar; aturan mutlak 1 dan Fase 11 melarang penandaan khusus.
- "Fasilitas pilihan, penilaian terbaik": kata "terbaik" ditolak filter M17 dan rating bukan dasar urutan.
- Diskon, "Terjual", keranjang, Beli, Unggah resep: Fase 9B, menunggu gate hukum farmasi.
- Ikuti penulis, suka, komentar artikel: fitur sosial baru dengan risiko moderasi.

## Belum dikerjakan (perlu perubahan skema; butuh izin)

- Jenis faskes baru: fisioterapi, radiologi, ambulans, pijat/wellness (enum `facility_type`).
- Katalog apotek (Fase 9A, flag `pharmacy_catalog_enabled`).
- Lama pengalaman dokter.
- Topik/tag artikel (artikel belum punya kolom topik).

## Pemeriksaan

- typecheck dan lint bersih (shared, db, api, web, mobile).
- Uji: shared 188, api 270, web 357, mobile 395.
- Browser (desktop 1366 px dan ponsel 390 px): tanpa luapan horizontal; ubin, spesialisasi, jadwal hari ini, peta,
  chip jenis, pengalihan `/fasilitas` dan `/mitra/harga`, `?jenis=` di `/daftar`, harga di `/mitra`.
