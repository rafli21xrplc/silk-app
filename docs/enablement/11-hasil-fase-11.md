# Hasil Fase 11: langganan mitra dengan pembayaran Duitku

Cabang: `enablement/usp-rekomendasi`. Flag: `subscriptions_enabled` (default OFF; OFF = semua endpoint 404,
menu portal tidak tampil). Penyedia pembayaran: Duitku POP, menggantikan Midtrans di spesifikasi
(keputusan 2026-11-14).

## Model harga (diperbarui 2026-11-14, mengikuti SILK versi lama)

- Satu paket 12 bulan, harga per jenis mitra: tenaga medis Rp300.000; fasilitas, apotek, dan gaya hidup sehat
  Rp1.500.000 (`SUBSCRIPTION_PRICES` di packages/shared).
- Masa gratis 6 bulan sejak mitra diverifikasi, dihitung dari `partners.verified_at` (tanpa tabel baru).
- Periode berbayar menyambung dari akhir masa aktif: setelah masa gratis atau periode sebelumnya, bukan memotongnya.
- Pesanan lama berpaket lain (mis. `bulanan` di data dev) tetap terbaca; paket baru yang bisa dipesan hanya `tahunan`.
- Halaman publik `/mitra` (web dan mobile) menampilkan harga hanya bila `subscriptions_enabled` menyala.

## Alur

1. Mitra terverifikasi membuka `/portal/langganan`, memilih paket (bulanan / tahunan).
2. Web memanggil `POST /v1/partners/me/subscription/orders` dengan `{ plan: 'tahunan' }` saja. Harga diambil server
   dari jenis mitra (`SUBSCRIPTION_PRICES`), bukan dari klien.
3. API membuat `payment_orders` (status `pending`, kedaluwarsa 60 menit), menulis audit `payment.created`,
   lalu meminta tagihan ke Duitku POP (`createInvoice`). Klik ganda memakai ulang pesanan terbuka yang sama.
4. Browser diarahkan ke `paymentUrl` Duitku. Mitra membayar (VA, QRIS, e-wallet, dst.).
5. Duitku memanggil `POST /v1/payments/duitku/callback` (form-urlencoded). API memeriksa tanda tangan
   HMAC-SHA256 dan nominal, lalu dalam satu transaksi (kunci baris `FOR UPDATE`): pesanan `paid`,
   periode `subscriptions` ditambahkan (menumpuk dari akhir periode sebelumnya), audit `payment.paid` dan
   `subscription.activated`. Callback ganda tidak menggandakan periode (`payment_order_id` unik).
6. Duitku mengembalikan browser ke `/portal/langganan/<id>`. Halaman ini **mengabaikan parameter URL**
   dan membaca status dari API (polling tiap 4 detik, maks. 2 menit).
7. Cadangan bila callback hilang: `GET` pesanan oleh pemiliknya dan cron `process-queue` memanggil
   `transactionStatus` Duitku secara hemat (maks. 1x/menit per pesanan; cron 10 pesanan per jalan).
   Pesanan tanpa kepastian ditutup `expired` setelah masa berlaku + tenggang; pembayaran yang
   datang terlambat tetap diterima.

Setiap callback (sah, ditolak, rusak) dicatat di `payment_events` untuk penelusuran.

## Mode penyedia

| `DUITKU_*` | Mode | Keterangan |
|---|---|---|
| kosong, bukan produksi | `simulator` | Halaman bayar tiruan `GET /v1/dev/duitku/pay`; tombol "Bayar (berhasil)" mengirim callback bertanda tangan ke handler yang sama. Tanpa uang dan tanpa jaringan. |
| diisi, `DUITKU_ENV=sandbox` | `sandbox` | `api-sandbox.duitku.com`, uang tiruan. |
| diisi, `DUITKU_ENV=production` | `production` | Harus dipilih eksplisit. |
| kosong, produksi, flag ON | — | API menolak start. Simulator tidak pernah terpasang di produksi. |

Portal menampilkan label mode (sandbox/simulator) agar tidak ada yang mengira uangnya ditarik.

## Beralih ke Duitku sandbox

1. Daftar di https://sandbox.duitku.com, buat proyek, salin **Merchant Code** dan **API Key**.
2. Isi di API (Vercel dashboard atau `.env` lokal, jangan komit):
   `DUITKU_MERCHANT_CODE`, `DUITKU_API_KEY`, `DUITKU_ENV=sandbox`.
3. `FEATURE_FLAGS` di API **dan** web memuat `subscriptions_enabled`.
4. Callback harus bisa dijangkau Duitku: `API_ORIGIN` publik (deploy Vercel atau tunnel). Localhost tidak
   menerima callback; tanpa callback, status tetap akan tersusul lewat cek status.
5. `WEB_ORIGIN` benar (dipakai untuk URL kembali).

## Keamanan

- Nominal dari server; callback dengan nominal berbeda ditolak (400) dan dicatat.
- Status hanya berubah lewat callback bertanda tangan atau cek status ke Duitku, tidak pernah lewat URL kembali.
- Pembanding tanda tangan timing-safe. Pesanan `paid` tidak pernah mundur status.
- Endpoint mitra: izin `partner.self` yang sudah ada, mitra harus `verified`, pesanan milik mitra lain = 404,
  CSRF origin seperti endpoint lain, batas 10 pesanan/jam per pengguna.
- **Aturan mutlak 1**: langganan tidak memengaruhi urutan pencarian. Ada uji regresi yang membandingkan
  urutan hasil sebelum dan sesudah mitra berlangganan.

## Skema (migrasi 0011, aditif)

`payment_orders`, `payment_events`, `subscriptions`, enum `payment_status`. Rencana rollback ada di kepala
berkas migrasi. Tabel lama tidak diubah.

## Pemeriksaan

- `typecheck` dan `lint`: bersih (api, web, shared, db).
- Uji: api 270 (termasuk 13 uji `fase11-subscriptions.test.ts`), web 357, shared 188, db 20, mobile 395.
- Duitku sandbox sungguhan (2026-11-14): tagihan dibuat, kartu uji dibayar, status lunas tersusul lewat cek status.
- E2E browser (simulator): masuk → `/portal/langganan` → Bayar → simulator → Lunas → "Aktif sampai …";
  tampilan ponsel 390 px tanpa luapan horizontal.

## Belum dikerjakan / catatan

- Fitur yang dibuka oleh langganan belum ada; fase ini hanya alur bayar dan masa aktif.
- Tanda tangan mengikuti dokumentasi POP (HMAC-SHA256). Bila sandbox menolak, cocokkan ulang dengan
  dokumentasi terbaru Duitku sebelum produksi.
- Gate produksi: akun merchant Duitku produksi, syarat & ketentuan langganan, kebijakan pengembalian dana.
