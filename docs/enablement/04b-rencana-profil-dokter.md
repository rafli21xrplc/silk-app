# Rencana Fase 4b: profil dan pencarian dokter (tambahan)

Branch `enablement/fase-4b-dokter` (dari `enablement/fase-5`, agar memuat perbaikan halaman faskes `83a9c3b`). Status: **menunggu persetujuan**.

Fase ini tidak ada di `prompt-enablement.md`. Ia ditambahkan atas permintaan karena SRS menempatkan SILK sebagai "media promosi digital bagi tenaga medis … khususnya dokter muda" (bab 1). Ia juga menutup bagian F-02 (profil tenaga medis dengan foto, deskripsi, lokasi, jadwal praktik, dan video) dan F-03 (mencari tenaga medis) yang belum tampil di sisi publik. Lingkup yang disetujui adalah Tahap A (halaman dokter lengkap) dan Tahap C (daftar dan pencarian dokter), dikerjakan sebelum Fase 5. Tahap B (pendidikan, pengalaman, bahasa) menyusul dan butuh perubahan skema.

## 1. Kondisi sekarang

**Halaman `/dokter/[slug]`** hanya menampilkan nama, spesialisasi, nomor STR, dan daftar nama faskes. Halaman ini hanya bisa dicapai dari halaman faskes; tidak ada daftar atau pencarian dokter.

**Data yang sudah ada tetapi belum dipakai halaman dokter**
- **`practitioners`:** `slug`, `name`, `specialty` (teks bebas), `str_no`, `str_verified_at`, `status`.
- **`facility_practitioners`:** tempat dokter berpraktik.
- **Dokter mitra (`tenaga_medis`, Fase 2):**
  - `partners.practitioner_id` menautkan akun mitra ke praktisinya.
  - Profil praktik sendiri adalah baris `facilities`, biasanya bertipe `praktik_dokter`. Profil ini punya deskripsi, telepon, situs, lokasi (`profile_locations`), jadwal, foto dan video yang disetujui, serta tarif terbit.
- **`schedules.practitioner_id`:** jadwal praktik dokter di faskes lain.
- **Artikel mitra (Fase 4):** artikel penulis tenaga medis sudah menautkan ke `/dokter/<slug>`.

**Aturan tampil sekarang** (`findPublishedPractitioner` dan sitemap): praktisi `terbit`, dan untuk sitemap juga tertaut ke minimal satu faskes `terbit`.

## 2. Keputusan desain (rekomendasi saya)

### D1. Satu aturan "dokter tampil publik"

Dokter tampil bila `practitioners.status = 'terbit'` **dan** tertaut ke minimal satu faskes `terbit`. Aturan ini ditulis sekali sebagai fragmen SQL di repo, lalu dipakai untuk detail, daftar, dan sitemap. Sitemap sudah memakai aturan yang sama; detail saat ini belum mensyaratkan faskes terbit, dan akan diseragamkan.

### D2. "Profil praktik utama" dokter

Sumber foto, deskripsi, kontak, video, dan tarif adalah profil praktik utama. Urutan penentuannya:
1. Faskes `terbit` yang tertaut ke praktisi **dan** dikelola akun mitra yang `practitioner_id`-nya adalah praktisi ini. Ini profil yang dibuat dokter sendiri di portal.
2. Bila tidak ada (dokter dari data faskes, bukan mitra): faskes `terbit` bertipe `praktik_dokter` yang tertaut, dipilih yang pertama menurut nama.
3. Bila tetap tidak ada: bagian foto, tentang, kontak, video, dan tarif tidak ditampilkan; hanya tempat praktik dan jadwal.

Hanya data yang sudah disetujui moderator yang dipakai: media `disetujui`, profil `terbit`, dan revisi yang sudah diterapkan. Revisi yang masih menunggu tidak bocor, karena halaman membaca data yang sama dengan halaman faskes publik.

### D3. Foto dokter

