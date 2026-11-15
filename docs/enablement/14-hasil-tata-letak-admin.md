# Hasil: tata letak admin dan portal baru, pencarian daftar

Cabang: `enablement/usp-rekomendasi`. Keputusan pengguna (2026-11-14): tambah `q` di API (aditif), dashboard dari
data yang sudah ada (tanpa grafik deret waktu), kerangka baru untuk admin **dan** portal mitra.

## Kerangka (components/app-shell.tsx)

- Sidebar penuh tinggi: logo, tombol "Cari menu" (Ctrl/⌘ K), menu berkelompok dengan ikon
  (Utama, Moderasi, Data dan konten, Sistem, Portal mitra, Akun), kartu pengguna + keluar di bawah.
- Bisa diciutkan jadi ikon saja (diingat per browser, `localStorage`), di ponsel jadi laci menu.
- Angka antrean menunggu di menu admin (Moderasi, Klaim, Tarif, Laporan, Impor) dari `GET /admin/overview`.
- Topbar: nama area + judul halaman (= menu aktif), "Lihat situs", inisial pengguna.
- Navbar dan footer situs disembunyikan di `/admin`, `/portal`, `/akun` (kecuali `/admin/mfa`).

## Dashboard admin (/admin)

Sapaan dan tanggal, 4 kartu angka dengan "Lihat detail", grafik batang antrean (9 antrean, urutan tetap,
setiap baris tautan ke antreannya), aktivitas terbaru dari log audit, ringkasan job latar.

## Pencarian dan paginasi

- API: parameter opsional `q` (maks. 100 karakter, cocok sebagian tanpa beda huruf, wildcard di-escape) di
  `/admin/partners`, `/claims`, `/tariffs`, `/reports`, `/imports`, `/tariff-requests`, `/profile-revisions`,
  `/media`, `/articles`, `/reviews`. Klien lama tetap jalan. Uji: `apps/api/test/admin-search.test.ts`.
- Web: kotak cari (`ListSearch`) di setiap daftar admin, mencari otomatis 350 ms setelah berhenti mengetik;
  hasil kosong karena pencarian punya pesan sendiri. Aturan konten disaring di browser (API mengirim daftar utuh).
- Paginasi berkursor yang sudah ada tetap dipakai; filter atau kata kunci berubah = kembali ke halaman 1.

## Perbaikan ikut

Log audit menampilkan waktu "–" karena web membaca `createdAt`, padahal API mengirim `at`. Diperbaiki.

## Pemeriksaan

typecheck dan lint bersih (semua paket); uji api 277, web 374, shared 188. Browser 1440 px dan 390 px:
tanpa luapan horizontal, tanpa galat konsol; pencarian daftar, Ctrl+K, ciutkan sidebar, dan laci ponsel diuji.
