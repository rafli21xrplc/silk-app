# SILK Mobile

Versi ukuran ponsel dari alur publik pasien SILK (beranda, cari faskes, profil faskes, dokter, layanan dan
perbandingan tarif, artikel, metodologi). Dibuat untuk demo: tetap jalan walau API SILK mati.

Stack: Next.js 15 (App Router) + React 19 + TypeScript strict, Tailwind 4, TanStack Query (daftar tak berujung),
vaul (bottom sheet), Zod (skema dari `@silk/shared`), lucide-react. Anggota workspace pnpm `@silk/mobile`.

## Menjalankan

```bash
corepack pnpm install
# API SILK harus jalan (lihat README root). Lalu:
SILK_API_ORIGIN=http://127.0.0.1:4000 corepack pnpm --filter @silk/mobile dev   # http://localhost:3002
```

Build produksi (lebih cepat untuk demo):

```bash
corepack pnpm --filter @silk/mobile build
SILK_API_ORIGIN=http://127.0.0.1:4000 corepack pnpm --filter @silk/mobile start -- -p 3002
```

Dibuka di laptop, aplikasi tampil dalam bingkai ponsel 440 px. Untuk demo di ponsel sungguhan, sambungkan ponsel
ke Wi-Fi yang sama lalu buka `http://<IP-laptop>:3002` (IP: `ipconfig getifaddr en0`). Bisa "Tambahkan ke Layar
Utama" (PWA manifest + ikon).

## Sumber data

| Variabel | Bawaan | Arti |
|---|---|---|
| `SILK_API_ORIGIN` | `http://127.0.0.1:4000` | API publik SILK (dibaca dari server Next, bukan peramban) |
| `SILK_API_TIMEOUT_MS` | `3500` | Batas waktu per permintaan sebelum beralih ke data cadangan |
| `SILK_DEMO_ONLY` | kosong | `1` = tidak memanggil API sama sekali, selalu data cadangan |

- Setiap respons API divalidasi dengan skema Zod `@silk/shared`.
- API mati, lambat, 5xx, atau respons tidak lolos skema → data cadangan `src/demo/snapshot.json`, dengan banner
  "Mode demo" di layar. 404 tetap berarti tidak ditemukan. Status koneksi terlihat di tab **Info**.
- Filter, urutan (nama, harga, jarak) dan halaman pada data cadangan meniru API. Urutan tidak pernah memakai data
  pembayaran atau langganan.

Memperbarui data cadangan dari API yang sedang jalan (hanya data seed demo, tanpa media):

```bash
SILK_API_ORIGIN=http://127.0.0.1:4000 corepack pnpm --filter @silk/mobile snapshot
```

## Struktur

```
src/app/            halaman (server component) + route handler BFF /api/faskes, /api/dokter
src/components/     UI (bottom nav, sheet, kartu, filter, daftar tak berujung)
src/lib/silk/       fetchApi + cadangan (source.ts), API bertipe (api.ts), pencarian demo (demo.ts)
src/lib/            parsing parameter, format harga/tanggal, kontak, ringkasan
src/messages/id.ts  semua teks UI (lolos filter konten M17, diuji)
scripts/snapshot.ts pembuat data cadangan
```

## Pemeriksaan

```bash
corepack pnpm --filter @silk/mobile typecheck
corepack pnpm --filter @silk/mobile lint
corepack pnpm --filter @silk/mobile test
```