Belum ada kolom "foto profil dokter". Saya pakai **foto pertama** (menurut urutan galeri) dari media profil praktik utama yang sudah disetujui. Dokter mengatur foto mana yang pertama lewat fitur urutkan media di portal, yang sudah ada sejak Fase 2. Di portal saya tambahkan petunjuk: "Foto pertama dipakai sebagai foto profil Anda." Tanpa foto, yang tampil inisial nama.

Alternatifnya adalah kolom `photo_media_id` khusus, tetapi itu mengubah skema tabel terbit; usulan ini masuk Tahap B.

### D4. Isi halaman `/dokter/[slug]`

1. **Bagian atas**
   - foto, nama, spesialisasi
   - lencana **"STR terverifikasi"** (dengan tanggal) dan **"Mitra terverifikasi SILK"** (status mitra `verified`)
   - kota praktik
   - tombol **Telepon**, **WhatsApp**, dan **Situs** dari profil utama, memakai `ContactLinks` yang sudah ada
   - tombol **Bagikan**
2. **Tentang:** deskripsi profil utama.
3. **Video perkenalan:** video disetujui dari profil utama.
4. **Jadwal praktik**, dikelompokkan per tempat:
   - profil utama: semua jadwalnya
   - faskes lain: hanya jadwal dengan `practitioner_id` dokter ini
   - per hari, dengan zona waktu (WIB/WITA/WIT), memakai helper `groupByWeekday`/`formatTimeRange` yang sudah ada
5. **Tempat praktik:** kartu per faskes (nama, tipe, alamat lokasi, tautan ke halaman faskes) dan peta semua titik (MapLibre, dimuat saat terlihat seperti di `/cari`).
6. **Layanan dan tarif:** tarif terbit profil utama, dengan tampilan, tanggal berlaku, sumber, lencana verifikasi, dan riwayat yang sama dengan halaman faskes. Diurutkan per nama layanan, bukan per harga.
7. **Artikel oleh dokter ini:** maksimal 6 artikel mitra yang tampil publik, terbaru dulu.
8. **Ulasan:** tidak tampil selama flag `reviews_enabled` mati. Field `rating` disiapkan (`null`) untuk Fase 6.
9. **Disclaimer:** "Informasi profil disampaikan oleh dokter atau faskes dan ditinjau tim SILK. SILK tidak memberi peringkat dokter." Teks ini lolos M17.

**SEO**
- Meta deskripsi dari spesialisasi, kota, dan tempat praktik.
- JSON-LD `Physician` dengan `image`, `medicalSpecialty`, `address`, `telephone`, dan `worksFor`.
- Tetap `revalidate` 1 jam dengan tag `practitioner:<slug>`.

### D5. Daftar dan pencarian `/dokter`

**Filter**
- `q`: nama atau spesialisasi, mencocokkan sebagian kata
- `specialty`: dari daftar spesialisasi yang ada
- `city`: cocok dengan kota faskes atau lokasi cabang tempat praktik
- "Dekat saya" dengan radius 1/3/5/10/25 km, memakai komponen `NearMeButton` dari Fase 3

**Urutan** (netral, tidak pernah berdasarkan pembayaran atau langganan)
- ada `q` → relevansi, lalu nama
- ada titik → jarak ke tempat praktik terdekat
- selain itu → nama
- pemecah seri: `slug`
- pilihan pengguna: "Nama A–Z" dan "Jarak terdekat" (yang terakhir bila lokasi aktif)

**Kartu dokter**
- foto atau inisial, nama, spesialisasi
- lencana STR dan mitra terverifikasi
- maksimal 2 tempat praktik dan kota
- jarak, bila lokasi aktif
- penanda "Ada video perkenalan" dan "Jadwal tersedia"

**Navigasi**
- Kursor "Halaman berikutnya" seperti `/cari`.
- Validasi parameter seperti Fase 3: radius dan urut jarak hanya bila ada lat/lng, nilai tak dikenal → 400.
- Menu header dan footer mendapat **"Dokter"**.
- `/cari` mendapat tautan "Cari dokter".
- Halaman faskes menampilkan dokternya sebagai kartu (foto, spesialisasi), bukan sekadar daftar nama.
- Sitemap memuat `/dokter`.

