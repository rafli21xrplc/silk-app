# Memindahkan database Neon ke Singapura (ap-southeast-1)

## Kenapa

Database saat ini berada di **AWS us-east-2 (Ohio)**, sedangkan API berjalan di Vercel `sin1` (Singapura)
dan pengguna ada di Indonesia. Setiap query harus menyeberang Pasifik.

Hasil pengukuran di dev (November 2026, dari Indonesia):

| Yang diukur                                 | Waktu         |
| ------------------------------------------- | ------------- |
| Satu round-trip query (`/v1/health`)        | ±250–340 ms   |
| Detail faskes (2 round-trip berurutan)      | ±510 ms       |
| Membuka koneksi baru (TLS + SCRAM)          | ±1,5 detik    |

Perkiraan setelah pindah ke `ap-southeast-1` (satu region dengan Vercel `sin1`): satu query **±1–5 ms**
di produksi dan **±20–40 ms** dari laptop di Indonesia. Kode sudah dirapikan agar sesedikit mungkin
round-trip; sisa lambatnya murni jarak.

Neon **tidak bisa mengubah region project yang sudah ada**. Jalannya: buat project baru di Singapura,
pindahkan data, lalu ganti connection string.

## Yang perlu disiapkan

- Akses ke dashboard Neon dan Vercel (project API).
- `pg_dump`/`pg_restore` **versi 18** (server memakai PostgreSQL 18.6; versi 16 bawaan Homebrew akan
  menolak dump):

  ```bash
  brew install postgresql@18
  PG=/opt/homebrew/opt/postgresql@18/bin
  $PG/pg_dump --version   # harus 18.x
  ```

- Hentikan dev server (`pnpm dev`) selama pemindahan agar tidak ada tulisan baru ke database lama.

## Langkah (database dev)

### 1. Buat project baru di Singapura

Di dashboard Neon: **New project**:

- **Region:** AWS Asia Pacific 1 (Singapore), `aws-ap-southeast-1`
- **Postgres version:** 18 (samakan dengan yang lama)
- Nama database bawaan: `neondb`

Lalu buat database untuk uji integrasi (cukup kosong; uji menjalankan migrasinya sendiri) dari SQL Editor:

```sql
CREATE DATABASE silk_test;
```

Catat dua connection string dari tombol **Connect**: yang **pooled** (host berakhiran `-pooler`) dan
yang **direct/unpooled**.

### 2. Salin data

Pakai URL **unpooled** (direct) untuk dump dan restore:

```bash
OLD='postgresql://...@ep-lama.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require'
NEW='postgresql://...@ep-baru.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'

$PG/pg_dump --format=custom --no-owner --no-privileges "$OLD" -f silk-dev.dump
$PG/pg_restore --no-owner --no-privileges --dbname "$NEW" silk-dev.dump
rm silk-dev.dump   # berisi data akun; jangan disimpan atau di-commit
```

Catatan:

- Ekstensi (postgis, pg_trgm, unaccent, citext) ikut dibuat ulang oleh restore.
- Trigger append-only `tariff_versions` hanya menolak UPDATE/DELETE, jadi restore (COPY) aman.
- Riwayat migrasi Drizzle ikut tersalin, jadi `db:migrate` berikutnya tidak menjalankan ulang migrasi lama.

**Alternatif tanpa pg_dump** (data dev bisa dibuat ulang): arahkan `.env` ke project baru (langkah 3),
lalu:

```bash
corepack pnpm --filter @silk/db db:migrate
corepack pnpm --filter @silk/db db:seed:demo
corepack pnpm --filter @silk/api create-admin -- --email <email> --name "<nama>"
```

Akun lama tidak ikut, jadi admin perlu mendaftarkan ulang autentikasi dua langkah di `/admin/mfa`.

### 3. Ganti connection string

Di `.env` lokal:

| Variabel                | Isi                                             |
| ----------------------- | ----------------------------------------------- |
| `DATABASE_URL`          | URL **pooled** project baru (`…-pooler…/neondb`) |
| `DATABASE_URL_UNPOOLED` | URL **direct** project baru (`…/neondb`)         |
| `TEST_DATABASE_URL`     | URL project baru dengan database `silk_test`     |

Lalu jalankan ulang `pnpm dev`.

### 4. Periksa

```bash
# Jalankan beberapa kali; yang pertama membuka koneksi.
curl -s -o /dev/null -w '%{time_starttransfer}\n' http://localhost:4000/v1/health
curl -s -o /dev/null -w '%{time_starttransfer}\n' http://localhost:4000/v1/facilities/rs-contoh-sukun
```

Target dari Indonesia: health di bawah ±100 ms (sebelumnya ±300 ms). Pastikan juga bisa masuk ke `/admin`
dan data demo tampil di `/cari`.

### 5. Bersihkan

Setelah beberapa hari tanpa masalah, hapus project lama di Neon.

## Produksi / staging

Langkahnya sama, ditambah:

1. Lakukan pada jendela pemeliharaan; matikan sementara Vercel Cron dan penulisan data (portal/admin)
   agar tidak ada data yang tertinggal di database lama selama dump.
2. Ganti `DATABASE_URL` dan `DATABASE_URL_UNPOOLED` di **Vercel → project API → Settings → Environment
   Variables** (Production dan Preview). Bila integrasi Neon–Vercel terpasang, perbarui lewat integrasi
   itu agar tidak ditimpa.
3. Redeploy project API, lalu periksa `/v1/health` dan log.

Pemindahan produksi dikerjakan pemilik sistem, bukan otomatis (lihat CLAUDE.md: migrasi tidak boleh
dijalankan ke staging/produksi oleh agen).
