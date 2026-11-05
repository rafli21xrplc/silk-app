# SILK — panduan untuk Claude Code

## Apa ini
SILK: platform transparansi tarif layanan kesehatan Indonesia. Monorepo pnpm + Turborepo.
- apps/web: Next.js (App Router), apps/api: Express, packages/db: Drizzle + Neon Postgres,
  packages/shared: skema Zod dan util.
Spesifikasi lengkap ada di docs/blueprint-teknis.md dan docs/modul/*.md. Baca modul yang relevan sebelum mengerjakan.

## Perintah
- pnpm install
- pnpm dev            # web:3000, api:4000
- pnpm typecheck && pnpm lint && pnpm test
- pnpm db:generate    # buat migrasi dari skema Drizzle
- pnpm db:migrate     # jalankan migrasi (hanya ke branch dev)
- pnpm db:seed

## Aturan wajib
- TypeScript strict, tanpa `any`. Semua input divalidasi dengan Zod dari packages/shared.
- Query database hanya di *.repo.ts. Controller memanggil service, service memanggil repo.
- tariff_versions append-only: jangan pernah UPDATE/DELETE; ralat = versi baru.
- Uang = integer rupiah (bigint). Waktu = UTC (timestamptz).
- Jangan pernah mengurutkan hasil berdasarkan pembayaran atau langganan.
- Teks publik harus lolos filter konten (M17): tanpa kata "termurah", "terbaik", janji sembuh.
- Setiap perubahan data oleh pengguna terautentikasi menulis audit_logs.
- Jangan commit rahasia. Jangan sentuh .env. Tambah variabel baru ke .env.example.
- Jangan menjalankan migrasi ke staging atau produksi.
- API berjalan di Vercel Functions: tanpa proses latar yang hidup terus, tanpa state di memori antar-request, body maksimal 4,5 MB (unggahan lewat signed URL R2), tulis berkas hanya ke /tmp.
- Job latar harus idempoten dan dipecah per potongan; dipanggil Vercel Cron dengan CRON_SECRET.
- UI berbahasa Indonesia; teks dari berkas pesan.

## Alur kerja
1. Baca spesifikasi modul dan kriteria penerimaannya.
2. Buat rencana singkat, lalu tunggu persetujuan.
3. Tulis uji dulu atau bersamaan; semua kriteria penerimaan punya uji.
4. Jalankan typecheck, lint, test sebelum menyatakan selesai.
5. Commit kecil dengan Conventional Commits; satu PR per modul.

## Yang tidak boleh dilakukan tanpa izin
Mengubah skema tabel yang sudah terbit, menambah dependensi besar, mengubah kontrak API, menyentuh auth/otorisasi.

## Catatan implementasi (repo ini)
- pnpm dijalankan lewat Corepack: `corepack pnpm <perintah>` bila pnpm belum terpasang global.
- Batas tarif terbit didefinisikan sekali di VIEW `published_tariffs` (migrasi 0003, diganti di 0006 untuk `tariffs.active`); jangan menduplikasi logika ini di query lain.
- Harga dari mitra tidak pernah ditulis langsung ke `tariff_versions`: masuk `tariff_change_requests`, lalu versi baru dibuat saat moderator menyetujui (Fase 2).
- Append-only `tariff_versions` ditegakkan trigger DB (migrasi 0002), bukan hanya oleh kode.
- Layanan eksternal (R2, Resend, Turnstile, Sanity, PostHog) memakai adaptor yang tetap jalan tanpa kunci di dev/test:
  penyimpanan lokal di tmpdir dengan signed URL palsu, email ke log/outbox uji, Turnstile dilewati.
- Uji integrasi API (`apps/api/test`) MENGOSONGKAN dan mengisi ulang database yang dipakai
  (`TEST_DATABASE_URL`, atau `DATABASE_URL` bila tidak diisi). Arahkan hanya ke branch Neon khusus uji.
- Bila skema diubah lalu `pnpm db:generate`, periksa SQL: drizzle-kit menulis `"geography(Point, 4326)"`
  dengan tanda kutip; hapus kutipnya.
- Dokumen OpenAPI: `corepack pnpm --filter @silk/api openapi` → docs/openapi.json.
- Drizzle 0.45 membungkus galat Postgres dalam `DrizzleQueryError`; pesan dan kode asli (mis. `23505`, `42501`) ada di `err.cause`.
- Hindari query per baris di loop (impor, seed): database bisa ratusan ms per round-trip. Pakai INSERT/UPDATE massal
  (`jsonb_to_recordset`). Saat menulis kolom enum dari `jsonb_to_recordset`, cast eksplisit (mis. `::entity_status`).
- Jangan menaruh literal angka di ORDER BY (`ORDER BY 0` dibaca sebagai nomor kolom).