**Spesialisasi** masih teks bebas, jadi variasi seperti "Sp.PK" dan "Patologi klinik" terhitung berbeda. Daftar filter diambil dari nilai yang ada, digabung tanpa membedakan huruf besar/kecil. Normalisasi ke daftar baku masuk Tahap B.

### D6. Revalidate

Halaman dokter ikut diperbarui saat datanya berubah. Revalidate yang sudah ada untuk faskes ditambah tag `practitioner:<slug>` dan `practitioners` untuk semua dokter yang tertaut ke faskes itu. Tempatnya:
- revisi profil disetujui
- media disetujui atau dihapus
- status faskes diubah admin
- impor tarif
- permintaan harga disetujui
- artikel mitra disetujui atau ditarik
- status mitra berubah

Ini satu helper `revalidatePractitionersOfFacility(facilityId)`, mengikuti pola `revalidatePartnerArticles`.

## 3. Skema

**Tidak ada migrasi.** Semua data sudah ada.

Pencarian `q` memakai `ILIKE` dan `similarity()` pada `practitioners.name` dan `specialty` tanpa indeks trigram. Tabel ini kecil (puluhan sampai ribuan baris). Bila nanti lambat, indeks trigram bisa ditambah dengan migrasi terpisah.

## 4. Kontrak API (semuanya aditif)

**`GET /v1/practitioners/:slug`**: field lama tetap, ditambah:

```
verification: { str: boolean, partner: boolean }
photo: { url, caption } | null
about: string | null
contact: { phone, website } | null
video: { url, mime, durationSec, caption } | null
practices: [{ facility: { slug, name, type, city }, isPrimary: boolean,
              locations: [{ label, address, city, lat, lng, isPrimary }],
              schedules: [{ kind, weekday, start, end, timezone, note }] }]
tariffs: PublicTariff[]          // dari VIEW published_tariffs, profil utama saja
articles: [{ slug, title, summary, publishedAt }]   // maks. 6
rating: null                     // Fase 6
```

**Endpoint baru**
- `GET /v1/practitioners?q&specialty&city&lat&lng&radius&sort=relevance|name|distance&cursor&limit` → `{ data: PractitionerListItem[], meta: { nextCursor } }`
- `GET /v1/practitioner-specialties` → `[{ name, count }]`

**Lainnya**
- `docs/openapi.json` diperbarui.
- Batas tarif terbit tetap hanya dari VIEW `published_tariffs`; tidak diduplikasi.
- Semua query di `*.repo.ts` modul `m1-directory`, supaya uji statis "urutan tanpa pembayaran" dari Fase 3 ikut menjaganya. Uji itu saya perluas ke berkas repo baru bila ada.

## 5. Web

- `app/dokter/page.tsx`: daftar, filter, dan kartu (`components/doctor-card.tsx`); helper `lib/doctor-search-params.ts` mengikuti pola `search-params.ts`.
- `app/dokter/[slug]/page.tsx`: ditulis ulang sesuai D4. Komponen jadwal, tarif, dan peta dari halaman faskes diekstrak menjadi komponen bersama bila perlu, tanpa mengubah tampilannya.
- `app/faskes/[slug]/page.tsx`: bagian dokter menjadi kartu.
- Header, footer, `/cari`, sitemap: tautan "Dokter".
- Portal media: petunjuk foto pertama (D3), khusus mitra `tenaga_medis`.
- Teks di `messages/id.ts` (`t.doctors.*`). Desktop dan ponsel 390 px tanpa geser mendatar.

## 6. Data demo (DB dev)

Kedua dokter contoh saat ini hampir kosong. Ke seed demo (`db:seed:demo`, idempoten) saya tambahkan **dua dokter fiktif lengkap**:
- satu dengan profil praktik sendiri (`praktik_dokter`): deskripsi, kontak, 2 lokasi, jadwal, dan beberapa tarif
- satu yang berpraktik di dua klinik contoh dengan jadwal ber-dokter

Foto dan video tidak di-seed karena perlu berkas di penyimpanan. Tampilan dengan media diuji lewat unggah manual di portal dan lewat uji integrasi. Nama memakai pola "dr. Contoh …" seperti data yang ada, dengan nomor STR fiktif yang jelas palsu.

## 7. Uji

**API integrasi** (`apps/api/test/fase4b-doctors.test.ts`)
- **Detail:**
  - semua field terisi untuk dokter mitra dengan profil lengkap
  - dokter tanpa mitra memakai cadangan `praktik_dokter`
  - dokter tanpa profil utama → bagian opsional `null` atau kosong
- **Tidak bocor:**
  - praktisi `draft`, atau semua faskesnya belum terbit → 404
  - media `menunggu`/`ditolak` tidak tampil
  - revisi profil yang menunggu tidak tampil
  - tarif hanya dari `published_tariffs` (layanan nonaktif tidak tampil)
  - artikel `pending`/ditarik tidak tampil
  - mitra dicabut → lencana mitra `false`
- **Daftar:**
  - filter `q`, `specialty` (tanpa beda huruf), `city` (termasuk cabang), radius
  - urutan nama, jarak, dan relevansi
  - kursor konsisten tanpa duplikat
  - parameter tidak sah → 400
- **Urutan:** regresi bahwa menambah data langganan atau pembayaran (bila tabelnya ada) tidak mengubah urutan, ditambah uji statis repo.
- **Revalidate:** tag `practitioner:<slug>` terpanggil pada media disetujui, revisi disetujui, dan artikel disetujui.

**Web:** helper parameter `/dokter`, pemilihan profil utama di sisi tampilan (bila ada logika), dan format kartu.

**Smoke di dev:**
- halaman dokter lengkap
- daftar dengan filter
- "Dekat saya"
- screenshot desktop dan ponsel
- `typecheck`, `lint`, `test`, dan `next build`

## 8. Risiko

- **Profil dokter menjadi alat promosi.** Ini memang tujuannya menurut SRS. Batasannya tetap berlaku: teks lolos M17 (tanpa "terbaik", "termurah", atau janji sembuh), semua isi ditinjau moderator, dan tidak ada urutan berbayar.
- **Foto pertama galeri bisa jadi bukan foto wajah** (mis. foto ruang praktik). Petunjuk di portal mengurangi risiko ini. Kolom foto khusus ada di Tahap B.
- **Spesialisasi teks bebas** membuat filter kurang rapi sampai dinormalisasi (Tahap B).
- **Dokter berpraktik di banyak tempat** membuat halaman panjang. Jadwal dan lokasi dikelompokkan per tempat, dan bagian panjang dilipat di ponsel.

## 9. Yang butuh keputusan atau izinmu

1. **Kontrak API aditif** di bagian 4: field baru di detail dokter, serta `GET /v1/practitioners` dan `GET /v1/practitioner-specialties`.
2. **Penyeragaman aturan tampil** (D1). Detail dokter yang semua faskesnya belum terbit kini menjadi 404, sama dengan sitemap.
3. **Foto dokter = foto pertama galeri profil praktik** (D3), tanpa kolom baru.
4. **Data demo fiktif** di seed demo, khusus DB dev (bagian 6).
5. **Menu "Dokter"** di header dan footer.

Tidak ada migrasi, tidak ada dependensi baru, dan tidak menyentuh auth atau otorisasi.

## 10. Belum termasuk (Tahap B dan seterusnya)

- Pendidikan, tahun lulus, lama praktik, bahasa, minat klinis, organisasi profesi, dan kolom foto khusus. Ini butuh perubahan skema dan moderasi.
- Daftar spesialisasi baku dan normalisasi data lama.
- Ulasan dan rating dokter (Fase 6).
- Indeks trigram untuk pencarian dokter, bila diperlukan.
- Janji temu atau booking (di luar SRS saat ini).
